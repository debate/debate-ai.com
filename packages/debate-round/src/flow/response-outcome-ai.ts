/**
 * @fileoverview Pure prompt-building and response-parsing helpers for
 * follow-up (a) under idea #4 ("AI Response-Outcome Charts") in TODO.md:
 * "an actual AI-panel call (multiple 'counsel' model roles) that evaluates
 * likely response paths and clash points beyond this deterministic
 * heuristic." `flow/response-outcome.ts` stays exactly as it is — a
 * deterministic vulnerability-scoring heuristic — and this module adds a
 * second, genuinely AI-backed assessment alongside it: a system prompt
 * that asks Claude to role-play a panel of three specialized debate
 * "counsel" (Policy Counsel, Kritik Counsel, Weighing Counsel), assign
 * whichever counsel role best fits each already-scored vulnerable
 * argument, and estimate that argument's likely response path and where
 * clash will concentrate, plus one overall round-level clash summary.
 *
 * This file makes no network call itself (see
 * `response-outcome-client.ts` for that) so the prompt-building and
 * parsing logic can be exercised directly in Vitest without mocking
 * `fetch`, mirroring `round/judge-decision-ai.ts`'s split.
 *
 * @module flow/response-outcome-ai
 */

import type { ArgumentVulnerability } from "./response-outcome";

/** The three specialized counsel roles the model is asked to role-play. */
export const COUNSEL_ROLES = ["Policy Counsel", "Kritik Counsel", "Weighing Counsel"] as const;

export type CounselRole = (typeof COUNSEL_ROLES)[number];

/** Minimal shape of an already-scored argument needed to request a counsel-panel assessment for it. */
export type CounselPanelAiArgumentInput = Pick<
  ArgumentVulnerability,
  "rowIndex" | "argument" | "originSpeech" | "isUnanswered" | "vulnerabilityScore"
>;

export type CounselPanelAiInput = {
  /** The already-scored arguments to assess, typically the top N most vulnerable from a report. */
  arguments: CounselPanelAiArgumentInput[];
};

/** One argument's AI-assessed likely response path and clash point, attributed to a counsel role. */
export type CounselPanelArgumentAssessment = {
  rowIndex: number;
  counselRole: CounselRole;
  likelyResponsePath: string;
  clashEstimate: string;
};

/** A structured AI counsel-panel assessment, parsed from the model's JSON reply. */
export type CounselPanelAiResult = {
  argumentAssessments: CounselPanelArgumentAssessment[];
  /** A short paragraph summarizing where clash will concentrate across the whole round. */
  overallClashSummary: string;
};

/**
 * System prompt instructing the model to role-play a panel of three
 * specialized debate "counsel" and reply with strict JSON only — no prose,
 * no markdown code fences — so `parseCounselPanelAiResponse` can parse it
 * directly. (The parser also tolerates a fenced or prose-wrapped reply,
 * since models don't always follow this instruction exactly.)
 */
export const COUNSEL_PANEL_AI_SYSTEM_PROMPT =
  "You are a panel of three specialized AI debate \"counsel\" roles, convened to evaluate a round's " +
  "most exposed arguments beyond a simple heuristic score:\n" +
  '- "Policy Counsel" — evaluates plan/counterplan mechanics, solvency, and net-benefits framing.\n' +
  '- "Kritik Counsel" — evaluates framework, discourse-level, and representational vulnerabilities.\n' +
  '- "Weighing Counsel" — evaluates impact calculus and which side is favored on magnitude, ' +
  "probability, and timeframe.\n\n" +
  "You will be given a list of already-scored vulnerable arguments (each with the speech that " +
  "introduced it, whether it's currently unanswered, and a 0-100 heuristic exposure score). For " +
  "each argument, decide which single counsel role is best suited to evaluate it, then give that " +
  "role's estimate of the likely response path the opposing side will take against it and where " +
  "clash will concentrate. Then give one overall paragraph summarizing where clash will concentrate " +
  "across the round as a whole.\n\n" +
  "Respond with STRICT JSON ONLY — no prose before or after it, no markdown code fences, no " +
  "trailing commentary. The JSON must have exactly this shape:\n" +
  '{"argumentAssessments": [{"rowIndex": <number>, ' +
  '"counselRole": "Policy Counsel" | "Kritik Counsel" | "Weighing Counsel", ' +
  '"likelyResponsePath": "<short estimate>", "clashEstimate": "<short estimate>"}, ...], ' +
  '"overallClashSummary": "<short paragraph>"}\n\n' +
  "Include exactly one assessment per argument given, in any order. Every field is required and " +
  "every string must be non-empty.";

/**
 * Builds the user-turn message text for a counsel-panel AI request: every
 * given argument's row index, origin speech, unanswered status, and
 * heuristic exposure score, plus a restatement of the required JSON reply
 * shape.
 */
export function buildCounselPanelAiUserPrompt(input: CounselPanelAiInput): string {
  const argumentLines = input.arguments
    .map(
      (arg) =>
        `- rowIndex ${arg.rowIndex} (${arg.originSpeech}${arg.isUnanswered ? ", currently unanswered" : ""}, ` +
        `heuristic exposure ${arg.vulnerabilityScore}/100): ${arg.argument}`,
    )
    .join("\n");

  return (
    "Most vulnerable arguments in this round's flow:\n" +
    `${argumentLines}\n\n` +
    "Reply with JSON only, matching this shape:\n" +
    '{"argumentAssessments": [{"rowIndex": number, ' +
    '"counselRole": "Policy Counsel" | "Kritik Counsel" | "Weighing Counsel", ' +
    '"likelyResponsePath": string, "clashEstimate": string}, ...] (one per argument given), ' +
    '"overallClashSummary": string}'
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isCounselRole(value: unknown): value is CounselRole {
  return typeof value === "string" && (COUNSEL_ROLES as readonly string[]).includes(value);
}

function validateArgumentAssessment(value: unknown): CounselPanelArgumentAssessment | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;

  const rowIndex = candidate["rowIndex"];
  if (typeof rowIndex !== "number" || !Number.isFinite(rowIndex)) return null;

  const counselRole = candidate["counselRole"];
  if (!isCounselRole(counselRole)) return null;

  const likelyResponsePath = candidate["likelyResponsePath"];
  if (!isNonEmptyString(likelyResponsePath)) return null;

  const clashEstimate = candidate["clashEstimate"];
  if (!isNonEmptyString(clashEstimate)) return null;

  return {
    rowIndex,
    counselRole,
    likelyResponsePath: likelyResponsePath.trim(),
    clashEstimate: clashEstimate.trim(),
  };
}

function validateResult(value: unknown): CounselPanelAiResult | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;

  const argumentAssessmentsRaw = candidate["argumentAssessments"];
  if (!Array.isArray(argumentAssessmentsRaw) || argumentAssessmentsRaw.length === 0) return null;

  const argumentAssessments: CounselPanelArgumentAssessment[] = [];
  for (const raw of argumentAssessmentsRaw) {
    const assessment = validateArgumentAssessment(raw);
    if (!assessment) return null;
    argumentAssessments.push(assessment);
  }

  const overallClashSummary = candidate["overallClashSummary"];
  if (!isNonEmptyString(overallClashSummary)) return null;

  return { argumentAssessments, overallClashSummary: overallClashSummary.trim() };
}

/** Extracts the first top-level `{...}` block from `raw`, or `null` if there isn't one. */
function extractFirstJsonObject(raw: string): string | null {
  const match = raw.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

/**
 * Tolerantly parses a model reply into a `CounselPanelAiResult`. Tries
 * `JSON.parse` on the trimmed string first (the model was asked to reply
 * with JSON only); if that fails, falls back to extracting the first
 * `{...}` block from the string (handling replies wrapped in prose or a
 * ```json fence) and parsing that instead.
 *
 * Returns `null` — rather than throwing — when the string isn't
 * parseable JSON at all, or when the parsed value doesn't validate against
 * the expected shape (missing field, wrong type, an unrecognized
 * `counselRole`, an empty `argumentAssessments`, or an empty string field),
 * so a malformed AI response degrades gracefully instead of crashing the
 * panel.
 */
export function parseCounselPanelAiResponse(raw: string): CounselPanelAiResult | null {
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
