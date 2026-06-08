/**
 * `*.tools.ts`, the `defineToolContract` half: a schema-only declaration for
 * a tool whose handler can't live here, because it must call a `useState`
 * setter — `setDraft` only exists inside `App`'s render. The contract alone
 * carries everything the CLI sync needs (`name`/`description`/`kind`/
 * `inputSchema`, never `execute`), so this file stays just as statically
 * discoverable and import-safe as `todo.tools.ts`.
 *
 * Paired with `useWebMCPTool(setDraftContract, handler)` in `App.tsx`, where
 * `setDraft` is in scope.
 */
import { defineToolContract } from '@webmcp-registry/kit'
import { z } from 'zod'

export const setDraftContract = defineToolContract({
  name: 'set-draft-text',
  description: 'Set the text currently in the new-todo input field, without submitting it',
  kind: 'write',
  input: z.object({ text: z.string().describe('Text to place in the input field') }),
})
