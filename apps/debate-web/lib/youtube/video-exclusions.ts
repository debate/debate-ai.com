/**
 * @fileoverview The "never queue this video again" list behind the admin
 * round queue.
 *
 * When staff delete a queued round video, its YouTube id is recorded in
 * `youtube_video_exclusions`; every channel scan (`resyncYouTubeRounds`) reads
 * that table first and skips those ids, so a deleted video never reappears in
 * the queue on the next daily or manual resync.
 *
 * The app ships no migrations folder (see lib/database/ensure-columns.ts), so
 * {@link ensureVideoExclusionsTable} creates the table on first use. The DDL
 * matches `youtubeVideoExclusions` in lib/database/schema.ts and is idempotent.
 * @module lib/youtube/video-exclusions
 */

import { eq, sql } from "drizzle-orm";
import { youtubeRoundVideos, youtubeVideoExclusions } from "@/lib/database/schema";

export const VIDEO_EXCLUSIONS_DDL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "youtube_video_exclusions" (
  "video_id" text PRIMARY KEY NOT NULL,
  "deleted_by" text,
  "deleted_at" integer DEFAULT (unixepoch()) NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS "idx_youtube_video_exclusions_deleted_at" ON "youtube_video_exclusions" ("deleted_at")`,
];

type RawDB = { run(query: ReturnType<typeof sql.raw>): Promise<unknown> };

let ensured: Promise<void> | null = null;

/** Creates `youtube_video_exclusions` once per isolate; a failure is forgotten and retried. */
export function ensureVideoExclusionsTable(db: unknown): Promise<void> {
  ensured ??= (async () => {
    for (const statement of VIDEO_EXCLUSIONS_DDL) await (db as RawDB).run(sql.raw(statement));
  })();
  ensured.catch(() => {
    ensured = null;
  });
  return ensured;
}

/** Test-only: forget that the table was already created. */
export function resetEnsuredVideoExclusionsTable(): void {
  ensured = null;
}

/**
 * Deletes one round video from the queue and remembers the deletion, so later
 * channel scans skip it instead of queueing it again.
 *
 * @param db - Drizzle handle.
 * @param videoId - The video's YouTube id (the queue row's id).
 * @param deletedBy - Staff email, when known, for the audit row.
 */
export async function deleteQueuedRoundVideo(db: any, videoId: string, deletedBy: string | null): Promise<void> {
  await ensureVideoExclusionsTable(db);
  await db.delete(youtubeRoundVideos).where(eq(youtubeRoundVideos.id, videoId));
  const deletedAt = new Date();
  await db
    .insert(youtubeVideoExclusions)
    .values({ videoId, deletedBy, deletedAt })
    .onConflictDoUpdate({
      target: youtubeVideoExclusions.videoId,
      set: { deletedBy, deletedAt },
    });
}
