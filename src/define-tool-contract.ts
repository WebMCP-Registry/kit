import type { z } from 'zod'
import { toJsonSchema } from './runtime.js'
import type { ToolContract, ToolContractOptions } from './types.js'

/**
 * Defines a WebMCP tool's schema and metadata *without* a handler — for
 * tools whose behavior can only be wired up inside a component, because the
 * handler closes over component state (`useState`/`useReducer` setters don't
 * exist outside render, so they can't be part of a module-scope `defineTool`
 * call).
 *
 * Pair it with `useWebMCPTool(contract, handler)`, which binds a handler at
 * registration time — where that state is in scope — into a fully validated,
 * spec-shaped runtime tool, identical in behavior to one `defineTool` would
 * produce directly.
 *
 * Because the contract alone carries everything the CLI sync needs
 * (`name`/`description`/`kind`/`inputSchema` — never `execute`/`handler`),
 * `.tools.ts` files can call `defineToolContract` at module scope and stay
 * fully static-analyzable even when a tool's behavior must live elsewhere.
 *
 * If your handler *can* be written without component state (it talks to a
 * store, a class instance, module-level state, `localStorage`, …), prefer
 * `defineTool` — one call site, immediately runnable and testable on its own.
 */
export function defineToolContract<TInput extends z.ZodObject<z.ZodRawShape>>(
  options: ToolContractOptions<TInput>,
): ToolContract<TInput> {
  return {
    name: options.name,
    description: options.description,
    kind: options.kind,
    input: options.input,
    inputSchema: toJsonSchema(options.input),
  }
}
