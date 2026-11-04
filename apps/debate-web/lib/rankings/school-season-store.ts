/**
 * Every high school's best ranked entries per event, for each finished
 * Extinction.GG season, kept in D1 so a school page's "Historical legend"
 * can chart a decade of seasons from one small query.
 *
 * A finished season never changes, so each one (per format) is built once:
 * its saved Extinction.GG ratings and bid list (`extinction-store.ts`, filled
 * from Extinction.GG the first time) are joined, every school's best
 * {@link SCHOOL_SEASON_TEAMS_PER_EVENT} entries are kept, and the season is
 * marked built. {@link getSchoolSeasons} builds a few missing seasons per
 * request and reports how many are still pending, so the first visits warm
 * the table and later ones only read it.
 *
 * Tables are created here on first use: the app has no tracked migrations
 * (see `lib/database/ensure-columns.ts`).
 */

import { sql } from "drizzle-orm";
import {
  EXTINCTION_BASE_URL,
  SCHOOL_SEASON_FIRST_YEAR,
  SCHOOL_SEASON_FORMATS,
  SCHOOL_SEASON_TEAMS_PER_EVENT,
  bestTeamsBySchool,
  combineDebateData,
  currentRankingSeasonYear,
  extinctionFileName,
  extinctionSeasonCode,
  type BidsResponse,
  type DebateFormat,
  type RatingsResponse,
  type SchoolSeason,
  type SchoolSeasonTeam,
} from "@debate-ai/rankings";
import type { getDBFromContext } from "@/lib/database/context";
import { readSavedExtinctionFile, saveExtinctionFile, type SavedExtinctionFile } from "./extinction-store";

type Database = Awaited<ReturnType<typeof getDBFromContext>>;

const CREATE_TEAMS_SQL = `CREATE TABLE IF NOT EXISTS "school_season_teams" (
  "school" text NOT NULL,
  "format" text NOT NULL,
  "year" integer NOT NULL,
  "teams" text NOT NULL,
  PRIMARY KEY ("school", "format", "year")
)`;

const CREATE_BUILDS_SQL = `CREATE TABLE IF NOT EXISTS "school_season_builds" (
  "format" text NOT NULL,
  "year" integer NOT NULL,
  "schools" integer NOT NULL,
  "built_at" integer DEFAULT (unixepoch()) NOT NULL,
  PRIMARY KEY ("format", "year")
)`;

/** Schools per insert; each insert is one JSON parameter read with `json_each`. */
const INSERT_CHUNK = 400;

/** Seasons built per request at most, so one page view stays quick. */
export const SCHOOL_SEASON_BUILD_BUDGET = 3;

let tablesReady: Promise<void> | null = null;

function ensureTables(db: Database): Promise<void> {
  tablesReady ??= (async () => {
    await db.run(sql.raw(CREATE_TEAMS_SQL));
    await db.run(sql.raw(CREATE_BUILDS_SQL));
  })().catch((error) => {
    tablesReady = null;
    throw error;
  });
  return tablesReady;
}

/** Fetches one Extinction.GG file; a 403/404 (no bid list) is a result, anything else throws. */
async function fetchExtinctionFile(kind: string, file: string): Promise<SavedExtinctionFile> {
  const res = await fetch(`${EXTINCTION_BASE_URL}/${kind}/${file}`, { headers: { Accept: "application/json" } });
  if (res.status === 403 || res.status === 404) return { status: res.status, body: "" };
  if (!res.ok) throw new Error(`Extinction.GG returned ${res.status} for ${kind}/${file}`);
  const body = await res.text();
  JSON.parse(body);
  return { status: 200, body };
}

/** A finished season's file: the saved copy, else Extinction.GG (and saved for next time). */
async function loadPastFile(
  db: Database,
  kind: string,
  file: string,
  fetchFile: typeof fetchExtinctionFile,
): Promise<SavedExtinctionFile> {
  const saved = await readSavedExtinctionFile(db, kind, file);
  if (saved) return saved;
  const fetched = await fetchFile(kind, file);
  await saveExtinctionFile(db, kind, file, fetched).catch((error) =>
    console.error("[school-seasons] saving season file failed:", error instanceof Error ? error.message : String(error)),
  );
  return fetched;
}

/** Writes every school's best entries for one format and season, replacing an earlier build. */
export async function saveSchoolSeasonBuild(
  db: Database,
  format: DebateFormat,
  year: number,
  bySchool: Map<string, SchoolSeasonTeam[]>,
): Promise<void> {
  await ensureTables(db);
  await db.run(sql`DELETE FROM school_season_teams WHERE format = ${format} AND year = ${year}`);
  const rows = [...bySchool].map(([school, teams]) => ({ s: school, t: JSON.stringify(teams) }));
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = JSON.stringify(rows.slice(i, i + INSERT_CHUNK));
    await db.run(
      sql`INSERT OR REPLACE INTO school_season_teams (school, format, year, teams)
          SELECT json_extract(value, '$.s'), ${format}, ${year}, json_extract(value, '$.t') FROM json_each(${chunk})`,
    );
  }
  await db.run(
    sql`INSERT OR REPLACE INTO school_season_builds (format, year, schools) VALUES (${format}, ${year}, ${rows.length})`,
  );
}

/**
 * Builds one finished season of one format from its Extinction.GG files.
 *
 * @param fetchFile - Fetches a file not yet saved; swapped out in tests.
 */
export async function buildSchoolSeason(
  db: Database,
  format: DebateFormat,
  year: number,
  fetchFile: typeof fetchExtinctionFile = fetchExtinctionFile,
): Promise<void> {
  const season = extinctionSeasonCode(year);
  const file = extinctionFileName(format, season);
  const [teams, bids] = await Promise.all([
    loadPastFile(db, "teams", file, fetchFile),
    loadPastFile(db, "bids", file, fetchFile),
  ]);
  if (teams.status !== 200) {
    await saveSchoolSeasonBuild(db, format, year, new Map());
    return;
  }
  const data = combineDebateData(
    format,
    season,
    JSON.parse(teams.body) as RatingsResponse,
    bids.status === 200 ? (JSON.parse(bids.body) as BidsResponse) : null,
  );
  await saveSchoolSeasonBuild(db, format, year, bestTeamsBySchool(data, SCHOOL_SEASON_TEAMS_PER_EVENT));
}

/** Every finished (format, season) a school page lists. */
export function finishedSchoolSeasons(now = new Date()): { format: DebateFormat; year: number }[] {
  const last = currentRankingSeasonYear(now) - 1;
  const out: { format: DebateFormat; year: number }[] = [];
  for (let year = SCHOOL_SEASON_FIRST_YEAR; year <= last; year++) {
    for (const { format } of SCHOOL_SEASON_FORMATS) out.push({ format, year });
  }
  return out;
}

/**
 * One school's best entries for every finished season, building up to
 * `budget` missing seasons first.
 *
 * @param school - The school's `@handle` (`schoolSeasonKey`).
 * @returns The seasons found and how many finished seasons are still unbuilt.
 */
export async function getSchoolSeasons(
  db: Database,
  school: string,
  options: { budget?: number; now?: Date; fetchFile?: typeof fetchExtinctionFile } = {},
): Promise<{ seasons: SchoolSeason[]; pending: number }> {
  await ensureTables(db);
  const built = (await db.all(sql`SELECT format, year FROM school_season_builds`)) as { format: string; year: number }[];
  const done = new Set(built.map((row) => `${row.format}|${Number(row.year)}`));
  // Newest first: the recent seasons are the ones a reader looks at first.
  const missing = finishedSchoolSeasons(options.now)
    .filter(({ format, year }) => !done.has(`${format}|${year}`))
    .sort((a, b) => b.year - a.year);

  let pending = missing.length;
  for (const { format, year } of missing.slice(0, options.budget ?? SCHOOL_SEASON_BUILD_BUDGET)) {
    try {
      await buildSchoolSeason(db, format, year, options.fetchFile);
      pending--;
    } catch (error) {
      console.error(
        `[school-seasons] building ${format} ${year} failed:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  const rows = (await db.all(
    sql`SELECT format, year, teams FROM school_season_teams WHERE school = ${school} ORDER BY year`,
  )) as { format: string; year: number; teams: string }[];
  const seasons: SchoolSeason[] = [];
  for (const row of rows) {
    const event = SCHOOL_SEASON_FORMATS.find((f) => f.format === row.format)?.event;
    if (!event) continue;
    try {
      seasons.push({ year: Number(row.year), event, teams: JSON.parse(row.teams) as SchoolSeasonTeam[] });
    } catch {
      // A damaged row is skipped; rebuilding the season replaces it.
    }
  }
  return { seasons, pending };
}
