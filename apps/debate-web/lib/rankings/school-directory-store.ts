/**
 * The school directory: one row per school `@handle` for every college and
 * high school of the last {@link SCHOOL_DIRECTORY_SEASONS} seasons, rebuilt
 * daily by the cron and kept in D1, so
 * - a school page that no current ranking lists still finds the school's
 *   name, level and other names (`/api/rankings/school-directory?handle=`),
 * - the admin "Schools with missing info" section lists the schools whose
 *   pages are missing a name or a logo, and names that look like one school
 *   split over two pages (`/api/admin/school-directory`).
 *
 * Sources: the current rankings (every dataset), the high school seasons the
 * Historical legend saved (`school_season_teams`, names from
 * `school_season_names`), and the college tables (debatedata seasons and the
 * NDT history). Building is `buildSchoolDirectory` in
 * `@debate-ai/rankings/src/schools/school-directory`.
 *
 * Tables are created here on first use: the app has no tracked migrations.
 */

import { sql } from "drizzle-orm";
import {
  SCHOOL_SEASON_FORMATS,
  clearExtinctionCache,
  currentRankingSeasonYear,
  loadCollegeHistory,
  loadRankingDataset,
  type RankingDatasetId,
} from "@debate-ai/rankings";
import { DIVISION_CONFIG } from "@debate-ai/rankings/src/leaderboard/leaderboardUtils";
import { hasSchoolLogo } from "@debate-ai/rankings/src/leaderboard/lib/schoolLogos";
import { canonicalSchoolHandle } from "@debate-ai/rankings/src/leaderboard/profile/rankingProfileHelpers";
import {
  SCHOOL_DIRECTORY_SEASONS,
  buildSchoolDirectory,
  similarSchoolGroups,
  type SchoolDirectoryEntry,
  type SchoolDirectoryLevel,
  type SchoolDirectoryRecord,
  type SchoolDirectoryReport,
  type SchoolMissingInfo,
} from "@debate-ai/rankings/src/schools/school-directory";
import type { getDBFromContext } from "@/lib/database/context";
import { buildSchoolSeasonNames } from "./school-season-store";

type Database = Awaited<ReturnType<typeof getDBFromContext>>;

const CREATE_SQL = `CREATE TABLE IF NOT EXISTS "school_directory" (
  "handle" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "level" text NOT NULL,
  "aliases" text DEFAULT '[]' NOT NULL,
  "first_year" integer NOT NULL,
  "last_year" integer NOT NULL,
  "ranked" integer DEFAULT 0 NOT NULL,
  "missing" text DEFAULT '[]' NOT NULL,
  "built_at" integer DEFAULT (unixepoch()) NOT NULL
)`;

/** Rows per insert; each insert is one JSON parameter read with `json_each`. */
const INSERT_CHUNK = 100;

/** Older seasons whose school names are backfilled per run (each reads two saved files). */
export const SCHOOL_NAME_BACKFILL_BUDGET = 6;

/** A day: the directory is rebuilt when older. */
const MAX_AGE_SECONDS = 24 * 60 * 60;

let tableReady: Promise<void> | null = null;

function ensureTable(db: Database): Promise<void> {
  tableReady ??= Promise.resolve(db.run(sql.raw(CREATE_SQL))).then(
    () => undefined,
    (error) => {
      tableReady = null;
      throw error;
    },
  );
  return tableReady;
}

/** Where the directory's names come from; swapped out in tests. */
export interface SchoolDirectorySources {
  /** The current season's rankings rows of one dataset. */
  current: (id: RankingDatasetId) => Promise<{ school: string }[]>;
  /** One past season's college table (debatedata). */
  college: (year: number) => Promise<{ school: string }[]>;
  /** Saves school names for a built high school season that has none. */
  backfillNames: (db: Database, format: string, year: number) => Promise<void>;
}

export const defaultSchoolDirectorySources: SchoolDirectorySources = {
  current: async (id) => {
    clearExtinctionCache();
    return (await loadRankingDataset(id)).entries;
  },
  college: (year) => loadCollegeHistory(year),
  backfillNames: (db, format, year) =>
    buildSchoolSeasonNames(db, format as Parameters<typeof buildSchoolSeasonNames>[1], year),
};

/** Saves names for up to `budget` built seasons that have none, newest first. */
async function backfillSeasonNames(
  db: Database,
  firstYear: number,
  budget: number,
  sources: SchoolDirectorySources,
): Promise<number> {
  const rows = (await db.all(sql`
    SELECT b.format AS format, b.year AS year FROM school_season_builds b
    WHERE b.year >= ${firstYear} AND b.schools > 0
      AND NOT EXISTS (SELECT 1 FROM school_season_names n WHERE n.format = b.format AND n.year = b.year)
    ORDER BY b.year DESC LIMIT ${budget}`)) as { format: string; year: number }[];
  let done = 0;
  for (const row of rows) {
    try {
      await sources.backfillNames(db, String(row.format), Number(row.year));
      done++;
    } catch (error) {
      console.error(`[school-directory] names for ${row.format} ${row.year} failed:`, error instanceof Error ? error.message : error);
    }
  }
  return done;
}

/** Every school name of the last ten seasons, from every source. */
export async function collectSchoolDirectoryRecords(
  db: Database,
  options: { now?: Date; sources?: SchoolDirectorySources; backfillBudget?: number } = {},
): Promise<SchoolDirectoryRecord[]> {
  const sources = options.sources ?? defaultSchoolDirectorySources;
  const current = currentRankingSeasonYear(options.now);
  const firstYear = current - SCHOOL_DIRECTORY_SEASONS + 1;
  const records: SchoolDirectoryRecord[] = [];

  const datasetIds = [...new Set(DIVISION_CONFIG.flatMap((division) => division.datasets))];
  for (const id of datasetIds) {
    try {
      const level: SchoolDirectoryLevel = id === "cpd" ? "college" : "highSchool";
      for (const row of await sources.current(id)) records.push({ name: row.school, level, year: current, current: true });
    } catch (error) {
      console.error(`[school-directory] current ${id} rankings failed:`, error instanceof Error ? error.message : error);
    }
  }

  for (let year = firstYear; year < current; year++) {
    try {
      for (const row of await sources.college(year)) records.push({ name: row.school, level: "college", year });
    } catch (error) {
      console.error(`[school-directory] college ${year} failed:`, error instanceof Error ? error.message : error);
    }
  }

  // High school seasons the Historical legend saved; the tables exist once a season was built.
  try {
    await backfillSeasonNames(db, firstYear, options.backfillBudget ?? SCHOOL_NAME_BACKFILL_BUDGET, sources);
  } catch {
    // No seasons built yet.
  }
  const formats = SCHOOL_SEASON_FORMATS.map((f) => f.format);
  try {
    const rows = (await db.all(sql`
      SELECT t.school AS school, t.year AS year, n.name AS name FROM school_season_teams t
      LEFT JOIN school_season_names n ON n.school = t.school AND n.format = t.format AND n.year = t.year
      WHERE t.year >= ${firstYear}`)) as { school: string; year: number; name: string | null }[];
    for (const row of rows) {
      const name = row.name ? String(row.name) : null;
      records.push({ name, handle: name ? undefined : String(row.school), level: "highSchool", year: Number(row.year) });
    }
  } catch (error) {
    console.error(`[school-directory] saved ${formats.join("/")} seasons unreadable:`, error instanceof Error ? error.message : error);
  }
  return records;
}

/** Rebuilds the directory table from {@link collectSchoolDirectoryRecords}. Returns the row count. */
export async function rebuildSchoolDirectory(
  db: Database,
  options: { now?: Date; sources?: SchoolDirectorySources; backfillBudget?: number } = {},
): Promise<number> {
  await ensureTable(db);
  const entries = buildSchoolDirectory(await collectSchoolDirectoryRecords(db, options), { hasLogo: hasSchoolLogo });
  if (entries.length === 0) return 0;
  const builtAt = Math.floor((options.now ?? new Date()).getTime() / 1000);
  await db.run(sql`DELETE FROM school_directory`);
  const rows = entries.map((e) => ({
    h: e.handle,
    n: e.name,
    l: e.level,
    a: JSON.stringify(e.aliases),
    f: e.firstYear,
    y: e.lastYear,
    r: e.ranked ? 1 : 0,
    m: JSON.stringify(e.missing),
  }));
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = JSON.stringify(rows.slice(i, i + INSERT_CHUNK));
    await db.run(sql`
      INSERT OR REPLACE INTO school_directory (handle, name, level, aliases, first_year, last_year, ranked, missing, built_at)
      SELECT json_extract(value, '$.h'), json_extract(value, '$.n'), json_extract(value, '$.l'), json_extract(value, '$.a'),
             json_extract(value, '$.f'), json_extract(value, '$.y'), json_extract(value, '$.r'), json_extract(value, '$.m'), ${builtAt}
      FROM json_each(${chunk})`);
  }
  return entries.length;
}

interface DirectoryRow {
  handle: string;
  name: string;
  level: string;
  aliases: string;
  first_year: number;
  last_year: number;
  ranked: number;
  missing: string;
  built_at: number;
}

function parseList<T>(text: string): T[] {
  try {
    const value = JSON.parse(text);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function toEntry(row: DirectoryRow): SchoolDirectoryEntry {
  return {
    handle: String(row.handle),
    name: String(row.name),
    level: row.level === "college" ? "college" : "highSchool",
    aliases: parseList<string>(row.aliases),
    firstYear: Number(row.first_year),
    lastYear: Number(row.last_year),
    ranked: Boolean(Number(row.ranked)),
    missing: parseList<SchoolMissingInfo>(row.missing),
  };
}

/** The directory row for a page's handle (an old spelling finds the school's row), or null. */
export async function getSchoolDirectoryEntry(db: Database, handle: string): Promise<SchoolDirectoryEntry | null> {
  await ensureTable(db);
  const keys = [...new Set([handle, canonicalSchoolHandle(handle)])];
  for (const key of keys) {
    const rows = (await db.all(sql`SELECT * FROM school_directory WHERE handle = ${key} LIMIT 1`)) as DirectoryRow[];
    if (rows[0]) return toEntry(rows[0]);
  }
  return null;
}

/** The admin report: every row with gaps, and names that look like one school on two pages. */
export async function getSchoolDirectoryReport(db: Database): Promise<SchoolDirectoryReport> {
  await ensureTable(db);
  const rows = (await db.all(sql`SELECT * FROM school_directory`)) as DirectoryRow[];
  const entries = rows.map(toEntry);
  const builtAt = rows.length ? Math.max(...rows.map((row) => Number(row.built_at))) : null;
  return {
    builtAt: builtAt ? new Date(builtAt * 1000).toISOString() : null,
    total: entries.length,
    counts: {
      college: entries.filter((e) => e.level === "college").length,
      highSchool: entries.filter((e) => e.level === "highSchool").length,
    },
    missing: entries
      .filter((e) => e.missing.length > 0)
      .sort((a, b) => b.missing.length - a.missing.length || b.lastYear - a.lastYear || a.name.localeCompare(b.name)),
    similar: similarSchoolGroups(entries),
  };
}

/** The daily cron's job: rebuilds the directory when it is a day old or empty. */
export async function runDailySchoolDirectoryRefresh(
  db: Database,
  options: { now?: Date; sources?: SchoolDirectorySources } = {},
): Promise<number | null> {
  await ensureTable(db);
  const [row] = (await db.all(sql`SELECT MAX(built_at) AS built FROM school_directory`)) as { built: number | null }[];
  const now = Math.floor((options.now ?? new Date()).getTime() / 1000);
  if (row?.built && now - Number(row.built) < MAX_AGE_SECONDS - 60 * 60) return null;
  return rebuildSchoolDirectory(db, options);
}
