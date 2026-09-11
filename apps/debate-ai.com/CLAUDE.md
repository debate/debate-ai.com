# CLAUDE.md — `apps/debate-ai.com`

The deployed product: Next.js (App Router) built with **vinext** and run on
**Cloudflare Workers**. Full notes in
[`../../.claude/architecture/web-app.md`](../../.claude/architecture/web-app.md).

## Mount, don't reimplement

Nearly every feature lives in a `packages/debate-*` library; this app routes to
it and wires up auth, data and layout. If you are writing round logic, evidence
scoring or editor behaviour inside `app/`, it is in the wrong package.

## Things that bite

- **`bun run build` has three stages** — `build:docs` → `vinext build` →
  `build:sw`. A bare `vinext build` ships **stale docs and no service worker**.
- **`keep_vars` in `wrangler.jsonc` is load-bearing.** Without it every
  `wrangler deploy` deletes the plaintext Variables. Don't remove it.
- **`bun run deploy` migrates production first** (`db:migrate:d1`, then build,
  then `vinext deploy --skip-build`). Know what's in `drizzle/` before running
  it.
- **Two Drizzle configs**: `drizzle.config.ts` and `drizzle.d1.config.ts`
  (`db:push:d1`). They are not interchangeable.
- **Three tsconfigs**: `tsconfig.json`, `tsconfig.typecheck.json` (what
  `bun run typecheck` uses), `tsconfig.sw.json` (the service worker).
- **Never edit an applied migration.** Change the schema, `bun run db:generate`,
  commit the new file.
- `preview` needs the raised heap (`--max-old-space-size=4096`) — the build is
  genuinely that memory-hungry.

## This app holds the repo's only Vitest config

`vitest.config.ts` here configures testing for **the entire monorepo** — every
`packages/*` project plus an inline project for this app. That is deliberate:
the repo root is kept free of tool configs. Don't add another config anywhere.

The app's own tests are only picked up from
`lib/**/__tests__/**/*.test.ts(x)`. Routes, `worker/index.ts` and the service
worker have no test coverage at all — verify those with `bun run preview`.

## Shape

`app/` · `components/` (shadcn) · `lib/` · `data/` · `drizzle/` (migrations +
seed) · `worker/index.ts` · `wrangler.jsonc` · `public/debate-openapi.yml` (the
spec `debate-api-client` is generated from) · `scripts/` (build-docs,
migrate-d1, seed-videos, deploy-upload) · `setup-secrets.sh`

```bash
bun run dev
bun run typecheck
bun run test
bun run build
bun run preview
bun run deploy
```
