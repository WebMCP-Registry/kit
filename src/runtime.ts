import type { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { assertSupportedSchema } from './schema.js'
import type { ToolContract, ToolDefinition, ToolResult } from './types.js'

export function toToolResult(value: unknown): ToolResult {
  if (
    value !== null &&
    typeof value === 'object' &&
    'content' in value &&
    Array.isArray((value as { content: unknown }).content)
  ) {
    return value as ToolResult
  }

  const text = typeof value === 'string' ? value : JSON.stringify(value ?? null)
  return { content: [{ type: 'text', text }] }
}

export function toJsonSchema(input: z.ZodObject<z.ZodRawShape>): Record<string, unknown> {
  assertSupportedSchema(input)
  return zodToJsonSchema(input, { target: 'jsonSchema7', $refStrategy: 'none' }) as Record<
    string,
    unknown
  >
}

/**
 * Builds the `execute` every runnable tool needs: `.strict()`-parses args
 * against `input` (see `defineTool`'s doc comment for why strict mode matters),
 * runs `handler`, and wraps its return value into the `{ content: [...] }`
 * shape the WebMCP spec requires. Shared by `defineTool` (handler known up
 * front) and `useWebMCPTool`'s contract-binding overload (handler supplied
 * later, at registration time) so the validation/wrapping guarantee is
 * identical either way — only *when* the handler is attached differs.
 */
export function buildExecute<TInput extends z.ZodObject<z.ZodRawShape>>(
  input: TInput,
  handler: (args: z.infer<TInput>) => unknown | Promise<unknown>,
): (args: unknown) => Promise<ToolResult> {
  const strictInput = input.strict()
  return async (args) => {
    const parsed = strictInput.parse(args)
    const result = await handler(parsed)
    return toToolResult(result)
  }
}

/**
 * Completes a `defineToolContract` schema with a handler, producing the same
 * `ToolDefinition` shape `defineTool` would — so a contract bound to a
 * component-scoped handler can sit alongside ordinary `defineTool` results in
 * a `useWebMCPTools` array, or be registered solo via `useWebMCPTool`.
 *
 * Pure data transform (no hooks): callers that need referential stability
 * across renders (e.g. for a `useWebMCPTools` array) should memoize the
 * result themselves, same as any other tool passed to these hooks.
 */
export function bindToolHandler<TInput extends z.ZodObject<z.ZodRawShape>>(
  contract: ToolContract<TInput>,
  handler: (args: z.infer<TInput>) => unknown | Promise<unknown>,
): ToolDefinition {
  return {
    name: contract.name,
    description: contract.description,
    kind: contract.kind,
    inputSchema: contract.inputSchema,
    execute: buildExecute(contract.input, handler),
  }
}
