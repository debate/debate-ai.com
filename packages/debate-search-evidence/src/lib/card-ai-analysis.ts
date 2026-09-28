/**
 * @fileoverview The evidence search's "AI Analysis" sidebar: its default
 * find-flaws-and-extensions prompt, the text it sends the model for a card,
 * and the content hashes a saved analysis is keyed by.
 *
 * Analyses are cached server-side by `/api/card-ai-analysis` (the
 * `card_ai_analyses` table), keyed by `(sha256(card text), sha256(prompt))`,
 * so every card ends up with one saved analysis per prompt that every later
 * reader gets without another model call. The hashing here runs unchanged in
 * the browser and in the Worker (`crypto.subtle`), so both sides agree on the
 * key.
 *
 * @module lib/card-ai-analysis
 */

import type { SearchResult } from "../types";

/**
 * The prompt the sidebar opens with, and the one every card's saved analysis
 * is generated from. Plain Markdown out (the sidebar renders it as text), not
 * JSON — unlike `findFlawsPrompt`'s scoring rubric in debate-speech-writer,
 * this is read by a debater, not parsed.
 */
export const FIND_FLAWS_AND_EXTENSIONS_PROMPT = `You are a debate coach reviewing one piece of evidence (a "card").

1. Claim — state the card's main claim in one sentence.
2. Warrants — summarize the reasons and evidence the card gives for it, in 2-3 sentences.
3. Support score — 0 to 10, where 0 means the warrants do not support the claim at all and 10 means full support; flaws lower it.
4. Flaws — list the problems an opponent would attack: outdated or unqualified evidence, logical fallacies, unwarranted leaps, missing internal links, overclaiming the tag, or missing parts (claim, warrant, evidence).
5. Extensions — list the ways to extend and strengthen this argument in round: the implications to draw out, the impacts it links to, the follow-up evidence that would shore up each flaw above, and how to answer the likely responses.

Use short Markdown headings for each section and bullet points for the lists. Be concise and specific to this card.`;

/** Upper bound on the card text sent for analysis; longer cards are truncated. */
export const MAX_ANALYSIS_CONTENT_CHARS = 20_000;

/** Strips tags from card HTML without a DOM, so this runs on the server too. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

/** The card as the model reads it: tag, cite, then the card text. */
export function buildCardAnalysisContent(
  card: Pick<SearchResult, "tag" | "cite" | "html"> & { summary?: string },
): string {
  const body = htmlToPlainText(card.html || "") || card.summary || "";
  return [card.tag, card.cite, body]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_ANALYSIS_CONTENT_CHARS);
}

/** Whitespace-insensitive form hashed for a cache key, so re-wrapped text still hits. */
export function normalizeForHash(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Hex SHA-256 of the normalized text — the cache key half for a card or a prompt. */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalizeForHash(text));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Response of `/api/card-ai-analysis`. */
export interface CardAiAnalysisResponse {
  result: string;
  /** True when the analysis came from the saved cache rather than a fresh model call. */
  cached: boolean;
}

/**
 * Returns the saved analysis for `content` under `prompt`, generating (and
 * saving) it on the server when none exists yet. Throws with the server's
 * `{ error }` message on failure.
 */
export async function requestCardAiAnalysis(
  input: { content: string; prompt: string; tag?: string },
  endpoint = "/api/card-ai-analysis",
  fetchImpl: typeof fetch = fetch,
): Promise<CardAiAnalysisResponse> {
  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  let payload: { result?: string; cached?: boolean; error?: string } = {};
  try {
    payload = await res.json();
  } catch {
    // Body wasn't JSON.
  }
  if (!res.ok || typeof payload.result !== "string") {
    throw new Error(payload.error || `AI analysis request failed (${res.status}).`);
  }
  return { result: payload.result, cached: Boolean(payload.cached) };
}
