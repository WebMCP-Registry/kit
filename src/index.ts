export { defineTool } from './define-tool.js'
export { defineToolContract } from './define-tool-contract.js'
export { bindToolHandler } from './runtime.js'
export { UnsupportedSchemaError } from './schema.js'
export type {
  ToolContract,
  ToolContractOptions,
  ToolDefinition,
  ToolDefinitionOptions,
  ToolKind,
  ToolResult,
} from './types.js'

/**
 * Ambient types for the WebMCP API — not yet in lib.dom.d.ts. Declared here
 * (the package entry) rather than a separate referenced file, since dts
 * bundlers drop `/// <reference>` directives but preserve `declare global`
 * blocks that live in the entry module itself.
 *
 * The spec text describes `document.modelContext`, but Chrome 149's shipped
 * implementation exposes `navigator.modelContext` — confirmed by Google's own
 * demos (github.com/GoogleChromeLabs/webmcp-tools), which probe both:
 * `const modelContext = document.modelContext || navigator.modelContext`.
 * We declare it on both and probe the same way at runtime (see react/shared.ts)
 * so the SDK keeps working as the implementation catches up to the spec.
 */
declare global {
  interface ModelContextToolResult {
    content: Array<{ type: 'text'; text: string }>
  }

  interface ModelContextTool {
    name: string
    description: string
    inputSchema: Record<string, unknown>
    execute: (args: Record<string, unknown>) => Promise<ModelContextToolResult>
  }

  interface ModelContext {
    registerTool(tool: ModelContextTool, options?: { signal?: AbortSignal }): void
  }

  interface Document {
    modelContext?: ModelContext
  }

  interface Navigator {
    modelContext?: ModelContext
  }
}
