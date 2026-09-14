# The Web App — `apps/debate-ai.com`

The deployed product. Next.js (App Router) built by **vinext** and run on
**Cloudflare Workers**.

## Shape

```
apps/debate-ai.com/
  app/             routes + route handlers
  components/      app-local UI (shadcn; components.json)
  lib/             app libraries — including the D1 read-replication session
                   wrapper and the offline service-worker generator
  data/            app data
  drizzle/         migrations (+ drizzle/seed)
  worker/index.ts  the Workers entrypoint
  wrangler.jsonc   bindings, crons, vars
  public/debate-openapi.yml   the spec debate-api-client is generated from
  scripts/         build-docs, migrate-d1, seed-videos, deploy-upload
  vitest.config.ts the whole repo's Vitest config (see monorepo.md)
```

Three TypeScript configs, and they are not interchangeable: `tsconfig.json`,
`tsconfig.typecheck.json` (what `bun run typecheck` uses) and `tsconfig.sw.json`
(the service worker).

## The build has three stages

```bash
bun run build    # build:docs → vinext build → build:sw
```

1. **`build:docs`** (`scripts/build-docs.mjs`) statically exports
   `packages/debate-help-docs` and copies it into `public/docs`. See
   [documentation.md](documentation.md).
2. **`vinext build`** — the app itself.
3. **`build:sw`** — generates the offline service worker
   (`lib/offline-sw/generate.cjs`), bundles it with **webpack**
   (`webpack.config.cjs`), and copies it to `dist/client/service-worker.js`.

A `vinext build` on its own produces an app with **stale docs and no service
worker**. Use `bun run build`.

`preview` raises the heap (`--max-old-space-size=4096`) and then runs
`wrangler dev` — the build is memory-hungry enough to need it.

## Bindings and crons

| Binding | What it is |
| --- | --- |
| `debate_db` | D1 database `debate-ai-db` |
| `ASSETS` | The client bundle |
| `IMAGES` | Cloudflare Images |

`keep_vars` is set on purpose: **without it, every `wrangler deploy` deletes the
plaintext Variables**. Do not remove it.

A weekly cron (Mondays 08:00 UTC) does YouTube maintenance — scanning the
subscribed channels for new videos *and* refreshing view counts on existing
ones.

## Turnstile first-load gate

`worker/index.ts` calls `handleTurnstileGate` (`apps/debate-ai.com/lib/turnstile/`) before
anything else. A desktop browser's **first** HTML page view is answered with a
Cloudflare Turnstile check; the Worker validates the token server-side against
`siteverify` and sets an HMAC-signed pass cookie (7 days by default), so nobody
is challenged twice.

Never challenged: phones (`Sec-CH-UA-Mobile`, falling back to the user-agent),
search-engine and link-preview crawlers, `/api/*`, `/_next/*`, `/_vinext/*`,
static assets, RSC payload fetches (`RSC: 1`, `?_rsc=`), `robots.txt` /
`sitemap.xml` / manifests / health checks, and every non-`GET` request. A new
machine-facing path outside `/api/*` has to be added to
`lib/turnstile/request-filter.ts`.

The gate is **off until configured and fails open**: with `TURNSTILE_SITE_KEY` /
`TURNSTILE_SECRET_KEY` unset it returns `null` for every request, which is what
keeps local dev, previews and CI unchallenged. `TURNSTILE_ENABLED=false` turns
it off with the keys still in place. Full write-up:
[debate-help-docs → Internals → Turnstile first-load gate](../../packages/debate-help-docs/content/docs/internals/turnstile-bot-gate.mdx).

## Database

Drizzle + D1, with **two configs**:

- `drizzle.config.ts` — the local/dev config
- `drizzle.d1.config.ts` — D1, used by `db:push:d1`

```bash
bun run db:generate        # after editing the schema
bun run db:push
bun run db:push:d1
bun run db:migrate:d1      # scripts/migrate-d1.ts — runs first in `deploy`
bun run db:studio
bun run db:seed:videos
bun run db:seed:videos:d1  # emits SQL, then wrangler d1 execute --remote
```

**Never edit an applied migration.** Change the schema, regenerate, commit the
new file in `drizzle/`.

Note `deploy` runs `db:migrate:d1` **before** building — a deploy migrates
production. Know what is in the migration directory before you run it.

## Deploy

```bash
bun run deploy            # db:migrate:d1 → build → vinext deploy --skip-build
bun run deploy:staging    # same, --env staging
bun run preview           # local wrangler dev against the real build
```

`setup-secrets.sh` is the helper for Worker secrets. Secrets are never committed.

## Testing against Workers

Tests run under Node. **Passing tests do not prove the code runs on a Worker.**
The app's own test project only covers `lib/**/__tests__` — routes, the worker
entrypoint and the service worker are not covered by anything. Exercise those
with `bun run preview` before shipping.
