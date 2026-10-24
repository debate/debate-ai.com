/**
 * @fileoverview The admin "Speech AI" batch job: splits each round's
 * transcript into its speeches and writes a summary of every speech and what
 * the speaker could have done instead.
 *
 * For each video in scope — the Greatest of All-Time collection
 * (`videos.is_top_pick`) or the whole library — this:
 *
 * 1. reads the cached captions from `video_transcripts`, fetching and caching
 *    them from YouTube when there are none yet;
 * 2. asks the model where each speech starts and ends, with the same prompt
 *    as the watch page's "Detect speeches" button;
 * 3. sends the round, cut into those speeches, to the model again with the
 *    admin's instructions (the default asks for a summary and an alternative
 *    per speech);
 * 4. saves the reply as the video's `summary` and `analysis` documents, whose
 *    `## 1AC (0:42–8:51)` headings become the speech buttons under the player
 *    and the per-speech tabs beside it.
 *
 * Videos run in priority order: the Greatest of All-Time collection first,
 * then by YouTube view count, most viewed first (ties by id), so the rounds
 * people watch most get their speeches detected first. See
 * {@link SPEECH_ANALYSIS_ORDER}.
 *
 * Two model calls on a two-hour round take a while, so one request handles
 * one page (one video by default) and hands back the cursor; the admin panel
 * loops until `done`, as the transcript scraper does. A document an editor
 * wrote is never replaced — only a missing one, or one the AI wrote earlier.
 * A dry run returns the documents without saving, for trying out a prompt.
 *
 * Pure prompt building and parsing live in `@debate-ai/videos`
 * (`lib/speech-analysis.ts`); this file does the I/O.
 * @module lib/videos/speech-analysis
 */

import { and, asc, count, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import {
  SPEECH_SEGMENTATION_SYSTEM_PROMPT,
  buildSpeechAnalysisPrompt,
  buildSpeechSegmentationPrompt,
  captionPauseSegmentation,
  groupIntoSentences,
  parseSpeechAnalysisResponse,
  parseSpeechSegmentationResponse,
  speechAnalysisDocuments,
  speechAnalysisSystemPrompt,
  speechTranscripts,
} from "@debate-ai/videos";
import { fetchYouTubeTranscript, type TranscriptSnippet } from "@/lib/youtube/transcript";
import { readCachedTranscript, writeCachedTranscript } from "@/lib/youtube/transcript-cache";
import { saveVideoDocument } from "@/lib/videos/video-content";
import { callModel, SUMMARY_MODEL } from "@/lib/videos/transcript-scraper";
import { videoDocuments, videoTranscripts, videos } from "@/lib/database/schema";
import type { ProviderKey } from "@/lib/ai/provider-key";

/** Which videos a run covers. */
export type SpeechAnalysisScope = "goat" | "all";

export function isSpeechAnalysisScope(value: unknown): value is SpeechAnalysisScope {
  return value === "goat" || value === "all";
}

/** Counts for the panel's status line, within one scope. */
export interface SpeechAnalysisStats {
  scope: SpeechAnalysisScope;
  totalVideos: number;
  withTranscript: number;
  /** Videos with an AI-written speech analysis document. */
  analyzed: number;
}

/** What happened to one video. */
export interface SpeechAnalysisVideoResult {
  videoId: string;
  title: string;
  /** YouTube views, which set the run order after the GOAT videos. */
  viewCount?: number;
  status: "saved" | "preview" | "failed";
  format?: string;
  speeches?: number;
  /** Which documents were written; an editor's document is left alone. */
  wrote?: Array<"summary" | "analysis">;
  error?: string;
  /** The documents, returned on a dry run so the admin can read them. */
  summary?: string;
  analysis?: string;
}

/** Result of one page. */
export interface SpeechAnalysisPageResult {
  processed: number;
  saved: number;
  results: SpeechAnalysisVideoResult[];
  nextAfterId: string | null;
  done: boolean;
}

export interface SpeechAnalysisPageOptions {
  scope: SpeechAnalysisScope;
  afterId: string | null;
  limit: number;
  /** The admin's prompt; empty uses the default. */
  instructions: string | null;
  /** Redo videos whose analysis the AI already wrote. */
  overwrite: boolean;
  /** Process just this video, whatever the scope or cursor. */
  videoId?: string | null;
  /** Return the documents without saving them. */
  dryRun?: boolean;
}

/** Shown on the watch page's document tabs. */
const SUMMARY_TITLE = "Speech-by-speech summary";
const ANALYSIS_TITLE = "What each speech could have done instead";

/** Room for a 12-speech round's outlines and alternatives. */
const ANALYSIS_MAX_TOKENS = 8000;
const SEGMENTATION_MAX_TOKENS = 2000;

const STYLE_NAMES: Record<number, string> = { 1: "Policy", 2: "PF", 3: "LD", 4: "College", 5: "WSD", 6: "ACC", 7: "Misc" };

/**
 * The order a run walks videos in, shown in the admin panel: GOAT videos
 * first, then most viewed first, then by id so the cursor is stable.
 */
export const SPEECH_ANALYSIS_ORDER = [
  desc(videos.isTopPick),
  desc(videos.viewCount),
  asc(videos.videoId),
];

/**
 * Keyset condition for "after `cursor`" in {@link SPEECH_ANALYSIS_ORDER}. A
 * cursor video that has since left the library falls back to id order.
 */
async function afterCursor(db: any, cursorId: string) {
  const [cursor] = await db
    .select({ isTopPick: videos.isTopPick, viewCount: videos.viewCount })
    .from(videos)
    .where(eq(videos.videoId, cursorId))
    .limit(1);
  if (!cursor) return gt(videos.videoId, cursorId);
  return or(
    lt(videos.isTopPick, cursor.isTopPick),
    and(eq(videos.isTopPick, cursor.isTopPick), lt(videos.viewCount, cursor.viewCount)),
    and(
      eq(videos.isTopPick, cursor.isTopPick),
      eq(videos.viewCount, cursor.viewCount),
      gt(videos.videoId, cursorId),
    ),
  );
}

function scopeCondition(scope: SpeechAnalysisScope) {
  return scope === "goat" ? eq(videos.isTopPick, true) : undefined;
}

/** Gets the panel's counts for a scope. */
export async function getSpeechAnalysisStats(
  db: any,
  scope: SpeechAnalysisScope,
): Promise<SpeechAnalysisStats> {
  const inScope = scopeCondition(scope);
  const [totals] = await db.select({ rows: count() }).from(videos).where(inScope);
  const [captioned] = await db
    .select({ rows: sql<number>`COUNT(DISTINCT ${videoTranscripts.videoId})` })
    .from(videoTranscripts)
    .innerJoin(videos, eq(videos.videoId, videoTranscripts.videoId))
    .where(inScope);
  const [analyzed] = await db
    .select({ rows: count() })
    .from(videoDocuments)
    .innerJoin(videos, eq(videos.videoId, videoDocuments.videoId))
    .where(and(eq(videoDocuments.kind, "analysis"), eq(videoDocuments.author, "ai"), inScope));
  return {
    scope,
    totalVideos: totals?.rows ?? 0,
    withTranscript: captioned?.rows ?? 0,
    analyzed: analyzed?.rows ?? 0,
  };
}

/** The video's captions, from the cache or else from YouTube (then cached). */
async function loadCaptions(videoId: string): Promise<TranscriptSnippet[]> {
  const cached = await readCachedTranscript(videoId, "en");
  if (cached) return cached;
  const fetched = await fetchYouTubeTranscript(videoId, "en");
  await writeCachedTranscript(videoId, "en", fetched);
  return fetched;
}

interface VideoRow {
  videoId: string;
  title: string;
  style: number | null;
  affTeam: string | null;
  negTeam: string | null;
  judgeDecision: string | null;
  viewCount?: number;
}

/**
 * Runs the pipeline on one video.
 *
 * @throws When the video has no captions, the model finds no speeches, or
 *   its write-up cannot be read — the page records it and moves on.
 */
async function analyzeVideo(
  db: any,
  row: VideoRow,
  providerKey: ProviderKey,
  instructions: string | null,
  dryRun: boolean,
): Promise<SpeechAnalysisVideoResult> {
  const snippets = await loadCaptions(row.videoId);
  const captions = groupIntoSentences(snippets);
  if (captions.length === 0) throw new Error("No captions.");

  const segmentationReply = await callModel(
    providerKey,
    SPEECH_SEGMENTATION_SYSTEM_PROMPT,
    // The raw cues keep the pauses a sentence of auto-captions can run across.
    buildSpeechSegmentationPrompt({
      captions: snippets,
      videoTitle: row.title,
      formatHint: row.style !== null ? STYLE_NAMES[row.style] : undefined,
      aff: row.affTeam ?? undefined,
      neg: row.negTeam ?? undefined,
      pauseGuess: captionPauseSegmentation(snippets, row.style)?.speeches,
    }),
    SEGMENTATION_MAX_TOKENS,
  );
  const lastCaption = snippets.reduce((latest, s) => Math.max(latest, s.start + s.duration), 0);
  const segmentation = parseSpeechSegmentationResponse(segmentationReply, { durationSeconds: lastCaption + 30 });
  if (!segmentation) throw new Error("The AI found no speeches in the captions.");

  const analysisReply = await callModel(
    providerKey,
    speechAnalysisSystemPrompt(instructions),
    buildSpeechAnalysisPrompt({
      speeches: speechTranscripts(segmentation, captions),
      videoTitle: row.title,
      format: segmentation.format,
      aff: row.affTeam,
      neg: row.negTeam,
      decision: row.judgeDecision,
    }),
    ANALYSIS_MAX_TOKENS,
  );
  const analysis = parseSpeechAnalysisResponse(analysisReply);
  if (!analysis) throw new Error("The AI's write-up couldn't be read.");

  const documents = speechAnalysisDocuments(segmentation, analysis);
  const base = {
    videoId: row.videoId,
    title: row.title,
    viewCount: row.viewCount,
    format: segmentation.format,
    speeches: documents.speechCount,
  };
  if (dryRun) {
    return { ...base, status: "preview", summary: documents.summary, analysis: documents.analysis };
  }

  // Only a missing document or one the AI wrote is replaced.
  const existing: Array<{ kind: string; author: string }> = await db
    .select({ kind: videoDocuments.kind, author: videoDocuments.author })
    .from(videoDocuments)
    .where(eq(videoDocuments.videoId, row.videoId));
  const writable = (kind: string) =>
    !existing.some((document) => document.kind === kind && document.author !== "ai");

  const wrote: Array<"summary" | "analysis"> = [];
  if (writable("summary")) {
    await saveVideoDocument(
      db,
      row.videoId,
      "summary",
      { title: SUMMARY_TITLE, body: documents.summary, author: "ai", model: SUMMARY_MODEL },
      null,
    );
    wrote.push("summary");
  }
  if (writable("analysis")) {
    await saveVideoDocument(
      db,
      row.videoId,
      "analysis",
      { title: ANALYSIS_TITLE, body: documents.analysis, author: "ai", model: SUMMARY_MODEL },
      null,
    );
    wrote.push("analysis");
  }
  return { ...base, status: "saved", wrote };
}

/**
 * Processes one page of videos in scope that have no speech analysis yet
 * (or, with `overwrite`, whose analysis the AI wrote), GOAT videos first and
 * then most viewed first ({@link SPEECH_ANALYSIS_ORDER}).
 *
 * @param db - Drizzle handle bound to D1.
 * @param providerKey - The site's shared AI key.
 * @param options - See {@link SpeechAnalysisPageOptions}.
 * @returns The page result, with the cursor for the next page.
 */
export async function processSpeechAnalysisPage(
  db: any,
  providerKey: ProviderKey,
  options: SpeechAnalysisPageOptions,
): Promise<SpeechAnalysisPageResult> {
  const columns = {
    videoId: videos.videoId,
    title: videos.title,
    style: videos.style,
    affTeam: videos.affTeam,
    negTeam: videos.negTeam,
    judgeDecision: videos.judgeDecision,
    viewCount: videos.viewCount,
  };

  let rows: VideoRow[];
  if (options.videoId) {
    rows = await db.select(columns).from(videos).where(eq(videos.videoId, options.videoId)).limit(1);
    if (rows.length === 0) throw new Error(`No video ${options.videoId} in the library.`);
  } else {
    const conditions = [
      options.overwrite
        ? or(isNull(videoDocuments.videoId), eq(videoDocuments.author, "ai"))
        : isNull(videoDocuments.videoId),
    ];
    const inScope = scopeCondition(options.scope);
    if (inScope) conditions.push(inScope);
    if (options.afterId) conditions.push(await afterCursor(db, options.afterId));
    rows = await db
      .select(columns)
      .from(videos)
      .leftJoin(
        videoDocuments,
        and(eq(videoDocuments.videoId, videos.videoId), eq(videoDocuments.kind, "analysis")),
      )
      .where(and(...conditions))
      .orderBy(...SPEECH_ANALYSIS_ORDER)
      .limit(options.limit);
  }

  const results: SpeechAnalysisVideoResult[] = [];
  for (const row of rows) {
    try {
      results.push(
        await analyzeVideo(db, row, providerKey, options.instructions, options.dryRun === true),
      );
    } catch (error) {
      // No captions, a bot check, an unreadable reply — record it and go on.
      results.push({
        videoId: row.videoId,
        title: row.title,
        viewCount: row.viewCount,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const last = rows[rows.length - 1];
  return {
    processed: rows.length,
    saved: results.filter((result) => result.status === "saved").length,
    results,
    nextAfterId: last ? last.videoId : options.afterId,
    done: Boolean(options.videoId) || rows.length < options.limit,
  };
}
