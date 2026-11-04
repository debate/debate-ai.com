/**
 * @fileoverview Fills `videos.aff_team_long` / `neg_team_long` — the
 * debaters' last names (`"yang-smith"`) — for round videos whose teams are a
 * school and two initials (`"Strath Haven YS"`), from each season's top-team
 * rankings. Matching rules live in `@debate-ai/videos`'
 * `lib/team-long-names.ts`; this module loads the tables and writes D1.
 *
 * Tables per format and season:
 * - College policy: debatedata's past-season table (bundled CSV, 2009-10 on)
 *   and Extinction.GG's College Policy ratings (2015-16 on).
 * - HS policy, PF: Extinction.GG's ratings (2015-16 on).
 *
 * Extinction.GG files for finished seasons come from the D1 copies the
 * `/api/extinction` proxy keeps (`lib/rankings/extinction-store.ts`), and are
 * fetched and saved there the first time. Each call handles one season (its
 * rows are matched against that season and the one before), so a Worker
 * invocation parses at most a handful of ratings files; the admin button
 * loops over seasons with `nextSeason`.
 *
 * Safe to re-run: sides that already hold a name are kept (unless
 * `overwrite`), rows an admin edited are never touched, and a side that
 * resolves to what it holds produces no write.
 * @module lib/videos/fill-team-long-names
 */

import { and, inArray, sql } from "drizzle-orm";
import {
  EXTINCTION_BASE_URL,
  collegeSeasonYearOf,
  currentRankingSeasonYear,
  extinctionFileName,
  extinctionSeasonCode,
  hasCollegeHistory,
  loadCollegeHistory,
  EXTINCTION_FIRST_SEASON_YEAR,
} from "@debate-ai/rankings";
import {
  TEAM_LONG_NAME_STYLE_FORMAT,
  isInitialsTeamLabel,
  parseExtinctionTeams,
  planTeamLongNames,
  teamLongNameFormat,
  type TeamLongNameEntry,
  type TeamLongNameFormat,
  type TeamLongNameRow,
  type TeamLongNameTables,
  type TeamLongNameUpdate,
} from "@debate-ai/videos/src/lib/team-long-names";
import { sqlLiteral } from "@debate-ai/videos-admin/src/sync/videos/video-seed-sql";
import { ensureTableColumns } from "@/lib/database/ensure-columns";
import { chunkStatements } from "@/lib/database/query-budget";
import { videos } from "@/lib/database/schema";
import { readSavedExtinctionFile, saveExtinctionFile } from "@/lib/rankings/extinction-store";

/** What one call did. */
export interface FillTeamLongNamesResult {
  /** The season handled, or null when no round needed one. */
  season: number | null;
  /** Rounds of that season with at least one initials team. */
  rows: number;
  /** Rows given a new aff and/or neg name. */
  updated: number;
  /** Initials teams of that season still without a name after this call. */
  unresolved: number;
  /** Rankings tables that could not be loaded (`"hspf 2019"`), skipped. */
  missingTables: string[];
  /** The next season to pass as `season`, or null when this was the last. */
  nextSeason: number | null;
  /** Every season with initials rounds, oldest first (for progress). */
  seasons: number[];
  durationMs: number;
}

/** Options for {@link fillTeamLongNames}. */
export interface FillTeamLongNamesOptions {
  /** Season to handle; defaults to the oldest one. */
  season?: number | null;
  /** Re-resolve sides that already hold a name. */
  overwrite?: boolean;
  /** Fetches Extinction.GG (tests pass a stub). */
  fetchImpl?: typeof fetch;
  /** Loads debatedata's table for a season (tests pass a stub). */
  loadCollege?: (season: number) => Promise<readonly TeamLongNameEntry[]>;
  /** Current season year (tests pin it). */
  now?: Date;
}

type Db = any;

interface CandidateRow extends TeamLongNameRow {
  publishedAt: string;
}

/** A row's season: its `season_year`, or its publish date's for legacy rows. */
function rowSeason(row: CandidateRow): number | null {
  return row.seasonYear > 0 ? row.seasonYear : collegeSeasonYearOf(row.publishedAt);
}

/** Whether a row still has a side to fill (or any initials side, when overwriting). */
function needsFill(row: CandidateRow, overwrite: boolean): boolean {
  return (
    (isInitialsTeamLabel(row.affTeam) && (overwrite || !row.affTeamLong)) ||
    (isInitialsTeamLabel(row.negTeam) && (overwrite || !row.negTeamLong))
  );
}

/** One Extinction.GG ratings file's body, from D1 or upstream; null when there is none. */
async function loadExtinctionBody(db: Db, file: string, past: boolean, fetchImpl: typeof fetch): Promise<string | null> {
  if (past) {
    const saved = await readSavedExtinctionFile(db, "teams", file).catch(() => null);
    if (saved) return saved.status === 200 ? saved.body : null;
  }
  const res = await fetchImpl(`${EXTINCTION_BASE_URL}/teams/${file}`, { headers: { Accept: "application/json" } });
  if (res.status === 403 || res.status === 404) {
    if (past) await saveExtinctionFile(db, "teams", file, { status: res.status, body: "" }).catch(() => undefined);
    return null;
  }
  if (!res.ok) throw new Error(`Extinction.GG returned ${res.status} for ${file}`);
  const body = await res.text();
  JSON.parse(body);
  if (past) await saveExtinctionFile(db, "teams", file, { status: 200, body }).catch(() => undefined);
  return body;
}

/**
 * Fills the long names for one season's initials rounds.
 *
 * @param db - Drizzle handle bound to D1 (or local SQLite).
 * @param options - See {@link FillTeamLongNamesOptions}.
 */
export async function fillTeamLongNames(db: Db, options: FillTeamLongNamesOptions = {}): Promise<FillTeamLongNamesResult> {
  const startedAt = Date.now();
  const overwrite = options.overwrite ?? false;
  const fetchImpl = options.fetchImpl ?? fetch;
  const currentSeason = currentRankingSeasonYear(options.now ?? new Date());
  const loadCollege = options.loadCollege ?? ((season: number) => loadCollegeHistory(season));

  // The long-name columns postdate the untracked migrations; add them if the
  // live table lacks them.
  await ensureTableColumns(db, videos);

  const styles = Object.keys(TEAM_LONG_NAME_STYLE_FORMAT).map(Number);
  const all = (await db
    .select({
      videoId: videos.videoId,
      style: videos.style,
      seasonYear: videos.seasonYear,
      publishedAt: videos.publishedAt,
      affTeam: videos.affTeam,
      negTeam: videos.negTeam,
      affTeamLong: videos.affTeamLong,
      negTeamLong: videos.negTeamLong,
    })
    .from(videos)
    .where(and(inArray(videos.style, styles), sql`${videos.adminEdited} = 0`))) as CandidateRow[];

  const bySeason = new Map<number, CandidateRow[]>();
  for (const row of all) {
    const season = rowSeason(row);
    if (season === null || !needsFill(row, overwrite)) continue;
    bySeason.set(season, [...(bySeason.get(season) ?? []), row]);
  }
  const seasons = [...bySeason.keys()].sort((a, b) => a - b);
  const season = options.season != null ? options.season : (seasons[0] ?? null);
  const nextSeason = season === null ? null : (seasons.find((s) => s > season) ?? null);
  const rows = season === null ? [] : (bySeason.get(season) ?? []);

  const missingTables: string[] = [];
  const tableCache = new Map<string, Promise<readonly TeamLongNameEntry[] | null>>();

  /** One table, or null when the source has none for that season (or failed). */
  const table = (source: "debatedata" | TeamLongNameFormat, year: number) => {
    const key = `${source} ${year}`;
    let pending = tableCache.get(key);
    if (!pending) {
      pending = (async () => {
        if (source === "debatedata") return hasCollegeHistory(year) ? loadCollege(year) : null;
        if (year < EXTINCTION_FIRST_SEASON_YEAR || year > currentSeason) return null;
        const body = await loadExtinctionBody(db, extinctionFileName(source, extinctionSeasonCode(year)), year < currentSeason, fetchImpl);
        return body === null ? null : parseExtinctionTeams(body);
      })().catch((error: unknown) => {
        console.error(`[team-long-names] ${key}:`, error instanceof Error ? error.message : String(error));
        missingTables.push(key);
        return null;
      });
      tableCache.set(key, pending);
    }
    return pending;
  };

  const seasonTables = async (format: TeamLongNameFormat, year: number): Promise<TeamLongNameTables> => {
    const sources: ("debatedata" | TeamLongNameFormat)[] = format === "collegepolicy" ? ["debatedata", format] : [format];
    const tables = await Promise.all(sources.map((source) => table(source, year)));
    return tables.filter((t): t is readonly TeamLongNameEntry[] => !!t && t.length > 0);
  };

  const updates: TeamLongNameUpdate[] = [];
  if (season !== null) {
    const byFormat = new Map<TeamLongNameFormat, CandidateRow[]>();
    for (const row of rows) {
      const format = teamLongNameFormat(row.style);
      if (format) byFormat.set(format, [...(byFormat.get(format) ?? []), row]);
    }
    for (const [format, formatRows] of byFormat) {
      const tables = [await seasonTables(format, season), await seasonTables(format, season - 1)];
      updates.push(...planTeamLongNames(formatRows, format, tables, overwrite));
    }
  }

  const statements = updates.map((update) => {
    const sets = [
      update.affTeamLong !== undefined ? `"aff_team_long" = ${sqlLiteral(update.affTeamLong)}` : null,
      update.negTeamLong !== undefined ? `"neg_team_long" = ${sqlLiteral(update.negTeamLong)}` : null,
    ].filter(Boolean);
    return db.run(sql.raw(`UPDATE "videos" SET ${sets.join(", ")} WHERE "video_id" = ${sqlLiteral(update.videoId)}`));
  });
  for (const batch of chunkStatements(statements)) await db.batch(batch);

  const filled = new Map(updates.map((u) => [u.videoId, u]));
  let unresolved = 0;
  for (const row of rows) {
    const update = filled.get(row.videoId);
    if (isInitialsTeamLabel(row.affTeam) && !(update?.affTeamLong ?? row.affTeamLong)) unresolved++;
    if (isInitialsTeamLabel(row.negTeam) && !(update?.negTeamLong ?? row.negTeamLong)) unresolved++;
  }

  return {
    season,
    rows: rows.length,
    updated: updates.length,
    unresolved,
    missingTables,
    nextSeason,
    seasons,
    durationMs: Date.now() - startedAt,
  };
}
