---
title: Operations
description: Scheduled jobs and troubleshooting a running deployment
---

# Operations

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
  [A fresh database](./database.md#a-fresh-database) on an empty database, or apply the missing statements.
- **Sign-in redirects to the wrong domain or fails the origin check.** Set `BETTER_AUTH_URL` to
  your origin and add any other hosts to `BETTER_AUTH_ALLOWED_HOSTS`.
- **Nobody can open `/admin`.** Set `ADMIN_EMAIL` in `wrangler.jsonc` or `ADMIN_EMAILS` on the Worker.
- **Variables vanish after a deploy.** `keep_vars` was removed from `wrangler.jsonc`, or they
  were set on a different environment than the one you deploy.
- **Content-table backups fail with `exceededCpu`.** Keep `limits.cpu_ms` at 120000; that requires
  the Workers Standard usage model.
- **Offline mode does not work.** The build skipped `build:sw`; use `bun run build`.
