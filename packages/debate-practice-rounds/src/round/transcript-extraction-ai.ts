/**
 * @fileoverview Pure prompt-building and response-parsing helpers for
 * follow-up (a) under idea #6 ("Speech Transcript Summaries and Answers")
 * in TODO.md: "audio/video transcription plus an AI call to extract
 * claims/warrants/impacts/evidence from raw speech text rather than
 * relying on a manually flowed grid." This is the AI-call half only — a
 * caller-supplied, already-transcribed speech text — not audio/video
 * transcription itself, mirroring this repo's established "AI call now,
 * richer input source later" slicing (e.g. `coach/team-coach-ai.ts`'s text
 * materials before any recording-transcription follow-up).
 *
 * Given raw speech text, the model extracts each distinct argument as a
 * claim plus optional warrant/impact/evidence, which
 * `buildFlowRowSummariesFromExtraction` then turns into synthetic
 * `flow-transcript-summary.ts` `FlowRowSummary` rows — the same shape
 * `FlowSummariesPanel` already renders — so extracted arguments slot into
 * the existing persisted-summary/cross-ex/extension pipeline without any
 * new panel-rendering logic.
 *
 * This file makes no network call itself (see `transcript-extraction-client.ts`
 * for that) so the prompt-building and parsing logic can be exercised
 * directly in Vitest without mocking `fetch`, mirroring
 * `judge-decision-ai.ts`'s split.
 *
 * @module round/transcript-extraction-ai
 */

import type { FlowRowSummary } from "debate-round/src/flow/flow-transcript-summary";

export type TranscriptExtractionAiInput = {
  /** The speech (column) this transcript belongs to, e.g. `"1AC"`. */
  speech: string;
  /** Raw, already-transcribed speech text. */
  transcriptText: string;
};

/** One argument extracted from raw speech text. */
export type ExtractedArgument = {
  claim: string;
  warrant?: string;
  impact?: string;
  evidence?: string;
};

/**
 * System prompt instructing the model to extract distinct arguments from a
 * raw speech transcript and reply with strict JSON only — no prose, no
 * markdown code fences — so `parseTranscriptExtractionAiResponse` can parse
 * it directly. (The parser also tolerates a fenced or prose-wrapped reply,
 * since models don't always follow this instruction exactly.)
 */
export const TRANSCRIPT_EXTRACTION_AI_SYSTEM_PROMPT =
  "You are extracting structured debate arguments from a raw speech transcript. You will be given " +
  "the text of one speech. Identify every distinct argument it makes. For each argument, extract: " +
  "the claim (what is being asserted), the warrant (the reasoning or mechanism given for it, if " +
  "any), the impact (why it matters, if stated), and evidence (any citation, study, or quoted " +
  "source referenced, if any). Only extract what the transcript actually says — don't invent " +
  "warrants, impacts, or evidence the speaker didn't give.\n\n" +
  "Respond with STRICT JSON ONLY — no prose before or after it, no markdown code fences, no " +
  "trailing commentary. The JSON must have exactly this shape:\n" +
  '{"arguments": [{"claim": "<claim>", "warrant": "<warrant or omit>", ' +
  '"impact": "<impact or omit>", "evidence": "<evidence or omit>"}, ...]}\n\n' +
  '"arguments" must have at least one entry. Every entry\'s "claim" is required; "warrant", ' +
  '"impact", and "evidence" are each optional — omit the key entirely when the transcript doesn\'t ' +
  "give one.";

/**
 * Builds the user-turn message text for a transcript-extraction AI
 * request: the speech label, the raw transcript text, and a restatement of
 * the required JSON reply shape.
 */
export function buildTranscriptExtractionAiUserPrompt(input: TranscriptExtractionAiInput): string {
  const { speech, transcriptText } = input;

  return (
    `Speech: ${speech}\n\n` +
    "Transcript:\n" +
    '"""\n' +
    `${transcriptText}\n` +
    '"""\n\n' +
    "Reply with JSON only, matching this shape:\n" +
    '{"arguments": [{"claim": string, "warrant"?: string, "impact"?: string, "evidence"?: string}, ...]} ' +
    "(at least one entry)."
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Reads an optional string field, treating a missing/blank/non-string value as absent. */
function optionalTrimmedString(value: unknown): string | undefined {
  return isNonEmptyString(value) ? value.trim() : undefined;
}

function validateExtractedArgument(value: unknown): ExtractedArgument | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;

  const claim = candidate["claim"];
  if (!isNonEmptyString(claim)) return null;

  const argument: ExtractedArgument = { claim: claim.trim() };
  const warrant = optionalTrimmedString(candidate["warrant"]);
  if (warrant) argument.warrant = warrant;
  const impact = optionalTrimmedString(candidate["impact"]);
  if (impact) argument.impact = impact;
  const evidence = optionalTrimmedString(candidate["evidence"]);
  if (evidence) argument.evidence = evidence;

  return argument;
}

/** Extracts the first top-level `{...}` block from `raw`, or `null` if there isn't one. */
function extractFirstJsonObject(raw: string): string | null {
  const match = raw.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

function validateResult(value: unknown): ExtractedArgument[] | null {
  if (typeof value !== "object" || value === null) return null;
  const argumentsRaw = (value as Record<string, unknown>)["arguments"];
  if (!Array.isArray(argumentsRaw)) return null;

  const args = argumentsRaw
    .map(validateExtractedArgument)
    .filter((arg): arg is ExtractedArgument => arg !== null);

  return args.length > 0 ? args : null;
}

/**
 * Tolerantly parses a model reply into `ExtractedArgument[]`. Tries
 * `JSON.parse` on the trimmed string first (the model was asked to reply
 * with JSON only); if that fails, falls back to extracting the first
 * `{...}` block from the string (handling replies wrapped in prose or a
 * ```json fence) and parsing that instead.
 *
 * Returns `null` — rather than throwing — when the string isn't parseable
 * JSON at all, when `arguments` is missing/not an array, or when every
 * entry fails validation (e.g. a missing `claim`), so a malformed AI
 * response degrades gracefully instead of crashing the caller. Entries
 * that individually fail validation are dropped rather than failing the
 * whole reply, mirroring `judge-decision-ai.ts`'s tolerant array filtering.
 */
export function parseTranscriptExtractionAiResponse(raw: string): ExtractedArgument[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const result = validateResult(JSON.parse(trimmed));
    if (result) return result;
  } catch {
    // Fall through to the extraction fallback below.
  }

  const extracted = extractFirstJsonObject(trimmed);
  if (!extracted) return null;

  try {
    return validateResult(JSON.parse(extracted));
  } catch {
    return null;
  }
}

/** Renders one extracted argument as a single display line for a `FlowRowSummary`. */
export function renderExtractedArgumentContent(argument: ExtractedArgument): string {
  const parts = [argument.claim];
  if (argument.warrant) parts.push(`Warrant: ${argument.warrant}`);
  if (argument.impact) parts.push(`Impact: ${argument.impact}`);
  if (argument.evidence) parts.push(`Evidence: ${argument.evidence}`);
  return parts.join(" — ");
}

/**
 * Turns AI-extracted arguments into synthetic `FlowRowSummary` rows for a
 * given speech, the same shape a manually flowed grid's
 * `getFlowRowSummaries` would produce. `startIndex` offsets `rowIndex` past
 * any rows a round's flow summary already has, so extracted rows can be
 * appended without colliding indices. Every row is marked `isUnanswered:
 * true` — the same as any argument freshly introduced in a speech no later
 * speech has responded to yet — so `suggestCrossExamQuestions`/
 * `suggestExtensionIdeas` treat it like any other newly-flowed row.
 */
export function buildFlowRowSummariesFromExtraction(
  speech: string,
  extractedArguments: ExtractedArgument[],
  startIndex = 0,
): FlowRowSummary[] {
  return extractedArguments.map((argument, index) => {
    const content = renderExtractedArgumentContent(argument);
    return {
      rowIndex: startIndex + index,
      isHeading: false,
      argument: content,
      originSpeech: speech,
      entries: [{ speech, content }],
      lastSpeech: speech,
      isUnanswered: true,
    };
  });
}
