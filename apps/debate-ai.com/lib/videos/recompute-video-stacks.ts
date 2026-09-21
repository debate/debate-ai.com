/**
 * @fileoverview Recomputes stacked-playlist membership (`stack_key`/
 * `stack_position`) for every row currently in the `videos` table.
 *
 * `assignVideoStacks` previously only ever ran over rows built fresh from the
 * bundled JSON assets (`video-rows.ts#buildVideoRows`, which drives the full
 * JSON seed, `seed-videos-to-db.ts`) — a round published through the live
 * YouTube pipeline (`publish-round-video.ts#publishRoundVideos`, behind the
 * admin "Publish"/"Publish all" actions, and the legacy single-endpoint
 * `POST /api/admin/youtube/videos/publish` the API client also exposes)
 * landed in `videos` with no stack fields set at all, and stayed that way
 * even after a full re-seed, since it was never part of the JSON assets to
 * begin with. See `content/docs/internals/video-library.mdx`'s "an existing
 * database shows no stacks until it is re-seeded" Known gap.
 *
 * Stacking has to run over the *whole* table, not just a freshly published
 * batch: a round and its analysis are commonly uploaded weeks apart, by
 * different pipelines, so the link can only be found by looking at
 * everything at once. Only rows whose computed placement actually changed
 * are rewritten, mirroring `resync-view-counts.ts#applyViewCounts`'s
 * "skip what didn't move" rule.
 * @module lib/videos/recompute-video-stacks
 */

import { sql } from "drizzle-orm";
import { assignVideoStacks } from "debate-data-sync/src/videos/video-stacks";
import {
  buildVideoStackUpdateStatements,
  type VideoStackUpdate,
} from "debate-data-sync/src/videos/video-stack-sql";
import { videos } from "@/lib/database/schema";

/** Outcome of one stack-recompute run. */
export interface RecomputeVideoStacksResult {
  /** Rows read from the table. */
  rows: number;
  /** Rows whose stack placement changed and were rewritten. */
  updated: number;
  /** Milliseconds the run took. */
  durationMs: number;
}

/**
 * Recomputes every row's stack placement and writes back whatever changed.
 *
 * Safe to re-run: a row already carrying its correct placement produces no
 * update, so calling this after every publish (see
 * `publish-round-video.ts#publishRoundVideos`) costs one full-table read and
 * however many rows actually moved, not a rewrite of the whole table.
 *
 * @param db - Drizzle handle bound to D1 (or local SQLite in development).
 * @returns Counts and timing for the run. See {@link RecomputeVideoStacksResult}.
 */
export async function recomputeVideoStacks(db: any): Promise<RecomputeVideoStacksResult> {
  const startedAt = Date.now();

  const rows = await db
    .select({
      videoId: videos.videoId,
      description: videos.description,
      source: videos.source,
      publishedMs: videos.publishedMs,
      stackKey: videos.stackKey,
      stackPosition: videos.stackPosition,
    })
    .from(videos);

  type StackedRow = { videoId: string; stackKey: string | null; stackPosition: number };

  const before = new Map<string, { stackKey: string | null; stackPosition: number }>();
  for (const row of rows as StackedRow[]) {
    before.set(row.videoId, { stackKey: row.stackKey, stackPosition: row.stackPosition });
  }

  assignVideoStacks(rows);

  const updates: VideoStackUpdate[] = [];
  for (const row of rows as StackedRow[]) {
    const prior = before.get(row.videoId);
    if (prior && (prior.stackKey !== row.stackKey || prior.stackPosition !== row.stackPosition)) {
      updates.push({ videoId: row.videoId, stackKey: row.stackKey, stackPosition: row.stackPosition });
    }
  }

  for (const statement of buildVideoStackUpdateStatements(updates)) {
    await db.run(sql.raw(statement));
  }

  return { rows: rows.length, updated: updates.length, durationMs: Date.now() - startedAt };
}
