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

import { and, eq, inArray } from "drizzle-orm";
import { publishedMsForDate, seasonYearForDate } from "debate-data-sync/src/videos/video-rows";
import { videos, type VideoTableInsert, type YoutubeRoundVideo } from "@/lib/database/schema";
import { recomputeVideoStacks } from "./recompute-video-stacks";

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
 * The weekly/manual resync (`lib/youtube/resync-rounds.ts`) re-walks every
 * subscribed channel's uploads since a fixed `2023-05-01` floor on every
 * run, with no check against `videos` — only an explicit admin removal
 * (`youtube_video_exclusions`) keeps a video out of the queue. So a round
 * published (and possibly corrected via the admin library, which sets
 * `admin_edited`) days or months ago can resurface in
 * `youtube_round_videos` and reach this function again, computed fresh from
 * the (unedited) YouTube listing. Re-reads which of `rows`' ids are already
 * published *and* admin-edited immediately before writing, and leaves those
 * rows alone entirely instead of letting the recomputed round data silently
 * overwrite an admin's title/category/tournament/speech-doc correction —
 * the same "an admin's edit is this row's source of truth once made" rule
 * `video-seed-sql.ts#buildVideoSeedStatements` already guards for the
 * JSON-seed path, applied here to the resync/publish path.
 *
 * Newly published rows carry no stack placement of their own — the resync
 * queue's rows are never run through `assignVideoStacks` — so once every row
 * is written, {@link recomputeVideoStacks} re-derives stacking for the whole
 * table. This is what lets a round published today link up with an analysis
 * published (or resynced) weeks earlier, and vice versa; see that module's
 * fileoverview for why a per-batch computation cannot find that link on its
 * own.
 *
 * @param db - Drizzle handle bound to D1 (or local SQLite in development).
 * @param rows - Queued round videos to publish.
 * @returns Number of rows actually upserted — excludes any left untouched
 *   because they were already published and admin-edited.
 */
export async function publishRoundVideos(db: any, rows: YoutubeRoundVideo[]): Promise<number> {
  const ids = rows.map((row) => row.id);
  const adminEditedIds: Set<string> =
    ids.length === 0
      ? new Set()
      : new Set(
          (
            await db
              .select({ videoId: videos.videoId })
              .from(videos)
              .where(and(inArray(videos.videoId, ids), eq(videos.adminEdited, true)))
          ).map((row: { videoId: string }) => row.videoId),
        );

  let published = 0;
  for (const row of rows) {
    if (adminEditedIds.has(row.id)) continue;
    const values = roundVideoToVideoRow(row);
    await db
      .insert(videos)
      .values(values)
      .onConflictDoUpdate({
        target: videos.videoId,
        set: { ...values, updatedAt: new Date() },
      });
    published++;
  }

  if (published > 0) await recomputeVideoStacks(db);

  return published;
}
