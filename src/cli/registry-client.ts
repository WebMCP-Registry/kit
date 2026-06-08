import type { ToolKind } from '../types.js'

export interface RegistryTool {
  name: string
  description: string
  kind: ToolKind | null
  specVersion: string
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown> | null
  updatedAt: string
}

export interface LookupResult {
  found: boolean
  tools: RegistryTool[]
}

export interface SubmitPayloadTool {
  name: string
  description: string
  kind?: ToolKind
  inputSchema: Record<string, unknown>
  /**
   * sha256 hex digest from `hashTool` — lets the registry skip rewriting (and
   * re-versioning) a tool whose contract is byte-for-byte identical to what
   * it already has, the server-side half of the no-op-skip the CLI relies on.
   */
  schemaHash: string
}

export interface SubmitResult {
  domainId: string
  verificationToken: string
  verified: boolean
  toolsSubmitted: number
  toolsSkipped: number
  toolsTombstoned: number
}

export class RegistryError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'RegistryError'
    this.status = status
  }
}

async function parseErrorBody(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown }
    if (typeof body.error === 'string') return body.error
  } catch {
    // fall through to statusText below
  }
  return response.statusText || `HTTP ${response.status}`
}

/**
 * Reads the registry's current view of a domain's *active* tools — the
 * baseline the CLI diffs a scan against to decide what's new, changed, or
 * gone. Public (no auth) — same endpoint the registry's own UI uses.
 */
export async function lookupDomain(registryUrl: string, domain: string): Promise<LookupResult> {
  const url = new URL('/api/lookup', registryUrl)
  url.searchParams.set('domain', domain)

  const response = await fetch(url, { headers: { accept: 'application/json' } })
  if (!response.ok) {
    throw new RegistryError(`Lookup failed for "${domain}": ${await parseErrorBody(response)}`, response.status)
  }

  const body = (await response.json()) as { found: boolean; tools?: RegistryTool[] }
  return { found: body.found, tools: body.tools ?? [] }
}

/**
 * Pushes a domain's *complete* tool set to the registry via `POST /api/submit`,
 * tagged `source: "cli"`.
 *
 * That tag does two things server-side: it tells `/api/submit` this payload is
 * authoritative — so it tombstones any currently-active tool absent from it —
 * and it marks the domain `cli_managed`, after which manual (dashboard-form)
 * submissions are rejected. The two paths can't safely interleave once tombstoning
 * is in play, hence "CLI becomes exclusive" once a domain adopts `sync`.
 *
 * This must only ever run at build/deploy time — never from the browser —
 * because it requires the registry API key (`Authorization: Bearer wmcp_<key>`),
 * which must never reach a visitor.
 *
 * `category` is optional and applies on every sync (insert or update) — most
 * useful the first time a domain is registered, since that's when the registry
 * has nothing to go on otherwise, but harmless to keep passing afterward.
 */
export async function submitTools(
  registryUrl: string,
  apiKey: string,
  domain: string,
  tools: SubmitPayloadTool[],
  category?: string,
): Promise<SubmitResult> {
  const url = new URL('/api/submit', registryUrl)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ domain, tools, source: 'cli', ...(category ? { category } : {}) }),
  })

  if (!response.ok) {
    throw new RegistryError(`Submit failed for "${domain}": ${await parseErrorBody(response)}`, response.status)
  }

  return (await response.json()) as SubmitResult
}
