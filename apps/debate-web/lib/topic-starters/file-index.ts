/**
 * @fileoverview Builds, stores and serves the Topic Starters file index — the
 * name and tree position of every published row, without content.
 *
 * The index is rebuilt once a day by the daily cron (`worker/index.ts`) and
 * after every applied catalogue edit (`applyTopicStarterChange`), and kept
 * as one JSON object in the `CARD_TEXT` R2 bucket (which already holds other
 * site text besides cards). `GET /api/topic-starters/file-index` serves that
 * snapshot, building it from D1 when there is none yet, or when the
 * deployment has no bucket (local dev).
 *
 * The client side — the `localStorage` copy the sidebar paints from — is in
 * `@debate-ai/reason-docs/lib/topic-starters/file-index`, which also owns
 * the shape.
 *
 * @module lib/topic-starters/file-index
 */

import { eq } from "drizzle-orm";
import {
  buildTopicStarterFileIndex,
  parseTopicStarterFileIndex,
  type TopicStarterFileIndex,
} from "@debate-ai/reason-docs/lib/topic-starters/file-index";
import type { getDBFromContext } from "@/lib/database/context";
import { topicStarterItems } from "@/lib/database/schema";
import { getCardTextBucket, type CardTextBucket } from "@/lib/search/card-text-store";

type Database = Awaited<ReturnType<typeof getDBFromContext>>;

/** R2 key of the stored snapshot. */
export const TOPIC_STARTER_INDEX_KEY = "topic-starters/file-index.json";

/** Upper bound on rows read, so a runaway table can't make an unbounded read. */
const MAX_ROWS = 50_000;

/** Builds the index from D1's published rows. Content is never selected. */
export async function buildTopicStarterFileIndexFromDb(db: Database, now: Date = new Date()): Promise<TopicStarterFileIndex> {
  const rows = await db
    .select({
      id: topicStarterItems.id,
      title: topicStarterItems.title,
      parentId: topicStarterItems.parentId,
      isFolder: topicStarterItems.isFolder,
      tags: topicStarterItems.tags,
      year: topicStarterItems.year,
      topicCode: topicStarterItems.topicCode,
      format: topicStarterItems.format,
    })
    .from(topicStarterItems)
    .where(eq(topicStarterItems.published, true))
    .limit(MAX_ROWS);
  return buildTopicStarterFileIndex(rows, now);
}

/** The stored snapshot, or `null` when there is none or it can't be read. */
export async function readStoredTopicStarterFileIndex(
  bucket: CardTextBucket | null = getCardTextBucket(),
): Promise<TopicStarterFileIndex | null> {
  if (!bucket) return null;
  try {
    const object = await bucket.get(TOPIC_STARTER_INDEX_KEY);
    return object ? parseTopicStarterFileIndex(JSON.parse(await object.text())) : null;
  } catch (error) {
    console.error("[topic-starters] could not read the stored file index", error);
    return null;
  }
}

/** Rebuilds the index from D1 and stores it (when a bucket is bound). */
export async function regenerateTopicStarterFileIndex(
  db: Database,
  bucket: CardTextBucket | null = getCardTextBucket(),
): Promise<TopicStarterFileIndex> {
  const index = await buildTopicStarterFileIndexFromDb(db);
  if (bucket) {
    await bucket.put(TOPIC_STARTER_INDEX_KEY, JSON.stringify(index), {
      httpMetadata: { contentType: "application/json" },
    });
  }
  return index;
}

/**
 * Rebuilds the stored snapshot after a catalogue edit, so the next visitor's
 * tree shows it. Never throws — a failed rebuild only leaves the snapshot as
 * stale as the next daily run — and does nothing without a bucket.
 */
export async function refreshTopicStarterFileIndexQuietly(db: Database): Promise<void> {
  const bucket = getCardTextBucket();
  if (!bucket) return;
  try {
    await regenerateTopicStarterFileIndex(db, bucket);
  } catch (error) {
    console.error("[topic-starters] could not rebuild the file index", error);
  }
}

/** What the route serves: the stored snapshot, or a fresh build (stored for
 *  next time) when there is none. */
export async function getTopicStarterFileIndex(db: Database): Promise<TopicStarterFileIndex> {
  const bucket = getCardTextBucket();
  const stored = await readStoredTopicStarterFileIndex(bucket);
  if (stored) return stored;
  try {
    return await regenerateTopicStarterFileIndex(db, bucket);
  } catch (error) {
    // Storing failed (R2 hiccup): still answer from D1.
    console.error("[topic-starters] could not store the file index", error);
    return buildTopicStarterFileIndexFromDb(db);
  }
}

/** The daily cron's job. */
export async function runDailyTopicStarterIndex(db: Database): Promise<void> {
  const index = await regenerateTopicStarterFileIndex(db);
  console.log(`[topic-starters] file index rebuilt: ${index.count} rows`);
}
