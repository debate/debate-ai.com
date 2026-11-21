/**
 * Every high school's best ranked entries per event, for each finished
 * Elo ratings season, kept in D1 so a school page's "Historical legend"
 * can chart a decade of seasons from one small query.
 *
 * A finished season never changes, so each one (per format) is built once:
 * its saved Elo ratings and bid list (`extinction-store.ts`, filled
 * from the ratings source the first time) are joined, every school's best
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
  HS_STRENGTH_WEIGHTS,
  bestTeamsBySchool,
  schoolNamesBySeasonKey,
  buildHsEliteSchools,
  combineDebateData,
  hsEliteKeys,
  rankAllSchoolStrengths,
  schoolStrengthTable,
  currentRankingSeasonYear,
  extinctionFileName,
  extinctionSeasonCode,
  type BidsResponse,
  type DebateFormat,
  type RatingsResponse,
  type SchoolSeason,
  type SchoolSeasonEvent,
  type SchoolSeasonPoints,
  type SchoolStrengthEventRanks,
  type SchoolSeasonsResponse,
  type SchoolEliteResponse,
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

/** Each school's name in each season, so pages can title schools no current ranking lists. */
const CREATE_NAMES_SQL = `CREATE TABLE IF NOT EXISTS "school_season_names" (
  "school" text NOT NULL,
  "format" text NOT NULL,
  "year" integer NOT NULL,
  "name" text NOT NULL,
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
const INSERT_CHUNK = 150;

/** Seasons built per request at most, so one page view stays quick. */
export const SCHOOL_SEASON_BUILD_BUDGET = 3;

let tablesReady: Promise<void> | null = null;

function ensureTables(db: Database): Promise<void> {
  tablesReady ??= (async () => {
    await db.run(sql.raw(CREATE_TEAMS_SQL));
    await db.run(sql.raw(CREATE_BUILDS_SQL));
    await db.run(sql.raw(CREATE_NAMES_SQL));
  })().catch((error) => {
    tablesReady = null;
    throw error;
  });
  return tablesReady;
}

/** Fetches one ratings file; a 403/404 (no bid list) is a result, anything else throws. */
async function fetchExtinctionFile(kind: string, file: string): Promise<SavedExtinctionFile> {
  const res = await fetch(`${EXTINCTION_BASE_URL}/${kind}/${file}`, { headers: { Accept: "application/json" } });
  if (res.status === 403 || res.status === 404) return { status: res.status, body: "" };
  if (!res.ok) throw new Error(`Ratings source returned ${res.status} for ${kind}/${file}`);
  const body = await res.text();
  JSON.parse(body);
  return { status: 200, body };
}

/** A finished season's file: the saved copy, else the ratings source (and saved for next time). */
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

/** Writes every school's name for one format and season, replacing an earlier write. */
export async function saveSchoolSeasonNames(
  db: Database,
  format: DebateFormat,
  year: number,
  names: Map<string, string>,
): Promise<void> {
  await ensureTables(db);
  await db.run(sql`DELETE FROM school_season_names WHERE format = ${format} AND year = ${year}`);
  const rows = [...names].map(([school, name]) => ({ s: school, n: name }));
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = JSON.stringify(rows.slice(i, i + INSERT_CHUNK));
    await db.run(
      sql`INSERT OR REPLACE INTO school_season_names (school, format, year, name)
          SELECT json_extract(value, '$.s'), ${format}, ${year}, json_extract(value, '$.n') FROM json_each(${chunk})`,
    );
  }
}

/** One season's ratings, combined, or null when the season has no ratings file. */
async function loadSeasonData(
  db: Database,
  format: DebateFormat,
  year: number,
  fetchFile: typeof fetchExtinctionFile,
) {
  const season = extinctionSeasonCode(year);
  const file = extinctionFileName(format, season);
  const [teams, bids] = await Promise.all([
    loadPastFile(db, "teams", file, fetchFile),
    loadPastFile(db, "bids", file, fetchFile),
  ]);
  if (teams.status !== 200) return null;
  return combineDebateData(
    format,
    season,
    JSON.parse(teams.body) as RatingsResponse,
    bids.status === 200 ? (JSON.parse(bids.body) as BidsResponse) : null,
  );
}

/**
 * Saves one built season's school names without rebuilding its teams: for
 * seasons built before names were kept. Reads the saved ratings files.
 */
export async function buildSchoolSeasonNames(
  db: Database,
  format: DebateFormat,
  year: number,
  fetchFile: typeof fetchExtinctionFile = fetchExtinctionFile,
): Promise<void> {
  const data = await loadSeasonData(db, format, year, fetchFile);
  await saveSchoolSeasonNames(db, format, year, data ? schoolNamesBySeasonKey(data) : new Map());
}

/**
 * Builds one finished season of one format from its saved ratings files.
 *
 * @param fetchFile - Fetches a file not yet saved; swapped out in tests.
 */
export async function buildSchoolSeason(
  db: Database,
  format: DebateFormat,
  year: number,
  fetchFile: typeof fetchExtinctionFile = fetchExtinctionFile,
): Promise<void> {
  const data = await loadSeasonData(db, format, year, fetchFile);
  if (!data) {
    await saveSchoolSeasonBuild(db, format, year, new Map());
    return;
  }
  await saveSchoolSeasonNames(db, format, year, schoolNamesBySeasonKey(data));
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

const CREATE_FAILURES_SQL = `CREATE TABLE IF NOT EXISTS "school_season_failures" (
  "format" text NOT NULL,
  "year" integer NOT NULL,
  "error" text NOT NULL,
  "failed_at" integer DEFAULT (unixepoch()) NOT NULL,
  PRIMARY KEY ("format", "year")
)`;

const CREATE_RANKS_SQL = `CREATE TABLE IF NOT EXISTS "school_strength_ranks" (
  "school" text PRIMARY KEY NOT NULL,
  "ranks" text NOT NULL,
  "builds" integer NOT NULL,
  "computed_at" integer DEFAULT (unixepoch()) NOT NULL
)`;

let extraTablesReady: Promise<void> | null = null;

function ensureExtraTables(db: Database): Promise<void> {
  extraTablesReady ??= (async () => {
    await ensureTables(db);
    await db.run(sql.raw(CREATE_FAILURES_SQL));
    await db.run(sql.raw(CREATE_RANKS_SQL));
  })().catch((error) => {
    extraTablesReady = null;
    throw error;
  });
  return extraTablesReady;
}

type BuildOptions = { now?: Date; fetchFile?: typeof fetchExtinctionFile };

/** A season a build attempt left unbuilt, retried on the next request or daily run. */
interface SeasonFailure {
  format: string;
  year: number;
  error: string;
}

/**
 * Builds up to `budget` missing finished seasons, newest first, recording
 * failures. Returns how many are still missing and the recorded failures.
 */
export async function buildMissingSchoolSeasons(
  db: Database,
  budget: number,
  options: BuildOptions = {},
): Promise<{ pending: number; builds: number; failures: SeasonFailure[] }> {
  await ensureExtraTables(db);
  const built = (await db.all(sql`SELECT format, year FROM school_season_builds`)) as { format: string; year: number }[];
  const done = new Set(built.map((row) => `${row.format}|${Number(row.year)}`));
  const missing = finishedSchoolSeasons(options.now)
    .filter(({ format, year }) => !done.has(`${format}|${year}`))
    .sort((a, b) => b.year - a.year);

  let pending = missing.length;
  let builds = built.length;
  for (const { format, year } of missing.slice(0, budget)) {
    try {
      await buildSchoolSeason(db, format, year, options.fetchFile);
      await db.run(sql`DELETE FROM school_season_failures WHERE format = ${format} AND year = ${year}`);
      pending--;
      builds++;
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 300);
      console.error(`[school-seasons] building ${format} ${year} failed:`, message);
      await db
        .run(
          sql`INSERT OR REPLACE INTO school_season_failures (format, year, error) VALUES (${format}, ${year}, ${message})`,
        )
        .catch(() => undefined);
    }
  }
  const failures = pending
    ? ((await db.all(sql`SELECT format, year, error FROM school_season_failures ORDER BY year DESC`)) as SeasonFailure[])
        .map((row) => ({ format: String(row.format), year: Number(row.year), error: String(row.error) }))
        .filter((row) => !done.has(`${row.format}|${row.year}`))
    : [];
  return { pending, builds, failures };
}

/** The two spans a school is ranked over. */
function rankSpans(now?: Date): { last: number; decadeFrom: number } {
  const last = currentRankingSeasonYear(now) - 1;
  // The same ten seasons the page's "Last decade" tile names (current season minus 9 on).
  return { last, decadeFrom: last - 8 };
}

/**
 * Recomputes every high school's all-time and last-decade rank in each event
 * (Policy, LD, PF; programs are never ranked across events combined) from the
 * seasons built so far and stores one row per school.
 *
 * @returns How many schools were ranked.
 */
export async function refreshSchoolStrengthRanks(db: Database, builds: number, now?: Date): Promise<number> {
  await ensureExtraTables(db);
  const points = await loadStrengthPoints(db);
  const { last, decadeFrom } = rankSpans(now);
  const byEvent = new Map<string, Partial<Record<SchoolSeasonEvent, SchoolStrengthEventRanks>>>();
  for (const { event } of SCHOOL_SEASON_FORMATS) {
    const table = schoolStrengthTable(points, undefined, event);
    const allTime = rankAllSchoolStrengths(table, -Infinity, last);
    const decade = rankAllSchoolStrengths(table, decadeFrom, last);
    for (const [school, rank] of allTime) {
      const own = byEvent.get(school) ?? {};
      own[event] = { allTime: rank, decade: decade.get(school) ?? null };
      byEvent.set(school, own);
    }
  }
  const rows = [...byEvent].map(([school, ranks]) => ({
    s: school,
    r: JSON.stringify({ byEvent: ranks, decadeFrom }),
  }));
  await db.run(sql`DELETE FROM school_strength_ranks`);
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = JSON.stringify(rows.slice(i, i + INSERT_CHUNK));
    await db.run(
      sql`INSERT OR REPLACE INTO school_strength_ranks (school, ranks, builds)
          SELECT json_extract(value, '$.s'), json_extract(value, '$.r'), ${builds} FROM json_each(${chunk})`,
    );
  }
  return rows.length;
}

/**
 * The daily job: builds every missing finished season, then recomputes every
 * school's ranks, so school pages read precomputed rows.
 */
export async function runDailySchoolSeasonsRefresh(db: Database, options: BuildOptions = {}): Promise<void> {
  const { pending, builds, failures } = await buildMissingSchoolSeasons(db, finishedSchoolSeasons(options.now).length, options);
  const ranked = await refreshSchoolStrengthRanks(db, builds, options.now);
  console.log(
    `[school-seasons] ${builds} seasons built, ${pending} pending, ${ranked} schools ranked` +
      (failures.length ? `; failures: ${failures.map((f) => `${f.format} ${f.year}: ${f.error}`).join("; ")}` : ""),
  );
}

/**
 * One school's best entries for every finished season and its ranks,
 * building up to `budget` missing seasons first. Ranks are the precomputed
 * rows; they are recomputed here only when seasons were built since.
 *
 * @param school - The school's `@handle` (`schoolSeasonKey`).
 */
export async function getSchoolSeasons(
  db: Database,
  school: string,
  options: BuildOptions & { budget?: number } = {},
): Promise<{
  seasons: SchoolSeason[];
  pending: number;
  ranks: SchoolSeasonsResponse["ranks"];
  failures: SeasonFailure[];
}> {
  const { pending, builds, failures } = await buildMissingSchoolSeasons(
    db,
    options.budget ?? SCHOOL_SEASON_BUILD_BUDGET,
    options,
  );

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

  // Any stored row says which build count the ranks were computed at; rows
  // from before ranks were split by event lack `byEvent` and are redone.
  const stamp = (await db.all(sql`SELECT builds, ranks FROM school_strength_ranks LIMIT 1`)) as {
    builds: number;
    ranks: string;
  }[];
  if (!stamp.length || Number(stamp[0]!.builds) !== builds || !String(stamp[0]!.ranks).includes('"byEvent"')) {
    await refreshSchoolStrengthRanks(db, builds, options.now);
  }
  const own = (await db.all(sql`SELECT ranks FROM school_strength_ranks WHERE school = ${school}`)) as { ranks: string }[];
  let ranks: SchoolSeasonsResponse["ranks"] = { byEvent: {}, decadeFrom: rankSpans(options.now).decadeFrom };
  if (own.length) {
    try {
      ranks = JSON.parse(own[0]!.ranks) as NonNullable<SchoolSeasonsResponse["ranks"]>;
    } catch {
      // Recomputed on the next build.
    }
  }
  return { seasons, pending, ranks, failures };
}

/**
 * Every high school's ranked-entry points per built season and event, for
 * ranking: summed in SQL from the stored teams (weights from
 * `HS_STRENGTH_WEIGHTS`). TOC finishes are added per event by
 * `schoolStrengthTable`.
 */
async function loadStrengthPoints(db: Database): Promise<SchoolSeasonPoints[]> {
  const w = HS_STRENGTH_WEIGHTS;
  const rows = (await db.all(sql`
    SELECT s.school AS school, s.format AS format, s.year AS year, SUM(
      CASE WHEN json_extract(t.value, '$.rank') BETWEEN 1 AND 100
        THEN (101.0 - json_extract(t.value, '$.rank')) / ${w.rankingDivisor} ELSE 0 END
      + CASE WHEN json_extract(t.value, '$.bids') >= ${w.qualifyingBids} THEN ${w.tocQualified} ELSE 0 END
    ) AS points
    FROM school_season_teams AS s, json_each(s.teams) AS t
    GROUP BY s.school, s.format, s.year`)) as { school: string; format: string; year: number; points: number }[];
  return rows.flatMap((row) => {
    const event = SCHOOL_SEASON_FORMATS.find((f) => f.format === row.format)?.event;
    return event ? [{ school: String(row.school), year: Number(row.year), points: Number(row.points), event }] : [];
  });
}

/**
 * One event's high school Top 10 chart: the ten programs with the most
 * all-time points in the event and their rank season by season, from the
 * seasons built so far (building up to `budget` missing ones first) plus
 * every TOC finish.
 */
export async function getSchoolElite(
  db: Database,
  event: SchoolSeasonEvent,
  options: BuildOptions & { budget?: number } = {},
): Promise<SchoolEliteResponse> {
  const { pending } = await buildMissingSchoolSeasons(db, options.budget ?? SCHOOL_SEASON_BUILD_BUDGET, options);
  const points = await loadStrengthPoints(db);
  const { last } = rankSpans(options.now);
  const format = SCHOOL_SEASON_FORMATS.find((f) => f.event === event)!.format;
  const keys = hsEliteKeys(points, event, last).filter((key) => !key.startsWith("toc:"));
  const teams = new Map<string, SchoolSeason[]>();
  if (keys.length) {
    const rows = (await db.all(
      sql`SELECT school, year, teams FROM school_season_teams
          WHERE format = ${format} AND school IN (SELECT value FROM json_each(${JSON.stringify(keys)}))`,
    )) as { school: string; year: number; teams: string }[];
    for (const row of rows) {
      try {
        const list = teams.get(String(row.school)) ?? [];
        list.push({ year: Number(row.year), event, teams: JSON.parse(row.teams) as SchoolSeasonTeam[] });
        teams.set(String(row.school), list);
      } catch {
        // A damaged row is skipped; rebuilding the season replaces it.
      }
    }
  }
  return { event, pending, ...buildHsEliteSchools(points, event, last, teams) };
}
