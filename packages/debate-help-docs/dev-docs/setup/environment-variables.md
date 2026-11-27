---
title: Environment variables
description: Every variable the app reads, what it is for and whether it is required
---

# Environment variables

Server code reads variables through `getEnv()` (`apps/debate-ai.com/lib/env.ts`), which checks
the Worker environment first and `process.env` second. So a value can be a Worker secret, a
dashboard variable, a `vars` entry, or a line in `.dev.vars` locally. Never commit real values.

"Required" below means required for that feature; the app boots with none of them.

## Editing them from the admin panel

**Admin → Environment** (admins only) edits the production Worker's variables and secrets
through the Cloudflare API and rebuilds from GitHub, so a change needs no dashboard or CLI.

- **Credentials.** A Cloudflare API token (Account · Workers Scripts · Edit), the account ID and
  Worker name (`d-ebate-app`), and a GitHub token with Actions read/write, Contents read, Variables
  read/write and Metadata read on the repo (or a classic token with `repo`). They are saved
  encrypted in D1 under the `SERVICE_LOGINS_SECRET` / `BETTER_AUTH_SECRET` key and never sent back;
  **Test connection** names any permission that is missing.
- **Variables.** Plain-text variables show their value, secrets only their name. Edits (including
  bulk `.env` paste) are staged, then a diff is confirmed before anything is sent. The save is one
  `PATCH .../workers/scripts/<name>/settings`, which replaces the whole bindings list, so every
  binding that is not a variable (D1, R2, KV, Durable Objects, AI, assets, other secrets) is sent
  as `{ "type": "inherit" }` and the settings are re-read afterwards to check none went missing.
  Deleting a variable, or changing `BETTER_AUTH_SECRET`, `SERVICE_LOGINS_SECRET`, `ADMIN_EMAIL(S)`
  or the D1 binding, needs an extra confirmation. Every change is logged by name, never by value.
- **`wrangler.jsonc` wins.** `wrangler deploy` rewrites the `vars` in that file on every deploy, so
  a variable listed there is flagged and an API-side edit to it is undone by the next deploy. The
  file has `keep_vars: true`, so variables that are only in Cloudflare survive deploys; the panel
  warns if that ever changes.
- **Rebuild.** Runtime variables take effect as soon as they are applied. **Apply and rebuild**
  also dispatches `.github/workflows/cloudflare-workers-deploy.yml` (`workflow_dispatch`) with the
  GitHub token, which builds and `wrangler deploy`s. `NEXT_PUBLIC_*` variables are inlined into the
  browser bundle at build time, so those are also written to the repository's GitHub Actions
  variables first (the workflow exports every `NEXT_PUBLIC_*` repository variable into the build).
  Cloudflare Workers Builds (the `d-ebate-app` check) keeps its own build variables in the
  Cloudflare dashboard; the panel does not manage those.

## Core: URLs and auth

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

## Sign-in providers and email

| Variable | Purpose | Where it is used | Required |
| --- | --- | --- | --- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | "Sign in with Google". Redirect URI: `<origin>/api/auth/callback/google`. | `lib/auth/index.ts`, `app/api/auth/providers/route.ts` | Optional; the button is hidden without both. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | The same client id for browser-side Google One Tap. Build-time. | `packages/debate-webview/src/lib/auth/client.ts`, `…/config/site.ts` | Optional |
| `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` | "Sign in with Discord". | `lib/auth/index.ts`, `app/api/auth/providers/route.ts` | Optional |
| `AUTH_LINKEDIN_ID` / `AUTH_LINKEDIN_SECRET` | "Sign in with LinkedIn". | same | Optional |
| `RESEND_API_KEY` | Sends magic-link and verification email, round invitations and moderator invites through Resend. Admin → Emails sends to saved lists with the key saved there (stored encrypted in D1) and falls back to this secret. | `lib/auth/index.ts`, `app/api/rounds/invite/route.ts`, `app/api/admin/moderators/route.ts`, `lib/emails/settings.ts` | Required for email sign-in and invites. |
| `AUTH_RESEND_KEY` | Alias read when `RESEND_API_KEY` is unset. | same | Optional |

## AI providers

| Variable | Purpose | Where it is used | Required |
| --- | --- | --- | --- |
| `OPENROUTER_API_KEY` | Shared model key for AI features; preferred over Anthropic when both are set. Users can also bring their own key per request. | `lib/ai/provider-key.ts`, `lib/practice-vs-ai/backend.ts`, video and card-annotation routes | One of OpenRouter/Anthropic for AI features. |
| `ANTHROPIC_API_KEY` | Shared Anthropic key, used when no OpenRouter key is set. | `lib/ai/provider-key.ts`, `app/api/reason-ai/route.ts`, `lib/practice-vs-ai/backend.ts`, video routes | See above |
| `GEMINI_API_KEY` | Last fallback model for the Practice vs AI opponent. With none of the three, bot replies are canned. | `lib/practice-vs-ai/backend.ts` | Optional |
| `GROQ_API_KEY` | Whisper transcription for the admin "Transcribe audio" action (tried first). | `lib/youtube/audio-extract.ts` | Optional |
| `OPENAI_API_KEY` | Whisper fallback when Groq is not set. | `lib/youtube/audio-extract.ts` | Optional |

## Video library

| Variable | Purpose | Where it is used | Required |
| --- | --- | --- | --- |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key for the weekly channel scan, view-count refresh, duration backfill and admin resync. | `lib/youtube/resync-rounds.ts`, `lib/videos/*`, `packages/debate-videos-admin/src/sync/youtube/*` | Required for those jobs; without it they log and skip. |
| `YOUTUBE_PROXY_URL` | Fetch-through proxy template for transcripts, e.g. `https://proxy.example.com/fetch?url={url}`. YouTube rate-limits Cloudflare IPs. | `lib/youtube/transcript.ts` | Optional |
| `YOUTUBE_AUDIO_SERVICE_URL` | Base URL of an external media API used to download audio for videos without captions (Workers cannot download YouTube media). | `lib/youtube/audio-extract.ts` | Optional |
| `YOUTUBE_AUDIO_SERVICE_KEY` | API key that media service expects. | `lib/youtube/audio-extract.ts` | With the URL above |

## Search, cards and integrations

| Variable | Purpose | Where it is used | Required |
| --- | --- | --- | --- |
| `CARD_IMPORT_TOKEN` | Bearer token that lets the `debate-cards-upload` CLI post card batches to `/api/admin/debate-cards` without an admin session. Generate with `openssl rand -hex 32`. | `lib/admin/debate-card-import.ts`, `app/api/admin/search-index/route.ts` | Optional; without it imports need a signed-in admin. |
| `QWKSEARCH_ORIGIN` | QwkSearch deployment for "Sign in with QwkSearch" and the embedded research workspace. Default `https://qwksearch.com`. | `packages/debate-webview/src/lib/qwksearch/connect.ts`, `app/api/qwksearch/*` | Optional |
| `STRIPE_WEBHOOK_SECRET` | Verifies Stripe webhook signatures at `/api/stripe/webhook` (writes `stripe_subscriptions`). | `packages/debate-webview/src/lib/stripe/webhook.ts`, `app/api/stripe/webhook/route.ts` | Required for paid plans. |
| `STRIPE_SECRET_KEY` | Lets the webhook re-fetch the live subscription from Stripe instead of trusting event order. | `app/api/stripe/webhook/route.ts` | Recommended with Stripe |
| `TABROOM_API_KEY` | The site's Tabroom session: the value of the `TabroomToken` cookie from a browser signed in at tabroom.com, raw (`$6$…`) or URL-encoded as copied (`%246%24…`). The Worker prefers the Tabroom login saved under **Admin → Service logins** (it signs in itself and signs in again when Tabroom rejects the session); this secret is the fallback when none is saved or it can't sign in. Sent as `Cookie: TabroomToken=<value>` on server-side Tabroom requests (the `/api/tabroom-beta` proxy, paradigm search and sync, the video results lookups) and by the rankings sync scripts. Set it as a Worker secret: `bunx wrangler secret put TABROOM_API_KEY` from `apps/debate-web`. `TABROOM_SESSION_TOKEN` is read as a fallback; `TABROOM_COOKIE_NAME` overrides the cookie name. | `apps/debate-web/lib/judge-paradigms/tabroom.ts`, `lib/service-logins/`, `app/api/tabroom-beta/[...path]/route.ts`, `packages/debate-rankings/src/sync/sync-rankings-ndca.ts` | Optional with a saved Tabroom login; otherwise recommended, or Tabroom requests go out signed out and paradigms and round results can't be read. |
| `SERVICE_LOGINS_SECRET` | Encrypts (AES-GCM) the Tabroom and openCaselist passwords and session tokens saved under **Admin → Service logins** in the `service_logins` table. Falls back to `BETTER_AUTH_SECRET`. Changing it makes saved logins unreadable; re-enter them in the panel. | `apps/debate-web/lib/service-logins/` | Optional; set it to keep these keys independent of `BETTER_AUTH_SECRET`. |

## Webcam rooms

| Variable | Purpose | Where it is used | Required |
| --- | --- | --- | --- |
| `CF_TURN_KEY_ID` / `CF_TURN_KEY_API_TOKEN` | Mint short-lived Cloudflare TURN credentials for signed-in users. | `app/api/rooms/ice/route.ts` | Optional |
| `WEBRTC_ICE_SERVERS` | JSON array of `RTCIceServer` to use when Cloudflare TURN is not configured. Without either, only Cloudflare's public STUN server is used, which fails behind strict NATs. | `app/api/rooms/ice/route.ts` | Optional |

## Bot gate (Cloudflare Turnstile)

Opt-in and fail-open: with either key missing the gate never runs (`lib/turnstile/config.ts`).

| Variable | Purpose | Required |
| --- | --- | --- |
| `TURNSTILE_SITE_KEY` | Public site key rendered into the challenge page. | Both keys to enable the gate |
| `TURNSTILE_SECRET_KEY` | Verifies tokens and signs the pass cookie. | Both keys to enable the gate |
| `TURNSTILE_ENABLED` | `false`/`0`/`off` disables the gate while keeping the keys. | Optional |
| `TURNSTILE_TTL_SECONDS` | How long a pass lasts. Default 604800 (7 days), clamped to 300 to 2592000. | Optional |
| `TURNSTILE_COOKIE_DOMAIN` | Cookie `Domain=`, e.g. `.example.org`, to share a pass across subdomains. | Optional |

## D1 read replication

| Variable | Purpose | Where it is used | Required |
| --- | --- | --- | --- |
| `D1_SESSION_MODE` | D1 Sessions API mode: `auto` (default), `primary`, `unconstrained`, or `off` to bypass it. Can be changed in the dashboard without a redeploy. | `lib/database/d1-session.ts`, `worker/index.ts` | Optional |
| `D1_SESSION_DEBUG` | When set, responses carry `x-d1-served-by-region` / `-primary` headers. | `worker/index.ts` | Optional |

## Analytics and docs (client, build-time)

| Variable | Purpose | Where it is used | Required |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_AMPLITUDE_API_KEY` | Amplitude analytics (autocapture, page views on every route change, Session Replay with the card editor blocked, see `packages/debate-webview/src/lib/analytics/amplitude/replay-config.ts`); nothing is sent without it. Inlined at build time, so set it where the build runs: the deploy workflow passes it to the build step (a repo variable of the same name overrides the default key). | `app/amplitude.tsx` | Optional |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry error monitoring in the browser (`@sentry/react`: errors, 10% of traces, Session Replay for 10% of sessions and every session with an error, the feedback widget). Public by design and inlined at build time: the deploy workflow passes the repo variable of the same name to the build step. Nothing is loaded without it. | `apps/debate-web/instrumentation-client.ts` | Optional |
| `SENTRY_DSN` | Sentry error monitoring in the Worker (`@sentry/cloudflare` wraps `fetch` and the crons in `worker/index.ts`; page, server action and route errors vinext catches arrive through `onRequestError` in `instrumentation.ts`). Read at runtime, so set it as a Worker secret or Variable; can be the same DSN as the browser one. `SENTRY_ENVIRONMENT` optionally replaces the `production` label. | `apps/debate-web/worker/index.ts` | Optional |
| `NEXT_PUBLIC_MIXPANEL_TOKEN` | Mixpanel analytics. | `packages/debate-webview/src/lib/analytics/mixpanel.ts` | Optional |
| `NEXT_PUBLIC_DOCS_URL` | Points docs links at an externally hosted docs site instead of the bundled `/docs`. | `packages/debate-webview/src/lib/docs-links.ts` | Optional |

## Tooling only (not read by the Worker)

| Variable | Purpose | Where it is used |
| --- | --- | --- |
| `DATABASE_URL` / `DATABASE_AUTH_TOKEN` | libSQL database for drizzle-kit and the Node scripts. Default `file:./data/db.sqlite`. | `drizzle.config.ts`, `lib/database/libsql.ts`, `.github/scripts/seed-videos.ts`, `.github/scripts/watch-counts.ts`, `packages/debate-search-evidence/src/caselist/caselist-sync-cli.ts` |
| `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_DATABASE_ID` / `CLOUDFLARE_D1_TOKEN` | Credentials for `db:push:d1` (`DRIZZLE_TARGET=d1`). | `drizzle.config.ts` |
| `CLOUDFLARE_API_KEY` / `CLOUDFLARE_EMAIL` / `CLOUDFLARE_ACCOUNT_ID` | Wrangler auth in the deploy workflow (GitHub secrets). Locally, `wrangler login` replaces them. | `.github/workflows/cloudflare-workers-deploy.yml` |
| `REQUIRE_TESTS_TO_DEPLOY` | GitHub repository *variable* (not a secret). `true` makes a failing test stop the deploy; unset or anything else lets the deploy continue with a warning. Default off. | `.github/workflows/cloudflare-workers-deploy.yml` |
| `D1_DATABASE_NAME` | Database name for the migration and row-count scripts. Default `debate-ai-db`. | `.github/scripts/migrate-d1.ts`, `.github/scripts/watch-counts.ts` |
| `DEPLOY_UPLOAD_ATTEMPTS` | Retry count for `deploy:upload` (`wrangler versions upload`). | `.github/scripts/deploy-upload.mjs` |
| `DEBATE_CARDS_ENDPOINT` / `DEBATE_ADMIN_COOKIE` | Target endpoint and admin cookie for the `debate-cards-upload` CLI (with `CARD_IMPORT_TOKEN`). | `packages/debate-search-evidence/src/lib/parquet-upload-cli-options.ts` |
| `GITHUB_TOKEN` | GitHub API access in release workflows; on the Worker, a fallback source for the "last updated" date in the page Info button on `/docs` pages when the build had no full Git history (normally the date comes from Git at build time, `lib/mdx/git-last-modified.ts`, which fetches the history itself when the build clone is shallow). | `.github/workflows/*`, `packages/debate-help-docs/routes/docs-page.tsx` |

`packages/debate-round-practice-ai` also contains a standalone `cf-app` and `frontend` with their
own variables (`JWT_SECRET`, `VITE_API_URL`, `VITE_BASE_URL`, `VITE_GOOGLE_CLIENT_ID`, …; see
`packages/debate-round-practice-ai/cf-app/.dev.vars.example`). The main app does not use them;
it runs Practice vs AI through `lib/practice-vs-ai/backend.ts` with the keys above.
