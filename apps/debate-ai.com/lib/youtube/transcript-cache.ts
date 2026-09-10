/**
 * @fileoverview Database-backed transcript cache.
 *
 * YouTube bot-checks and rate-limits server IPs, so every transcript this app
 * manages to fetch is worth keeping. Transcripts are also immutable in
 * practice — a video's captions don't change — which makes them about the
 * safest thing there is to cache indefinitely.
 *
 * The lookup is deliberately best-effort in both directions: a database that
 * is unavailable, or a row that fails to write, must never turn a working
 * transcript request into an error. Callers get `null` on a miss and fall
 * through to YouTube.
 */

import { and, eq } from "drizzle-orm";
import { getDBFromContext } from "@/lib/database/context";
import { videoTranscripts } from "@/lib/database/schema";
import type { TranscriptSnippet } from "@/lib/youtube/transcript";

/** Reads `videoId`'s cached transcript, or null when it isn't cached. */
export async function readCachedTranscript(
  videoId: string,
  lang: string,
): Promise<TranscriptSnippet[] | null> {
  try {
    const db = await getDBFromContext();
    const [row] = await db
      .select({ snippets: videoTranscripts.snippets })
      .from(videoTranscripts)
      .where(and(eq(videoTranscripts.videoId, videoId), eq(videoTranscripts.lang, lang)))
      .limit(1);

    if (!row?.snippets) return null;

    const snippets = JSON.parse(row.snippets) as TranscriptSnippet[];
    // A row that somehow holds an empty or malformed payload is treated as a
    // miss, so the next request refetches it rather than serving nothing.
    return Array.isArray(snippets) && snippets.length > 0 ? snippets : null;
  } catch (error) {
    console.error(`Transcript cache read failed for ${videoId}:`, error);
    return null;
  }
}

/**
 * Stores `snippets` as `videoId`'s transcript, replacing any existing row.
 *
 * Only successful fetches should be written: a video with no captions is left
 * uncached so it picks them up if they ever appear.
 */
export async function writeCachedTranscript(
  videoId: string,
  lang: string,
  snippets: TranscriptSnippet[],
): Promise<void> {
  if (snippets.length === 0) return;

  try {
    const db = await getDBFromContext();
    await db
      .insert(videoTranscripts)
      .values({ videoId, lang, snippets: JSON.stringify(snippets), fetchedAt: new Date() })
      .onConflictDoUpdate({
        target: [videoTranscripts.videoId, videoTranscripts.lang],
        set: { snippets: JSON.stringify(snippets), fetchedAt: new Date() },
      });
  } catch (error) {
    console.error(`Transcript cache write failed for ${videoId}:`, error);
  }
}
