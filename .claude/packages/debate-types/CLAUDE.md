# CLAUDE.md — `debate-types`

Private. Published in-repo as **`@types/debate`**: every shared Debate AI type,
declarations only, with a doc comment on every object and field. Entry
`src/index.d.ts`, one `.d.ts` per domain, test in `test/`.

- **Import it as `"debate"`**, never `"@types/debate"` — TypeScript rejects the
  `@types/` scope by name (TS6137). Always `import type` / `export type`; there is
  no runtime module.
- **Files must stay `.d.ts`.** TypeScript only accepts declaration files when it
  falls back to `@types/*`; a `.ts` source here makes `"debate"` unresolvable.
  It also means no constants or functions in this package.
- **Every exported type and interface field needs a `/** … */` comment** — that is
  the package's whole point (hover docs). `test/docs.test.ts` enforces it.
- **The barrel is flat**, so names must be unique. Collisions get a prefix
  (`VideoDebateStyle` vs the timer's `DebateStyle`); the owning package re-exports
  under its old name.
- **The owning package keeps runtime code** and re-exports its types from here
  (`export type { … } from "debate"`), so existing imports of that package don't
  change. Add `"@types/debate": "workspace:*"` to any package that imports it.
- Keep it a leaf: no dependencies, nothing imported from other `debate-*` packages.
- Typecheck runs with `skipLibCheck: false` here so the declarations themselves are
  checked (consumers skip `.d.ts` checking).
