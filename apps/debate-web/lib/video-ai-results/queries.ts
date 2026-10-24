/**
 * @fileoverview Reads and writes `video_ai_results`, the watch page's AI
 * results shared by every viewer of a video (see
 * `@debate-ai/videos/src/lib/shared-video-ai` for the rules and shapes).
 *
 * A write is first-come: the first good result for a video, kind and key is
 * kept, and a later one is answered with the stored copy instead. Only staff
 * may replace or delete one — their "Run again" is how a bad shared answer is
 * regenerated.
 *
 * @module lib/video-ai-results/queries
 */

import { and, eq, sql } from "drizzle-orm";
import {
  collectSharedVideoAi,
  sharedVideoAiId,
  type SharedVideoAi,
  type SharedVideoAiItem,
  type SharedVideoAiKind,
  type SharedVideoAiWrite,
} from "@debate-ai/videos/src/lib/shared-video-ai";

import type { getDBFromContext } from "@/lib/database/context";
import { videoAiResults } from "@/lib/database/schema";

type Db = Awaited<ReturnType<typeof getDBFromContext>>;

/** Most results one video may hold — a few dozen speeches times a handful of panels. */
export const MAX_RESULTS_PER_VIDEO = 300;

/** Everything shared for one video. */
export async function loadSharedVideoAi(db: Db, videoId: string): Promise<SharedVideoAi> {
  const rows = await db
    .select({ kind: videoAiResults.kind, key: videoAiResults.itemKey, data: videoAiResults.data })
    .from(videoAiResults)
    .where(eq(videoAiResults.videoId, videoId));
  return collectSharedVideoAi(rows);
}

function toItem(kind: string, key: string, data: string): SharedVideoAiItem | null {
  try {
    return { kind, key, data: JSON.parse(data) } as SharedVideoAiItem;
  } catch {
    return null;
  }
}

export interface SaveResult {
  /** Whether this write is what is now stored. */
  stored: boolean;
  /** What every viewer now sees for this key. */
  item: SharedVideoAiItem;
}

/**
 * Saves a result unless one is already stored for its key, or — with
 * `canReplace` and `write.replace` — overwrites it.
 *
 * @returns `null` when the video already holds {@link MAX_RESULTS_PER_VIDEO}.
 */
export async function saveSharedVideoAi(
  db: Db,
  write: SharedVideoAiWrite,
  { userId, canReplace }: { userId: string; canReplace: boolean },
): Promise<SaveResult | null> {
  const id = sharedVideoAiId(write.videoId, write.kind, write.key);
  const item = { kind: write.kind, key: write.key, data: write.data } as SharedVideoAiItem;
  const data = JSON.stringify(write.data);

  const [existing] = await db
    .select({ data: videoAiResults.data })
    .from(videoAiResults)
    .where(eq(videoAiResults.id, id))
    .limit(1);
  if (existing) {
    if (!(canReplace && write.replace)) {
      return { stored: false, item: toItem(write.kind, write.key, existing.data) ?? item };
    }
    await db
      .update(videoAiResults)
      .set({ data, createdBy: userId, updatedAt: new Date() })
      .where(eq(videoAiResults.id, id));
    return { stored: true, item };
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(videoAiResults)
    .where(eq(videoAiResults.videoId, write.videoId));
  if (Number(count) >= MAX_RESULTS_PER_VIDEO) return null;

  // Two viewers finishing together: the insert that lands second is ignored,
  // and its caller is answered with whatever won.
  await db
    .insert(videoAiResults)
    .values({ id, videoId: write.videoId, kind: write.kind, itemKey: write.key, data, createdBy: userId })
    .onConflictDoNothing();
  const [winner] = await db
    .select({ data: videoAiResults.data, createdBy: videoAiResults.createdBy })
    .from(videoAiResults)
    .where(eq(videoAiResults.id, id))
    .limit(1);
  const stored = winner?.data === data;
  return { stored, item: (winner && toItem(write.kind, write.key, winner.data)) || item };
}

/** Deletes one shared result, or every result of a video when `kind` is omitted. */
export async function deleteSharedVideoAi(
  db: Db,
  videoId: string,
  target?: { kind: SharedVideoAiKind; key: string },
): Promise<void> {
  await db
    .delete(videoAiResults)
    .where(
      target
        ? and(eq(videoAiResults.videoId, videoId), eq(videoAiResults.id, sharedVideoAiId(videoId, target.kind, target.key)))
        : eq(videoAiResults.videoId, videoId),
    );
}
