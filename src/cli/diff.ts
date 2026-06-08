import type { ExtractedTool } from './scan.js'
import { hashTool } from './hash.js'
import type { RegistryTool } from './registry-client.js'

export interface ChangedTool {
  local: ExtractedTool
  remote: RegistryTool
}

export interface ToolDiff {
  /** In the local scan, absent from the registry's active tools — needs creating. */
  added: ExtractedTool[]
  /** In both, but the contract hash differs — needs updating (and versioning). */
  changed: ChangedTool[]
  /** In both, with matching contract hashes — no push needed. */
  unchanged: ExtractedTool[]
  /** Active in the registry but absent from the local scan — tombstone candidates. */
  removed: RegistryTool[]
}

/**
 * Compares a fresh scan against the registry's current active tools for a
 * domain, classifying each by what — if anything — needs to happen to bring
 * the registry in line with the source of truth (the codebase).
 *
 * Hashing both sides with the same `hashTool` (rather than deep-equal on
 * the registry's possibly-differently-key-ordered JSON) keeps "did this
 * actually change" cheap and consistent with the no-op-skip logic the CLI
 * uses to decide what to push.
 */
export function diffTools(local: ExtractedTool[], remote: RegistryTool[]): ToolDiff {
  const remoteByName = new Map(remote.map((tool) => [tool.name, tool]))
  const localNames = new Set(local.map((tool) => tool.name))

  const added: ExtractedTool[] = []
  const changed: ChangedTool[] = []
  const unchanged: ExtractedTool[] = []

  for (const tool of local) {
    const existing = remoteByName.get(tool.name)
    if (!existing) {
      added.push(tool)
      continue
    }

    const localHash = hashTool(tool)
    const remoteHash = hashTool({
      name: existing.name,
      description: existing.description,
      kind: existing.kind ?? undefined,
      inputSchema: existing.inputSchema,
    })

    if (localHash === remoteHash) unchanged.push(tool)
    else changed.push({ local: tool, remote: existing })
  }

  const removed = remote.filter((tool) => !localNames.has(tool.name))

  return { added, changed, unchanged, removed }
}
