# Contributing to @webmcp-registry/kit

Thanks for taking a look — patches, bug reports, and questions are all welcome. This doc covers how the project is laid out and how to get a change from your machine into a release.

## Getting set up

```bash
git clone https://github.com/WebMCP-Registry/kit.git
cd kit
npm install
npm run build
```

That builds the SDK and the CLI into `dist/`. From here:

```bash
npm run dev        # tsup in watch mode — rebuilds on save
npm run typecheck  # tsc --noEmit
```

## Project layout

```
src/
  define-tool.ts           defineTool — schema + handler in one shot
  define-tool-contract.ts  defineToolContract — schema only, handler bound later
  runtime.ts               shared plumbing: buildExecute, bindToolHandler, toJsonSchema
  schema.ts                guards against Zod schemas that can't round-trip to JSON Schema
  types.ts                 ToolDefinition, ToolContract, and friends
  index.ts                 public entry point + WebMCP ambient type declarations
  react/
    use-webmcp-tool.ts     useWebMCPTool — single-tool registration (+ contract overload)
    use-webmcp-tools.ts    useWebMCPTools — batch registration
    shared.ts              getModelContext, dev-mode warning when WebMCP is unavailable
  cli/
    index.ts               CLI entry — arg parsing, command dispatch
    scan.ts                finds and imports *.tools.ts files in an isolated Node context
    hash.ts                deterministic hashing of tool contracts
    diff.ts                local-vs-registry diffing (added/changed/unchanged/removed)
    registry-client.ts     thin fetch wrapper around the registry's HTTP API
    sync.ts                orchestrates the above into `webmcp sync`
demo/                      a small todo app exercising both tool-definition patterns
```

Start in `src/define-tool.ts` and `src/runtime.ts` if you're trying to understand how a tool goes from a Zod schema to something the browser can run — everything else builds on those two.

## Trying your changes against the demo

The demo (`demo/`) is the fastest way to see a change actually run in a browser:

```bash
npm run build          # rebuild the SDK after your change
cd demo
npm install
npm run dev
```

Then open the dev server URL in a Chromium build with `chrome://flags/#enable-webmcp-testing` enabled, and watch the console — registered tools log there, and `registerWithWarning` (in `react/shared.ts`) tells you loudly if `modelContext` isn't available.

## Trying your changes against the CLI

If you're working on `src/cli/*`, the demo's `*.tools.ts` files double as a real fixture:

```bash
npm run build
node dist/cli/index.js sync --domain example.com --api-key <key> --cwd demo --dry-run
```

`--dry-run` never touches the registry — it just reports what `scan` found and how it diffs against whatever the registry currently has for that domain.

## How we write code here

A few things that'll save you a round-trip in review:

- **No premature abstraction.** If three call sites look similar, that's fine — don't reach for a shared helper until a fourth shows up with a real reason to share it.
- **Comments explain *why*, not *what*.** Skip comments that restate what the code obviously does. Write one when there's a non-obvious constraint, a workaround for a specific platform quirk, or something that would genuinely surprise the next reader — see the doc comments on `defineTool` or `getModelContext` for the kind of thing worth writing down.
- **Match the existing style.** Run `npm run typecheck` before opening a PR — there's no separate linter, but the type system catches almost everything that matters here.
- **Keep `defineTool` results as plain object literals at known call sites.** This isn't just style — the CLI's static scan depends on being able to find and import `*.tools.ts` exports without running your whole app. Anything that makes a tool definition harder to statically locate (wrapping it in a factory, building it conditionally, etc.) breaks that contract.

## Opening a PR

- Keep PRs focused — one logical change per PR is easier to review and easier to revert if something's off.
- Explain the *why* in the description. The diff shows what changed; we need the description to know what problem it solves.
- If you're changing public API surface (`src/index.ts`, `src/react/index.ts`, or the CLI's flags/output), call that out explicitly — it's the part most likely to need a second pair of eyes.

## Reporting bugs

Open an issue with:
- What you expected to happen, and what happened instead
- A minimal reproduction — a tool definition + the call that misbehaved goes a long way
- Your browser/Node version, since both the runtime and the CLI are sensitive to platform quirks (WebMCP's implementation status varies by Chrome version; the CLI relies on fairly recent Node behavior)

## Questions

Not sure if something's a bug, a missing feature, or just you missing something obvious? Open an issue anyway — "is this expected?" is a perfectly good issue title.
