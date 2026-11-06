/**
 * @fileoverview Fills `videos.computed_title` — the round's standardized
 * title, e.g. `"2026 Harvard Quarters: Iowa #6 Eltyeb & Weimar vs Emory #1
 * Gallagher & Young"` — for every video, one season per call.
 *
 * The wording is `buildComputedTitle` (`@debate-ai/videos`'
 * `lib/computed-title.ts`). This module supplies what the tuple alone can't:
 * each team's rank in its season's rankings and its debaters' last names,
 * from the same tables the team last-names fill reads (debatedata and the
 * Elo ratings for college, the Elo ratings for HS policy and PF; see
 * `fill-team-long-names.ts`). Names may come from the season before when the
 * round's own season doesn't know the team; ranks only from the round's own
 * season. A team no table knows keeps its stored last names
 * (`aff_team_long`), else its code. LD, WSD and the other formats get the
 * standard title without ranks or names.
 *
 * Lectures, and videos whose title doesn't read as a round, end up with no
 * computed title. Safe to re-run: every round is recomputed (ranks change
 * through the current season), and only a title that changed is written.
 * @module lib/videos/fill-computed-titles
 */

import { sql } from "drizzle-orm";
import { collegeSeasonYearOf, currentRankingSeasonYear, loadCollegeHistory } from "@debate-ai/rankings";
import { buildComputedTitle } from "@debate-ai/videos/src/lib/computed-title";
import {
  longNameToDisplay,
  resolveTeamTitleParts,
  teamLongNameFormat,
  type TeamLongNameEntry,
  type TeamLongNameTables,
} from "@debate-ai/videos/src/lib/team-long-names";
import type { VideoType } from "@debate-ai/videos";
import { sqlLiteral } from "@debate-ai/videos-admin/src/sync/videos/video-seed-sql";
import { ensureTableColumns } from "@/lib/database/ensure-columns";
import { chunkStatements } from "@/lib/database/query-budget";
import { videos } from "@/lib/database/schema";
import { createSeasonTableLoader } from "./fill-team-long-names";

/** What one call did. */
export interface FillComputedTitlesResult {
  /** The season handled (0 = legacy, before 2010), or null when the table is empty. */
  season: number | null;
  /** Videos of that season. */
  rows: number;
  /** Videos whose computed title was written (set, changed or cleared). */
  updated: number;
  /** Videos of that season that have a computed title after this call. */
  titled: number;
  /** Teams of that season shown with a rank. */
  ranked: number;
  /** Rankings tables that could not be loaded (`"hspf 2019"`), skipped. */
  missingTables: string[];
  /** The next season to pass as `season`, or null when this was the last. */
  nextSeason: number | null;
  /** Every season with videos, oldest first (for progress). */
  seasons: number[];
  durationMs: number;
}

/** Options for {@link fillComputedTitles}. */
export interface FillComputedTitlesOptions {
  /** Season to handle; defaults to the oldest one. */
  season?: number | null;
  /** Fetches the upstream ratings (tests pass a stub). */
  fetchImpl?: typeof fetch;
  /** Loads debatedata's table for a season (tests pass a stub). */
  loadCollege?: (season: number) => Promise<readonly TeamLongNameEntry[]>;
  /** Current season year (tests pin it). */
  now?: Date;
}

type Db = any;

/** The columns of a `videos` row the title is built from. */
interface TitleRow {
  videoId: string;
  title: string;
  publishedAt: string;
  style: number | null;
  category: string | null;
  tournament: string | null;
  roundLevel: string | null;
  affTeam: string | null;
  negTeam: string | null;
  arg1ac: string | null;
  arg2nr: string | null;
  seasonYear: number;
  affTeamLong: string | null;
  negTeamLong: string | null;
  computedTitle: string | null;
}

/** A row's season: its `season_year`, its publish date's for legacy rows, else 0. */
function rowSeason(row: TitleRow): number {
  return row.seasonYear > 0 ? row.seasonYear : (collegeSeasonYearOf(row.publishedAt) ?? 0);
}

/** The tuple `buildComputedTitle` reads, from a row's columns. */
function rowTuple(row: TitleRow): VideoType {
  const tuple: unknown[] = [
    row.videoId,
    row.title,
    row.publishedAt,
    "",
    0,
    "",
    row.style ?? row.category ?? undefined,
    row.tournament,
    row.roundLevel,
    row.affTeam,
    row.negTeam,
    null,
    null,
    row.arg1ac,
    row.arg2nr,
    null,
    null,
    row.seasonYear,
  ];
  return tuple as VideoType;
}

/**
 * Fills the computed titles for one season's videos.
 *
 * @param db - Drizzle handle bound to D1 (or local SQLite).
 * @param options - See {@link FillComputedTitlesOptions}.
 */
export async function fillComputedTitles(db: Db, options: FillComputedTitlesOptions = {}): Promise<FillComputedTitlesResult> {
  const startedAt = Date.now();
  const currentSeason = currentRankingSeasonYear(options.now ?? new Date());
  const { seasonTables, missingTables } = createSeasonTableLoader(db, {
    fetchImpl: options.fetchImpl ?? fetch,
    loadCollege: options.loadCollege ?? ((season: number) => loadCollegeHistory(season)),
    currentSeason,
  });

  // `computed_title` postdates the untracked migrations; add it if missing.
  await ensureTableColumns(db, videos);

  const all = (await db
    .select({
      videoId: videos.videoId,
      title: videos.title,
      publishedAt: videos.publishedAt,
      style: videos.style,
      category: videos.category,
      tournament: videos.tournament,
      roundLevel: videos.roundLevel,
      affTeam: videos.affTeam,
      negTeam: videos.negTeam,
      arg1ac: videos.arg1ac,
      arg2nr: videos.arg2nr,
      seasonYear: videos.seasonYear,
      affTeamLong: videos.affTeamLong,
      negTeamLong: videos.negTeamLong,
      computedTitle: videos.computedTitle,
    })
    .from(videos)) as TitleRow[];

  const bySeason = new Map<number, TitleRow[]>();
  for (const row of all) {
    const season = rowSeason(row);
    const list = bySeason.get(season);
    if (list) list.push(row);
    else bySeason.set(season, [row]);
  }
  const seasons = [...bySeason.keys()].sort((a, b) => a - b);
  const season = options.season != null ? options.season : (seasons[0] ?? null);
  const nextSeason = season === null ? null : (seasons.find((s) => s > season) ?? null);
  const rows = season === null ? [] : (bySeason.get(season) ?? []);

  const tablesByFormat = new Map<string, Promise<TeamLongNameTables[]>>();
  const tablesFor = (format: NonNullable<ReturnType<typeof teamLongNameFormat>>, year: number) => {
    let pending = tablesByFormat.get(format);
    if (!pending) {
      pending = Promise.all([seasonTables(format, year), seasonTables(format, year - 1)]);
      tablesByFormat.set(format, pending);
    }
    return pending;
  };

  const updates: { videoId: string; title: string | null }[] = [];
  let titled = 0;
  let ranked = 0;
  for (const row of rows) {
    const format = season ? teamLongNameFormat(row.style) : null;
    const tables = format && season ? await tablesFor(format, season) : null;
    const aff = format && tables && row.affTeam ? resolveTeamTitleParts(format, row.affTeam, tables) : null;
    const neg = format && tables && row.negTeam ? resolveTeamTitleParts(format, row.negTeam, tables) : null;
    if (aff?.rank) ranked++;
    if (neg?.rank) ranked++;
    const title = buildComputedTitle(rowTuple(row), {
      aff: aff?.rank ?? null,
      neg: neg?.rank ?? null,
      affNames: aff?.names ?? longNameToDisplay(row.affTeamLong),
      negNames: neg?.names ?? longNameToDisplay(row.negTeamLong),
    });
    if (title) titled++;
    if (title !== (row.computedTitle ?? null)) updates.push({ videoId: row.videoId, title });
  }

  // `updated_at` moves too, so clients holding the library index pick the
  // new titles up on their next "what changed since?" request.
  const statements = updates.map(({ videoId, title }) =>
    db.run(
      sql.raw(
        `UPDATE "videos" SET "computed_title" = ${sqlLiteral(title)}, "updated_at" = unixepoch() WHERE "video_id" = ${sqlLiteral(videoId)}`,
      ),
    ),
  );
  for (const batch of chunkStatements(statements)) await db.batch(batch);

  return {
    season,
    rows: rows.length,
    updated: updates.length,
    titled,
    ranked,
    missingTables,
    nextSeason,
    seasons,
    durationMs: Date.now() - startedAt,
  };
}
