/**
 * @fileoverview Files every Super Debate video — queued or already published —
 * under the "Open Super Debates" lecture category.
 *
 * New videos land there on their own (`classifyLecture`, `publishRoundVideos`),
 * so this is the catch-up for rows stored before the category existed: the
 * queued lectures in `youtube_round_videos` and the published rows in `videos`.
 * Idempotent — a row already on the shelf produces no write.
 * @module lib/videos/recategorize-super-debates
 */

import { eq, like, or } from "drizzle-orm";
import { normalizeCategoryKey } from "@debate-ai/videos/src/data/video-rows";
import { isSuperDebateVideo, OPEN_SUPER_DEBATES_CATEGORY } from "@debate-ai/videos/src/data/lecture-classifier";
import { chunkStatements } from "@/lib/database/query-budget";
import { videos, youtubeRoundVideos } from "@/lib/database/schema";
import { clearLibraryTotals } from "./admin-library";
import { recomputeVideoStacks } from "./recompute-video-stacks";

export interface RecategorizeSuperDebatesResult {
  /** Queued lectures moved onto the shelf. */
  queued: number;
  /** Published videos moved onto the shelf. */
  published: number;
}

const CATEGORY_KEY = normalizeCategoryKey(OPEN_SUPER_DEBATES_CATEGORY);

/** SQL pre-filter, a superset of `isSuperDebateVideo`; the exact rule re-checks each row. */
const SUPER_DEBATE_LIKE = "%super%debate%";

/**
 * Moves every Super Debate video onto the Open Super Debates shelf.
 *
 * Queued rows are only touched when they are lectures (`style` null): a queued
 * round keeps its format and picks up the shelf when it is published. Published
 * rows of any kind take the category, as rounds already carry collection
 * categories such as ACC.
 *
 * @param db - Drizzle handle bound to D1 (or local SQLite in development).
 */
export async function recategorizeSuperDebates(db: any): Promise<RecategorizeSuperDebatesResult> {
  const queuedRows: { id: string; title: string; channel: string; style: number | null; category: string | null }[] =
    await db
      .select({
        id: youtubeRoundVideos.id,
        title: youtubeRoundVideos.title,
        channel: youtubeRoundVideos.channel,
        style: youtubeRoundVideos.style,
        category: youtubeRoundVideos.category,
      })
      .from(youtubeRoundVideos)
      .where(or(like(youtubeRoundVideos.title, SUPER_DEBATE_LIKE), like(youtubeRoundVideos.channel, SUPER_DEBATE_LIKE)));
  const queuedStale = queuedRows.filter(
    (row) => row.style == null && isSuperDebateVideo(row.title, row.channel) && row.category !== OPEN_SUPER_DEBATES_CATEGORY,
  );

  const publishedRows: { videoId: string; title: string; channel: string; category: string | null }[] = await db
    .select({ videoId: videos.videoId, title: videos.title, channel: videos.channel, category: videos.category })
    .from(videos)
    .where(or(like(videos.title, SUPER_DEBATE_LIKE), like(videos.channel, SUPER_DEBATE_LIKE)));
  const publishedStale = publishedRows.filter(
    (row) => isSuperDebateVideo(row.title, row.channel) && row.category !== OPEN_SUPER_DEBATES_CATEGORY,
  );

  const now = new Date();
  const writes = [
    ...queuedStale.map((row) =>
      db
        .update(youtubeRoundVideos)
        .set({ category: OPEN_SUPER_DEBATES_CATEGORY, updatedAt: now })
        .where(eq(youtubeRoundVideos.id, row.id)),
    ),
    ...publishedStale.map((row) =>
      db
        .update(videos)
        .set({ category: OPEN_SUPER_DEBATES_CATEGORY, categoryKey: CATEGORY_KEY, updatedAt: now })
        .where(eq(videos.videoId, row.videoId)),
    ),
  ];
  for (const batch of chunkStatements(writes)) await db.batch(batch);

  if (publishedStale.length > 0) {
    clearLibraryTotals();
    await recomputeVideoStacks(db);
  }
  return { queued: queuedStale.length, published: publishedStale.length };
}
