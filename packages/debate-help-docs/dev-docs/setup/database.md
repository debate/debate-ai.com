---
title: Database setup
description: Where the D1 tables come from, creating a fresh database, and migrating it
---

# Database setup and migrations

The database is one D1 database. Its tables come from three places:

| Source | Tables | How they reach a database |
| --- | --- | --- |
| `apps/debate-ai.com/lib/database/schema.ts` (Drizzle) | The 72 app tables | `drizzle-kit export` or `db:push:d1` (below). The app's own `drizzle/` migrations folder is deliberately **not** in git. |
| `packages/*/migrations/*.sql` | Tabroom (110), prediction markets, YouTube channels, topic polls, profile follows, plus two data migrations for the video queue | `bun run db:migrate:d1` (`.github/scripts/migrate-d1.ts`) |
| Runtime `CREATE … IF NOT EXISTS` | `organization`/`member`/`invitation`, `qwksearch_connection`, `video_durations`, the card search FTS tables | Created by the app on first use |

## A fresh database

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

## How `db:migrate:d1` works

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

## Schema changes after the first deploy

- **New nullable columns** on `user_settings` and `session` are added automatically at runtime
  by `ensureTableColumns()` (`lib/database/ensure-columns.ts`).
- **Anything else** (new tables, other columns, indexes) has to be applied by hand. Run
  `drizzle-kit export` again and apply only the new statements with
  `bunx wrangler d1 execute debate-ai-db --remote --command "…"`. Package tables are covered by
  adding a new numbered file to that package's `migrations/` folder.

## Seeding and maintenance scripts

Run from `apps/debate-ai.com`:

| Script | What it does |
| --- | --- |
| `bun run db:seed:videos` | Loads `data/videos/*.json` into the local libSQL `videos` table. |
| `bun run db:seed:videos:d1` | Writes the same as SQL and executes it on the remote D1. |
| `bun run db:seed:tournaments` / `:d1` | Applies migrations and loads the demo Tabroom tournament, locally or remotely. |
| `bun run db:watch-counts` / `:d1` | Prints row counts while an import runs. |
| `bun run db:studio` | Drizzle Studio on the libSQL file. |
