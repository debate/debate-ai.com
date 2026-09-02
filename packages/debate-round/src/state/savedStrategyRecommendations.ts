/**
 * @fileoverview Account-linked strategy-recommendation-history sync — the
 * "🧭 Scout-to-Strategy Workflow" bullet's "a history log of past strategy
 * recommendations per matchup" follow-up in TODO.md's Research
 * Crowdsourcing Organizer Features list. Pure validation helpers shared by
 * the `/api/strategy-recommendations` D1-backed routes
 * (`apps/debate-ai.com`) and `hooks/useStrategyRecommendations.ts`,
 * mirroring `state/savedJudgeDecisions.ts`'s split — kept framework/fetch-free
 * so both sides agree on what a valid synced record is without duplicating
 * logic.
 *
 * Like `savedJudgeDecisions`, a `StrategyRecommendationRecord`'s payload is
 * small (a handful of ranked case options, judge-adaptation note strings,
 * a risk level/factors, and an optional AI case-choice evaluation) so
 * `GET /api/strategy-recommendations` returns every record in full — there
 * is no separate summary/label concept here.
 *
 * @module state/savedStrategyRecommendations
 */

import type { StrategyRecommendationRecord } from "./strategyRecommendations";

/** Hard cap on a single recommendation's JSON size — generous even with an AI case-choice evaluation attached, well short of D1's row-size limits. */
export const MAX_SAVED_STRATEGY_RECOMMENDATION_BYTES = 200_000;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isValidRankedCaseOption(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const option = value as Record<string, unknown>;
  return (
    typeof option.name === "string" &&
    isStringArray(option.argumentTags) &&
    typeof option.overlapScore === "number" &&
    Number.isFinite(option.overlapScore)
  );
}

function isValidRecommendation(value: unknown): value is StrategyRecommendationRecord["recommendation"] {
  if (typeof value !== "object" || value === null) return false;
  const recommendation = value as Record<string, unknown>;

  if (recommendation.recommendedCase !== null && !isValidRankedCaseOption(recommendation.recommendedCase)) {
    return false;
  }
  if (!Array.isArray(recommendation.caseRankings) || !recommendation.caseRankings.every(isValidRankedCaseOption)) {
    return false;
  }
  if (!isStringArray(recommendation.judgeAdaptationNotes)) return false;
  if (
    recommendation.riskLevel !== "low" &&
    recommendation.riskLevel !== "medium" &&
    recommendation.riskLevel !== "high"
  ) {
    return false;
  }
  if (!isStringArray(recommendation.riskFactors)) return false;

  return true;
}

function isValidCaseChoiceAssessment(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const assessment = value as Record<string, unknown>;
  return typeof assessment.name === "string" && typeof assessment.assessment === "string";
}

function isValidAiCaseChoice(value: unknown): value is NonNullable<StrategyRecommendationRecord["aiCaseChoice"]> {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.recommendedCase === "string" &&
    typeof result.reasoning === "string" &&
    Array.isArray(result.caseAssessments) &&
    result.caseAssessments.every(isValidCaseChoiceAssessment)
  );
}

/**
 * Structural validator for an untrusted (e.g. parsed request-body JSON)
 * value claiming to be a `StrategyRecommendationRecord`.
 */
export function isValidStrategyRecommendationRecord(value: unknown): value is StrategyRecommendationRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;

  if (typeof record.id !== "string" || record.id.trim().length === 0) return false;
  if (typeof record.matchupId !== "string" || record.matchupId.trim().length === 0) return false;
  if (!isValidRecommendation(record.recommendation)) return false;
  if (record.aiCaseChoice !== undefined && !isValidAiCaseChoice(record.aiCaseChoice)) return false;
  if (typeof record.generatedAt !== "number") return false;

  return true;
}
