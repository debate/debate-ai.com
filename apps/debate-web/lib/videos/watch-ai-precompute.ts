/**
 * @fileoverview The admin "Watch page AI" batch job: pre-generates each
 * round's watch-page AI so readers find it already done — the speech
 * detection when nothing times the round, and an LLM summary and an
 * Alternatives run (alternative responses with predicted ballots) for the
 * round's last three speeches.
 *
 * The per-video work is `precomputeWatchAi` in `@debate-ai/videos`
 * (`lib/watch-ai-precompute.ts`), which builds the speeches the way the watch
 * page does so the results land under the keys the page looks up. This file
 * does the I/O: it walks the library's rounds in the Speech AI job's order
 * (Greatest of All-Time first, then most viewed — {@link SPEECH_ANALYSIS_ORDER}),
 * calls the model with the site's shared key, and saves through the shared
 * store (`video_ai_results`) first-come, so nothing a video already holds is
 * replaced.
 *
 * A request scans up to {@link SCAN_ROWS} rounds after the cursor, skipping
 * the ones that are already done with two database reads each, and runs the
 * model on at most `limit` of them; the admin panel loops on the returned
 * cursor until `done`. Stopping and starting again from that cursor resumes
 * the run, and starting over only re-checks (never re-runs) finished videos.
 * @module lib/videos/watch-ai-precompute
 */

import { and, count, countDistinct, eq, isNotNull, type SQL } from "drizzle-orm";
import {
  isSharedVideoId,
  type SharedVideoAiItem,
} from "@debate-ai/videos/src/lib/shared-video-ai";
import {
  precomputeWatchAi,
  type PrecomputeVideo,
  type PrecomputeVideoResult,
} from "@debate-ai/videos/src/lib/watch-ai-precompute";
import { videoAiResults, videos } from "@/lib/database/schema";
import { loadSharedVideoAi, saveSharedVideoAi } from "@/lib/video-ai-results/queries";
import { getVideoDocuments } from "@/lib/videos/video-content";
import { callModel } from "@/lib/videos/transcript-scraper";
import {
  SPEECH_ANALYSIS_ORDER,
  afterCursor,
  loadCaptions,
  type SpeechAnalysisScope,
} from "@/lib/videos/speech-analysis";
import type { ProviderKey } from "@/lib/ai/provider-key";

/** Rounds looked at per request; a finished one costs two reads, no model call. */
export const SCAN_ROWS = 25;

/** Counts for the panel's status line. */
export interface WatchAiStats {
  scope: SpeechAnalysisScope;
  /** Rounds (not lectures) in scope. */
  rounds: number;
  /** Rounds holding at least one shared Alternatives run. */
  withAlternatives: number;
  /** Rounds holding at least one shared LLM summary. */
  withSummaries: number;
}

/** One video's line in a page result. */
export interface WatchAiVideoResult extends PrecomputeVideoResult {
  videoId: string;
  title: string;
}

/** Result of one request. */
export interface WatchAiPageResult {
  /** Rounds looked at, finished ones included. */
  scanned: number;
  /** Rounds the model ran on. */
  processed: number;
  /** Rounds that were already done (or have nothing to run on). */
  skipped: number;
  failed: number;
  /** The rounds the model ran on (or failed on); skipped ones are only counted. */
  results: WatchAiVideoResult[];
  nextAfterId: string | null;
  done: boolean;
}

export interface WatchAiPageOptions {
  scope: SpeechAnalysisScope;
  afterId: string | null;
  /** Most rounds to run the model on in this request. */
  limit: number;
  /** Run just this video, whatever the scope or cursor. */
  videoId?: string | null;
}

const COLUMNS = {
  videoId: videos.videoId,
  title: videos.title,
  style: videos.style,
  tournament: videos.tournament,
  roundLevel: videos.roundLevel,
  affTeam: videos.affTeam,
  negTeam: videos.negTeam,
  judgeDecision: videos.judgeDecision,
};

function scopeConditions(scope: SpeechAnalysisScope): SQL[] {
  const conditions: SQL[] = [isNotNull(videos.style)];
  if (scope === "goat") conditions.push(eq(videos.isTopPick, true));
  return conditions;
}

/** The panel's counts for a scope. */
export async function getWatchAiStats(db: any, scope: SpeechAnalysisScope): Promise<WatchAiStats> {
  const inScope = and(...scopeConditions(scope));
  const [rounds] = await db.select({ rows: count() }).from(videos).where(inScope);
  const withKind = async (kind: string) => {
    const [row] = await db
      .select({ rows: countDistinct(videoAiResults.videoId) })
      .from(videoAiResults)
      .innerJoin(videos, eq(videos.videoId, videoAiResults.videoId))
      .where(and(eq(videoAiResults.kind, kind), inScope));
    return Number(row?.rows ?? 0);
  };
  return {
    scope,
    rounds: Number(rounds?.rows ?? 0),
    withAlternatives: await withKind("outcome"),
    withSummaries: await withKind("summary"),
  };
}

/** Runs one round, saving each result as it lands. */
async function runVideo(db: any, video: PrecomputeVideo, providerKey: ProviderKey, userId: string) {
  const [documents, shared] = await Promise.all([
    getVideoDocuments(video.videoId),
    loadSharedVideoAi(db, video.videoId),
  ]);
  return precomputeWatchAi(video, documents, shared, {
    ask: (system, prompt, maxTokens) => callModel(providerKey, system, prompt, maxTokens),
    share: async (item: SharedVideoAiItem) => {
      // First-come, as a reader's own run: a result someone saved meanwhile stands.
      const saved = await saveSharedVideoAi(
        db,
        { videoId: video.videoId, replace: false, ...item },
        { userId, canReplace: false },
      );
      if (!saved) throw new Error("This video already holds as many AI results as it can.");
    },
    loadCaptions: () => loadCaptions(video.videoId),
  });
}

/**
 * Looks at up to {@link SCAN_ROWS} rounds after the cursor and runs the model
 * on up to `limit` of those still missing something.
 *
 * @param db - Drizzle handle bound to D1.
 * @param providerKey - The site's shared AI key.
 * @param userId - The admin running it, recorded as each result's author.
 */
export async function processWatchAiPage(
  db: any,
  providerKey: ProviderKey,
  userId: string,
  options: WatchAiPageOptions,
): Promise<WatchAiPageResult> {
  let rows: PrecomputeVideo[];
  if (options.videoId) {
    rows = await db.select(COLUMNS).from(videos).where(eq(videos.videoId, options.videoId)).limit(1);
    if (rows.length === 0) throw new Error(`No video ${options.videoId} in the library.`);
  } else {
    const conditions = scopeConditions(options.scope);
    const after = options.afterId ? await afterCursor(db, options.afterId) : undefined;
    if (after) conditions.push(after);
    rows = await db
      .select(COLUMNS)
      .from(videos)
      .where(and(...conditions))
      .orderBy(...SPEECH_ANALYSIS_ORDER)
      .limit(SCAN_ROWS);
  }

  const page: WatchAiPageResult = {
    scanned: 0,
    processed: 0,
    skipped: 0,
    failed: 0,
    results: [],
    nextAfterId: options.afterId,
    done: false,
  };
  for (const row of rows) {
    if (page.processed + page.failed >= options.limit) break;
    page.scanned += 1;
    page.nextAfterId = row.videoId;
    if (!isSharedVideoId(row.videoId)) {
      page.skipped += 1;
      continue;
    }
    let result: PrecomputeVideoResult;
    try {
      result = await runVideo(db, row, providerKey, userId);
    } catch (error) {
      result = {
        status: "failed",
        reason: error instanceof Error ? error.message : String(error),
        speeches: [],
        detected: false,
        summaries: [],
        outcomes: [],
        errors: [],
      };
    }
    if (result.status === "skipped") {
      page.skipped += 1;
      continue;
    }
    if (result.status === "failed") page.failed += 1;
    else page.processed += 1;
    page.results.push({ videoId: row.videoId, title: row.title, ...result });
  }
  page.done = Boolean(options.videoId) || (page.scanned === rows.length && rows.length < SCAN_ROWS);
  return page;
}
