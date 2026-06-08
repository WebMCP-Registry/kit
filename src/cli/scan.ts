import { glob } from 'node:fs/promises'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ToolKind } from '../types.js'

const REWRITABLE_EXTENSION = /\.(js|jsx|mjs)$/
const TS_EXTENSIONS = ['.ts', '.tsx', '.mts']

let resolutionHookRegistered = false

/**
 * `.tools.ts` files written under `"moduleResolution": "bundler"` (or
 * `nodenext` with `verbatimModuleSyntax`) import sibling modules as `./foo.js`
 * — the TypeScript convention where the specifier names the *emitted* file,
 * not the source. Bundlers and `tsc` rewrite this transparently; Node's
 * native TS support does not, so a straight `import()` of such a file fails
 * with `ERR_MODULE_NOT_FOUND` for every relative import.
 *
 * This hook retries an unresolvable `./foo.js` specifier as `./foo.ts` (then
 * `.tsx`/`.mts`), so the CLI can import projects written the conventional way
 * without requiring a build step first — central to "Option A" (run the real
 * `defineTool` code path, not a hand-rolled static analysis of it).
 */
function ensureTsExtensionResolutionHook(): void {
  if (resolutionHookRegistered) return
  resolutionHookRegistered = true

  registerHooks({
    resolve(specifier, context, nextResolve) {
      try {
        return nextResolve(specifier, context)
      } catch (error) {
        const code = (error as { code?: string } | null)?.code
        if (code !== 'ERR_MODULE_NOT_FOUND') throw error
        if (!REWRITABLE_EXTENSION.test(specifier)) throw error

        const base = specifier.replace(REWRITABLE_EXTENSION, '')
        for (const ext of TS_EXTENSIONS) {
          try {
            return nextResolve(`${base}${ext}`, context)
          } catch {
            continue
          }
        }
        throw error
      }
    },
  })
}

/**
 * The contract surface the CLI needs from a tool — a subset shared by both
 * `defineTool`'s `ToolDefinition` (which also carries `execute`, irrelevant
 * here) and `defineToolContract`'s `ToolContract` (which never does). The
 * registry only ever sees this shape; the CLI duck-types on it rather than
 * importing either type, so it works against whatever a project's installed
 * `@webmcp-registry/kit` version actually produces.
 */
export interface ExtractedTool {
  name: string
  description: string
  kind?: ToolKind
  inputSchema: Record<string, unknown>
  sourceFile: string
  exportName: string
}

const TOOL_FILE_GLOB = '**/*.tools.{ts,tsx,mts,js,mjs}'
const IGNORED_DIR_SEGMENTS = new Set(['node_modules', 'dist', 'build', '.next', 'out', '.git'])

/**
 * Finds `*.tools.{ts,tsx,...}` files under `cwd` — the static, Node-importable
 * call sites the `defineTool`/`defineToolContract` convention requires (see
 * `define-tool-contract.ts`'s doc comment for the full rationale).
 */
export async function findToolFiles(cwd: string): Promise<string[]> {
  const matches: string[] = []
  for await (const entry of glob(TOOL_FILE_GLOB, { cwd })) {
    const relative = entry.toString()
    if (relative.split(path.sep).some((segment) => IGNORED_DIR_SEGMENTS.has(segment))) continue
    matches.push(path.resolve(cwd, relative))
  }
  return matches.sort()
}

/**
 * `*.tools.ts` files are documented as browser/React-free (see the
 * `defineTool`/`defineToolContract` convention), so importing one in plain
 * Node should never touch `window`/`document`/`navigator` — but stubbing
 * them defensively turns an accidental reference into a clear, inspectable
 * `undefined` instead of a `ReferenceError` buried in some unrelated
 * dependency's module-scope code.
 */
function stubBrowserGlobals(): () => void {
  const keys = ['window', 'document', 'navigator'] as const
  const previous = new Map<(typeof keys)[number], PropertyDescriptor | undefined>()

  for (const key of keys) {
    // Node defines `navigator` (and sometimes others) as a getter-only
    // accessor — plain assignment throws `TypeError: ... has only a getter`.
    // Redefining the property (and restoring the exact original descriptor
    // afterward) works for both accessor and data properties.
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, {
      value: undefined,
      writable: true,
      enumerable: true,
      configurable: true,
    })
  }

  return () => {
    for (const key of keys) {
      const descriptor = previous.get(key)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete (globalThis as Record<string, unknown>)[key]
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isToolKind(value: unknown): value is ToolKind {
  return value === 'read' || value === 'write' || value === 'action'
}

/**
 * Duck-types a value as the contract surface both `ToolDefinition` and
 * `ToolContract` share. Extra fields (`execute`, `input`) are ignored —
 * the registry never sees them, so the CLI doesn't need to care which of
 * the two produced the value.
 */
function asToolLike(value: unknown): Omit<ExtractedTool, 'sourceFile' | 'exportName'> | undefined {
  if (!isPlainObject(value)) return undefined
  const { name, description, kind, inputSchema } = value
  if (typeof name !== 'string' || !name) return undefined
  if (typeof description !== 'string' || !description) return undefined
  if (!isPlainObject(inputSchema)) return undefined
  if (kind !== undefined && !isToolKind(kind)) return undefined

  return { name, description, kind, inputSchema }
}

function collectFromExport(
  exportName: string,
  value: unknown,
  sourceFile: string,
  out: ExtractedTool[],
): void {
  const direct = asToolLike(value)
  if (direct) {
    out.push({ ...direct, sourceFile, exportName })
    return
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const entry = asToolLike(item)
      if (entry) out.push({ ...entry, sourceFile, exportName: `${exportName}[${index}]` })
    })
  }
}

/**
 * Imports a `.tools.ts` file in-process (Node's native TypeScript support
 * handles the erasable syntax `defineTool`/`defineToolContract` call sites
 * use — no separate transpile step) and collects every export — direct or
 * inside an array — that looks like a tool contract.
 *
 * This is "Option A": run the *real* `defineTool`/`zodToJsonSchema` code
 * path so the registry always receives exactly the schema the browser will
 * register, never a hand-rolled approximation of it.
 */
export async function extractToolsFromFile(absolutePath: string): Promise<ExtractedTool[]> {
  ensureTsExtensionResolutionHook()
  const restore = stubBrowserGlobals()
  try {
    const moduleUrl = pathToFileURL(absolutePath).href
    const exports = (await import(moduleUrl)) as Record<string, unknown>
    const found: ExtractedTool[] = []
    for (const [exportName, value] of Object.entries(exports)) {
      collectFromExport(exportName, value, absolutePath, found)
    }
    return found
  } finally {
    restore()
  }
}

export interface ScanResult {
  files: string[]
  tools: ExtractedTool[]
}

/**
 * Finds and imports every `*.tools.ts` file under `cwd`, returning the full
 * set of discovered tools. Throws if the same tool `name` is exported from
 * two different files — the registry indexes tools by `(domain, name)`, so a
 * collision here would silently overwrite one tool with another at sync time.
 */
export async function scanTools(cwd: string): Promise<ScanResult> {
  const files = await findToolFiles(cwd)
  const tools: ExtractedTool[] = []
  const seenByName = new Map<string, ExtractedTool>()

  for (const file of files) {
    for (const tool of await extractToolsFromFile(file)) {
      const previous = seenByName.get(tool.name)
      if (previous) {
        if (previous.sourceFile !== tool.sourceFile) {
          throw new Error(
            `Duplicate tool name "${tool.name}": exported as "${previous.exportName}" from ` +
              `${path.relative(cwd, previous.sourceFile)} and as "${tool.exportName}" from ` +
              `${path.relative(cwd, tool.sourceFile)}. Tool names must be unique across the project.`,
          )
        }
        // Same file, same name — almost certainly the same tool reachable
        // through two exports (e.g. an individual `export const addTodoTool`
        // alongside an aggregate `export const todoTools = [addTodoTool, ...]`
        // for `useWebMCPTools`). Keep the first occurrence, skip the rest.
        continue
      }
      seenByName.set(tool.name, tool)
      tools.push(tool)
    }
  }

  return { files, tools }
}
