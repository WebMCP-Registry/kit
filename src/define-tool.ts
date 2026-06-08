import type { z } from 'zod'
import { buildExecute, toJsonSchema } from './runtime.js'
import type { ToolDefinition, ToolDefinitionOptions } from './types.js'

/**
 * Defines a complete, runnable WebMCP tool as a plain object literal at a
 * known call site (critical for the CLI's static AST scan), deriving its
 * JSON Schema from a Zod schema once so the schema and handler can never
 * drift apart.
 *
 * The handler may return any serializable value — `defineTool` wraps it
 * into the `{ content: [{ type: 'text', ... }] }` shape `execute` must
 * resolve to per the WebMCP spec. Returning an already-shaped `ToolResult`
 * (an object with a `content` array) passes through untouched.
 *
 * Parses with `.strict()` rather than Zod's default "strip" mode. Without
 * it, `zod-to-json-schema` still publishes `additionalProperties: false`
 * (Zod's strip mode maps to that JSON Schema), but `.parse()` would silently
 * drop unrecognized keys instead of rejecting them — a real drift between
 * the schema an agent is told to honor and what the tool actually does with
 * deviations. `.strict()` makes the two match: an agent sending an unexpected
 * field gets a clear rejection, not silently-discarded data.
 *
 * If your handler must close over component state (a `useState` setter,
 * which can't exist outside render), use `defineToolContract` +
 * `useWebMCPTool(contract, handler)` instead — `defineTool` requires a
 * complete handler up front, by design, so anything it produces is
 * immediately runnable and testable on its own.
 */
export function defineTool<TInput extends z.ZodObject<z.ZodRawShape>>(
  options: ToolDefinitionOptions<TInput>,
): ToolDefinition {
  return {
    name: options.name,
    description: options.description,
    kind: options.kind,
    inputSchema: toJsonSchema(options.input),
    execute: buildExecute(options.input, options.handler),
  }
}
