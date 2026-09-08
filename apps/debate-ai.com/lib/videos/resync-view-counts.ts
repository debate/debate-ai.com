/**
 * @fileoverview Refreshes stored YouTube view counts from inside the Worker.
 *
 * View counts are captured once, when a video is ingested, and then drift for
 * as long as the video keeps being watched — so the library's "most viewed"
 * ordering slowly stops reflecting reality. `debate-data-sync`'s CLI
 * (`youtube-update-views.ts`) fixes that in the committed JSON assets from a
 * machine with a checkout; this runs the same refresh against the request's
 * own D1 binding, so the admin page can do it on a deployment without one.
 *
 * Both video tables are refreshed in one pass: the public `videos` table that
 * `/api/videos` serves from, and the `youtube_round_videos` queue the admin
 * page reviews before publishing. An id in both is fetched once.
 * @module lib/videos/resync-view-counts
 */

import { sql } from "drizzle-orm";
import { fetchViewCounts } from "debate-data-sync/src/youtube/youtube-api";
import {
  buildViewCountUpdateStatements,
  ROUND_QUEUE_VIEW_COUNT_TARGET,
  VIDEOS_VIEW_COUNT_TARGET,
  type ViewCountTarget,
  type ViewCountUpdate,
} from "debate-data-sync/src/videos/view-count-sql";
import { videos, youtubeRoundVideos } from "@/lib/database/schema";
import { getEnv } from "@/lib/env";

/** Per-table outcome of a view-count resync. */
export interface ViewCountTableResult {
  /** Rows read from the table. */
  rows: number;
  /** Rows whose stored count differed from YouTube and were rewritten. */
  updated: number;
}

/** Outcome of one view-count resync run. */
export interface ViewCountResyncResult {
  /** Distinct video ids across both tables — what was asked of YouTube. */
  videosChecked: number;
  /** Ids YouTube returned a view count for. */
  viewCountsFetched: number;
  /** Ids YouTube did not return, typically deleted or private videos. */
  missing: number;
  /** Distinct video ids rewritten in at least one table. */
  updated: number;
  /** The published `videos` table. See {@link ViewCountTableResult}. */
  published: ViewCountTableResult;
  /** The unpublished admin queue. See {@link ViewCountTableResult}. */
  queued: ViewCountTableResult;
  /** Milliseconds the run took. */
  durationMs: number;
}

/** One stored row's current view count, from either table. */
interface StoredCount {
  id: string;
  views: number;
}

/**
 * Writes the rows whose count actually changed, and reports how many.
 *
 * Rows already carrying the fetched count are skipped rather than rewritten:
 * most videos do not move between runs, and a no-op `UPDATE` would still cost
 * a D1 write and bump `updated_at`.
 *
 * @param db - Drizzle handle bound to D1 (or local SQLite in development).
 * @param rows - Stored ids and their current counts.
 * @param viewCounts - Freshly fetched counts, keyed by video id.
 * @param target - Table and columns to write. See {@link ViewCountTarget}.
 * @returns The ids that were rewritten.
 */
async function applyViewCounts(
  db: any,
  rows: StoredCount[],
  viewCounts: Record<string, number>,
  target: ViewCountTarget,
): Promise<string[]> {
  const updates: ViewCountUpdate[] = [];
  for (const row of rows) {
    const viewCount = viewCounts[row.id];
    if (viewCount === undefined || viewCount === row.views) continue;
    updates.push({ videoId: row.id, viewCount });
  }

  for (const statement of buildViewCountUpdateStatements(updates, target)) {
    await db.run(sql.raw(statement));
  }

  return updates.map((update) => update.videoId);
}

/**
 * Refetches every stored video's view count from YouTube and writes back the
 * ones that moved.
 *
 * Runs synchronously within the request, matching `resyncYouTubeRounds` — this
 * app has no background job queue, so the caller (the admin button) waits for
 * it. One YouTube request covers 50 videos, so a full library costs on the
 * order of a hundred of them.
 *
 * @param db - Drizzle handle bound to D1 (or local SQLite in development).
 * @returns Counts and timing for the run. See {@link ViewCountResyncResult}.
 * @throws When no YouTube API key is configured for the environment.
 */
export async function resyncVideoViewCounts(db: any): Promise<ViewCountResyncResult> {
  if (!getEnv("YOUTUBE_API_KEY")) {
    throw new Error("YouTube API key not configured");
  }

  const startedAt = Date.now();

  const publishedRows: StoredCount[] = await db
    .select({ id: videos.videoId, views: videos.viewCount })
    .from(videos);
  const queuedRows: StoredCount[] = await db
    .select({ id: youtubeRoundVideos.id, views: youtubeRoundVideos.views })
    .from(youtubeRoundVideos);

  const ids = [...new Set([...publishedRows, ...queuedRows].map((row) => row.id))];

  const viewCounts = ids.length > 0 ? await fetchViewCounts(ids) : {};
  const fetchedCount = Object.keys(viewCounts).length;

  const publishedUpdated = await applyViewCounts(
    db,
    publishedRows,
    viewCounts,
    VIDEOS_VIEW_COUNT_TARGET,
  );
  const queuedUpdated = await applyViewCounts(
    db,
    queuedRows,
    viewCounts,
    ROUND_QUEUE_VIEW_COUNT_TARGET,
  );

  return {
    videosChecked: ids.length,
    viewCountsFetched: fetchedCount,
    missing: ids.length - fetchedCount,
    updated: new Set([...publishedUpdated, ...queuedUpdated]).size,
    published: { rows: publishedRows.length, updated: publishedUpdated.length },
    queued: { rows: queuedRows.length, updated: queuedUpdated.length },
    durationMs: Date.now() - startedAt,
  };
}
