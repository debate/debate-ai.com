/**
 * @fileoverview Pure prompt-building and response-parsing helpers for
 * follow-up (a) under idea #5 ("AI Judge Decision Modes") in TODO.md: "an
 * AI judge-decision call that uses `buildJudgeParadigmPrompt` output
 * instead of (or alongside) the existing static `judgeDecisionPrompt`."
 * `debate-speech-writer`'s `judge/judge-paradigms.ts` already turns a
 * selected `JudgeParadigm` into a self-contained prompt section
 * (`buildJudgeParadigmPrompt`); this module composes that with a round's
 * flow summary text (`flow/flow-transcript-summary.ts`'s
 * `buildFlowSummaryText`) into a single AI judge-decision request, and
 * parses the model's reply into a structured, renderable decision.
 *
 * This file makes no network call itself (see `judge-decision-client.ts`
 * for that) so the prompt-building and parsing logic can be exercised
 * directly in Vitest without mocking `fetch`, mirroring
 * `lib/llm-card-scoring-ai.ts`'s split.
 *
 * `buildJudgeDecisionRubric` closes the "🧪 Practice Round Simulator" idea's
 * "a scoring rubric shown alongside the AI judge decision" Next item
 * (TODO.md's Research Crowdsourcing Organizer Features list): a
 * paradigm-agnostic checklist of that paradigm's own `votingPriorities`,
 * each marked addressed/not against the already-parsed decision, reusing
 * the same `JudgeParadigm`/`JudgeDecisionAiResult` shapes this file already
 * defines instead of a second AI call.
 *
 * @module round/judge-decision-ai
 */

import type { JudgeParadigm } from "debate-speech-writer/src/judge/judge-paradigms";
import { buildJudgeParadigmPrompt } from "debate-speech-writer/src/judge/judge-paradigms";

/** One row of a paradigm's scoring rubric, checked against a rendered decision. */
export type JudgeDecisionRubricRow = {
  /** The paradigm's own voting-priority text, unmodified. */
  criterion: string;
  /** Whether the decision's `keyVotingIssues`/`rationale` appear to speak to this criterion. */
  addressed: boolean;
  /** The `keyVotingIssues` entry that matched, if `addressed` is true. */
  matchedIssue: string | null;
};

/** Which side of the round the AI judge voted for. */
export type JudgeDecisionWinner = "primary" | "secondary";

/** Labels for the two sides of the round, e.g. `{ primary: "Affirmative", secondary: "Negative" }`. */
export type JudgeDecisionSideNames = { primary: string; secondary: string };

export type JudgeDecisionAiInput = {
  paradigm: JudgeParadigm;
  /** A flow-oriented text summary of the round, e.g. `buildFlowSummaryText`'s output. */
  flowSummaryText: string;
  sideNames: JudgeDecisionSideNames;
};

/** A structured AI judge decision, parsed from the model's JSON reply. */
export type JudgeDecisionAiResult = {
  winner: JudgeDecisionWinner;
  /** Ordered highest to lowest impact on the decision. */
  keyVotingIssues: string[];
  /** A short paragraph explaining the vote under the selected paradigm. */
  rationale: string;
};

/**
 * System prompt instructing the model to act as an AI debate judge under a
 * caller-supplied paradigm and reply with strict JSON only — no prose, no
 * markdown code fences — so `parseJudgeDecisionAiResponse` can parse it
 * directly. (The parser also tolerates a fenced or prose-wrapped reply,
 * since models don't always follow this instruction exactly.)
 */
export const JUDGE_DECISION_AI_SYSTEM_PROMPT =
  "You are an AI debate judge. You will be given a judge paradigm describing how to evaluate the " +
  "round (voting priorities, speed/jargon tolerance, and paradigm-specific instructions) and a " +
  "flow-oriented summary of the round's arguments, noting where each argument was introduced and " +
  "whether it went unanswered. Decide the round strictly under the given paradigm.\n\n" +
  "Respond with STRICT JSON ONLY — no prose before or after it, no markdown code fences, no " +
  "trailing commentary. The JSON must have exactly this shape:\n" +
  '{"winner": "primary" | "secondary", "keyVotingIssues": ["<issue>", ...], ' +
  '"rationale": "<short paragraph explaining the vote under this paradigm>"}\n\n' +
  "Every field is required. `keyVotingIssues` must have at least one entry. `winner` must be " +
  'exactly "primary" or "secondary".';

/**
 * Builds the user-turn message text for a judge-decision AI request: the
 * selected paradigm's prompt section (via `buildJudgeParadigmPrompt`), the
 * two sides' labels, the round's flow summary, and a restatement of the
 * required JSON reply shape.
 */
export function buildJudgeDecisionAiUserPrompt(input: JudgeDecisionAiInput): string {
  const { paradigm, flowSummaryText, sideNames } = input;

  return (
    `${buildJudgeParadigmPrompt(paradigm)}\n\n` +
    `Sides: "primary" = ${sideNames.primary}; "secondary" = ${sideNames.secondary}.\n\n` +
    "Round flow summary:\n" +
    '"""\n' +
    `${flowSummaryText}\n` +
    '"""\n\n' +
    "Reply with JSON only, matching this shape:\n" +
    '{"winner": "primary" | "secondary", "keyVotingIssues": string[] (at least one), ' +
    '"rationale": string (short paragraph)}'
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateResult(value: unknown): JudgeDecisionAiResult | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;

  const winner = candidate["winner"];
  if (winner !== "primary" && winner !== "secondary") return null;

  const keyVotingIssuesRaw = candidate["keyVotingIssues"];
  if (!Array.isArray(keyVotingIssuesRaw) || keyVotingIssuesRaw.length === 0) return null;
  const keyVotingIssues = keyVotingIssuesRaw.filter(isNonEmptyString).map((issue) => issue.trim());
  if (keyVotingIssues.length === 0) return null;

  const rationale = candidate["rationale"];
  if (!isNonEmptyString(rationale)) return null;

  return { winner, keyVotingIssues, rationale: rationale.trim() };
}

/** Extracts the first top-level `{...}` block from `raw`, or `null` if there isn't one. */
function extractFirstJsonObject(raw: string): string | null {
  const match = raw.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

/**
 * Tolerantly parses a model reply into a `JudgeDecisionAiResult`. Tries
 * `JSON.parse` on the trimmed string first (the model was asked to reply
 * with JSON only); if that fails, falls back to extracting the first
 * `{...}` block from the string (handling replies wrapped in prose or a
 * ```json fence) and parsing that instead.
 *
 * Returns `null` — rather than throwing — when the string isn't
 * parseable JSON at all, or when the parsed value doesn't validate against
 * the expected shape (missing field, wrong type, an empty `rationale`, or
 * an empty `keyVotingIssues`), so a malformed AI response degrades
 * gracefully instead of crashing the panel.
 */
export function parseJudgeDecisionAiResponse(raw: string): JudgeDecisionAiResult | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    return validateResult(JSON.parse(trimmed));
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

// Only words of 4+ letters ever reach this set (see extractRubricKeywords), so
// shorter stopwords like "the"/"and"/"or" need no entry here.
const RUBRIC_STOPWORDS = new Set(["with", "only", "when", "that", "this", "established"]);

/** Lowercased, punctuation-stripped words of 4+ letters, used as this criterion's match keywords. */
function extractRubricKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => word.length >= 4 && !RUBRIC_STOPWORDS.has(word));
}

/**
 * Builds a scoring-rubric checklist from a paradigm's own `votingPriorities`,
 * marking each as "addressed" when the decision's `keyVotingIssues` or
 * `rationale` mention one of that criterion's significant words. This is a
 * heuristic keyword match rather than a second AI call — good enough to spot
 * a paradigm criterion the decision never actually engaged with (e.g. a
 * "framework" judge whose rationale never mentions framework at all), not a
 * claim that a matched criterion was reasoned about correctly.
 */
export function buildJudgeDecisionRubric(
  paradigm: JudgeParadigm,
  decision: JudgeDecisionAiResult,
): JudgeDecisionRubricRow[] {
  return paradigm.votingPriorities.map((criterion) => {
    const keywords = extractRubricKeywords(criterion);
    const matchedIssue =
      decision.keyVotingIssues.find((issue) => rowMatchesKeywords(issue, keywords)) ?? null;
    const addressed = matchedIssue !== null || rowMatchesKeywords(decision.rationale, keywords);

    return { criterion, addressed, matchedIssue };
  });
}

function rowMatchesKeywords(text: string, keywords: string[]): boolean {
  if (keywords.length === 0) return false;
  const lowered = text.toLowerCase();
  return keywords.some((keyword) => lowered.includes(keyword));
}
