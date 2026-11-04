/**
 * The Schools table, precomputed and saved in D1.
 *
 * Rolling every division's rankings up into schools used to run in the
 * browser and froze the Rankings → Schools tab. The Worker now builds each
 * season's snapshot (`computeSchoolRankingsSnapshot` in `@debate-ai/rankings`)
 * once and keeps it in `school_rankings_snapshots`:
 *
 * - `GET /api/school-rankings?season=` serves the saved copy, building and
 *   saving it the first time a season is asked for.
 * - The daily cron (`worker/index.ts`) rebuilds the current season and
 *   rewrites the row only when the snapshot's hash changed; otherwise it just
 *   records that it checked.
 *
 * Bodies are split into ~900 KB parts (as in `extinction-store.ts`) to stay
 * under D1's row size limit. The table is created on first use: the app has
 * no tracked migrations (see `lib/database/ensure-columns.ts`).
 */

import { sql } from "drizzle-orm";
import { clearExtinctionCache, currentRankingSeasonYear } from "@debate-ai/rankings";
import {
  SCHOOL_RANKINGS_SNAPSHOT_VERSION,
  computeSchoolRankingsSnapshot,
  isSchoolRankingsSnapshot,
  type SchoolRankingsSnapshot,
} from "@debate-ai/rankings/src/leaderboard/schoolRankingsSnapshot";
import type { getDBFromContext } from "@/lib/database/context";
import { splitBody } from "./extinction-store";

type Database = Awaited<ReturnType<typeof getDBFromContext>>;

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS "school_rankings_snapshots" (
  "season_year" integer NOT NULL,
  "part" integer NOT NULL,
  "parts" integer NOT NULL,
  "version" integer NOT NULL,
  "hash" text NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "built_at" integer DEFAULT (unixepoch()) NOT NULL,
  "checked_at" integer DEFAULT (unixepoch()) NOT NULL,
  PRIMARY KEY ("season_year", "part")
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

interface PartRow {
  part: number;
  parts: number;
  version: number;
  hash: string;
  body: string;
}

/** The saved snapshot for `seasonYear`, or null (none, incomplete, or an older version). */
export async function readSavedSchoolRankings(db: Database, seasonYear: number): Promise<SchoolRankingsSnapshot | null> {
  await ensureTable(db);
  const rows = (await db.all(
    sql`SELECT part, parts, version, hash, body FROM school_rankings_snapshots WHERE season_year = ${seasonYear} ORDER BY part`,
  )) as PartRow[];
  if (rows.length === 0) return null;
  const first = rows[0]!;
  if (Number(first.version) !== SCHOOL_RANKINGS_SNAPSHOT_VERSION) return null;
  if (rows.length !== Number(first.parts) || rows.some((row, i) => Number(row.part) !== i)) return null;
  try {
    const parsed: unknown = JSON.parse(rows.map((row) => row.body).join(""));
    return isSchoolRankingsSnapshot(parsed) && parsed.seasonYear === seasonYear ? parsed : null;
  } catch {
    return null;
  }
}

/** Saves `snapshot`, replacing that season's earlier copy. */
export async function saveSchoolRankings(db: Database, snapshot: SchoolRankingsSnapshot): Promise<void> {
  await ensureTable(db);
  const parts = splitBody(JSON.stringify(snapshot));
  const builtAt = Math.floor(Date.parse(snapshot.builtAt) / 1000) || Math.floor(Date.now() / 1000);
  await db.run(sql`DELETE FROM school_rankings_snapshots WHERE season_year = ${snapshot.seasonYear}`);
  for (let part = 0; part < parts.length; part++) {
    await db.run(
      sql`INSERT INTO school_rankings_snapshots (season_year, part, parts, version, hash, body, built_at, checked_at)
          VALUES (${snapshot.seasonYear}, ${part}, ${parts.length}, ${snapshot.version}, ${snapshot.hash}, ${parts[part]!}, ${builtAt}, unixepoch())`,
    );
  }
}

/** Notes that the saved copy was confirmed current. */
async function markChecked(db: Database, seasonYear: number): Promise<void> {
  await db.run(sql`UPDATE school_rankings_snapshots SET checked_at = unixepoch() WHERE season_year = ${seasonYear}`);
}

/** Builds a snapshot from the live sources, never from this isolate's earlier fetches. */
export type SchoolRankingsBuilder = (seasonYear: number) => Promise<SchoolRankingsSnapshot>;

const buildFresh: SchoolRankingsBuilder = (seasonYear) => {
  clearExtinctionCache();
  return computeSchoolRankingsSnapshot(seasonYear);
};

/**
 * Rebuilds `seasonYear` and saves it only when its hash differs from the
 * saved copy's. Returns the current snapshot and whether it changed.
 */
export async function refreshSchoolRankings(
  db: Database,
  seasonYear: number,
  build: SchoolRankingsBuilder = buildFresh,
): Promise<{ snapshot: SchoolRankingsSnapshot; changed: boolean }> {
  const [saved, fresh] = await Promise.all([readSavedSchoolRankings(db, seasonYear), build(seasonYear)]);
  if (saved && saved.hash === fresh.hash) {
    await markChecked(db, seasonYear);
    return { snapshot: saved, changed: false };
  }
  await saveSchoolRankings(db, fresh);
  return { snapshot: fresh, changed: true };
}

/** What the route serves: the saved copy, or a fresh build saved for next time. */
export async function getSchoolRankings(
  db: Database,
  seasonYear: number,
  build: SchoolRankingsBuilder = buildFresh,
): Promise<SchoolRankingsSnapshot> {
  const saved = await readSavedSchoolRankings(db, seasonYear);
  if (saved) return saved;
  const fresh = await build(seasonYear);
  try {
    await saveSchoolRankings(db, fresh);
  } catch (error) {
    console.error("[school-rankings] could not save the snapshot", error);
  }
  return fresh;
}

/** The daily cron's job: refresh the current season. */
export async function runDailySchoolRankingsRefresh(db: Database): Promise<void> {
  const seasonYear = currentRankingSeasonYear();
  const { snapshot, changed } = await refreshSchoolRankings(db, seasonYear);
  console.log(
    `[school-rankings] ${seasonYear}: ${changed ? "updated" : "unchanged"} (${snapshot.scopes.all.length} schools, hash ${snapshot.hash})`,
  );
}
