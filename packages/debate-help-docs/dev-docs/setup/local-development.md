---
title: Run it locally
description: Develop against the real Worker runtime with simulated D1, KV and R2
---

# Run it locally

Local development runs the real Worker runtime: `@cloudflare/vite-plugin` (in
`apps/debate-ai.com/vite.config.ts`) starts workerd/Miniflare and reads the bindings from
`wrangler.jsonc`. D1, KV and R2 are simulated on disk under `apps/debate-ai.com/.wrangler/state`
(gitignored). Nothing reaches your Cloudflare account.

1. **Create the local database schema** (once, and again after schema changes; see
   [Database setup](./database.md)):

   ```bash
   cd apps/debate-ai.com
   bunx drizzle-kit export --config drizzle.config.ts > /tmp/debate-schema.sql
   bunx wrangler d1 execute debate-ai-db --local --file /tmp/debate-schema.sql
   bun run db:migrate:d1 -- --local
   ```

2. **Optionally seed data:**

   ```bash
   bun run db:seed:tournaments   # demo Tabroom tournament (packages/debate-tournaments/seed/demo.sql)
   ```

3. **Add local secrets** in `apps/debate-ai.com/.dev.vars` (gitignored, `KEY="value"` lines).
   Wrangler also reads `.env` in that folder when `.dev.vars` is absent; `.env*` is gitignored
   too. Nothing is required to boot: `BETTER_AUTH_SECRET` falls back to a development string
   and each missing key turns one feature off. Typical minimum for a useful dev setup:

   ```bash
   BETTER_AUTH_SECRET="<openssl rand -base64 32>"
   ADMIN_EMAILS="you@example.com"
   OPENROUTER_API_KEY="<your key>"      # or ANTHROPIC_API_KEY, for the AI features
   ```

4. **Start the dev server** from the repo root:

   ```bash
   bun run dev:web     # just the web app, http://localhost:3000
   bun run dev         # every package's dev task through turbo
   ```

5. **Run the production Worker locally** before deploying:

   ```bash
   cd apps/debate-ai.com
   bun run preview     # vinext build + service worker + wrangler dev
   ```

`lib/database/libsql.ts` and `drizzle.config.ts` also describe a plain SQLite/libSQL database
(`DATABASE_URL`, default `file:./data/db.sqlite`). The app itself does not use it: the Vite
build sets `__USE_LIBSQL__` to `false`, so `getDB()` always uses the D1 binding. That file is
for drizzle-kit (`db:push`, `db:studio`, `db:generate`) and for the Node scripts in
`.github/scripts` (`seed-videos.ts`, `watch-counts.ts`).
