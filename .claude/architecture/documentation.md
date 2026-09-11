# Documentation

## Where it lives

| If it is… | It goes in… |
| --- | --- |
| A guide a debater or contributor would read | `packages/debate-help-docs` |
| A feature spec | `docs/features/` (published by the docs site) |
| What a package is and what it depends on | `packages/README.md` — the index everyone reads first |
| How to use one package | That package's own `README.md` |
| How an agent should work in a package | That package's `CLAUDE.md` |
| Repo-wide agent orientation | root `CLAUDE.md` + `.claude/architecture/` |

## `/docs` is built into the app, not deployed separately

`packages/debate-help-docs` is a Fumadocs site, but it is **not** deployed on its
own. It is statically exported under `basePath: '/docs'` and copied into the web
app's `public/docs` by `apps/debate-ai.com/scripts/build-docs.mjs`, which runs
as the **first stage of the app's build** (`bun run build` → `build:docs` →
`vinext build` → `build:sw`).

Two consequences:

- A docs change only appears after a full app build. Running `vinext build`
  alone leaves the old export in `public/docs`.
- It publishes the product's feature specs (`docs/features/`) **and the package
  READMEs**. So a package README is user-facing documentation here — write it
  that way, and keep `packages/README.md` current when a package's purpose or
  dependencies change.

`debate-help-docs` is excluded from the Vitest projects (it is a site, not a
tested library), so nothing in the test run will tell you the docs build broke.

## The API spec

`apps/debate-ai.com/public/debate-openapi.yml` is the source of truth for the
API, and `packages/debate-api-client` is **generated from it** with Hey API. To
change the client, change the route and the spec, then regenerate — never
hand-edit the generated SDK.

The spec is also what's served at
[debate-ai.com/api/api-docs](https://debate-ai.com/api/api-docs).
