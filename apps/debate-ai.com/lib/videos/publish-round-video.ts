/**
 * @fileoverview Publishes rows from the admin YouTube resync queue
 * (`youtube_round_videos`) into the public `videos` table that `/api/videos`
 * serves from.
 *
 * Mirrors the row shape `debate-data-sync`'s JSON-seeded rows use (see
 * `video-rows.ts`) so a resynced round and a JSON-seeded round are
 * indistinguishable to the public feed once published.
 * @module lib/videos/publish-round-video
 */

import { publishedMsForDate, seasonYearForDate } from "debate-data-sync/src/videos/video-rows";
import { videos, type VideoTableInsert, type YoutubeRoundVideo } from "@/lib/database/schema";

/** Converts one queued round video into a `videos` table insert row. */
export function roundVideoToVideoRow(row: YoutubeRoundVideo): VideoTableInsert {
  return {
    videoId: row.id,
    source: "round",
    title: row.title,
    publishedAt: row.publishedAt,
    publishedMs: publishedMsForDate(row.publishedAt),
    channel: row.channel,
    viewCount: row.views,
    description: row.description,
    style: row.style,
    category: null,
    categoryKey: null,
    tournament: row.tournament,
    roundLevel: row.roundLevel,
    affTeam: row.aff,
    negTeam: row.neg,
    affWin: row.winner,
    judgeDecision: row.judgeDecision,
    arg1ac: null,
    arg2nr: null,
    isTopPick: false,
    speechDocsUrl: null,
    seasonYear: seasonYearForDate(row.publishedAt),
    searchText: `${row.title} ${row.channel} ${row.description}`.toLowerCase(),
  };
}

/**
 * Upserts queued round videos into the public `videos` table.
 *
 * Rows are written one at a time (matching the resync's own upsert loop)
 * rather than batched, since D1 caps bound parameters per statement and a
 * `videos` row already uses most of that budget.
 *
 * @param db - Drizzle handle bound to D1 (or local SQLite in development).
 * @param rows - Queued round videos to publish.
 * @returns Number of rows upserted.
 */
export async function publishRoundVideos(db: any, rows: YoutubeRoundVideo[]): Promise<number> {
  for (const row of rows) {
    const values = roundVideoToVideoRow(row);
    await db
      .insert(videos)
      .values(values)
      .onConflictDoUpdate({
        target: videos.videoId,
        set: { ...values, updatedAt: new Date() },
      });
  }
  return rows.length;
}
