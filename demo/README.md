# @webmcp-registry/kit demo

A minimal todo app exercising `defineTool` + `useWebMCPTools` against the real
WebMCP platform API (`document.modelContext`), not a polyfill or mock.

## Run it

```bash
npm install   # links the local `@webmcp-registry/kit` package via `file:..`
npm run dev   # http://localhost:5173
```

Rebuild the SDK (`npm run build` in the parent directory) and Vite will pick
up the new `dist/` output on reload — no relink needed.

## Testing against Chrome's WebMCP origin trial

`document.modelContext` doesn't exist in stock Chrome yet (general availability
is targeted for Chrome 149 via origin trial). To exercise it locally:

1. Open `chrome://flags/#enable-webmcp-testing` in Chrome, set it to **Enabled**,
   and relaunch.
2. Load `http://localhost:5173`. The banner at the top of the page flips from
   "✗ unavailable" to "✓ available" once `document.modelContext` exists.
3. Open DevTools → Console:
   - With the flag **off**, you'll see `@webmcp-registry/kit`'s dev-mode warning naming
     each tool that wasn't registered, with a link back to the flag.
   - With the flag **on**, no warning — the tools registered silently, as
     they should in production.
4. To call the tools yourself without a full agent harness, use the console:
   ```js
   const [tool] = await document.modelContext.getTools?.() ?? []
   // or, per the spec's discovery shape — check the live API surface,
   // it may differ from this sketch (verify against chrome://webmcp-internals
   // or whatever introspection the trial build exposes)
   ```
   The more realistic path is connecting an MCP-aware agent (e.g. Chrome's own
   WebMCP demo extension, or any MCP client wired to the page) and asking it to
   add/list/complete a todo — that exercises `inputSchema` validation and the
   `execute` → `{ content: [...] }` round trip exactly as an agent would.

## What this validates

- `defineTool`'s Zod → JSON Schema conversion produces a schema the live
  platform accepts (not just one that satisfies our own types).
- `useWebMCPTools`' `AbortController` lifecycle registers/unregisters cleanly
  across React Strict Mode's mount → unmount → remount cycle.
- The dev-mode warning fires precisely when `document.modelContext` is absent,
  and stays silent once it's present.
