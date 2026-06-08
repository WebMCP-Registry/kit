import type { ToolDefinition } from '../types.js'

/**
 * The spec text places this on `document`, but Chrome 149's shipped
 * implementation exposes it on `navigator` — Google's own WebMCP demos probe
 * both (`document.modelContext || navigator.modelContext`) for exactly this
 * reason. We do the same so the SDK works against the implementation that
 * actually exists today, not just the spec direction it's heading toward.
 */
export function getModelContext(): ModelContext | undefined {
  if (typeof document !== 'undefined' && document.modelContext) return document.modelContext
  if (typeof navigator !== 'undefined' && navigator.modelContext) return navigator.modelContext
  return undefined
}

/**
 * Dev-only diagnostic for the "tools silently don't appear" failure mode —
 * the platform absence is a correct, silent no-op in production, but a
 * confusing dead end while building if you don't know why.
 */
export function registerWithWarning(tools: ToolDefinition[]): void {
  if (process.env.NODE_ENV === 'production' || tools.length === 0) return

  const names = tools.map((tool) => `"${tool.name}"`).join(', ')
  console.warn(
    `[webmcp-kit] modelContext is unavailable on document or navigator — tool(s) ${names} ` +
      `were not registered. ` +
      `WebMCP may not be enabled in this browser. Enable it at chrome://flags/#enable-webmcp-testing ` +
      `(Chrome's WebMCP origin trial). See https://developer.chrome.com/docs/ai/webmcp`,
  )
}
