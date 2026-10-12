# dev-docs

Internal documentation for people running or changing Debate AI. Unlike
[`debate-help-docs`](../debate-help-docs), which the web app serves at `/docs`, this package is
**never published or deployed**: `package.json` is `"private": true` (npm refuses to publish
it), it has no build, typecheck or test script, nothing imports it, and the help-docs site does
not read it.

| File | What it covers |
| --- | --- |
| [database-schema.md](./database-schema.md) | Every table in `apps/debate-ai.com/lib/database/schema.ts`, with columns, types, keys and what each column is for, plus the FTS search index and migration bookkeeping tables |
| [tabroom-schema.md](./tabroom-schema.md) | The 110 Tabroom tournament tables from `packages/debate-tournaments/migrations` |
| [self-hosting.md](./self-hosting.md) | Running locally, creating the D1 schema, deploying to your own Cloudflare account, and every environment variable |

## Keeping it current

These are plain Markdown and are not regenerated automatically. When you add or change a table
in `schema.ts` or a package migration, update the matching entry in `database-schema.md` or
`tabroom-schema.md`. When you add an environment variable, add it to the right table in
`self-hosting.md`. Never put a real secret value in any of these files.
