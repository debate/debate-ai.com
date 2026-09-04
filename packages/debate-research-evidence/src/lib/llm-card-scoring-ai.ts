/**
 * @fileoverview Pure prompt-building and response-parsing helpers for
 * follow-up (a) under the "🧠 LLM Card Scoring" bullet in TODO.md ("an
 * actual LLM-scoring call for the more subjective dimensions instead of
 * the heuristic proxy"). `lib/llm-card-scoring.ts` stays exactly as it is
 * — a deterministic heuristic — and this module adds a second, genuinely
 * AI-backed assessment alongside it: a system prompt + user-prompt builder
 * that ask Claude to review a card's text and argument-block keywords and
 * return a structured JSON verdict, plus a tolerant parser for the model's
 * reply.
 *
 * This file makes no network call itself (see
 * `lib/llm-card-scoring-client.ts` for that) so the prompt-building and
 * parsing logic can be exercised directly in Vitest without mocking
 * `fetch`.
 *
 * @module lib/llm-card-scoring-ai
 */

/** Minimal shape of a card needed to request an AI assessment for it. */
export interface CardScoringAiInput {
  /** Plain-text card body (summary + underlined/highlighted evidence). */
  text: string;
  /** Keywords or short phrases describing the argument block this card supports. */
  argBlockKeywords: string[];
}

/** A qualitative AI assessment of one card, parsed from the model's JSON reply. */
export interface CardScoringAiAssessment {
  /** Overall quality score 0-100. */
  overallScore: number;
  /** One-sentence overall verdict. */
  verdict: string;
  /** One short note per dimension, explaining the model's read of that dimension. */
  notes: {
    relevance: string;
    clarity: string;
    uniqueness: string;
    evidenceQuality: string;
    usability: string;
  };
}

/**
 * System prompt instructing the model to act as a debate-card quality
 * reviewer and reply with strict JSON only — no prose, no markdown code
 * fences — so `parseCardScoringAiResponse` can parse it directly. (The
 * parser also tolerates a fenced or prose-wrapped reply, since models
 * don't always follow this instruction exactly.)
 */
export const CARD_SCORING_AI_SYSTEM_PROMPT =
  "You are an expert competitive-debate card reviewer. A user will give you the text of a " +
  "debate-evidence \"card\" (a tagline/summary plus underlined or highlighted evidence) and the " +
  "argument-block keywords it's meant to support. Assess the card's quality as a debate coach " +
  "would: is it actually relevant to those keywords, is it clearly written, does it say " +
  "something distinctive rather than restating common knowledge, is the underlying evidence " +
  "strong, and is it a usable length/format to read live in a round.\n\n" +
  "Respond with STRICT JSON ONLY — no prose before or after it, no markdown code fences, no " +
  "trailing commentary. The JSON must have exactly this shape:\n" +
  '{"overallScore": <number 0-100>, "verdict": "<one-sentence overall verdict>", ' +
  '"notes": {"relevance": "<short note>", "clarity": "<short note>", "uniqueness": "<short note>", ' +
  '"evidenceQuality": "<short note>", "usability": "<short note>"}}\n\n' +
  "Every field is required and every note must be non-empty. Keep each note to one short sentence.";

/**
 * Builds the user-turn message text for a card-scoring AI request: the
 * card's text, its argument-block keywords, and a restatement of the
 * required JSON reply shape.
 */
export function buildCardScoringAiUserPrompt(card: CardScoringAiInput): string {
  const keywordsLine =
    card.argBlockKeywords.length > 0 ? card.argBlockKeywords.join(", ") : "(none given)";

  return (
    "Argument-block keywords:\n" +
    `${keywordsLine}\n\n` +
    "Card text:\n" +
    '"""\n' +
    `${card.text}\n` +
    '"""\n\n' +
    "Reply with JSON only, matching this shape:\n" +
    '{"overallScore": number (0-100), "verdict": string (one sentence), ' +
    '"notes": {"relevance": string, "clarity": string, "uniqueness": string, ' +
    '"evidenceQuality": string, "usability": string}}'
  );
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Validates a parsed JSON value against the expected assessment shape,
 * returning a normalized `CardScoringAiAssessment` (score clamped to
 * [0, 100] and rounded) or `null` if any required field is missing,
 * wrong-typed, or an empty string after trimming.
 */
function validateAssessment(value: unknown): CardScoringAiAssessment | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;

  const overallScoreRaw = candidate["overallScore"];
  if (typeof overallScoreRaw !== "number" || !Number.isFinite(overallScoreRaw)) return null;

  const verdict = candidate["verdict"];
  if (!isNonEmptyString(verdict)) return null;

  const notesRaw = candidate["notes"];
  if (typeof notesRaw !== "object" || notesRaw === null) return null;
  const notes = notesRaw as Record<string, unknown>;

  const relevance = notes["relevance"];
  const clarity = notes["clarity"];
  const uniqueness = notes["uniqueness"];
  const evidenceQuality = notes["evidenceQuality"];
  const usability = notes["usability"];
  if (
    !isNonEmptyString(relevance) ||
    !isNonEmptyString(clarity) ||
    !isNonEmptyString(uniqueness) ||
    !isNonEmptyString(evidenceQuality) ||
    !isNonEmptyString(usability)
  ) {
    return null;
  }

  return {
    overallScore: clampScore(overallScoreRaw),
    verdict: verdict.trim(),
    notes: {
      relevance: relevance.trim(),
      clarity: clarity.trim(),
      uniqueness: uniqueness.trim(),
      evidenceQuality: evidenceQuality.trim(),
      usability: usability.trim(),
    },
  };
}

/** Extracts the first top-level `{...}` block from `raw`, or `null` if there isn't one. */
function extractFirstJsonObject(raw: string): string | null {
  const match = raw.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

/**
 * Tolerantly parses a model reply into a `CardScoringAiAssessment`. Tries
 * `JSON.parse` on the trimmed string first (the model was asked to reply
 * with JSON only); if that fails, falls back to extracting the first
 * `{...}` block from the string (handling replies wrapped in prose or a
 * ```json fence) and parsing that instead.
 *
 * Returns `null` — rather than throwing — when the string isn't
 * parseable JSON at all, or when the parsed value doesn't validate
 * against the expected shape (missing field, wrong type, or an empty
 * string after trimming), so a malformed AI response degrades gracefully
 * instead of crashing the panel.
 */
export function parseCardScoringAiResponse(raw: string): CardScoringAiAssessment | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    return validateAssessment(JSON.parse(trimmed));
  } catch {
    // Fall through to the extraction fallback below.
  }

  const extracted = extractFirstJsonObject(trimmed);
  if (!extracted) return null;

  try {
    return validateAssessment(JSON.parse(extracted));
  } catch {
    return null;
  }
}
