/**
 * @fileoverview Pure prompt-building and response-parsing helpers for
 * follow-up (c) under the "🧭 Scout-to-Strategy Workflow" bullet in
 * TODO.md's Research Crowdsourcing Organizer Features list: "an actual
 * AI-panel evaluation of case choice instead of the tag-overlap
 * heuristic." `scout-to-strategy.ts`'s `buildStrategyRecommendation`
 * already ranks case options by a deterministic opponent-tag-overlap
 * score; this module composes that ranking (plus the judge-adaptation
 * notes and risk assessment already derived alongside it) into a request
 * asking the model for an actual strategic case-choice evaluation — one
 * that can weigh a case's fit against the judge's tendencies and the
 * matchup's risk factors, not just its raw overlap score.
 *
 * This file makes no network call itself (see `case-choice-client.ts` for
 * that) so the prompt-building and parsing logic can be exercised directly
 * in Vitest without mocking `fetch`, mirroring `judge-decision-ai.ts`'s
 * split.
 *
 * @module round/case-choice-ai
 */

import type { RankedCaseOption, RiskLevel } from "./scout-to-strategy";

export type CaseChoiceAiInput = {
  /** Every case option under consideration, already ranked by tag-overlap score (safest first). */
  caseRankings: RankedCaseOption[];
  judgeAdaptationNotes: string[];
  riskLevel: RiskLevel;
  riskFactors: string[];
};

/** A short strategic note on one case option's fit against this matchup. */
export type CaseChoiceAssessment = { name: string; assessment: string };

/** A structured AI case-choice evaluation, parsed from the model's JSON reply. */
export type CaseChoiceAiResult = {
  /** The name of the case the model recommends running — should match one of the supplied case names. */
  recommendedCase: string;
  /** A short paragraph explaining the recommendation. */
  reasoning: string;
  /** A short strategic note per case option, ordered to match the supplied ranking. */
  caseAssessments: CaseChoiceAssessment[];
};

/**
 * System prompt instructing the model to act as a debate strategist
 * evaluating a team's prepared case options against a scouted opponent and
 * judge, and to reply with strict JSON only — no prose, no markdown code
 * fences — so `parseCaseChoiceAiResponse` can parse it directly. (The
 * parser also tolerates a fenced or prose-wrapped reply, since models don't
 * always follow this instruction exactly.)
 */
export const CASE_CHOICE_AI_SYSTEM_PROMPT =
  "You are a debate strategist helping a team choose which prepared case to run against a scouted " +
  "opponent and judge. You will be given the team's case options, each with its argument-type tags " +
  "and a tag-overlap score against the opponent's most commonly run arguments (higher overlap means " +
  "the opponent has likely prepped answers against it — this is a rough proxy, not a full strategic " +
  "read), judge-adaptation notes describing how to adapt to this judge, and an overall matchup risk " +
  "level with its contributing factors. Recommend which case is strategically best: weigh how well " +
  "each case fits the judge-adaptation notes and mitigates the noted risk factors, not just the raw " +
  "overlap score alone — the lowest-overlap case can still be a poor strategic fit if it collides " +
  "with a judge preference or a risk factor.\n\n" +
  "Respond with STRICT JSON ONLY — no prose before or after it, no markdown code fences, no " +
  "trailing commentary. The JSON must have exactly this shape:\n" +
  '{"recommendedCase": "<name of the recommended case, matching one of the supplied case names>", ' +
  '"reasoning": "<short paragraph explaining the recommendation>", ' +
  '"caseAssessments": [{"name": "<case name>", "assessment": "<short note on this case\'s strategic fit>"}, ...]}\n\n' +
  "Every field is required. `caseAssessments` must have one entry per supplied case option.";

/**
 * Builds the user-turn message text for a case-choice AI request: the
 * ranked case options with their tags and overlap scores, the judge
 * adaptation notes, and the matchup's risk level/factors.
 */
export function buildCaseChoiceAiUserPrompt(input: CaseChoiceAiInput): string {
  const { caseRankings, judgeAdaptationNotes, riskLevel, riskFactors } = input;

  const caseLines =
    caseRankings.length > 0
      ? caseRankings
          .map(
            (option) =>
              `- ${option.name} (tags: ${option.argumentTags.length > 0 ? option.argumentTags.join(", ") : "none"}; opponent-tag overlap score: ${option.overlapScore})`,
          )
          .join("\n")
      : "No case options supplied.";

  const judgeLines = judgeAdaptationNotes.map((note) => `- ${note}`).join("\n");

  const riskLines =
    riskFactors.length > 0 ? riskFactors.map((factor) => `- ${factor}`).join("\n") : "- No notable risk factors detected.";

  return (
    "Case options (safest tag-overlap first):\n" +
    `${caseLines}\n\n` +
    "Judge adaptation notes:\n" +
    `${judgeLines}\n\n` +
    `Matchup risk level: ${riskLevel}\n` +
    "Risk factors:\n" +
    `${riskLines}\n\n` +
    "Reply with JSON only, matching this shape:\n" +
    '{"recommendedCase": string, "reasoning": string, ' +
    '"caseAssessments": [{"name": string, "assessment": string}, ...] (one entry per case option)}'
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateCaseAssessments(value: unknown): CaseChoiceAssessment[] | null {
  if (!Array.isArray(value)) return null;
  const assessments: CaseChoiceAssessment[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const candidate = entry as Record<string, unknown>;
    const name = candidate["name"];
    const assessment = candidate["assessment"];
    if (!isNonEmptyString(name) || !isNonEmptyString(assessment)) continue;
    assessments.push({ name: name.trim(), assessment: assessment.trim() });
  }
  return assessments.length > 0 ? assessments : null;
}

function validateResult(value: unknown): CaseChoiceAiResult | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;

  const recommendedCase = candidate["recommendedCase"];
  if (!isNonEmptyString(recommendedCase)) return null;

  const reasoning = candidate["reasoning"];
  if (!isNonEmptyString(reasoning)) return null;

  const caseAssessments = validateCaseAssessments(candidate["caseAssessments"]);
  if (!caseAssessments) return null;

  return { recommendedCase: recommendedCase.trim(), reasoning: reasoning.trim(), caseAssessments };
}

/** Extracts the first top-level `{...}` block from `raw`, or `null` if there isn't one. */
function extractFirstJsonObject(raw: string): string | null {
  const match = raw.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

/**
 * Tolerantly parses a model reply into a `CaseChoiceAiResult`. Tries
 * `JSON.parse` on the trimmed string first (the model was asked to reply
 * with JSON only); if that fails, falls back to extracting the first
 * `{...}` block from the string (handling replies wrapped in prose or a
 * ```json fence) and parsing that instead.
 *
 * Returns `null` — rather than throwing — when the string isn't
 * parseable JSON at all, or when the parsed value doesn't validate against
 * the expected shape (missing field, wrong type, an empty `reasoning`, or
 * no valid `caseAssessments` entries), so a malformed AI response degrades
 * gracefully instead of crashing the panel.
 */
export function parseCaseChoiceAiResponse(raw: string): CaseChoiceAiResult | null {
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
