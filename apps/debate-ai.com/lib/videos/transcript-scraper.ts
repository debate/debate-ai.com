/**
 * @fileoverview Backfills YouTube transcripts for every video in the
 * library, and optionally writes an AI summary of each one.
 *
 * YouTube bot-checks and rate-limits server IPs in bursts, so a
 * transcript that was fetched once is worth keeping forever — a
 * video's captions don't change. This walks the `videos` table in id
 * order, fetches the captions of every video that has none cached
 * yet, and stores them in `video_transcripts`. With
 * `generateSummaries` on, each fetched transcript also goes to the
 * model, whose answer is stored as the video's `summary` document in
 * `video_documents`.
 *
 * A corpus of thousands of videos cannot be walked inside one Worker
 * request, so each call handles one page and hands back the cursor
 * for the next — the caller loops until `done`.
 *
 * @module lib/videos/transcript-scraper
 */

import { and, asc, count, eq, gt, isNull, sql } from "drizzle-orm";
import { fetchYouTubeTranscript, type TranscriptSnippet } from "@/lib/youtube/transcript";
import { writeCachedTranscript } from "@/lib/youtube/transcript-cache";
import { saveVideoDocument } from "@/lib/videos/video-content";
import { videoDocuments, videoTranscripts, videos } from "@/lib/database/schema";
import { getEnv } from "@/lib/env";
import type { ProviderKey } from "@/lib/ai/provider-key";

/** Stats for the scraper panel. */
export interface TranscriptScraperStats {
  totalVideos: number;
  withTranscript: number;
  withoutTranscript: number;
  withSummary: number;
}

/** Result of one page of scraping. */
export interface ScrapePageResult {
  processed: number;
  scraped: number;
  summarized: number;
  errors: Array<{ videoId: string; error: string }>;
  nextAfterId: string | null;
  done: boolean;
}

/** System prompt for the transcript summary. */
const SUMMARY_SYSTEM_PROMPT = `You are a debate analyst. Summarize the transcript of a competitive debate round or lecture. Cover: the resolution or topic if stated, the arguments each side made (affirmative and negative), the key evidence and warrants, and how the round was decided if that is clear. Be concise and factual — a few paragraphs, no preamble.`;

/** The model summaries are generated with, for the attribution line. */
const SUMMARY_MODEL = "claude-sonnet-4-6";

/** Longest transcript sent to the model, in characters. */
const MAX_SUMMARY_INPUT_CHARS = 300_000;

/**
 * The site's shared AI key, for a server-side batch job that has no
 * signed-in user to meter. `null` when neither key is configured.
 */
export function sharedProviderKey(): ProviderKey | null {
  const openrouter = getEnv("OPENROUTER_API_KEY");
  if (openrouter) return { provider: "openrouter", key: openrouter, own: false };
  const anthropic = getEnv("ANTHROPIC_API_KEY");
  if (anthropic) return { provider: "anthropic", key: anthropic, own: false };
  return null;
}

/** Gets the scraper stats. */
export async function getTranscriptScraperStats(db: any): Promise<TranscriptScraperStats> {
  const [totals] = await db.select({ rows: count() }).from(videos);
  // One row per video+language; count distinct videos instead.
  const [withCaptions] = await db
    .select({ rows: sql<number>`COUNT(DISTINCT ${videoTranscripts.videoId})` })
    .from(videoTranscripts);
  const [withSummaries] = await db
    .select({ rows: count() })
    .from(videoDocuments)
    .where(eq(videoDocuments.kind, "summary"));
  const total = totals?.rows ?? 0;
  const captions = withCaptions?.rows ?? 0;
  return {
    totalVideos: total,
    withTranscript: captions,
    withoutTranscript: Math.max(total - captions, 0),
    withSummary: withSummaries?.rows ?? 0,
  };
}

/** Turns caption cues into the plain text the model summarizes. */
function transcriptToText(snippets: TranscriptSnippet[]): string {
  return snippets
    .map((snippet) => snippet.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Calls the model directly with the shared key. */
async function callModel(
  providerKey: ProviderKey,
  system: string,
  prompt: string,
  maxTokens: number,
): Promise<string> {
  const useOpenRouter = providerKey.provider === "openrouter";
  const endpoint = useOpenRouter
    ? "https://openrouter.ai/api/v1/chat/completions"
    : "https://api.anthropic.com/v1/messages";
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (useOpenRouter) {
    headers.authorization = `Bearer ${providerKey.key}`;
    headers["HTTP-Referer"] = "https://debate-ai.com";
    headers["X-Title"] = "Debate AI";
  } else {
    headers["x-api-key"] = providerKey.key;
    headers["anthropic-version"] = "2023-06-01";
  }
  const bodyJson: Record<string, unknown> = { max_tokens: maxTokens };
  if (useOpenRouter) {
    bodyJson.model = "anthropic/claude-sonnet-4.6";
    bodyJson.messages = [
      ...(system ? [{ role: "system", content: system }] : []),
      { role: "user", content: prompt },
    ];
  } else {
    bodyJson.model = SUMMARY_MODEL;
    bodyJson.system = system;
    bodyJson.messages = [{ role: "user", content: prompt }];
  }
  const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(bodyJson) });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`AI API returned ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  const json = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text =
    json.choices?.[0]?.message?.content ??
    (json.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  if (!text) throw new Error("AI API returned an empty response.");
  return text;
}

/** Generates an AI summary of a transcript. */
async function summarizeTranscript(
  providerKey: ProviderKey,
  transcriptText: string,
  videoTitle: string,
): Promise<string> {
  const capped = transcriptText.slice(0, MAX_SUMMARY_INPUT_CHARS);
  return callModel(
    providerKey,
    SUMMARY_SYSTEM_PROMPT,
    `Video title: ${videoTitle}\n\nTranscript:\n${capped}`,
    2000,
  );
}

/**
 * Processes one page of videos with no cached transcript.
 *
 * @param db - Drizzle handle bound to D1.
 * @param afterId - Last video id from the previous page, or null to start.
 * @param limit - Page size.
 * @param generateSummaries - Also write an AI summary document per video.
 * @param providerKey - The shared AI key, when summaries are on.
 * @returns The page result, with the cursor for the next page.
 */
export async function scrapeTranscriptsPage(
  db: any,
  afterId: string | null,
  limit: number,
  generateSummaries: boolean,
  providerKey: ProviderKey | null,
): Promise<ScrapePageResult> {
  const conditions = [isNull(videoTranscripts.videoId)];
  if (afterId) conditions.push(gt(videos.videoId, afterId));

  const rows = await db
    .select({ videoId: videos.videoId, title: videos.title })
    .from(videos)
    .leftJoin(videoTranscripts, eq(videoTranscripts.videoId, videos.videoId))
    .where(and(...conditions))
    .orderBy(asc(videos.videoId))
    .limit(limit);

  let scraped = 0;
  let summarized = 0;
  const errors: Array<{ videoId: string; error: string }> = [];

  for (const row of rows) {
    try {
      const snippets = await fetchYouTubeTranscript(row.videoId, "en");
      await writeCachedTranscript(row.videoId, "en", snippets);
      scraped++;

      if (generateSummaries && providerKey) {
        const transcriptText = transcriptToText(snippets);
        if (transcriptText.length > 0) {
          const summary = await summarizeTranscript(providerKey, transcriptText, row.title);
          await saveVideoDocument(
            db,
            row.videoId,
            "summary",
            { title: null, body: summary, author: "ai", model: SUMMARY_MODEL },
            null,
          );
          summarized++;
        }
      }
    } catch (error) {
      // A video with no captions, a bot check, a failed summary —
      // record it and keep going; the page still returns.
      errors.push({
        videoId: row.videoId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const last = rows[rows.length - 1];
  return {
    processed: rows.length,
    scraped,
    summarized,
    errors,
    nextAfterId: last ? last.videoId : afterId,
    done: rows.length < limit,
  };
}
