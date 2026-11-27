/**
 * NPDL (high school parliamentary) rankings, cached in D1.
 *
 * The Parli tab on `/rank` used to scrape parliamentarydebate.org and its
 * embedded Google Sheets on every uncached request, trying up to three seasons
 * with retries, so it often sat on "Loading parliamentary rankings…" for many
 * seconds. The rows now live in two tables:
 *
 * - `npdl_rankings_seasons`: one row per season scraped (page URL, scrape time,
 *   content hash, row counts, last check). A season that was tried and had no
 *   rows is kept with zero counts so requests don't scrape it again.
 * - `npdl_rankings`: one row per ranked team or school, ranks as published.
 *
 * `GET /api/rankings/npdl` reads from here. It only scrapes when a season was
 * never saved (or its empty marker is older than {@link EMPTY_RETRY_SECONDS}),
 * then saves what it found. The daily cron (`worker/index.ts`, 06:00 UTC)
 * re-scrapes the newest {@link REFRESH_SEASONS} seasons, backfills any older
 * season not saved yet, and rewrites a season
 * only when its hash changed, as one `db.batch()` (one D1 request, one
 * transaction). That is at most a few hundred small inserts a day, and usually
 * a single UPDATE per season.
 *
 * The tables are created on first use: the app has no tracked migrations (see
 * `lib/database/ensure-columns.ts`).
 */

import { eq, sql } from "drizzle-orm";
import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import {
  fetchNpdlSeason,
  NPDL_SEASONS,
  type NpdlFetchOptions,
  type NpdlRankingRow,
  type NpdlSeasonRankings,
} from "@debate-ai/rankings/src/sync/sync-npdl-rankings";
import type { getDBFromContext } from "@/lib/database/context";

type Database = Awaited<ReturnType<typeof getDBFromContext>>;

/** Seasons the daily cron re-scrapes, newest first (the coming season's page is often still empty). */
export const REFRESH_SEASONS = 3;

/** How long a season that came back empty is trusted before a request may scrape it again. */
export const EMPTY_RETRY_SECONDS = 24 * 60 * 60;

/** Rows per INSERT: 9 bound values each keeps a statement under D1's 100-parameter limit. */
const ROWS_PER_INSERT = 11;

const CREATE_SEASONS_SQL = `CREATE TABLE IF NOT EXISTS "npdl_rankings_seasons" (
  "season" text PRIMARY KEY NOT NULL,
  "page_url" text DEFAULT '' NOT NULL,
  "fetched_at" text DEFAULT '' NOT NULL,
  "hash" text DEFAULT '' NOT NULL,
  "team_rows" integer DEFAULT 0 NOT NULL,
  "school_rows" integer DEFAULT 0 NOT NULL,
  "checked_at" integer DEFAULT (unixepoch()) NOT NULL
)`;

const CREATE_ROWS_SQL = `CREATE TABLE IF NOT EXISTS "npdl_rankings" (
  "season" text NOT NULL,
  "tab" text NOT NULL,
  "position" integer NOT NULL,
  "rank" integer NOT NULL,
  "school" text NOT NULL,
  "region" text,
  "debater1" text,
  "debater2" text,
  "points" real NOT NULL,
  PRIMARY KEY ("season", "tab", "position")
)`;

/*
 * Drizzle mirrors of the two tables above, for the statements that go into a
 * `db.batch()`. D1's driver binds each batched statement through the prepared
 * statement a query builder carries; a raw `db.run(sql…)` has none, so a batch
 * of them throws on D1 (`reading 'bind'`) while libsql runs it fine.
 */
const seasonsTable = sqliteTable("npdl_rankings_seasons", {
  season: text("season").primaryKey(),
  pageUrl: text("page_url").notNull().default(""),
  fetchedAt: text("fetched_at").notNull().default(""),
  hash: text("hash").notNull().default(""),
  teamRows: integer("team_rows").notNull().default(0),
  schoolRows: integer("school_rows").notNull().default(0),
  checkedAt: integer("checked_at").notNull(),
});

const rankingsTable = sqliteTable(
  "npdl_rankings",
  {
    season: text("season").notNull(),
    tab: text("tab").notNull(),
    position: integer("position").notNull(),
    rank: integer("rank").notNull(),
    school: text("school").notNull(),
    region: text("region"),
    debater1: text("debater1"),
    debater2: text("debater2"),
    points: real("points").notNull(),
  },
  (t) => [primaryKey({ columns: [t.season, t.tab, t.position] })],
);

let tablesReady: Promise<void> | null = null;

function ensureTables(db: Database): Promise<void> {
  tablesReady ??= (async () => {
    await db.run(sql.raw(CREATE_SEASONS_SQL));
    await db.run(sql.raw(CREATE_ROWS_SQL));
  })().catch((error) => {
    tablesReady = null;
    throw error;
  });
  return tablesReady;
}

/** Forgets that the tables exist, for tests that open a fresh database. */
export function resetNpdlTablesForTests(): void {
  tablesReady = null;
}

/** FNV-1a over the published rows, so an unchanged scrape skips the rewrite. */
export function npdlRankingsHash(rankings: Pick<NpdlSeasonRankings, "teams" | "schools">): string {
  const text = JSON.stringify([rankings.teams, rankings.schools]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

interface SeasonRow {
  season: string;
  page_url: string;
  fetched_at: string;
  hash: string;
  team_rows: number;
  school_rows: number;
  checked_at: number;
}

interface RankingRow {
  tab: string;
  rank: number;
  school: string;
  region: string | null;
  debater1: string | null;
  debater2: string | null;
  points: number;
}

async function readSeasonRow(db: Database, season: string): Promise<SeasonRow | null> {
  const rows = (await db.all(
    sql`SELECT season, page_url, fetched_at, hash, team_rows, school_rows, checked_at
        FROM npdl_rankings_seasons WHERE season = ${season}`,
  )) as SeasonRow[];
  return rows[0] ?? null;
}

const hasRows = (row: SeasonRow) => Number(row.team_rows) > 0 || Number(row.school_rows) > 0;

/** The saved season, or null when it was never saved or was saved empty. */
export async function readSavedNpdlSeason(db: Database, season: string): Promise<NpdlSeasonRankings | null> {
  await ensureTables(db);
  const meta = await readSeasonRow(db, season);
  if (!meta || !hasRows(meta)) return null;
  const rows = (await db.all(
    sql`SELECT tab, rank, school, region, debater1, debater2, points
        FROM npdl_rankings WHERE season = ${season} ORDER BY tab, position`,
  )) as RankingRow[];
  const toRow = (r: RankingRow): NpdlRankingRow => ({
    rank: Number(r.rank),
    school: r.school,
    region: r.region ?? null,
    debater1: r.debater1 ?? null,
    debater2: r.debater2 ?? null,
    points: Number(r.points),
  });
  return {
    season,
    pageUrl: meta.page_url,
    fetchedAt: meta.fetched_at,
    teams: rows.filter((r) => r.tab === "team").map(toRow),
    schools: rows.filter((r) => r.tab === "school").map(toRow),
  };
}

/** Saved seasons that have rows, newest first (in {@link NPDL_SEASONS} order). */
export async function listSavedNpdlSeasons(db: Database): Promise<string[]> {
  await ensureTables(db);
  const rows = (await db.all(
    sql`SELECT season FROM npdl_rankings_seasons WHERE team_rows > 0 OR school_rows > 0`,
  )) as Array<{ season: string }>;
  const saved = new Set(rows.map((r) => r.season));
  return NPDL_SEASONS.filter((s) => saved.has(s));
}

/**
 * Replaces a season's rows and its season row in one batch (one D1 request,
 * one transaction), so a failed save leaves the old copy in place.
 */
export async function saveNpdlSeason(db: Database, rankings: NpdlSeasonRankings): Promise<void> {
  await ensureTables(db);
  const { season } = rankings;
  const rows = [
    ...rankings.teams.map((row, position) => ({ tab: "team", position, row })),
    ...rankings.schools.map((row, position) => ({ tab: "school", position, row })),
  ].map(({ tab, position, row }) => ({
    season,
    tab,
    position,
    rank: row.rank,
    school: row.school,
    region: row.region,
    debater1: row.debater1,
    debater2: row.debater2,
    points: row.points,
  }));
  const statements: unknown[] = [db.delete(rankingsTable).where(eq(rankingsTable.season, season))];
  for (let start = 0; start < rows.length; start += ROWS_PER_INSERT) {
    statements.push(db.insert(rankingsTable).values(rows.slice(start, start + ROWS_PER_INSERT)));
  }
  statements.push(
    db
      .insert(seasonsTable)
      .values({
        season,
        pageUrl: rankings.pageUrl,
        fetchedAt: rankings.fetchedAt,
        hash: npdlRankingsHash(rankings),
        teamRows: rankings.teams.length,
        schoolRows: rankings.schools.length,
        checkedAt: sql`unixepoch()`,
      })
      .onConflictDoUpdate({
        target: seasonsTable.season,
        set: {
          pageUrl: sql`excluded.page_url`,
          fetchedAt: sql`excluded.fetched_at`,
          hash: sql`excluded.hash`,
          teamRows: sql`excluded.team_rows`,
          schoolRows: sql`excluded.school_rows`,
          checkedAt: sql`excluded.checked_at`,
        },
      }),
  );
  if (typeof db.batch === "function") {
    await db.batch(statements as unknown as Parameters<typeof db.batch>[0]);
  } else {
    for (const statement of statements) await statement;
  }
}

/** Records that a season was checked; keeps its rows. Creates an empty marker for a never-saved season. */
async function markChecked(db: Database, season: string): Promise<void> {
  await db.run(
    sql`INSERT INTO npdl_rankings_seasons (season, checked_at) VALUES (${season}, unixepoch())
        ON CONFLICT (season) DO UPDATE SET checked_at = unixepoch()`,
  );
}

/** Scrapes one season. Injected in tests. */
export type NpdlSeasonFetcher = (season: string) => Promise<NpdlSeasonRankings>;

const scrapeLive: NpdlSeasonFetcher = (season) => {
  const opts: NpdlFetchOptions = { retries: 2, timeoutMs: 15_000 };
  return fetchNpdlSeason(season, opts);
};

/** What {@link refreshNpdlSeason} did; `"unsaved"` means the scrape had rows but D1 refused the write. */
export type NpdlRefreshStatus = "updated" | "unchanged" | "empty" | "unsaved";

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Scrapes `season` and saves it when its rows changed, returning the scraped
 * rows too, so a request can serve them even when the save fails. A scrape
 * that fails or finds no rows only marks the season checked, keeping any
 * earlier copy.
 */
async function scrapeAndSave(
  db: Database,
  season: string,
  fetchSeason: NpdlSeasonFetcher,
): Promise<{ status: NpdlRefreshStatus; rankings: NpdlSeasonRankings | null }> {
  let fresh: NpdlSeasonRankings | null = null;
  try {
    fresh = await fetchSeason(season);
  } catch (error) {
    console.error(`[npdl-rankings] ${season} scrape failed:`, errorMessage(error));
  }
  if (!fresh || (fresh.teams.length === 0 && fresh.schools.length === 0)) {
    await markChecked(db, season);
    return { status: "empty", rankings: null };
  }
  try {
    const saved = await readSeasonRow(db, season);
    if (saved && hasRows(saved) && saved.hash === npdlRankingsHash(fresh)) {
      await markChecked(db, season);
      return { status: "unchanged", rankings: fresh };
    }
    await saveNpdlSeason(db, fresh);
    return { status: "updated", rankings: fresh };
  } catch (error) {
    console.error(`[npdl-rankings] ${season} save failed:`, errorMessage(error));
    return { status: "unsaved", rankings: fresh };
  }
}

/** Scrapes `season` and saves it when its rows changed; see {@link scrapeAndSave}. */
export async function refreshNpdlSeason(
  db: Database,
  season: string,
  fetchSeason: NpdlSeasonFetcher = scrapeLive,
): Promise<NpdlRefreshStatus> {
  await ensureTables(db);
  return (await scrapeAndSave(db, season, fetchSeason)).status;
}

/** What the route serves for a season, or for the newest season with rows when `season` is null. */
export interface NpdlRankingsLookup {
  rankings: NpdlSeasonRankings | null;
  /** `"database"` when read from D1, `"live"` when this request had to scrape. */
  source: "database" | "live";
}

/** True when a never-saved season, or an empty marker past its retry window, may be scraped now. */
async function mayScrape(db: Database, season: string, nowSeconds: number): Promise<boolean> {
  const meta = await readSeasonRow(db, season);
  if (!meta) return true;
  return !hasRows(meta) && nowSeconds - Number(meta.checked_at) >= EMPTY_RETRY_SECONDS;
}

/**
 * Reads rankings from D1. Scrapes only what was never saved: an asked season
 * missing from D1, or (with no season asked) each of the newest
 * {@link REFRESH_SEASONS} seasons not saved yet, newest first, so an older
 * season someone happened to open first never stands in for the current one.
 */
export async function getNpdlRankings(
  db: Database,
  season: string | null,
  fetchSeason: NpdlSeasonFetcher = scrapeLive,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<NpdlRankingsLookup> {
  await ensureTables(db);
  if (season) {
    const saved = await readSavedNpdlSeason(db, season);
    if (saved) return { rankings: saved, source: "database" };
    if (!(await mayScrape(db, season, nowSeconds))) return { rankings: null, source: "database" };
    return { rankings: (await scrapeAndSave(db, season, fetchSeason)).rankings, source: "live" };
  }

  for (const candidate of NPDL_SEASONS.slice(0, REFRESH_SEASONS)) {
    const saved = await readSavedNpdlSeason(db, candidate);
    if (saved) return { rankings: saved, source: "database" };
    if (!(await mayScrape(db, candidate, nowSeconds))) continue;
    const { rankings } = await scrapeAndSave(db, candidate, fetchSeason);
    if (rankings) return { rankings, source: "live" };
  }
  const newest = (await listSavedNpdlSeasons(db))[0];
  return { rankings: newest ? await readSavedNpdlSeason(db, newest) : null, source: "database" };
}

/**
 * The daily cron's job: re-scrape the newest seasons, then backfill every
 * older season that was never saved (or whose empty marker has expired), one
 * after another. Past seasons are final, so once saved they are left alone;
 * the backfill means every season's rankings are in D1 without waiting for
 * someone to pick that year on the Parli tab. One season failing does not
 * stop the others.
 */
export async function runDailyNpdlRankingsRefresh(
  db: Database,
  fetchSeason: NpdlSeasonFetcher = scrapeLive,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<void> {
  await ensureTables(db);
  const results: string[] = [];
  const refresh = async (season: string, label = "") => {
    try {
      results.push(`${season} ${(await scrapeAndSave(db, season, fetchSeason)).status}${label}`);
    } catch (error) {
      results.push(`${season} failed (${errorMessage(error)})${label}`);
    }
  };
  for (const season of NPDL_SEASONS.slice(0, REFRESH_SEASONS)) await refresh(season);
  for (const season of NPDL_SEASONS.slice(REFRESH_SEASONS)) {
    if (await mayScrape(db, season, nowSeconds)) await refresh(season, " (backfill)");
  }
  console.log(`[npdl-rankings] ${results.join(", ")}`);
}
