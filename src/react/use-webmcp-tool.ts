import { useEffect } from 'react'
import type { z } from 'zod'
import { bindToolHandler } from '../runtime.js'
import type { ToolContract, ToolDefinition } from '../types.js'
import { getModelContext, registerWithWarning } from './shared.js'

/**
 * Registers a single WebMCP tool for the lifetime of the component, via
 * `modelContext.registerTool` (resolved from `document` or `navigator` —
 * see `getModelContext`). Lifecycle is managed exclusively
 * through `AbortController`/`signal` (the documented cleanup path — there
 * is no `unregisterTool`), which maps directly onto `useEffect` teardown.
 *
 * `tool` should be referentially stable across renders (e.g. the result of
 * `defineTool`, defined at module scope or memoized) — a new identity each
 * render re-registers the tool on every render.
 */
export function useWebMCPTool(tool: ToolDefinition): void
/**
 * Binds a `defineToolContract` schema to a handler defined inside the
 * component — where `useState`/`useReducer` setters and other component
 * state are in scope — and registers the result exactly as the single-arg
 * overload would.
 *
 * Unlike `tool` above, `handler` is *expected* to change identity across
 * renders (it closes over state that changes), and each change re-registers
 * the tool so the platform always calls the handler that sees current state.
 * If your handler doesn't need component state, prefer `defineTool` — one
 * call site, no re-registration on every state change.
 */
export function useWebMCPTool<TInput extends z.ZodObject<z.ZodRawShape>>(
  contract: ToolContract<TInput>,
  handler: (args: z.infer<TInput>) => unknown | Promise<unknown>,
): void
export function useWebMCPTool<TInput extends z.ZodObject<z.ZodRawShape>>(
  toolOrContract: ToolDefinition | ToolContract<TInput>,
  handler?: (args: z.infer<TInput>) => unknown | Promise<unknown>,
): void {
  useEffect(() => {
    const tool = handler
      ? bindToolHandler(toolOrContract as ToolContract<TInput>, handler)
      : (toolOrContract as ToolDefinition)

    const modelContext = getModelContext()
    if (!modelContext) {
      registerWithWarning([tool])
      return
    }

    const controller = new AbortController()
    modelContext.registerTool(
      {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        execute: tool.execute,
      },
      { signal: controller.signal },
    )

    return () => controller.abort()
  }, [toolOrContract, handler])
}
