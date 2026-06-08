# @webmcp-registry/kit

A small toolkit for exposing parts of your web app as tools an AI agent can call — built on top of [WebMCP](https://webmachinelearning.github.io/webmcp/), the emerging browser API that lets a page register tools directly on `document`/`navigator`.

It gives you:

- **`defineTool`** — describe a tool with a Zod schema and a handler, get something the browser can run, with the JSON Schema generated for you.
- **`useWebMCPTool` / `useWebMCPTools`** — React hooks that register tools for the lifetime of a component and clean up after themselves.
- **`webmcp sync`** — a CLI that scans your project for tools and pushes their schemas to the [WebMCP Registry](https://webmcp-registry.dev), so agents can discover what your site can do before they even land on it.

If you've never heard of WebMCP: think of it as the in-browser sibling of MCP. Instead of running a separate server that an agent connects to, your *web page itself* declares "here's what you can ask me to do," and a browser-native agent can call those tools directly — with the user's session, permissions, and current page state already in scope.

> **Heads up:** WebMCP is brand new and not broadly shipped yet. As of writing, it's behind a flag in Chrome (`chrome://flags/#enable-webmcp-testing`, part of an origin trial). `@webmcp-registry/kit` is built so your code is ready the moment support lands — and degrades to a harmless no-op (with a console warning in dev) where it hasn't yet.

## Install

```bash
npm install @webmcp-registry/kit zod
```

`zod` is a peer dependency — you bring your own version (`^3`). `react` is an optional peer dependency, only needed if you use the `@webmcp-registry/kit/react` hooks.

> **Note on names:** the npm package is `@webmcp-registry/kit`, and it ships a CLI command called `webmcp` (you'll see it as `npx webmcp sync` below). Install the package and the command comes with it — `npx` resolves it from your local `node_modules/.bin`. If you ever try to run `webmcp` *without* installing first, be explicit (`npx --package=@webmcp-registry/kit -- webmcp sync ...`): there's an unrelated package also named `webmcp` on npm, and a bare `npx webmcp` could resolve to it instead of ours.

## Quick start

Describe a tool with a name, a description (this is what the agent reads to decide whether to call it — write it like you're explaining the action to a person), an input schema, and a handler:

```ts
import { defineTool } from '@webmcp-registry/kit'
import { z } from 'zod'

export const addTodoTool = defineTool({
  name: 'add-todo',
  description: "Add a new item to the user's todo list",
  kind: 'write',
  input: z.object({
    text: z.string().describe('The text of the todo item'),
  }),
  handler: ({ text }) => {
    const todo = addTodo(text) // however your app actually adds a todo
    return { added: todo }
  },
})
```

That's a complete `ToolDefinition` — name, description, JSON Schema (derived from the `z.object` you passed in), and a handler wired up to validate input and run. Nothing else to wire up by hand.

Now register it from a component:

```tsx
import { useWebMCPTool } from '@webmcp-registry/kit/react'
import { addTodoTool } from './todo.tools'

function TodoApp() {
  useWebMCPTool(addTodoTool)
  // ...
}
```

While this component is mounted, an agent visiting the page can call `add-todo` with `{ text: "buy milk" }`, and your handler runs exactly as if the user had typed it in and hit submit.

## Two ways to define a tool

Most tools are easy to define in one shot with `defineTool` — name, schema, and handler all in the same place. But every so often a handler genuinely needs something that only exists *inside* a component: a `useState` setter, a `useReducer` dispatch, a ref. You can't put those in a module-level `defineTool` call because they don't exist outside render.

For that case, split the schema from the handler:

```ts
// draft.tools.ts — just the contract, no handler. Lives at module scope.
import { defineToolContract } from '@webmcp-registry/kit'
import { z } from 'zod'

export const setDraftContract = defineToolContract({
  name: 'set-draft-text',
  description: 'Set the text currently in the new-todo input field, without submitting it',
  kind: 'write',
  input: z.object({ text: z.string() }),
})
```

```tsx
// inside your component, where setDraft actually exists
import { useWebMCPTool } from '@webmcp-registry/kit/react'
import { setDraftContract } from './draft.tools'

function TodoApp() {
  const [draft, setDraft] = useState('')

  useWebMCPTool(setDraftContract, ({ text }) => {
    setDraft(text)
    return { draft: text }
  })

  // ...
}
```

`useWebMCPTool` binds the contract and the handler together at registration time — same validation, same `{ content: [...] }` wrapping, same everything `defineTool` would give you. The only difference is *when* the handler gets attached.

**Rule of thumb:** if your handler can be written without touching component state — it talks to a store, an API, `localStorage`, a class instance, whatever — reach for `defineTool`. It's one call site, and you can test it on its own without rendering anything. Only split it into a contract when you genuinely have to.

## Registering more than one tool

`useWebMCPTools` (plural) batches an array of tools under a single `AbortController`, which is what you want once a component exposes more than one thing:

```tsx
import { useWebMCPTools } from '@webmcp-registry/kit/react'
import { todoTools } from './todo.tools'

function TodoApp() {
  useWebMCPTools(todoTools) // [addTodoTool, completeTodoTool, listTodosTool]
  // ...
}
```

Keep the array referentially stable — define it at module scope (like `todoTools` above) or memoize it. A new array identity on every render means re-registering everything on every render.

## The `*.tools.ts` convention

Put your tool definitions in files named `*.tools.ts` (e.g. `todo.tools.ts`, `search.tools.ts`), as plain top-level exports, with no React or browser imports:

```
src/
  todo.tools.ts      // export const addTodoTool = defineTool({ ... })
  search.tools.ts    // export const searchTool = defineTool({ ... })
  draft.tools.ts     // export const setDraftContract = defineToolContract({ ... })
```

This isn't enforced by the SDK at runtime — it's a convention that makes your tools discoverable by `webmcp sync`, which scans for these files and imports them in an isolated Node context to read their schemas. Following it costs you nothing (these files would probably look like this anyway) and means the CLI just works without any extra config.

## Syncing to the registry

The [WebMCP Registry](https://webmcp-registry.dev) is a public directory of what tools live on which domains — the place an agent can look *before* visiting your site to find out what it can do there. `webmcp sync` keeps that directory honest by pushing your actual tool schemas straight from source.

Since you've already got `@webmcp-registry/kit` installed (per the install step above), `npx` will find its `webmcp` binary in your local `node_modules/.bin` — no extra setup:

```bash
npx webmcp sync --domain example.com --api-key $WEBMCP_REGISTRY_KEY
```

> See the note on names above if you want to run this *without* installing first — a bare `npx webmcp` with nothing installed locally can resolve to an unrelated package.

Get an API key from the registry's dashboard once you've signed in and verified your domain. Treat it like any other secret — store it in your CI provider's secrets, never commit it, never ship it to the browser.

Want to see what would happen first?

```bash
npx webmcp sync --domain example.com --api-key $WEBMCP_REGISTRY_KEY --dry-run
```

```
Found 4 tool(s) across 2 file(s):
  src/todo.tools.ts
  src/draft.tools.ts

  + 1 new
  ~ 1 changed
  = 2 unchanged (no-op on push)
  - 0 no longer in source

Dry run — would push 4 tool(s) (1 new, 1 changed, 0 to tombstone). Re-run without --dry-run to apply.
```

A few things worth knowing about what happens on push:

- **It only ever sends what's actually true of your contracts** — name, description, kind, and the JSON Schema derived from your Zod input. Never your handler code.
- **Unchanged tools are free.** Each tool is submitted with a hash of its contract; if the registry already has that exact hash, it skips the rewrite (and the new version row it would otherwise create) entirely. Run `sync` on every deploy without worrying about spamming version history.
- **It pushes your complete tool set, not just the diff.** That's intentional — the registry uses your latest sync as the source of truth for what's still active. A tool that's vanished from your source gets marked inactive ("tombstoned") rather than deleted, so its history sticks around.
- **Once a domain syncs via the CLI, it stays CLI-managed.** Manual submissions through the dashboard get turned off for that domain — the two paths can't safely coexist once tombstoning is in play. If you start with `sync`, keep using it.

### CLI options

```
webmcp sync --domain <domain> --api-key <key> [options]

  --domain <domain>        Domain to sync tools under (required)
  --api-key <key>          Registry API key — or set WEBMCP_REGISTRY_KEY (required)
  --cwd <dir>              Directory to scan (default: current directory)
  --registry-url <url>     Registry base URL (default: https://webmcp-registry.dev)
  --dry-run                Report what would change without pushing
```

### Wiring it into CI

The natural home for `sync` is your deploy pipeline — run it after a successful build (and after `npm ci`/`npm install`, so `@webmcp-registry/kit` is in `node_modules` and `npx` resolves the local `webmcp` binary) so the registry never drifts out of sync with what's actually live:

```yaml
- name: Sync WebMCP tools to registry
  run: npx webmcp sync --domain example.com --api-key ${{ secrets.WEBMCP_REGISTRY_KEY }}
```

Because unchanged tools are free, this is safe to run on every single deploy — most runs will do nothing at all.

## Trying it locally

There's a working demo in [`demo/`](./demo) — a small todo app wired up with both `defineTool` (store-backed tools) and `defineToolContract` + `useWebMCPTool` (a component-state-bound tool). To run it:

```bash
npm install
npm run build
cd demo && npm install && npm run dev
```

Then open it in a build of Chrome with `chrome://flags/#enable-webmcp-testing` turned on, and check the console — you'll see the tools register themselves.

## A note on tool descriptions

The single highest-leverage thing you can do for how well your tools work is write good descriptions. An agent decides whether (and how) to call your tool almost entirely from `name`, `description`, and the field-level `.describe()` calls on your schema. Write them the way you'd explain the action to a new team member — what it does, what it affects, anything surprising about it — not the way you'd name a function in code.

```ts
// Less useful — reads like a function signature
description: 'Updates todo'

// More useful — an agent can actually reason about this
description: "Mark a todo item as complete by its ID. Has no effect if the item is already complete."
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
