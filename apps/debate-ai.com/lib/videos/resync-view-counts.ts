/**
 * @fileoverview Refreshes stored YouTube view counts — and whether the videos
 * are still there at all — from inside the Worker.
 *
 * View counts are captured once, when a video is ingested, and then drift for
 * as long as the video keeps being watched, so the library's "most viewed"
 * ordering slowly stops reflecting reality. Availability drifts the other
 * way: uploads get deleted, made private or have their embedding turned off,
 * and the library goes on offering a card that plays nothing.
 *
 * Both are answered by the same request, so this run does both. The API is
 * asked for `statistics,status` over every stored id; what comes back updates
 * the counts, and what *doesn't* come back is the takedown case — a `/videos`
 * lookup by id simply omits a video that no longer exists.
 *
 * Both video tables are refreshed in one pass: the public `videos` table that
 * `/api/videos` serves from, and the `youtube_round_videos` queue the admin
 * page reviews before publishing. An id in both is fetched once.
 * @module lib/videos/resync-view-counts
 */

import { eq, inArray, sql } from "drizzle-orm";
import {
  fetchVideoStatuses,
  setYouTubeApiKey,
  type YouTubeVideoStatus,
} from "debate-data-sync/src/youtube/youtube-api";
import {
  buildViewCountUpdateStatements,
  ROUND_QUEUE_VIEW_COUNT_TARGET,
  VIDEOS_VIEW_COUNT_TARGET,
  type ViewCountTarget,
  type ViewCountUpdate,
} from "debate-data-sync/src/videos/view-count-sql";
import { videos, youtubeRoundVideos } from "@/lib/database/schema";
import { getEnv } from "@/lib/env";

/** What a stored video's availability can be, as written to `videos`. */
export type VideoAvailability = "available" | "private" | "not_embeddable" | "removed";

/** Per-table outcome of a view-count resync. */
export interface ViewCountTableResult {
  /** Rows read from the table. */
  rows: number;
  /** Rows whose stored count differed from YouTube and were rewritten. */
  updated: number;
}

/** How the library's availability moved during one run. */
export interface AvailabilityResult {
  /** Videos YouTube still serves normally. */
  available: number;
  /** Videos whose owner has made them private. */
  private: number;
  /** Videos that still exist but can no longer be embedded. */
  notEmbeddable: number;
  /** Videos the API no longer returns at all — deleted or fully withdrawn. */
  removed: number;
  /** Published rows whose availability changed during this run. */
  changed: number;
}

/** Outcome of one view-count resync run. */
export interface ViewCountResyncResult {
  /** Distinct video ids across both tables — what was asked of YouTube. */
  videosChecked: number;
  /** Ids YouTube returned a view count for. */
  viewCountsFetched: number;
  /** Ids YouTube did not return, i.e. deleted or private videos. */
  missing: number;
  /** Distinct video ids rewritten in at least one table. */
  updated: number;
  /** The published `videos` table. See {@link ViewCountTableResult}. */
  published: ViewCountTableResult;
  /** The unpublished admin queue. See {@link ViewCountTableResult}. */
  queued: ViewCountTableResult;
  /** Takedown tracking for this run. See {@link AvailabilityResult}. */
  availability: AvailabilityResult;
  /** Milliseconds the run took. */
  durationMs: number;
}

/** One stored row's current view count and availability. */
interface StoredRow {
  id: string;
  views: number;
  availability?: string | null;
}

/**
 * Classifies what YouTube said about one video.
 *
 * A missing status means the id was not in the response at all, which is the
 * only signal the API gives for a deleted video. `private` and
 * `not_embeddable` are deliberately kept apart from `removed`: the first two
 * can be undone by the uploader and the video's metadata is still worth
 * keeping, the third is permanent.
 *
 * @param status - What the API returned for this id, or `undefined` when it
 *   returned nothing.
 * @returns The availability to store.
 */
export function classifyAvailability(
  status: YouTubeVideoStatus | undefined,
): VideoAvailability {
  if (!status) return "removed";
  if (status.privacyStatus === "private") return "private";
  if (
    status.uploadStatus === "rejected" ||
    status.uploadStatus === "failed" ||
    status.uploadStatus === "deleted"
  ) {
    return "removed";
  }
  if (status.embeddable === false) return "not_embeddable";
  return "available";
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
  rows: StoredRow[],
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

/** How many ids one `IN (...)` availability update may carry. */
const AVAILABILITY_BATCH = 200;

/**
 * Writes availability back to the published table, one statement per state.
 *
 * Grouping by state rather than by row keeps a full-library run to a handful
 * of writes. `missing_checks` counts consecutive failures so a single bad
 * response — a batch that 500s, a region hiccup — reads differently from a
 * video that has been gone for weeks; finding the video again resets it.
 *
 * @param db - Drizzle handle.
 * @param states - Availability per published video id.
 * @param stored - Availability as currently stored, for the change count.
 * @returns How many published rows changed state.
 */
async function applyAvailability(
  db: any,
  states: Map<string, VideoAvailability>,
  stored: Map<string, string>,
): Promise<number> {
  const byState = new Map<VideoAvailability, string[]>();
  let changed = 0;

  for (const [videoId, availability] of states) {
    if ((stored.get(videoId) ?? "available") !== availability) changed++;
    const bucket = byState.get(availability);
    if (bucket) bucket.push(videoId);
    else byState.set(availability, [videoId]);
  }

  const checkedAt = new Date();
  for (const [availability, ids] of byState) {
    for (let i = 0; i < ids.length; i += AVAILABILITY_BATCH) {
      const batch = ids.slice(i, i + AVAILABILITY_BATCH);
      await db
        .update(videos)
        .set({
          availability,
          availabilityCheckedAt: checkedAt,
          viewCountSyncedAt: checkedAt,
          missingChecks:
            availability === "available" ? 0 : sql`${videos.missingChecks} + 1`,
        })
        .where(inArray(videos.videoId, batch));
    }
  }

  return changed;
}

/**
 * Refetches every stored video's view count and availability from YouTube and
 * writes back what moved.
 *
 * Runs synchronously within the request, matching `resyncYouTubeRounds` — this
 * app has no background job queue, so the caller (the admin button) waits for
 * it. One YouTube request covers 50 videos, so a full library costs on the
 * order of a hundred of them.
 *
 * @param db - Drizzle handle bound to D1 (or local SQLite in development).
 * @returns Counts and timing for the run. See {@link ViewCountResyncResult}.
 * @throws When no YouTube API key is configured, or when YouTube declines the
 *   request — a failed run must not be mistaken for a library of deleted
 *   videos, so it fails loudly rather than marking everything missing.
 */
export async function resyncVideoViewCounts(db: any): Promise<ViewCountResyncResult> {
  const apiKey = getEnv("YOUTUBE_API_KEY");
  if (!apiKey) {
    throw new Error("YouTube API key not configured");
  }
  // The API client is shared with the CLI, where the key comes from
  // `process.env` at import. Inside the Worker it arrives on the request's
  // `env` binding instead, so hand it over before the first request — without
  // this every batch goes out unauthenticated and comes back 403.
  setYouTubeApiKey(apiKey);

  const startedAt = Date.now();

  const publishedRows: StoredRow[] = await db
    .select({
      id: videos.videoId,
      views: videos.viewCount,
      availability: videos.availability,
    })
    .from(videos);
  const queuedRows: StoredRow[] = await db
    .select({ id: youtubeRoundVideos.id, views: youtubeRoundVideos.views })
    .from(youtubeRoundVideos);

  const ids = [...new Set([...publishedRows, ...queuedRows].map((row) => row.id))];

  const { statuses, missing } =
    ids.length > 0 ? await fetchVideoStatuses(ids) : { statuses: {}, missing: [] };

  const viewCounts: Record<string, number> = {};
  for (const status of Object.values(statuses)) {
    if (status.viewCount !== null) viewCounts[status.videoId] = status.viewCount;
  }
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

  const states = new Map<string, VideoAvailability>();
  for (const row of publishedRows) {
    states.set(row.id, classifyAvailability(statuses[row.id]));
  }
  const stored = new Map(
    publishedRows.map((row) => [row.id, row.availability ?? "available"] as const),
  );
  const changed = await applyAvailability(db, states, stored);

  const tally = { available: 0, private: 0, notEmbeddable: 0, removed: 0 };
  for (const availability of states.values()) {
    if (availability === "available") tally.available++;
    else if (availability === "private") tally.private++;
    else if (availability === "not_embeddable") tally.notEmbeddable++;
    else tally.removed++;
  }

  return {
    videosChecked: ids.length,
    viewCountsFetched: fetchedCount,
    missing: missing.length,
    updated: new Set([...publishedUpdated, ...queuedUpdated]).size,
    published: { rows: publishedRows.length, updated: publishedUpdated.length },
    queued: { rows: queuedRows.length, updated: queuedUpdated.length },
    availability: { ...tally, changed },
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Lists the published videos a run has found missing, newest failure first.
 *
 * This is what the admin page shows under "taken down": the rows whose
 * embeds no longer play, so they can be removed or replaced deliberately
 * rather than discovered by a viewer.
 *
 * @param db - Drizzle handle.
 * @param limit - How many rows to return.
 */
export async function listUnavailableVideos(db: any, limit = 100) {
  return db
    .select({
      videoId: videos.videoId,
      title: videos.title,
      channel: videos.channel,
      availability: videos.availability,
      missingChecks: videos.missingChecks,
      availabilityCheckedAt: videos.availabilityCheckedAt,
    })
    .from(videos)
    .where(sql`${videos.availability} <> 'available'`)
    .orderBy(sql`${videos.missingChecks} desc`)
    .limit(limit);
}

/**
 * Clears a video's takedown flag by hand.
 *
 * A video can come back — a private upload is made public again, an embed
 * restriction is lifted — and an admin who has checked should not have to
 * wait for the next weekly run to clear the badge.
 *
 * @param db - Drizzle handle.
 * @param videoId - The video to mark available again.
 */
export async function markVideoAvailable(db: any, videoId: string): Promise<void> {
  await db
    .update(videos)
    .set({ availability: "available", missingChecks: 0, availabilityCheckedAt: new Date() })
    .where(eq(videos.videoId, videoId));
}
