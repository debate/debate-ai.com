# `debate-ai.com`

The deployed application: [debate-ai.com](https://debate-ai.com). Routes, the
`/api` handlers, auth, the D1 schema, the offline service worker and the
Worker that serves all of it.

**Only `apps/debate-ai.com` is a workspace.** `apps/debate-native-wrapper` and
`apps/debate-web-ext` are deliberately outside the workspace globs, so a root
`bun install` does not install them.

Almost no feature logic lives here. Nearly every feature is a
`packages/debate-*` library that a route in `app/` merely mounts — find the
owning package before editing anything under `app/`. The map is in the
[root CLAUDE.md](../../CLAUDE.md#where-things-live).

## What it does

| Area | Route | Owning package |
| --- | --- | --- |
| Evidence research, card scoring, review queue | `/research`, `/cards` | `debate-search-evidence` |
| The card editor, `.docx` interop | `/reason-editor`, `/doc` | `debate-editor`, `debate-card-parser` |
| The live round workspace (FIAT), flow grid | `/debate`, `/practice-round` | `debate-round`, `debate-flow` |
| Practice drills, AI coach, AI judge | `/drills`, `/coach`, `/judge-decision` | `debate-practice-drills` |
| A full timed round against an AI opponent | `/versus-ai`, `/practice-opponent`, `/opponents` | `debate-round-practice-ai` |
| Speech and prep timers, the in-round recorder | `/speech-documents`, `/word-count` | `debate-timer` |
| The video library (LEARN) | `/videos` | `debate-videos` |
| Team prep, task inbox, prep room | `/community-hub`, `/prep-notes`, `/contacts` | `debate-team-collaboration` |
| Leaderboards, quests, contributor awards | `/rank`, `/outcomes` | `debate-contributor-progress` |
| AI prompts for speeches and flows | `/summaries`, `/strategy`, `/outline` | `debate-speech-writer` |
| Documentation | `/docs` | `debate-help-docs` |
| Accounts | `/login`, `/settings` | better-auth |
| Admin | `/admin` | gated on `ADMIN_EMAILS` |

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js App Router, built by [vinext](https://github.com/cloudflare/vinext) (Vite) rather than `next build` |
| Runtime | Cloudflare Workers (`workerd`) |
| Database | Cloudflare D1 via Drizzle ORM, with the [D1 Sessions API](https://developers.cloudflare.com/d1/best-practices/read-replication/) for read replication |
| Auth | [better-auth](https://better-auth.com) — Google, Discord, LinkedIn, email |
| Offline | A generated service worker (`lib/offline-sw`, bundled by webpack) |
| Images | The Cloudflare `IMAGES` binding, via `worker/index.ts` |
| Tests | Vitest — one config for the whole repo, at [`vitest.config.ts`](./vitest.config.ts) |

## Quick start

From the repository root:

```bash
bun install                    # never npm or yarn
bun run dev:web                # http://localhost:3000 — just this app
bun run dev                    # everything
```

Nothing has to be configured to boot. `BETTER_AUTH_SECRET` falls back to
`dev-secret-change-in-production` locally, and each missing key disables one
feature rather than failing the build.

Before opening a PR, run what CI runs:

```bash
bun run typecheck
bun run test
```

## Environment variables

There is no `.env.example` in this directory — [`setup-secrets.sh`](./setup-secrets.sh)
lists the deployed set, and everything is read through `getEnv()`, which checks
the Worker environment first and `process.env` second. Local values go in
`apps/debate-ai.com/.env`; deployed values go behind
`wrangler secret put <NAME>`.

`wrangler.jsonc` deliberately defines no `vars` and sets `keep_vars: true`, so
plaintext variables entered in the Cloudflare dashboard survive each deploy.
Secrets survive either way.

### App URLs

| Variable | Enables | Where to get it |
| --- | --- | --- |
| `NEXT_PUBLIC_BASE_URL` | Absolute links, OAuth callbacks, email links. | Your own origin — `https://debate-ai.com` in production. |
| `NEXT_PUBLIC_APP_URL` | The same, where a component needs it client-side. | Same value. |
| `NEXT_PUBLIC_DOCS_URL` | Points `/docs` at an externally hosted docs build. | Optional; omit to serve the bundled docs. |

### Auth

| Variable | Enables | Where to get it |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | Session signing. **Set this in production** — it falls back to a well-known development string otherwise. | Generate one: `openssl rand -base64 32`. See [better-auth installation](https://www.better-auth.com/docs/installation). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | "Sign in with Google". | [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) → OAuth client ID (Web application). Redirect URI: `<BASE_URL>/api/auth/callback/google`. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | The same client ID, for the browser. | Same value as `GOOGLE_CLIENT_ID`. |
| `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` | "Sign in with Discord". | [discord.com/developers/applications](https://discord.com/developers/applications) → your app → OAuth2 → General Information. |
| `AUTH_LINKEDIN_ID` / `AUTH_LINKEDIN_SECRET` | "Sign in with LinkedIn". | [linkedin.com/developers](https://www.linkedin.com/developers/) → your app → Auth. |
| `RESEND_API_KEY` (alias `AUTH_RESEND_KEY`) | Verification email and round invitations. | [resend.com/api-keys](https://resend.com/api-keys) |
| `BETTER_AUTH_ALLOWED_HOSTS` | Extra comma-separated hosts this app is served from. See [`lib/auth/hosts.ts`](./lib/auth/hosts.ts). | Your own preview or custom-domain hosts. |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Extra origins allowed to make authenticated requests. | The same. |
| `ADMIN_EMAILS` | Restricts `/admin` to the comma-separated addresses listed. **Leaving it unset leaves `/admin` open to every signed-in user** — set it before you deploy. | Your own addresses. |

### Model providers

| Variable | Enables | Where to get it |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | `/api/reason-ai` and the AI opponent in `debate-round-practice-ai`. Without it — and without a Gemini key — bot replies are canned. | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| `GEMINI_API_KEY` | The AI opponent's fallback model. | [Google AI Studio](https://aistudio.google.com/app/apikey) |

### The video library

| Variable | Enables | Where to get it |
| --- | --- | --- |
| `YOUTUBE_API_KEY` | The weekly channel scan and view-count refresh, and the `/admin` resync. **Required** for either to run. | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → enable *YouTube Data API v3* → Create Credentials → API key. |
| `YOUTUBE_PROXY_URL` | A fetch-through proxy for transcripts, e.g. `https://proxy.example.com/fetch?key=K&url={url}`. YouTube rate-limits Cloudflare egress IPs, so transcripts often need one. | Your own proxy. |

### Card import

| Variable | Enables | Where to get it |
| --- | --- | --- |
| `CARD_IMPORT_TOKEN` | Bearer-token auth for the `debate-cards-upload` CLI. Without it, card imports require an admin session — which a laptop or CI job does not have. | Generate one: `openssl rand -hex 32`. |

### D1 read replication

| Variable | Enables | Where to get it |
| --- | --- | --- |
| `D1_SESSION_MODE` | `auto` (default), `primary`, `unconstrained`, or `off` as a rollback switch. A plain Worker variable, so it can be flipped in the dashboard without a redeploy. | See [`lib/database/d1-session.ts`](./lib/database/d1-session.ts). |
| `D1_SESSION_DEBUG` | Adds `x-d1-served-by-region` / `-primary` response headers so you can see which D1 instance answered. | — |

### Bot gate — Cloudflare Turnstile

Optional. With both keys unset the gate never runs. Set both to challenge a
desktop browser's first HTML page view; phones, crawlers, `/api/*`, assets and
RSC fetches are never challenged.

| Variable | Enables | Where to get it |
| --- | --- | --- |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | The gate. | [Cloudflare dashboard](https://dash.cloudflare.com) → Turnstile → Add widget (Managed). |
| `TURNSTILE_ENABLED` | `"false"` switches it off while keeping the keys. | — |
| `TURNSTILE_TTL_SECONDS` | How long one pass lasts. Default 604800 (7 days). | — |
| `TURNSTILE_COOKIE_DOMAIN` | Shares one pass across subdomains, e.g. `.debate-ai.com`. | — |

## Scripts

| Script | What it does |
| --- | --- |
| `dev` | `vinext dev` on port 3000. |
| `build` | `build:docs` → `vinext build` → `build:sw`. All three stages matter. |
| `build:sw` | Generates and webpack-bundles the offline service worker into `dist/client`. |
| `preview` | Builds, then `wrangler dev` — the real Worker locally. |
| `deploy` / `deploy:staging` | Migrates D1, builds, then `vinext deploy`. |
| `db:generate` | Generates a Drizzle migration into `drizzle/`. |
| `db:migrate:d1` | Applies migrations to D1. |
| `db:seed:videos` / `:d1` | Seeds the video library locally or remotely. |
| `db:studio` | Drizzle Studio. |
| `typecheck` / `test` / `coverage` | What CI runs. |

## Deploying

Target: Cloudflare Workers. Once, per account:

```bash
bunx wrangler login
bunx wrangler d1 create debate-ai-db       # paste the id into wrangler.jsonc
bun run db:migrate:d1
bun run db:seed:videos:d1                  # optional: seed the video library
```

Then the secrets. [`setup-secrets.sh`](./setup-secrets.sh) prints the list; set
each with `bunx wrangler secret put <NAME>`. At minimum, set
`BETTER_AUTH_SECRET` and `ADMIN_EMAILS` — the first has an insecure fallback,
and the second leaves `/admin` open to every signed-in user when unset.

Ship it:

```bash
bun run preview     # the real Worker, locally — do this first
bun run deploy      # migrate, build, deploy
```

Three things to know before a deploy surprises you:

- **The Worker name is load-bearing.** `"name": "debate-ai-com"` must match the
  Cloudflare Workers Builds project name. If it does not, CI overrides it at
  deploy time and a manual `wrangler deploy` from this directory targets a
  different Worker than production.
- **`keep_vars: true` is load-bearing.** This config defines no `vars`, so
  without it every deploy would delete the plaintext variables set in the
  dashboard.
- **Use `bun run build`, not `vinext build` alone.** Skipping `build:docs`
  ships a stale `/docs`, and skipping `build:sw` ships no service worker, so
  offline mode silently stops working.

A weekly cron (`0 8 * * 1` — Mondays 08:00 UTC) runs the YouTube channel scan
and view-count refresh from the `scheduled` export in
[`worker/index.ts`](./worker/index.ts). It needs `YOUTUBE_API_KEY` set, or it
logs and returns.

## Tests

Tests live in each package's `test/` folder, and there is exactly one Vitest
config for the whole repository — [`vitest.config.ts`](./vitest.config.ts), here.
The repo root is kept free of tool configs on purpose; don't add one.

```bash
bun run test        # from the repo root: one run across every package
bun run coverage    # merged into coverage/lcov.info
```
