/**
 * The 90-day rank baselines the rankings tables' +/− column compares against
 * (`leaderboard/rankBaseline.ts` in `@debate-ai/rankings`).
 *
 * `rank_baselines` keeps each list's saved positions: one row per scope
 * (`team:hspf`, `school:VCX`) and save time, the rows as JSON. The daily cron
 * saves a list again once its newest save is 90 days old (or it has none),
 * and keeps the last three saves. The route serves the newest save that is at
 * least a day old, so a fresh save never shows every team at "0".
 *
 * Created on first use: the app has no tracked migrations (see
 * `lib/database/ensure-columns.ts`).
 */

import { sql } from "drizzle-orm";
import { clearExtinctionCache, loadRankingDataset, type RankingDatasetId } from "@debate-ai/rankings";
import { DIVISION_CONFIG } from "@debate-ai/rankings/src/leaderboard/leaderboardUtils";
import {
  RANK_BASELINE_MIN_AGE_SECONDS,
  rankBaselineDue,
  type RankBaseline,
  type RankBaselineRow,
  type RankBaselineScope,
} from "@debate-ai/rankings/src/leaderboard/rankBaseline";
import type { SchoolRankingsSnapshot } from "@debate-ai/rankings/src/leaderboard/schoolRankingsSnapshot";
import type { getDBFromContext } from "@/lib/database/context";

type Database = Awaited<ReturnType<typeof getDBFromContext>>;

/** Saves kept per scope. */
const KEEP_SAVES = 3;

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS "rank_baselines" (
  "scope" text NOT NULL,
  "captured_at" integer NOT NULL,
  "body" text NOT NULL,
  PRIMARY KEY ("scope", "captured_at")
)`;

let tableReady: Promise<void> | null = null;

function ensureTable(db: Database): Promise<void> {
  tableReady ??= Promise.resolve(db.run(sql.raw(CREATE_TABLE_SQL))).then(
    () => undefined,
    (error) => {
      tableReady = null;
      throw error;
    },
  );
  return tableReady;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** The newest save for `scope` that is at least a day old, or null. */
export async function readRankBaseline(
  db: Database,
  scope: RankBaselineScope,
  now: number = nowSeconds(),
): Promise<RankBaseline | null> {
  await ensureTable(db);
  const [row] = (await db.all(
    sql`SELECT captured_at, body FROM rank_baselines WHERE scope = ${scope} AND captured_at <= ${now - RANK_BASELINE_MIN_AGE_SECONDS} ORDER BY captured_at DESC LIMIT 1`,
  )) as { captured_at: number; body: string }[];
  if (!row) return null;
  try {
    const rows = JSON.parse(row.body) as RankBaselineRow[];
    return Array.isArray(rows) ? { scope, capturedAt: row.captured_at, rows } : null;
  } catch {
    return null;
  }
}

async function newestCapture(db: Database, scope: RankBaselineScope): Promise<number | null> {
  const [row] = (await db.all(sql`SELECT MAX(captured_at) AS at FROM rank_baselines WHERE scope = ${scope}`)) as {
    at: number | null;
  }[];
  return row?.at ?? null;
}

/** Saves `rows` for `scope` at `now` and drops all but the newest saves. */
export async function saveRankBaseline(
  db: Database,
  scope: RankBaselineScope,
  rows: RankBaselineRow[],
  now: number = nowSeconds(),
): Promise<void> {
  await ensureTable(db);
  await db.run(
    sql`INSERT OR REPLACE INTO rank_baselines (scope, captured_at, body) VALUES (${scope}, ${now}, ${JSON.stringify(rows)})`,
  );
  await db.run(
    sql`DELETE FROM rank_baselines WHERE scope = ${scope} AND captured_at NOT IN (SELECT captured_at FROM rank_baselines WHERE scope = ${scope} ORDER BY captured_at DESC LIMIT ${KEEP_SAVES})`,
  );
}

/** Where the cron gets the lists it saves; injectable for tests. */
export interface RankBaselineSources {
  teams: (id: RankingDatasetId) => Promise<RankBaselineRow[]>;
  /** The current Schools-tab snapshot, when one is at hand. */
  schools?: () => Promise<SchoolRankingsSnapshot | null>;
}

/** The live sources: each dataset loaded fresh (no Schools snapshot; the cron adds it). */
export const defaultRankBaselineSources: RankBaselineSources = {
  teams: async (id) => {
    clearExtinctionCache();
    const dataset = await loadRankingDataset(id);
    return dataset.entries.map((entry) => ({ rank: entry.rank, school: entry.school, name: entry.name }));
  },
};

/**
 * The daily cron's job: saves every list whose newest save is 90 days old
 * (or missing). A list that fails to load is skipped until tomorrow.
 *
 * @returns The scopes saved this run.
 */
export async function runRankBaselineCapture(
  db: Database,
  sources: RankBaselineSources = defaultRankBaselineSources,
  now: number = nowSeconds(),
): Promise<RankBaselineScope[]> {
  await ensureTable(db);
  const saved: RankBaselineScope[] = [];
  const datasetIds = [...new Set(DIVISION_CONFIG.flatMap((division) => division.datasets))];
  for (const id of datasetIds) {
    const scope: RankBaselineScope = `team:${id}`;
    if (!rankBaselineDue(await newestCapture(db, scope), now)) continue;
    try {
      const rows = await sources.teams(id);
      if (rows.length === 0) continue;
      await saveRankBaseline(db, scope, rows, now);
      saved.push(scope);
    } catch (error) {
      console.error("[rank-baselines] could not save", scope, error);
    }
  }
  const snapshot = sources.schools ? await sources.schools().catch(() => null) : null;
  if (snapshot) {
    for (const division of DIVISION_CONFIG.map((d) => d.value)) {
      const scope: RankBaselineScope = `school:${division}`;
      const rows = snapshot.scopes[division];
      if (!rows?.length || !rankBaselineDue(await newestCapture(db, scope), now)) continue;
      await saveRankBaseline(db, scope, rows.map((row) => ({ rank: row.rank, school: row.school })), now);
      saved.push(scope);
    }
  }
  return saved;
}
