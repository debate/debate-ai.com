# CLAUDE.md — `debate-help-docs`

Private. The Debate AI documentation site, on the Fumadocs starter template.

## It is not deployed on its own

It is statically exported under `basePath: '/docs'` and copied into the web
app's `public/docs` by `apps/debate-ai.com/scripts/build-docs.mjs`, which runs
as the **first stage** of the app's build. So it is served at
[debate-ai.com/docs](https://debate-ai.com/docs), and:

- A docs change only appears after a full `bun run build` of the app. A bare
  `vinext build` leaves the previous export in place.
- **`basePath: '/docs'` is load-bearing.** Change it and every internal link and
  asset URL in the export breaks once copied into the app.

## It has no tests, and nothing will tell you it broke

This package is explicitly excluded from the Vitest projects in
`apps/debate-ai.com/vitest.config.ts` — it is a site, not a library. The test
run is green whether or not the docs build works. Build it before you claim it
works.

## What it publishes

The product's feature specs (`docs/features/`) **and the package READMEs**.
That makes a package README user-facing documentation in this repo — write them
for debaters and contributors, not just for maintainers, and keep
`packages/README.md` current.
