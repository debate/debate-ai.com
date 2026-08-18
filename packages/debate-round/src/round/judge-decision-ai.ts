/**
 * @fileoverview Pure prompt-building and response-parsing helpers for
 * follow-up (a) under idea #5 ("AI Judge Decision Modes") in TODO.md: "an
 * AI judge-decision call that uses `buildJudgeParadigmPrompt` output
 * instead of (or alongside) the existing static `judgeDecisionPrompt`".
 * Composes a selected `JudgeParadigm`'s prompt section
 * (debate-speech-writer's `judge/judge-paradigms.ts`) with a round's
 * already-derived flow summary text (`flow/flow-transcript-summary.ts`'s
 * `buildFlowSummaryText`) into a single AI judge-decision request, asking
 * for a structured JSON verdict rather than `prompts/judge-decision-options.ts`'s
 * free-form dual-ballot prompt (left unchanged).
 *
 * This file makes no network call itself (see `judge-decision-client.ts`
 * for that) so the prompt-building and parsing logic can be exercised
 * directly in Vitest without mocking `fetch`, mirroring
 * `ai-versus-speech-ai.ts`'s split.
 *
 * @module round/judge-decision-ai
 */

import type { JudgeParadigm } from "debate-speech-writer/src/judge/judge-paradigms";
import { buildJudgeParadigmPrompt } from "debate-speech-writer/src/judge/judge-paradigms";

export type JudgeDecisionAiInput = {
  paradigm: JudgeParadigm;
  /** Rendered flow summary text, e.g. from `flow-transcript-summary.ts`'s `buildFlowSummaryText`. */
  flowSummaryText: string;
  /** The two sides' display labels, e.g. `["Affirmative", "Negative"]`. */
  sideLabels: [string, string];
};

export type JudgeDecisionAiVerdict = {
  /** Exactly one of the two `sideLabels` passed in the request (matched case-insensitively, normalized to the input's casing). */
  winner: string;
  /** Ordered voting-issue reasons, framed around the selected paradigm's priorities. */
  reasoning: string[];
  /** A short ballot paragraph explaining the decision. */
  ballotText: string;
};

/**
 * System prompt instructing the model to act as a judge deciding strictly
 * under the given paradigm and reply with strict JSON only — no prose, no
 * markdown code fences — so `parseJudgeDecisionAiResponse` can parse it
 * directly. (The parser also tolerates a fenced or prose-wrapped reply,
 * since models don't always follow this instruction exactly.)
 */
export const JUDGE_DECISION_AI_SYSTEM_PROMPT =
  "You are an experienced competitive-debate judge. You will be given a judging paradigm " +
  "(your own voting priorities, speed/jargon tolerance, and instructions for how to evaluate a " +
  "round) and a flow-oriented summary of the round's arguments, noting which have gone " +
  "unanswered. Decide the round strictly under the given paradigm, in character as that kind of " +
  "judge — do not import a different judging philosophy.\n\n" +
  "Respond with STRICT JSON ONLY — no prose before or after it, no markdown code fences, no " +
  "trailing commentary. The JSON must have exactly this shape:\n" +
  '{"winner": "<one of the two side labels, verbatim>", "reasoning": ["<voting-issue reason>", ' +
  '...], "ballotText": "<a short ballot paragraph explaining the decision>"}\n\n' +
  '"winner" must exactly match one of the two side labels given. "reasoning" must have at ' +
  "least one entry, each a short voting-issue reason framed around the paradigm's priorities. " +
  '"ballotText" must be non-empty.';

/**
 * Builds the user-turn message text for a judge-decision AI request: the
 * selected paradigm's full prompt section, the round's two side labels,
 * and its flow summary text, plus a restatement of the required JSON reply
 * shape.
 */
export function buildJudgeDecisionUserPrompt(input: JudgeDecisionAiInput): string {
  const [sideA, sideB] = input.sideLabels;

  return (
    `${buildJudgeParadigmPrompt(input.paradigm)}\n\n` +
    `The two sides are "${sideA}" and "${sideB}".\n\n` +
    "Flow summary (one line per argument thread, noting where it was introduced and flagging " +
    "anything unanswered):\n" +
    `${input.flowSummaryText}\n\n` +
    `Decide the round under the "${input.paradigm.name}" paradigm above. Reply with JSON only, ` +
    `matching this shape: {"winner": "${sideA}" or "${sideB}", "reasoning": [string, ...], ` +
    '"ballotText": string}'
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Extracts the first top-level `{...}` block from `raw`, or `null` if there isn't one. */
function extractFirstJsonObject(raw: string): string | null {
  const match = raw.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

/**
 * Validates a parsed JSON value against the expected verdict shape,
 * matching `winner` case-insensitively against `sideLabels` and
 * normalizing it back to the input's exact casing. Returns `null` if any
 * required field is missing, wrong-typed, empty, or `winner` doesn't match
 * either side label.
 */
function validateVerdict(
  value: unknown,
  sideLabels: [string, string],
): JudgeDecisionAiVerdict | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;

  const winnerRaw = candidate["winner"];
  if (!isNonEmptyString(winnerRaw)) return null;
  const winner = sideLabels.find(
    (label) => label.trim().toLowerCase() === winnerRaw.trim().toLowerCase(),
  );
  if (!winner) return null;

  const reasoningRaw = candidate["reasoning"];
  if (!Array.isArray(reasoningRaw)) return null;
  const reasoning = reasoningRaw.filter(isNonEmptyString).map((reason) => reason.trim());
  if (reasoning.length === 0) return null;

  const ballotTextRaw = candidate["ballotText"];
  if (!isNonEmptyString(ballotTextRaw)) return null;

  return { winner, reasoning, ballotText: ballotTextRaw.trim() };
}

/**
 * Tolerantly parses a model reply into a `JudgeDecisionAiVerdict`. Tries
 * `JSON.parse` on the trimmed string first (the model was asked to reply
 * with JSON only); if that fails, falls back to extracting the first
 * `{...}` block from the string (handling replies wrapped in prose or a
 * ```json fence) and parsing that instead.
 *
 * Returns `null` — rather than throwing — when the string isn't parseable
 * JSON at all, or when the parsed value doesn't validate against the
 * expected shape (missing field, wrong type, empty string/array after
 * trimming, or a `winner` that doesn't match either side label), so a
 * malformed AI response degrades gracefully instead of crashing the panel.
 */
export function parseJudgeDecisionAiResponse(
  raw: string,
  sideLabels: [string, string],
): JudgeDecisionAiVerdict | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    return validateVerdict(JSON.parse(trimmed), sideLabels);
  } catch {
    // Fall through to the extraction fallback below.
  }

  const extracted = extractFirstJsonObject(trimmed);
  if (!extracted) return null;

  try {
    return validateVerdict(JSON.parse(extracted), sideLabels);
  } catch {
    return null;
  }
}
