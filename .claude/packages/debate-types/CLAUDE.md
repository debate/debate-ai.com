# CLAUDE.md — `debate-types`

Public, published to npm as **`@debate/types`**: every shared Debate AI type,
declarations only, with a doc comment on every object and field. Entry
`src/index.d.ts`, one `.d.ts` per domain, test in `test/`.

- **Import it as `"@debate/types"`**. (It was `@types/debate`, imported as
  `"debate"`, before it moved under the `@debate/` scope to be published.) Always
  `import type` / `export type`; there is no runtime module.
- **Files must stay `.d.ts`.** `exports` only has a `types` condition, so there
  is no runtime module: no constants or functions in this package.
- **Every exported type and interface field needs a `/** … */` comment** — that is
  the package's whole point (hover docs). `test/docs.test.ts` enforces it.
- **The barrel is flat**, so names must be unique. Collisions get a prefix
  (`VideoDebateStyle` vs the timer's `DebateStyle`); the owning package re-exports
  under its old name.
- **The owning package keeps runtime code** and re-exports its types from here
  (`export type { … } from "@debate/types"`), so existing imports of that package don't
  change. Add `"@debate/types": "workspace:*"` to any package that imports it.
- Keep it a leaf: no dependencies, nothing imported from other `debate-*` packages.
- Typecheck runs with `skipLibCheck: false` here so the declarations themselves are
  checked (consumers skip `.d.ts` checking).
