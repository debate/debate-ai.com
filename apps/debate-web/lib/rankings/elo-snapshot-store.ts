/**
 * Monthly Elo snapshots: every team's rating and rank, saved once per
 * calendar month and kept for all time (`leaderboard/eloHistory.ts` in
 * `@debate-ai/rankings`).
 *
 * `elo_monthly_snapshots` holds one row per month and dataset (`2026-11`,
 * `hspf`), the teams as compact JSON (`{ key: [rating, rank] }`). The daily
 * rankings cron calls {@link runMonthlyEloSnapshot}; its first run of a new
 * month scrapes the live ratings and saves them. The insert is `INSERT OR
 * IGNORE` on the month's primary key, so a month already saved — every past
 * month — is never overwritten, even by a re-run or a second isolate.
 *
 * Every save also writes one `scraper_log` row (job `elo-monthly-snapshot`)
 * naming the month and team counts, in the same `db.batch()`: the whole month
 * costs one D1 request. Days that find the month already saved only read.
 *
 * Created on first use: the app has no tracked migrations (see
 * `lib/database/ensure-columns.ts`).
 */

import { sql } from "drizzle-orm";
import { clearExtinctionCache, loadRankingDataset, type RankingDatasetId } from "@debate-ai/rankings";
import {
  ELO_HISTORY_DATASETS,
  buildEloSnapshot,
  eloHistoryFor,
  eloSnapshotMonth,
  type EloHistory,
  type EloSnapshotTeams,
} from "@debate-ai/rankings/src/leaderboard/eloHistory";
import type { RankingEntry } from "@debate-ai/rankings/src/types";
import type { getDBFromContext } from "@/lib/database/context";

type Database = Awaited<ReturnType<typeof getDBFromContext>>;

/** The `scraper_log` job name of the monthly save. */
export const ELO_SNAPSHOT_JOB = "elo-monthly-snapshot";

const CREATE_SNAPSHOTS_SQL = `CREATE TABLE IF NOT EXISTS "elo_monthly_snapshots" (
  "month" text NOT NULL,
  "dataset" text NOT NULL,
  "captured_at" integer NOT NULL,
  "teams" integer NOT NULL,
  "body" text NOT NULL,
  PRIMARY KEY ("month", "dataset")
)`;

const CREATE_LOG_SQL = `CREATE TABLE IF NOT EXISTS "scraper_log" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "job" text NOT NULL,
  "ran_at" integer NOT NULL,
  "detail" text NOT NULL
)`;

let tablesReady: Promise<void> | null = null;

function ensureTables(db: Database): Promise<void> {
  tablesReady ??= (async () => {
    await db.run(sql.raw(CREATE_SNAPSHOTS_SQL));
    await db.run(sql.raw(CREATE_LOG_SQL));
  })().catch((error) => {
    tablesReady = null;
    throw error;
  });
  return tablesReady;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** Where the cron gets each dataset's live entries; injectable for tests. */
export type EloSnapshotSource = (id: RankingDatasetId) => Promise<readonly RankingEntry[]>;

/** The live ratings, loaded fresh. */
export const defaultEloSnapshotSource: EloSnapshotSource = async (id) => {
  clearExtinctionCache();
  return (await loadRankingDataset(id)).entries;
};

/** What a run did. */
export interface EloSnapshotResult {
  month: string;
  /** Datasets saved this run, with their team counts. */
  saved: { dataset: RankingDatasetId; teams: number }[];
  /** Datasets that could not load; tomorrow's run tries them again. */
  failed: RankingDatasetId[];
}

/**
 * The daily cron's job: on the first run of a month, saves every dataset not
 * yet saved for that month, and logs the save. Later runs that month find
 * every dataset saved and stop after one read. A dataset that fails to load
 * is retried the next day (still the same month's snapshot).
 *
 * @returns What was saved, or null when the month was already complete.
 */
export async function runMonthlyEloSnapshot(
  db: Database,
  source: EloSnapshotSource = defaultEloSnapshotSource,
  now: number = nowSeconds(),
): Promise<EloSnapshotResult | null> {
  await ensureTables(db);
  const month = eloSnapshotMonth(now);
  const done = new Set(
    ((await db.all(sql`SELECT dataset FROM elo_monthly_snapshots WHERE month = ${month}`)) as { dataset: string }[]).map(
      (row) => row.dataset,
    ),
  );
  const due = ELO_HISTORY_DATASETS.filter((id) => !done.has(id));
  if (due.length === 0) return null;

  const saved: EloSnapshotResult["saved"] = [];
  const failed: RankingDatasetId[] = [];
  const statements = [];
  for (const dataset of due) {
    try {
      const teams = buildEloSnapshot(await source(dataset));
      const count = Object.keys(teams).length;
      if (count === 0) {
        failed.push(dataset);
        continue;
      }
      statements.push(
        db.run(
          sql`INSERT OR IGNORE INTO elo_monthly_snapshots (month, dataset, captured_at, teams, body)
              VALUES (${month}, ${dataset}, ${now}, ${count}, ${JSON.stringify(teams)})`,
        ),
      );
      saved.push({ dataset, teams: count });
    } catch (error) {
      console.error("[elo-snapshot] could not load", dataset, error);
      failed.push(dataset);
    }
  }
  if (saved.length === 0) return { month, saved, failed };

  const detail = JSON.stringify({ month, saved, failed });
  statements.push(
    db.run(sql`INSERT INTO scraper_log (job, ran_at, detail) VALUES (${ELO_SNAPSHOT_JOB}, ${now}, ${detail})`),
  );
  const batch = (db as unknown as { batch?: (items: unknown[]) => Promise<unknown> }).batch;
  if (typeof batch === "function") await batch.call(db, statements);
  else for (const statement of statements) await statement;
  monthsCache.clear();
  return { month, saved, failed };
}

/** Saved months per dataset, kept per isolate: a month never changes once saved. */
const monthsCache = new Map<RankingDatasetId, { at: number; months: Promise<{ month: string; teams: EloSnapshotTeams }[]> }>();

/** How long an isolate trusts its copy before checking for a new month. */
const MONTHS_CACHE_SECONDS = 6 * 60 * 60;

async function readMonths(db: Database, dataset: RankingDatasetId) {
  await ensureTables(db);
  const rows = (await db.all(
    sql`SELECT month, body FROM elo_monthly_snapshots WHERE dataset = ${dataset} ORDER BY month`,
  )) as { month: string; body: string }[];
  return rows.flatMap((row) => {
    try {
      const teams = JSON.parse(row.body) as EloSnapshotTeams;
      return teams && typeof teams === "object" ? [{ month: row.month, teams }] : [];
    } catch {
      return [];
    }
  });
}

/** The saved months of `keys` in `dataset` (teams with none are left out). */
export async function readEloHistory(
  db: Database,
  dataset: RankingDatasetId,
  keys: readonly string[],
  now: number = nowSeconds(),
): Promise<EloHistory> {
  let cached = monthsCache.get(dataset);
  if (!cached || now - cached.at > MONTHS_CACHE_SECONDS) {
    cached = { at: now, months: readMonths(db, dataset) };
    cached.months.catch(() => monthsCache.delete(dataset));
    monthsCache.set(dataset, cached);
  }
  return eloHistoryFor(await cached.months, keys);
}

/** Drops the per-isolate cache (tests). */
export function clearEloHistoryMonthsCache(): void {
  monthsCache.clear();
}
