# Self-hosting Debate AI

How to run your own copy of the web app (`apps/debate-ai.com`): locally for development, and
on your own Cloudflare account in production. Everything here was taken from the code and
config in this repository; file paths are given so you can check them when they drift.

- [What you are deploying](#what-you-are-deploying)
- [Prerequisites](#prerequisites)
- [Run it locally](#run-it-locally)
- [Database setup and migrations](#database-setup-and-migrations)
- [Deploy to your Cloudflare account](#deploy-to-your-cloudflare-account)
- [Environment variables](#environment-variables)
- [Scheduled jobs](#scheduled-jobs)
- [Troubleshooting](#troubleshooting)

## What you are deploying

One Cloudflare Worker (`worker/index.ts`) that serves a Next.js App Router app built by
[vinext](https://github.com/cloudflare/vinext) (Vite), plus these Cloudflare resources, all
declared in `apps/debate-ai.com/wrangler.jsonc`:

| Binding | Kind | Used for | Required |
| --- | --- | --- | --- |
| `debate_db` | D1 database (`debate-ai-db`) | Every table in [database-schema.md](./database-schema.md) and [tabroom-schema.md](./tabroom-schema.md) | Yes |
| `ASSETS` | Static assets (`dist/client`) | The built client bundle | Yes (provided by the build) |
| `IMAGES` | Cloudflare Images | `/_next/image`-style resizing in `worker/index.ts` | Yes for image optimization |
| `DEBATE_ROOMS` | Durable Object `DebateRoomSignal` (SQLite-backed) | WebRTC signalling for webcam rounds (`lib/webcam/debate-room.ts`) | Only for webcam rooms |
| `DB_BACKUPS` | R2 bucket `debate-ai-db-backups` | Weekly SQL backups of content tables (`lib/admin/db-backup-r2.ts`) | Only for backups |
| `DB_BACKUPS_KV` | KV namespace (no id; wrangler provisions it) | `.sql.7z` copies of those backups | Only for backups |

Nearly all features live in `packages/debate-*` libraries the app mounts; you deploy only the
app. The browser extension (`apps/debate-browser-ext`) and native wrapper
(`apps/debate-native-wrapper`) are built separately and are not covered here.

## Prerequisites

- **Bun 1.4.x.** The repo pins `packageManager: bun@1.4.x`; CI uses 1.4.2. Do not use npm or yarn.
- **Git with submodules.** The build runs `.github/scripts/ensure-submodules.mjs`; clone with
  `git clone --recurse-submodules` or run `git submodule update --init --recursive`.
- **A Cloudflare account** for production. Wrangler, drizzle-kit and vinext are installed as
  dev dependencies by `bun install`; run them with `bunx` from `apps/debate-ai.com`.
- Node 22 is useful for some scripts but not required for the app.

```bash
git clone --recurse-submodules https://github.com/debate/debate-ai.com.git
cd debate-ai.com
bun install
```

## Run it locally

Local development runs the real Worker runtime: `@cloudflare/vite-plugin` (in
`apps/debate-ai.com/vite.config.ts`) starts workerd/Miniflare and reads the bindings from
`wrangler.jsonc`. D1, KV and R2 are simulated on disk under `apps/debate-ai.com/.wrangler/state`
(gitignored). Nothing reaches your Cloudflare account.

1. **Create the local database schema** (once, and again after schema changes; see
   [Database setup](#database-setup-and-migrations)):

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

## Database setup and migrations

The database is one D1 database. Its tables come from three places:

| Source | Tables | How they reach a database |
| --- | --- | --- |
| `apps/debate-ai.com/lib/database/schema.ts` (Drizzle) | The 72 app tables | `drizzle-kit export` or `db:push:d1` (below). The app's own `drizzle/` migrations folder is deliberately **not** in git. |
| `packages/*/migrations/*.sql` | Tabroom (110), prediction markets, YouTube channels, topic polls, profile follows, plus two data migrations for the video queue | `bun run db:migrate:d1` (`.github/scripts/migrate-d1.ts`) |
| Runtime `CREATE … IF NOT EXISTS` | `organization`/`member`/`invitation`, `qwksearch_connection`, `video_durations`, the card search FTS tables | Created by the app on first use |

### A fresh database

Create the app tables first, then apply the package migrations:

```bash
cd apps/debate-ai.com
bunx drizzle-kit export --config drizzle.config.ts > /tmp/debate-schema.sql   # CREATE statements for schema.ts
bunx wrangler d1 execute debate-ai-db --remote --file /tmp/debate-schema.sql   # --local for the dev database
bun run db:migrate:d1                                                         # add -- --local for the dev database
```

`drizzle-kit export` only prints SQL; it needs no database or credentials. This sequence was
run against a local D1 while writing this guide and produced all 72 app tables, the 110 Tabroom
tables and the package tables.

**Alternative:** `bun run db:push:d1` pushes `schema.ts` straight to the remote D1 over HTTP
(`drizzle.d1.config.ts`). It needs `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID` and
`CLOUDFLARE_D1_TOKEN` (an API token with D1 edit rights). Use it only on an empty database:
push compares the whole database against `schema.ts` and will offer to drop every table that
is not in it, which includes all Tabroom and FTS tables.

### How `db:migrate:d1` works

`.github/scripts/migrate-d1.ts` applies each migration file once and records it in
`_d1_applied_migrations`. It rewrites `CREATE` statements to `IF NOT EXISTS` and isolates
`ALTER TABLE … ADD COLUMN` so a partly migrated database still converges, and it exits non-zero
on any other error so a deploy stops before shipping code whose schema did not land.

| Flag / variable | Effect |
| --- | --- |
| `--local` | Target the Miniflare database instead of the remote one. |
| `--dry-run` | Print what would run. |
| `D1_DATABASE_NAME` | Database name to target (default `debate-ai-db`). |

It also reads `apps/debate-ai.com/drizzle/*.sql` when that folder exists locally. The folder is
gitignored and must not be committed (see the repo's `CLAUDE.md`).

### Schema changes after the first deploy

- **New nullable columns** on `user_settings` and `session` are added automatically at runtime
  by `ensureTableColumns()` (`lib/database/ensure-columns.ts`).
- **Anything else** (new tables, other columns, indexes) has to be applied by hand. Run
  `drizzle-kit export` again and apply only the new statements with
  `bunx wrangler d1 execute debate-ai-db --remote --command "…"`. Package tables are covered by
  adding a new numbered file to that package's `migrations/` folder.

### Seeding and maintenance scripts

Run from `apps/debate-ai.com`:

| Script | What it does |
| --- | --- |
| `bun run db:seed:videos` | Loads `data/videos/*.json` into the local libSQL `videos` table. |
| `bun run db:seed:videos:d1` | Writes the same as SQL and executes it on the remote D1. |
| `bun run db:seed:tournaments` / `:d1` | Applies migrations and loads the demo Tabroom tournament, locally or remotely. |
| `bun run db:watch-counts` / `:d1` | Prints row counts while an import runs. |
| `bun run db:studio` | Drizzle Studio on the libSQL file. |

## Deploy to your Cloudflare account

### 1. Point the config at your account

Edit `apps/debate-ai.com/wrangler.jsonc`:

| Setting | Change it to |
| --- | --- |
| `name` | Your Worker's name. If you use Cloudflare Workers Builds, it must match that project's name. |
| `vars.ADMIN_EMAIL` | Your admin email. It is hardcoded here and overrides any dashboard value. |
| `d1_databases[].database_id` (top level **and** `env.production`) | The id printed by `wrangler d1 create`. |
| `d1_databases[].database_name` | Only if you name the database something else; then also set `D1_DATABASE_NAME` for `db:migrate:d1` and edit the database name in the `db:seed:*` scripts in `package.json`. |
| `r2_buckets[].bucket_name` | Your bucket name, if different. |

Keep `keep_vars: true`: without it every `wrangler deploy` deletes plaintext variables you set
in the dashboard. Secrets survive either way.

### 2. Create the resources

```bash
cd apps/debate-ai.com
bunx wrangler login
bunx wrangler d1 create debate-ai-db              # copy the database_id into wrangler.jsonc
bunx wrangler r2 bucket create debate-ai-db-backups   # optional: weekly backups
```

The KV namespace and the Durable Object need no manual step: wrangler provisions the KV
namespace on the first deploy, and the `migrations` block (`v1-debate-rooms`) registers
`DebateRoomSignal`.

### 3. Create the schema

Follow [A fresh database](#a-fresh-database) with `--remote`.

### 4. Set secrets

Secrets go in with `bunx wrangler secret put <NAME>` (add `--env production` if you deploy that
environment). Non-secret settings can be plaintext variables in the dashboard. At minimum set
`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (your origin), and `ADMIN_EMAILS` if you need admins
beyond `vars.ADMIN_EMAIL`. See [Environment variables](#environment-variables) for the rest.

`NEXT_PUBLIC_*` variables are read by client code (`process.env.NEXT_PUBLIC_…`), so they must be
present in the environment of the **build**, not only on the Worker.

### 5. Build and deploy

```bash
cd apps/debate-ai.com
bun run build        # vinext build, then the offline service worker (build:sw). Both are needed.
bunx wrangler deploy
```

`bun run deploy` does `db:migrate:d1`, `build` and `vinext deploy --skip-build` in one step.
Use `bun run build`, never `vinext build` alone: skipping `build:sw` ships no service worker and
offline mode silently stops working.

**Production environment.** `wrangler.jsonc` defines `env.production`, which repeats every
binding and is the only place the cron `triggers` are declared. A plain `wrangler deploy` uses the
top-level config and therefore deploys **without** scheduled jobs; deploy with
`--env production`, or copy the `triggers` block to the top level, if you want them.

### 6. Continuous deployment (optional)

`.github/workflows/cloudflare-workers-deploy.yml` builds and deploys every app under `apps/`
that has a wrangler config, on pushes to `master` that touch `apps/**` or `packages/**`. It runs
`bun install`, `bun run build`, `bun run db:migrate:d1`, then `bunx wrangler deploy`, and needs
these repository secrets: `CLOUDFLARE_API_KEY`, `CLOUDFLARE_EMAIL`, `CLOUDFLARE_ACCOUNT_ID`.
Worker variables and secrets still live on the Worker, not in GitHub.

## Environment variables

Server code reads variables through `getEnv()` (`apps/debate-ai.com/lib/env.ts`), which checks
the Worker environment first and `process.env` second. So a value can be a Worker secret, a
dashboard variable, a `vars` entry, or a line in `.dev.vars` locally. Never commit real values.

"Required" below means required for that feature; the app boots with none of them.

### Core: URLs and auth

| Variable | Purpose | Where it is used | Required |
| --- | --- | --- | --- |
| `BETTER_AUTH_SECRET` | Signs sessions and auth tokens; also signs practice-partner match tokens. Generate with `openssl rand -base64 32`. | `lib/auth/index.ts`, `packages/debate-webview/src/lib/practice-partners/match-token.ts` | **Yes in production.** Falls back to a public development string. |
| `BETTER_AUTH_URL` | Your public origin, e.g. `https://debate.example.org`. Used as the auth base URL and is always an allowed host. | `lib/auth/index.ts`, `lib/seo/site-url.ts` | **Yes** for a custom domain; the built-in host list only covers the project's own domains and localhost. |
| `NEXT_PUBLIC_APP_URL` | Fallback for the same origin, also readable by client code. | `lib/auth/index.ts`, `lib/seo/site-url.ts`, `packages/debate-webview/src/lib/config/site.ts` | Optional |
| `NEXT_PUBLIC_BASE_URL` | Further fallback for the origin. | `lib/auth/index.ts`, `lib/seo/site-url.ts`, `worker/index.ts` | Optional |
| `CANONICAL_SITE_URL` | Canonical origin for SEO (sitemap `<loc>`, `robots.txt`, `metadataBase`). Empty falls through to `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BASE_URL`, then `https://d.ebate.app`. | `lib/seo/site-url.ts`, `app/layout.tsx`, `wrangler.jsonc` `vars` | Optional; set it (or `BETTER_AUTH_URL`) so your sitemap does not point at the upstream site. |
| `BETTER_AUTH_ALLOWED_HOSTS` | Extra comma-separated hosts the app is served on (preview domains, wildcards like `*.example.workers.dev`). | `lib/auth/hosts.ts` | Optional |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Extra comma-separated origins allowed to make authenticated requests (e.g. a Firefox build of the extension's `moz-extension://…` origin). | `lib/auth/hosts.ts` | Optional |
| `ADMIN_EMAIL` | One admin email. Set in `wrangler.jsonc` `vars`. | `lib/auth/admin.ts` | One of `ADMIN_EMAIL`/`ADMIN_EMAILS`, or nobody can open `/admin`. |
| `ADMIN_EMAILS` | Comma-separated admin emails, merged with `ADMIN_EMAIL`. Admins can invite moderators in `/admin` (stored in `staff_roles`). | `lib/auth/admin.ts` | See above |

### Sign-in providers and email

| Variable | Purpose | Where it is used | Required |
| --- | --- | --- | --- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | "Sign in with Google". Redirect URI: `<origin>/api/auth/callback/google`. | `lib/auth/index.ts`, `app/api/auth/providers/route.ts` | Optional; the button is hidden without both. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | The same client id for browser-side Google One Tap. Build-time. | `packages/debate-webview/src/lib/auth/client.ts`, `…/config/site.ts` | Optional |
| `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` | "Sign in with Discord". | `lib/auth/index.ts`, `app/api/auth/providers/route.ts` | Optional |
| `AUTH_LINKEDIN_ID` / `AUTH_LINKEDIN_SECRET` | "Sign in with LinkedIn". | same | Optional |
| `RESEND_API_KEY` | Sends magic-link and verification email, round invitations and moderator invites through Resend. | `lib/auth/index.ts`, `app/api/rounds/invite/route.ts`, `app/api/admin/moderators/route.ts` | Required for email sign-in and invites. |
| `AUTH_RESEND_KEY` | Alias read when `RESEND_API_KEY` is unset. | same | Optional |

### AI providers

| Variable | Purpose | Where it is used | Required |
| --- | --- | --- | --- |
| `OPENROUTER_API_KEY` | Shared model key for AI features; preferred over Anthropic when both are set. Users can also bring their own key per request. | `lib/ai/provider-key.ts`, `lib/practice-vs-ai/backend.ts`, video and card-annotation routes | One of OpenRouter/Anthropic for AI features. |
| `ANTHROPIC_API_KEY` | Shared Anthropic key, used when no OpenRouter key is set. | `lib/ai/provider-key.ts`, `app/api/reason-ai/route.ts`, `lib/practice-vs-ai/backend.ts`, video routes | See above |
| `GEMINI_API_KEY` | Last fallback model for the Practice vs AI opponent. With none of the three, bot replies are canned. | `lib/practice-vs-ai/backend.ts` | Optional |
| `GROQ_API_KEY` | Whisper transcription for the admin "Transcribe audio" action (tried first). | `lib/youtube/audio-extract.ts` | Optional |
| `OPENAI_API_KEY` | Whisper fallback when Groq is not set. | `lib/youtube/audio-extract.ts` | Optional |

### Video library

| Variable | Purpose | Where it is used | Required |
| --- | --- | --- | --- |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key for the weekly channel scan, view-count refresh, duration backfill and admin resync. | `lib/youtube/resync-rounds.ts`, `lib/videos/*`, `packages/debate-videos-admin/src/sync/youtube/*` | Required for those jobs; without it they log and skip. |
| `YOUTUBE_PROXY_URL` | Fetch-through proxy template for transcripts, e.g. `https://proxy.example.com/fetch?url={url}`. YouTube rate-limits Cloudflare IPs. | `lib/youtube/transcript.ts` | Optional |
| `YOUTUBE_AUDIO_SERVICE_URL` | Base URL of an external media API used to download audio for videos without captions (Workers cannot download YouTube media). | `lib/youtube/audio-extract.ts` | Optional |
| `YOUTUBE_AUDIO_SERVICE_KEY` | API key that media service expects. | `lib/youtube/audio-extract.ts` | With the URL above |

### Search, cards and integrations

| Variable | Purpose | Where it is used | Required |
| --- | --- | --- | --- |
| `CARD_IMPORT_TOKEN` | Bearer token that lets the `debate-cards-upload` CLI post card batches to `/api/admin/debate-cards` without an admin session. Generate with `openssl rand -hex 32`. | `lib/admin/debate-card-import.ts`, `app/api/admin/search-index/route.ts` | Optional; without it imports need a signed-in admin. |
| `QWKSEARCH_ORIGIN` | QwkSearch deployment for "Sign in with QwkSearch" and the embedded research workspace. Default `https://qwksearch.com`. | `packages/debate-webview/src/lib/qwksearch/connect.ts`, `app/api/qwksearch/*` | Optional |
| `STRIPE_WEBHOOK_SECRET` | Verifies Stripe webhook signatures at `/api/stripe/webhook` (writes `stripe_subscriptions`). | `packages/debate-webview/src/lib/stripe/webhook.ts`, `app/api/stripe/webhook/route.ts` | Required for paid plans. |
| `STRIPE_SECRET_KEY` | Lets the webhook re-fetch the live subscription from Stripe instead of trusting event order. | `app/api/stripe/webhook/route.ts` | Recommended with Stripe |

### Webcam rooms

| Variable | Purpose | Where it is used | Required |
| --- | --- | --- | --- |
| `CF_TURN_KEY_ID` / `CF_TURN_KEY_API_TOKEN` | Mint short-lived Cloudflare TURN credentials for signed-in users. | `app/api/rooms/ice/route.ts` | Optional |
| `WEBRTC_ICE_SERVERS` | JSON array of `RTCIceServer` to use when Cloudflare TURN is not configured. Without either, only Cloudflare's public STUN server is used, which fails behind strict NATs. | `app/api/rooms/ice/route.ts` | Optional |

### Bot gate (Cloudflare Turnstile)

Opt-in and fail-open: with either key missing the gate never runs (`lib/turnstile/config.ts`).

| Variable | Purpose | Required |
| --- | --- | --- |
| `TURNSTILE_SITE_KEY` | Public site key rendered into the challenge page. | Both keys to enable the gate |
| `TURNSTILE_SECRET_KEY` | Verifies tokens and signs the pass cookie. | Both keys to enable the gate |
| `TURNSTILE_ENABLED` | `false`/`0`/`off` disables the gate while keeping the keys. | Optional |
| `TURNSTILE_TTL_SECONDS` | How long a pass lasts. Default 604800 (7 days), clamped to 300 to 2592000. | Optional |
| `TURNSTILE_COOKIE_DOMAIN` | Cookie `Domain=`, e.g. `.example.org`, to share a pass across subdomains. | Optional |

### D1 read replication

| Variable | Purpose | Where it is used | Required |
| --- | --- | --- | --- |
| `D1_SESSION_MODE` | D1 Sessions API mode: `auto` (default), `primary`, `unconstrained`, or `off` to bypass it. Can be changed in the dashboard without a redeploy. | `lib/database/d1-session.ts`, `worker/index.ts` | Optional |
| `D1_SESSION_DEBUG` | When set, responses carry `x-d1-served-by-region` / `-primary` headers. | `worker/index.ts` | Optional |

### Analytics and docs (client, build-time)

| Variable | Purpose | Where it is used | Required |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_AMPLITUDE_API_KEY` | Amplitude analytics; nothing is sent without it. | `app/amplitude.tsx` | Optional |
| `NEXT_PUBLIC_MIXPANEL_TOKEN` | Mixpanel analytics. | `packages/debate-webview/src/lib/analytics/mixpanel.ts` | Optional |
| `NEXT_PUBLIC_DOCS_URL` | Points docs links at an externally hosted docs site instead of the bundled `/docs`. | `packages/debate-webview/src/lib/docs-links.ts` | Optional |

### Tooling only (not read by the Worker)

| Variable | Purpose | Where it is used |
| --- | --- | --- |
| `DATABASE_URL` / `DATABASE_AUTH_TOKEN` | libSQL database for drizzle-kit and the Node scripts. Default `file:./data/db.sqlite`. | `drizzle.config.ts`, `lib/database/libsql.ts`, `.github/scripts/seed-videos.ts`, `.github/scripts/watch-counts.ts`, `packages/debate-search-evidence/src/caselist/caselist-sync-cli.ts` |
| `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_DATABASE_ID` / `CLOUDFLARE_D1_TOKEN` | Credentials for `db:push:d1`. | `drizzle.d1.config.ts` |
| `CLOUDFLARE_API_KEY` / `CLOUDFLARE_EMAIL` / `CLOUDFLARE_ACCOUNT_ID` | Wrangler auth in the deploy workflow (GitHub secrets). Locally, `wrangler login` replaces them. | `.github/workflows/cloudflare-workers-deploy.yml` |
| `D1_DATABASE_NAME` | Database name for the migration and row-count scripts. Default `debate-ai-db`. | `.github/scripts/migrate-d1.ts`, `.github/scripts/watch-counts.ts` |
| `DEPLOY_UPLOAD_ATTEMPTS` | Retry count for `deploy:upload` (`wrangler versions upload`). | `.github/scripts/deploy-upload.mjs` |
| `DEBATE_CARDS_ENDPOINT` / `DEBATE_ADMIN_COOKIE` | Target endpoint and admin cookie for the `debate-cards-upload` CLI (with `CARD_IMPORT_TOKEN`). | `packages/debate-search-evidence/src/lib/parquet-upload-cli-options.ts` |
| `TABROOM_API_KEY` | Tabroom auth cookie for the NDCA rankings sync script. | `packages/debate-rankings-adapter/src/sync/sync-rankings-ndca.ts` |
| `GITHUB_TOKEN` | GitHub API access in release workflows; on the Worker, enables "last edited" dates on `/docs` pages. | `.github/workflows/*`, `packages/debate-help-docs/routes/docs-page.tsx` |

`packages/debate-round-practice-ai` also contains a standalone `cf-app` and `frontend` with their
own variables (`JWT_SECRET`, `VITE_API_URL`, `VITE_BASE_URL`, `VITE_GOOGLE_CLIENT_ID`, …; see
`packages/debate-round-practice-ai/cf-app/.dev.vars.example`). The main app does not use them;
it runs Practice vs AI through `lib/practice-vs-ai/backend.ts` with the keys above.

## Scheduled jobs

Defined in `wrangler.jsonc` under `env.production.triggers.crons` and handled by `scheduled()`
in `worker/index.ts`:

| Cron (UTC) | Jobs |
| --- | --- |
| `0 6 * * *` | Daily YouTube channel scan for new videos (needs `YOUTUBE_API_KEY`). |
| `0 8 * * MON` | YouTube view-count refresh (needs `YOUTUBE_API_KEY`); purge of old `reuse_check_log` rows; finishing the card search FTS and sort indexes; opening automatic prediction markets. |
| `0 7 * * SUN` | Weekly backup of content tables (videos, cards, history; no user data) to R2 and KV. |

## Troubleshooting

- **`no such table` / `no such column` errors.** The schema did not reach the database. Re-run
  [A fresh database](#a-fresh-database) on an empty database, or apply the missing statements.
- **Sign-in redirects to the wrong domain or fails the origin check.** Set `BETTER_AUTH_URL` to
  your origin and add any other hosts to `BETTER_AUTH_ALLOWED_HOSTS`.
- **Nobody can open `/admin`.** Set `ADMIN_EMAIL` in `wrangler.jsonc` or `ADMIN_EMAILS` on the Worker.
- **Variables vanish after a deploy.** `keep_vars` was removed from `wrangler.jsonc`, or they
  were set on a different environment than the one you deploy.
- **Content-table backups fail with `exceededCpu`.** Keep `limits.cpu_ms` at 120000; that requires
  the Workers Standard usage model.
- **Offline mode does not work.** The build skipped `build:sw`; use `bun run build`.
