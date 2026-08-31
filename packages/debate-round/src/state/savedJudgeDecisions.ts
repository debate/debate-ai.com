/**
 * @fileoverview Account-linked judge-decision-history sync — TODO.md idea
 * #5 ("AI Judge Decision Modes"), "(b) a decision history log per round
 * instead of only the latest result" follow-up. Pure validation helpers
 * shared by the `/api/judge-decisions` D1-backed routes
 * (`apps/debate-ai.com`) and `hooks/useJudgeDecisions.ts`, mirroring
 * `state/savedWordCountRounds.ts`'s split — kept framework/fetch-free so
 * both sides agree on what a valid synced record is without duplicating
 * logic.
 *
 * Like `saved_word_count_rounds`, a `JudgeDecisionRecord`'s payload is
 * small (a paradigm name, a rationale string, a handful of voting-issue
 * strings) so `GET /api/judge-decisions` returns every record in full —
 * there is no separate summary/label concept here.
 *
 * @module state/savedJudgeDecisions
 */

import type { JudgeDecisionRecord } from "./judgeDecisions";

/** Hard cap on a single decision's JSON size — generous for even a long rationale, well short of D1's row-size limits. */
export const MAX_SAVED_JUDGE_DECISION_BYTES = 200_000;

function isValidSideNames(value: unknown): value is { primary: string; secondary: string } {
  if (typeof value !== "object" || value === null) return false;
  const sideNames = value as Record<string, unknown>;
  return typeof sideNames.primary === "string" && typeof sideNames.secondary === "string";
}

function isValidResult(value: unknown): value is JudgeDecisionRecord["result"] {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Record<string, unknown>;
  return (
    (result.winner === "primary" || result.winner === "secondary") &&
    Array.isArray(result.keyVotingIssues) &&
    result.keyVotingIssues.every((issue) => typeof issue === "string") &&
    typeof result.rationale === "string"
  );
}

/**
 * Structural validator for an untrusted (e.g. parsed request-body JSON)
 * value claiming to be a `JudgeDecisionRecord`.
 */
export function isValidJudgeDecisionRecord(value: unknown): value is JudgeDecisionRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;

  if (typeof record.id !== "string" || record.id.trim().length === 0) return false;
  if (typeof record.roundId !== "string" || record.roundId.trim().length === 0) return false;
  if (typeof record.paradigmName !== "string") return false;
  if (!isValidSideNames(record.sideNames)) return false;
  if (!isValidResult(record.result)) return false;
  if (typeof record.generatedAt !== "number") return false;

  return true;
}
