import path from 'node:path'
import { diffTools } from './diff.js'
import { hashTool } from './hash.js'
import { lookupDomain, submitTools, type SubmitPayloadTool } from './registry-client.js'
import { scanTools } from './scan.js'

export interface SyncOptions {
  cwd: string
  domain: string
  apiKey: string
  registryUrl: string
  dryRun: boolean
}

export interface SyncReport {
  filesScanned: number
  added: number
  changed: number
  unchanged: number
  removed: number
  pushed: boolean
}

/**
 * The full `webmcp-kit sync` pipeline:
 *
 *   scan (real `defineTool`/`zodToJsonSchema` code path, see `scan.ts`)
 *     → hash + diff against the registry's current active tools (local-only
 *       reporting — what would change, and what's gone from source)
 *     → push the *complete* local set, each tagged with its contract hash
 *
 * The push always includes every locally-discovered tool, not just the
 * added/changed ones: `/api/submit` treats a `source: "cli"` payload as
 * authoritative and tombstones any active tool absent from it (`source: "cli"`
 * is also what makes the domain CLI-exclusive — see `submitTools`'s doc
 * comment). Sending only a subset would tombstone every unchanged tool by
 * mistake. The registry uses each tool's `schemaHash` to skip rewriting (and
 * re-versioning) the ones that haven't actually changed — so an unchanged
 * tool still round-trips through the request, but costs the registry nothing.
 */
export async function runSync(options: SyncOptions, log: (line: string) => void = console.log): Promise<SyncReport> {
  log(`Scanning ${options.cwd} for *.tools.ts files…`)
  const { files, tools } = await scanTools(options.cwd)

  if (files.length === 0) {
    log('No *.tools.ts files found — nothing to sync.')
    return { filesScanned: 0, added: 0, changed: 0, unchanged: 0, removed: 0, pushed: false }
  }

  log(`Found ${tools.length} tool(s) across ${files.length} file(s):`)
  for (const file of files) log(`  ${path.relative(options.cwd, file)}`)

  log(`Looking up "${options.domain}" on ${options.registryUrl}…`)
  const { tools: remoteTools } = await lookupDomain(options.registryUrl, options.domain)

  const diff = diffTools(tools, remoteTools)

  log('')
  log(`  + ${diff.added.length} new`)
  log(`  ~ ${diff.changed.length} changed`)
  log(`  = ${diff.unchanged.length} unchanged (no-op on push)`)
  log(`  - ${diff.removed.length} no longer in source${diff.removed.length > 0 ? ' (will be tombstoned)' : ''}`)
  log('')

  for (const tool of diff.added) log(`  + ${tool.name}  (${path.relative(options.cwd, tool.sourceFile)})`)
  for (const { local } of diff.changed) log(`  ~ ${local.name}  (${path.relative(options.cwd, local.sourceFile)})`)
  for (const tool of diff.removed) {
    log(`  - ${tool.name}  (active in registry, not found in source — will be marked inactive on push)`)
  }

  const summary = {
    filesScanned: files.length,
    added: diff.added.length,
    changed: diff.changed.length,
    unchanged: diff.unchanged.length,
    removed: diff.removed.length,
  }

  if (diff.added.length === 0 && diff.changed.length === 0 && diff.removed.length === 0) {
    log('\nEverything is already in sync — nothing to push.')
    return { ...summary, pushed: false }
  }

  if (options.dryRun) {
    log(
      `\nDry run — would push ${tools.length} tool(s) ` +
        `(${diff.added.length} new, ${diff.changed.length} changed, ${diff.removed.length} to tombstone). ` +
        `Re-run without --dry-run to apply.`,
    )
    return { ...summary, pushed: false }
  }

  // Always push the *complete* local set — see this function's doc comment
  // for why a partial push would cause incorrect tombstoning.
  const payload: SubmitPayloadTool[] = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    kind: tool.kind,
    inputSchema: tool.inputSchema,
    schemaHash: hashTool(tool),
  }))

  log(`\nPushing ${payload.length} tool(s) to ${options.registryUrl}…`)
  const result = await submitTools(options.registryUrl, options.apiKey, options.domain, payload)
  log(
    `Done — ${result.toolsSubmitted} submitted, ${result.toolsSkipped} unchanged (skipped), ` +
      `${result.toolsTombstoned} tombstoned. Domain verified: ${result.verified}.`,
  )
  if (!result.verified) {
    log(`Domain "${options.domain}" is not yet verified — visit the registry dashboard to complete verification.`)
  }

  return { ...summary, pushed: true }
}
