# `apps/debate-ai.com` — The Deployed Product

Next.js (App Router) compiled by **vinext** and deployed to a **Cloudflare
Worker** (`debate-ai-com`). Everything a user touches ships through here.

## Layout

```
app/                 ~45 routes, one per tool, each thin
  api/               ~44 route handlers
components/          app-level composition (layout, hubs, tool headers)
lib/                 the app's own logic
  auth/              Better Auth, trusted origins, OAuth state
  database/          Drizzle schema (~1,400 lines), D1 session, request context
  cardmirror/ videos/ youtube/ qwksearch/ reason-docs/ topic-starters/
  nav/ layout/ ui/ hooks/ offline-sw/ native/
drizzle/             D1 migrations + seed SQL
scripts/             build-docs, migrate-d1, seed-videos, deploy-upload
worker/index.ts      Worker entry: fetch handler + scheduled handler
wrangler.jsonc       bindings, cron triggers, production env
```

Route handlers stay thin — parsing, auth, a Drizzle call. Feature logic belongs
in a `packages/debate-*` library.

## Worker entry

`worker/index.ts` does four things beyond serving the app:

- image optimization (`vinext/server/image-optimization`);
- opens the per-request database context and D1 session;
- runs the **weekly cron** (`0 8 * * 1`) — `runWeeklyYouTubeSync`, which refreshes
  view counts as well as scanning for new videos;
- purges old evidence-reuse-check log rows.

A cron trigger is declared **twice** in `wrangler.jsonc` — top level and again
under `env.production`. Named envs do not inherit triggers or bindings, so
anything production needs has to be repeated there. The same is true of
`keep_vars`, `images` and `d1_databases`.

## Database

D1 (`debate-ai-db`, binding `debate_db`) through Drizzle. Schema in
`lib/database/schema.ts`.

```bash
bun run db:generate       # drizzle-kit generate — migration from schema
bun run db:migrate:d1     # scripts/migrate-d1.ts, also run by `deploy`
bun run db:push:d1
bun run db:seed:videos:d1
bun run db:studio
```

Edit `schema.ts` → `db:generate` → commit the SQL in `drizzle/` → migrate. Never
hand-edit an applied migration.

**Read replication** works exactly as in the sibling qwksearch repo: the Worker
opens a D1 session per request, `sessionedD1()` wraps the binding so every Drizzle
statement joins it, and `applyD1Bookmark` writes the closing bookmark onto the
response. Outside a session scope the wrapper is a pass-through.
`runWithPrimaryD1Session` forces the primary where a replica read would be wrong.

## Auth

**Better Auth** over the Drizzle/D1 adapter — `oneTap`, `openAPI`, `magicLink`,
`anonymous` and `oneTimeToken` plugins, Resend for mail. Trusted origins and
allowed hosts are built in `lib/auth/hosts.ts`; the native wrapper's custom URL
scheme (`debateai://`) hands a session back to the app window through the OAuth
flow, so host handling is not purely web.

## Build and deploy

```bash
bun run build      # build:docs → vinext build → build:sw
bun run deploy     # db:migrate:d1 → build → vinext deploy --skip-build
bun run preview    # vinext build + wrangler dev
```

Three things make that build longer than a plain Next build:

1. **`build:docs`** static-exports `packages/debate-help-docs` and copies it into
   `public/docs`. `public/docs` is build output and gitignored. Set
   `SKIP_DOCS_BUILD=1` to reuse an existing export while iterating on the app.
2. **`build:sw`** generates and webpacks the offline service worker, then copies
   it into `dist/client`.
3. `deploy` migrates D1 **before** building, so a failed migration stops the
   release rather than half-applying it.

## Workers-runtime rules

- No filesystem, no `import.meta.url` path resolution at module scope.
- No runtime code generation (`new Function` throws `EvalError`).
- `keep_vars: true` is load-bearing: this config declares no `vars`, so without it
  a deploy would wipe the plaintext Variables set in the Cloudflare dashboard.
  It has to be repeated inside `env.production`.
- Tests run under Node and will happily pass code that cannot run on a Worker.
