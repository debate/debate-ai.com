/**
 * @fileoverview The admin "Detect speeches on every round" batch job: runs the
 * watch page's Detect speeches (one model call over the round's captions) on
 * every round in the library, newest upload first, and saves each result to
 * the shared store (`video_ai_results`, kind `segmentation`) so every reader's
 * watch page opens with the speeches already timed.
 *
 * Calls go through write-language on OpenRouter's free router only
 * (`openrouter/free`), the way `/api/reason-ai` sends Detect speeches: an
 * empty reply from a reasoning model is asked again (`chatUntilAnswered`),
 * then the next shared OpenRouter key is tried (`tryKeysInTurn`). The paid
 * Anthropic key is deliberately never used here, since this walks thousands
 * of rounds.
 *
 * A request scans up to {@link DETECT_SCAN_ROWS} rounds after the cursor
 * (rounds that already hold a detection cost nothing — one query covers the
 * whole page) and runs the model on at most `limit` of them. When the
 * provider rate-limits (HTTP 429), the page stops *before* that round and
 * says so, so the panel can wait and retry the same round. Stopping and
 * starting again from the returned cursor resumes; starting over only
 * re-checks finished rounds, it never re-runs them.
 * @module lib/videos/detect-speeches-batch
 */

import { and, asc, count, countDistinct, desc, eq, gt, inArray, isNotNull, lt, or } from "drizzle-orm";
import { detectSpeeches } from "@debate-ai/videos/src/lib/watch-ai-precompute";
import { isSharedVideoId } from "@debate-ai/videos/src/lib/shared-video-ai";
import { videoAiResults, videos } from "@/lib/database/schema";
import { saveSharedVideoAi } from "@/lib/video-ai-results/queries";
import { loadCaptions } from "@/lib/videos/speech-analysis";
import { OPENROUTER_FREE_MODEL, sharedProviderKeys, type ProviderKey } from "@/lib/ai/provider-key";
import { tryKeysInTurn } from "@/lib/ai/key-fallback";
import { chatUntilAnswered } from "@/lib/ai/free-chat";
import { WriteLanguageChatError } from "@/lib/ai/write-language-chat";

/** Rounds looked at per request; one already detected costs no model call. */
export const DETECT_SCAN_ROWS = 50;

/** Newest upload first; the id breaks ties so the cursor is stable. */
export const DETECT_ORDER = [desc(videos.publishedMs), asc(videos.videoId)];

/** The shared OpenRouter keys — the only keys this job may spend. */
export function freeRouterKeys(): ProviderKey[] {
  return sharedProviderKeys().filter((key) => key.provider === "openrouter");
}

/** Whether a failure is the provider's rate limit (try the same round later). */
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof WriteLanguageChatError && error.status === 429) return true;
  const text = error instanceof Error ? error.message : String(error);
  return /\b429\b|rate.?limit/i.test(text);
}

/** Counts for the panel's status line. */
export interface DetectSpeechesStats {
  /** Rounds (not lectures) in the library. */
  rounds: number;
  /** Rounds holding a shared speech detection. */
  detected: number;
}

/** One round's line in a page result. */
export interface DetectSpeechesVideoResult {
  videoId: string;
  title: string;
  publishedAt: string;
  status: "detected" | "skipped" | "failed";
  /** Speech labels found, e.g. `["1AC", "CX", "1NC", …]`. */
  speeches: string[];
  reason?: string;
}

/** Result of one request. */
export interface DetectSpeechesPageResult {
  scanned: number;
  detected: number;
  /** Already detected, no captions, or not a YouTube video. */
  skipped: number;
  failed: number;
  /** Rounds the model ran on (or failed on); skipped ones are only counted. */
  results: DetectSpeechesVideoResult[];
  nextAfterId: string | null;
  done: boolean;
  /** The provider rate-limited; `nextAfterId` still points before that round. */
  rateLimited: boolean;
}

export interface DetectSpeechesPageOptions {
  afterId: string | null;
  /** Most rounds to run the model on in this request. */
  limit: number;
}

const COLUMNS = {
  videoId: videos.videoId,
  title: videos.title,
  publishedAt: videos.publishedAt,
  style: videos.style,
  affTeam: videos.affTeam,
  negTeam: videos.negTeam,
};

/** Keyset condition for "after `cursorId`" in {@link DETECT_ORDER}. */
async function afterDetectCursor(db: any, cursorId: string) {
  const [cursor] = await db
    .select({ publishedMs: videos.publishedMs })
    .from(videos)
    .where(eq(videos.videoId, cursorId))
    .limit(1);
  if (!cursor) return gt(videos.videoId, cursorId);
  return or(
    lt(videos.publishedMs, cursor.publishedMs),
    and(eq(videos.publishedMs, cursor.publishedMs), gt(videos.videoId, cursorId)),
  );
}

/** The panel's counts. */
export async function getDetectSpeechesStats(db: any): Promise<DetectSpeechesStats> {
  const [rounds] = await db.select({ rows: count() }).from(videos).where(isNotNull(videos.style));
  const [detected] = await db
    .select({ rows: countDistinct(videoAiResults.videoId) })
    .from(videoAiResults)
    .innerJoin(videos, eq(videos.videoId, videoAiResults.videoId))
    .where(and(eq(videoAiResults.kind, "segmentation"), isNotNull(videos.style)));
  return { rounds: Number(rounds?.rows ?? 0), detected: Number(detected?.rows ?? 0) };
}

/** The model call, on the free router, with the empty-reply and next-key fallbacks. */
async function askFreeRouter(keys: ProviderKey[], system: string, prompt: string, maxTokens: number): Promise<string> {
  const result = await tryKeysInTurn(keys, (key) =>
    chatUntilAnswered({
      key,
      model: OPENROUTER_FREE_MODEL,
      system,
      messages: [{ role: "user", content: prompt }],
      maxTokens,
    }),
  );
  if (result.kind === "reply") return result.reply.text;
  if (result.kind === "failed") throw result.failure;
  throw new Error("The AI call was stopped.");
}

/**
 * Looks at up to {@link DETECT_SCAN_ROWS} rounds after the cursor and runs
 * Detect speeches on up to `limit` of those with no shared detection yet.
 *
 * @param db - Drizzle handle bound to D1.
 * @param keys - The shared OpenRouter keys ({@link freeRouterKeys}).
 * @param userId - The admin running it, recorded as each result's author.
 */
export async function processDetectSpeechesPage(
  db: any,
  keys: ProviderKey[],
  userId: string,
  options: DetectSpeechesPageOptions,
): Promise<DetectSpeechesPageResult> {
  const conditions = [isNotNull(videos.style)];
  const after = options.afterId ? await afterDetectCursor(db, options.afterId) : undefined;
  if (after) conditions.push(after);
  const rows: Array<{
    videoId: string;
    title: string;
    publishedAt: string;
    style: number | null;
    affTeam: string | null;
    negTeam: string | null;
  }> = await db
    .select(COLUMNS)
    .from(videos)
    .where(and(...conditions))
    .orderBy(...DETECT_ORDER)
    .limit(DETECT_SCAN_ROWS);

  const already = new Set<string>();
  if (rows.length > 0) {
    const found: Array<{ videoId: string }> = await db
      .select({ videoId: videoAiResults.videoId })
      .from(videoAiResults)
      .where(
        and(
          eq(videoAiResults.kind, "segmentation"),
          inArray(
            videoAiResults.videoId,
            rows.map((row) => row.videoId),
          ),
        ),
      );
    for (const row of found) already.add(row.videoId);
  }

  const page: DetectSpeechesPageResult = {
    scanned: 0,
    detected: 0,
    skipped: 0,
    failed: 0,
    results: [],
    nextAfterId: options.afterId,
    done: false,
    rateLimited: false,
  };

  for (const row of rows) {
    if (page.detected + page.failed >= options.limit) break;
    if (already.has(row.videoId) || !isSharedVideoId(row.videoId)) {
      page.scanned += 1;
      page.skipped += 1;
      page.nextAfterId = row.videoId;
      continue;
    }

    const line: DetectSpeechesVideoResult = {
      videoId: row.videoId,
      title: row.title,
      publishedAt: row.publishedAt,
      status: "detected",
      speeches: [],
    };
    try {
      const captions = await loadCaptions(row.videoId).catch(() => []);
      if (captions.length === 0) {
        page.scanned += 1;
        page.skipped += 1;
        page.nextAfterId = row.videoId;
        continue;
      }
      const segmentation = await detectSpeeches(row, captions, {
        ask: (system, prompt, maxTokens) => askFreeRouter(keys, system, prompt, maxTokens),
      });
      // First-come, as a reader's own run: a detection someone saved meanwhile stands.
      const saved = await saveSharedVideoAi(
        db,
        { videoId: row.videoId, replace: false, kind: "segmentation", key: "", data: segmentation },
        { userId, canReplace: false },
      );
      if (!saved) throw new Error("This video already holds as many AI results as it can.");
      line.speeches = segmentation.speeches.map((speech) => speech.name);
      page.detected += 1;
    } catch (error) {
      if (isRateLimitError(error)) {
        // Leave the cursor before this round so the retry runs it.
        page.rateLimited = true;
        break;
      }
      line.status = "failed";
      line.reason = error instanceof Error ? error.message : String(error);
      page.failed += 1;
    }
    page.scanned += 1;
    page.nextAfterId = row.videoId;
    page.results.push(line);
  }

  page.done = !page.rateLimited && page.scanned === rows.length && rows.length < DETECT_SCAN_ROWS;
  return page;
}
