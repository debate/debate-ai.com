/**
 * @fileoverview Account-linked counsel-panel-assessment-history sync —
 * TODO.md idea #4 ("AI Response-Outcome Charts"), "a timeline of past AI
 * counsel-panel assessments for a round, not just the latest" follow-up.
 * Pure validation helpers shared by the `/api/counsel-panel-assessments`
 * D1-backed routes (`apps/debate-ai.com`) and
 * `hooks/useCounselPanelAssessments.ts`, mirroring
 * `state/savedJudgeDecisions.ts`'s exact split — kept framework/fetch-free
 * so both sides agree on what a valid synced record is without duplicating
 * logic.
 *
 * Like `savedJudgeDecisions`, a `CounselPanelAssessmentRecord`'s payload is
 * small (a handful of per-argument role/response-path/clash-estimate
 * strings plus one summary paragraph) so `GET /api/counsel-panel-assessments`
 * returns every record in full — there is no separate summary/label concept
 * here.
 *
 * @module state/savedCounselPanelAssessments
 */

import { COUNSEL_ROLES } from "../flow/response-outcome-ai";
import type { CounselPanelAssessmentRecord } from "./counselPanelAssessments";

/** Hard cap on a single assessment's JSON size — generous for even a long summary, well short of D1's row-size limits. */
export const MAX_SAVED_COUNSEL_PANEL_ASSESSMENT_BYTES = 200_000;

function isCounselRole(value: unknown): value is (typeof COUNSEL_ROLES)[number] {
  return typeof value === "string" && (COUNSEL_ROLES as readonly string[]).includes(value);
}

function isValidArgumentAssessment(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const assessment = value as Record<string, unknown>;
  return (
    typeof assessment.rowIndex === "number" &&
    Number.isFinite(assessment.rowIndex) &&
    isCounselRole(assessment.counselRole) &&
    typeof assessment.likelyResponsePath === "string" &&
    typeof assessment.clashEstimate === "string"
  );
}

function isValidResult(value: unknown): value is CounselPanelAssessmentRecord["result"] {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Record<string, unknown>;
  return (
    Array.isArray(result.argumentAssessments) &&
    result.argumentAssessments.length > 0 &&
    result.argumentAssessments.every(isValidArgumentAssessment) &&
    typeof result.overallClashSummary === "string"
  );
}

/**
 * Structural validator for an untrusted (e.g. parsed request-body JSON)
 * value claiming to be a `CounselPanelAssessmentRecord`.
 */
export function isValidCounselPanelAssessmentRecord(
  value: unknown,
): value is CounselPanelAssessmentRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;

  if (typeof record.id !== "string" || record.id.trim().length === 0) return false;
  if (typeof record.roundId !== "string" || record.roundId.trim().length === 0) return false;
  if (!isValidResult(record.result)) return false;
  if (typeof record.generatedAt !== "number") return false;

  return true;
}
