---
title: Deploy
description: Deploy the Worker and its resources to your own Cloudflare account
---

# Deploy to your Cloudflare account

## 1. Point the config at your account

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

## 2. Create the resources

```bash
cd apps/debate-ai.com
bunx wrangler login
bunx wrangler d1 create debate-ai-db              # copy the database_id into wrangler.jsonc
bunx wrangler r2 bucket create debate-ai-db-backups   # optional: weekly backups
```

The KV namespace and the Durable Object need no manual step: wrangler provisions the KV
namespace on the first deploy, and the `migrations` block (`v1-debate-rooms`) registers
`DebateRoomSignal`.

## 3. Create the schema

Follow [A fresh database](./database.md#a-fresh-database) with `--remote`.

## 4. Set secrets

Secrets go in with `bunx wrangler secret put <NAME>` (add `--env production` if you deploy that
environment). Non-secret settings can be plaintext variables in the dashboard. At minimum set
`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (your origin), and `ADMIN_EMAILS` if you need admins
beyond `vars.ADMIN_EMAIL`. See [Environment variables](./environment-variables.md) for the rest.

`NEXT_PUBLIC_*` variables are read by client code (`process.env.NEXT_PUBLIC_…`), so they must be
present in the environment of the **build**, not only on the Worker.

## 5. Build and deploy

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

## 6. Continuous deployment (optional)

`.github/workflows/cloudflare-workers-deploy.yml` builds and deploys every app under `apps/`
that has a wrangler config, on pushes to `master` that touch `apps/**` or `packages/**`. It runs
`bun install`, `bun run build`, `bun run db:migrate:d1`, then `bunx wrangler deploy`, and needs
these repository secrets: `CLOUDFLARE_API_KEY`, `CLOUDFLARE_EMAIL`, `CLOUDFLARE_ACCOUNT_ID`.
Worker variables and secrets still live on the Worker, not in GitHub.
