import type { z } from 'zod'

/**
 * Matches the registry's tool taxonomy (`tools.kind` CHECK constraint).
 */
export type ToolKind = 'read' | 'write' | 'action'

/**
 * The shape `execute` must resolve to per the WebMCP spec —
 * https://webmachinelearning.github.io/webmcp/#dom-modelcontexttool-execute
 */
export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>
}

export interface ToolDefinitionOptions<TInput extends z.ZodObject<z.ZodRawShape>> {
  name: string
  description: string
  kind?: ToolKind
  /**
   * Must be a `z.object({...})` — every WebMCP `inputSchema` is rooted at
   * `type: "object"`, and `defineTool` parses in `.strict()` mode (see
   * `defineTool`'s doc comment for why), which only `ZodObject` supports.
   */
  input: TInput
  /**
   * Receives args already parsed and typed from `input`. May return any
   * serializable value — `defineTool` wraps it into the `{ content: [...] }`
   * shape `execute` must produce, so handlers stay focused on app logic.
   */
  handler: (args: z.infer<TInput>) => unknown | Promise<unknown>
}

export interface ToolContractOptions<TInput extends z.ZodObject<z.ZodRawShape>> {
  name: string
  description: string
  kind?: ToolKind
  /** See `ToolDefinitionOptions.input` — same constraints apply. */
  input: TInput
}

/**
 * Output of `defineToolContract`: a tool's schema and metadata *without* a
 * handler — for the (uncommon, but real) case where the handler can only be
 * constructed inside a component, because it closes over component state
 * (`useState`/`useReducer` setters don't exist outside render).
 *
 * Pair it with `useWebMCPTool(contract, handler)` to bind a handler at
 * registration time, where that state is in scope. The contract alone is
 * enough for the CLI sync (it only ever reads `name`/`description`/`kind`/
 * `inputSchema` — never `execute`/`handler`), so `.tools.ts` files can
 * `defineToolContract` at module scope and stay fully static-analyzable
 * even when their behavior must live elsewhere.
 *
 * Carries `input` (the original Zod schema, not just its JSON Schema
 * projection in `inputSchema`) so `useWebMCPTool` can still parse in
 * `.strict()` mode when binding — the same runtime guarantee `defineTool`
 * gives you, just assembled in two steps instead of one.
 */
export interface ToolContract<TInput extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>> {
  name: string
  description: string
  kind?: ToolKind
  input: TInput
  inputSchema: Record<string, unknown>
}

/**
 * Output of `defineTool`: a plain object literal at a known call site
 * (so the CLI's static AST scan can find it), already carrying the
 * JSON Schema derived from `input` and an `execute` ready for
 * `document.modelContext.registerTool`.
 *
 * Deliberately not generic over the input schema — tools with different
 * input types must coexist in the same array (for `useWebMCPTools`, the
 * CLI scan, etc.), and `execute` already validates/parses internally via
 * the original Zod schema, so there's nothing useful for callers to infer
 * from the type parameter once the definition is built.
 */
export interface ToolDefinition {
  name: string
  description: string
  kind?: ToolKind
  inputSchema: Record<string, unknown>
  execute: (args: unknown) => Promise<ToolResult>
}
