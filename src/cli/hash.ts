import { createHash } from 'node:crypto'
import type { ToolKind } from '../types.js'

/**
 * The fields that define a tool's observable contract — the things an agent
 * sees and the registry stores. Anything else (`sourceFile`, `exportName`,
 * `execute`, …) is provenance or runtime detail that shouldn't affect whether
 * a sync considers the tool "changed".
 */
export interface HashableTool {
  name: string
  description: string
  kind?: ToolKind
  inputSchema: Record<string, unknown>
}

/**
 * Deterministic stringify — sorts object keys recursively so that two
 * structurally-identical schemas hash identically regardless of the order
 * `zodToJsonSchema` (or the registry's stored JSON) happens to emit them in.
 */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, sortKeysDeep(entry)]),
    )
  }
  return value
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value))
}

/**
 * Content hash of a tool's contract — used to skip no-op pushes (the schema
 * the registry already has matches what the scan just produced) and to
 * detect drift cheaply without a full deep-equal on every sync. Also the
 * basis for the registry-side `schema_hash` column (see HANDOVER's CLI plan):
 * once the registry stores this same hash, the CLI can diff against it
 * directly instead of re-fetching and re-comparing full schemas.
 */
export function hashTool(tool: HashableTool): string {
  const canonical = stableStringify({
    name: tool.name,
    description: tool.description,
    kind: tool.kind ?? null,
    inputSchema: tool.inputSchema,
  })
  return createHash('sha256').update(canonical).digest('hex')
}
