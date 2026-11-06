/**
 * @fileoverview Removes the year from every saved tournament name —
 * `videos.tournament` (the public library) and `youtube_round_videos.tournament`
 * (the admin resync queue) — so `"2024 TOC"` is stored as `"TOC"`. New writes
 * already go through `stripTournamentYear` (`@debate-ai/videos`'
 * `data/video-rows.ts`); this cleans the rows saved before that.
 *
 * Works on distinct names, not rows: one `UPDATE … WHERE tournament = old`
 * per name that changes, so a name shared by hundreds of rounds costs one
 * statement. At most {@link STRIP_TOURNAMENT_YEARS_BATCH} names are rewritten
 * per call to stay inside a Worker invocation's D1 query budget; `remaining`
 * says how many are left, and the admin card calls again until it is 0. Safe
 * to re-run: a name with no year produces no write.
 * @module lib/videos/strip-tournament-years
 */

import { isNotNull, sql } from "drizzle-orm";
import { stripTournamentYear } from "@debate-ai/videos/src/data/video-rows";
import { chunkStatements } from "@/lib/database/query-budget";
import { videos, youtubeRoundVideos } from "@/lib/database/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** Most distinct names rewritten per call, across both tables. */
export const STRIP_TOURNAMENT_YEARS_BATCH = 400;

/** One name to rewrite in one table. */
export interface TournamentRename {
  table: "videos" | "youtube_round_videos";
  from: string;
  /** The name without its year; null when nothing but a year was stored. */
  to: string | null;
}

/** What one call did. */
export interface StripTournamentYearsResult {
  /** Distinct names rewritten by this call. */
  renamed: number;
  /** Rows those names covered. */
  rows: number;
  /** Distinct names still holding a year, for the next call. */
  remaining: number;
  /** A few of this call's renames, for the admin card's progress line. */
  examples: Array<{ from: string; to: string | null }>;
}

/**
 * Plans the renames for one table's distinct tournament names.
 *
 * @param table - Which table the names come from.
 * @param names - Distinct stored names with their row counts.
 * @returns Every name whose year-stripped form differs.
 */
export function planTournamentRenames(
  table: TournamentRename["table"],
  names: Array<{ tournament: string | null; rows: number }>,
): Array<TournamentRename & { rows: number }> {
  const renames: Array<TournamentRename & { rows: number }> = [];
  for (const { tournament, rows } of names) {
    if (!tournament) continue;
    const to = stripTournamentYear(tournament);
    if (to !== tournament) renames.push({ table, from: tournament, to, rows: Number(rows) || 0 });
  }
  return renames;
}

/**
 * Strips the year from saved tournament names, one batch per call.
 *
 * @param db - Drizzle handle bound to D1 (or local SQLite).
 * @param options - `limit`: most names rewritten by this call (default
 *   {@link STRIP_TOURNAMENT_YEARS_BATCH}); the daily cron passes a smaller one
 *   since it shares its invocation's query budget with other jobs.
 * @returns See {@link StripTournamentYearsResult}.
 */
export async function stripTournamentYears(
  db: Db,
  options: { limit?: number } = {},
): Promise<StripTournamentYearsResult> {
  const [videoNames, queueNames] = await Promise.all([
    db
      .select({ tournament: videos.tournament, rows: sql<number>`count(*)` })
      .from(videos)
      .where(isNotNull(videos.tournament))
      .groupBy(videos.tournament),
    db
      .select({ tournament: youtubeRoundVideos.tournament, rows: sql<number>`count(*)` })
      .from(youtubeRoundVideos)
      .where(isNotNull(youtubeRoundVideos.tournament))
      .groupBy(youtubeRoundVideos.tournament),
  ]);

  const all = [
    ...planTournamentRenames("videos", videoNames),
    ...planTournamentRenames("youtube_round_videos", queueNames),
  ];
  const batch = all.slice(0, Math.max(1, options.limit ?? STRIP_TOURNAMENT_YEARS_BATCH));

  const statements = batch.map(({ table, from, to }) => {
    const column = table === "videos" ? videos.tournament : youtubeRoundVideos.tournament;
    const target = table === "videos" ? videos : youtubeRoundVideos;
    return db.update(target).set({ tournament: to }).where(sql`${column} = ${from}`);
  });
  for (const chunk of chunkStatements(statements)) await db.batch(chunk);

  return {
    renamed: batch.length,
    rows: batch.reduce((sum, rename) => sum + rename.rows, 0),
    remaining: all.length - batch.length,
    examples: batch.slice(0, 3).map(({ from, to }) => ({ from, to })),
  };
}

/** Names the daily cron rewrites per run; the admin card handles a backlog. */
const DAILY_LIMIT = 100;

/**
 * The daily cron's pass: keeps any name saved with a year by a path that
 * skipped {@link stripTournamentYear} (a manual D1 edit, an old seed) from
 * lingering. Logs what it did; errors propagate to the cron's catch.
 *
 * @param db - Drizzle handle bound to D1.
 */
export async function runDailyTournamentYearStrip(db: Db): Promise<void> {
  const result = await stripTournamentYears(db, { limit: DAILY_LIMIT });
  if (result.renamed > 0) {
    console.log(
      `Stripped years from ${result.renamed} tournament names (${result.rows} rows); ${result.remaining} left.`,
    );
  }
}
