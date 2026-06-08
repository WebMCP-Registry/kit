import { useEffect } from 'react'
import type { ToolDefinition } from '../types.js'
import { getModelContext, registerWithWarning } from './shared.js'

/**
 * Batch form of `useWebMCPTool` — registers an array of tools sharing one
 * `AbortController`, since real components usually expose more than one
 * tool and a `useEffect` per tool is wasteful.
 *
 * `tools` should be referentially stable across renders (e.g. a module-level
 * array, or memoized) — a new array identity each render re-registers
 * everything on every render.
 */
export function useWebMCPTools(tools: ToolDefinition[]): void {
  useEffect(() => {
    const modelContext = getModelContext()
    if (!modelContext) {
      registerWithWarning(tools)
      return
    }

    const controller = new AbortController()
    for (const tool of tools) {
      modelContext.registerTool(
        {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          execute: tool.execute,
        },
        { signal: controller.signal },
      )
    }

    return () => controller.abort()
  }, [tools])
}
