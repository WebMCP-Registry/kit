#!/usr/bin/env node
import path from 'node:path'
import { parseArgs } from 'node:util'
import { runSync } from './sync.js'

const DEFAULT_REGISTRY_URL = 'https://webmcp-registry.dev'

function printUsage(): void {
  console.log(`Usage: webmcp-kit <command> [options]

Commands:
  sync     Scan *.tools.ts files and sync their schemas to the WebMCP Registry

Options for "sync":
  --domain <domain>        Domain to sync tools under (required)
  --api-key <key>          Registry API key — or set WEBMCP_REGISTRY_KEY (required)
  --cwd <dir>              Directory to scan (default: current directory)
  --registry-url <url>     Registry base URL (default: ${DEFAULT_REGISTRY_URL})
  --dry-run                Report what would change without pushing

Example:
  webmcp-kit sync --domain myapp.com --api-key $WEBMCP_REGISTRY_KEY`)
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2)

  if (!command || command === '--help' || command === '-h') {
    printUsage()
    process.exitCode = command ? 0 : 1
    return
  }

  if (command !== 'sync') {
    console.error(`Unknown command: "${command}"\n`)
    printUsage()
    process.exitCode = 1
    return
  }

  const { values } = parseArgs({
    args: rest,
    options: {
      domain: { type: 'string' },
      'api-key': { type: 'string' },
      cwd: { type: 'string' },
      'registry-url': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
  })

  const domain = values.domain
  const apiKey = values['api-key'] ?? process.env.WEBMCP_REGISTRY_KEY

  if (!domain) {
    console.error('Missing required option: --domain <domain>\n')
    printUsage()
    process.exitCode = 1
    return
  }

  if (!apiKey) {
    console.error('Missing API key — pass --api-key <key> or set WEBMCP_REGISTRY_KEY\n')
    printUsage()
    process.exitCode = 1
    return
  }

  try {
    await runSync({
      cwd: path.resolve(values.cwd ?? process.cwd()),
      domain,
      apiKey,
      registryUrl: values['registry-url'] ?? DEFAULT_REGISTRY_URL,
      dryRun: values['dry-run'] ?? false,
    })
  } catch (error) {
    console.error(`\nSync failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}

void main()
