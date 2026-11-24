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
| `30 * * * *` | Moves card full text/markup and caselist doc HTML still in D1 into the `CARD_TEXT` R2 bucket, resuming from `cron/move-text-cursor.json` in that bucket; idles once done and rescans daily. Same work as the admin "Move card text to R2" button, but throttled because it shares D1 with live traffic: 100-card pages, a 3 s pause after each page, a 4-minute budget, and it stops for the hour as soon as D1 says it is overloaded. (Back-to-back 500-card pages for 10 minutes overloaded D1 every hour and turned signed-in requests into 500s/503s.) |

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
- **A user's saved item is missing from a list, or opening it says it is damaged.** Its row's
  `data` column (the JSON-encoded client record in `saved_flows`, `saved_drill_sets`,
  `saved_tool_records` and the other account tables) can't be parsed. List routes skip such a
  row instead of failing the whole list (`parseSavedRows` in `apps/debate-web/lib/api/saved-rows.ts`),
  and `GET /api/flows/[clientId]` / `GET /api/rounds/[clientId]` answer 422 for one. Fix or
  delete the row in D1; the user can also remove a damaged flow or round from their account.
- **Offline mode does not work.** The build skipped `build:sw`; use `bun run build`.
