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

/**
 * Idea #5's third "Next" bullet ("a per-round decision count cap, now that a
 * heavily-re-judged round can accumulate many entries even with the new
 * bulk-clear action available"). Once a round's history log exceeds this
 * many entries, the oldest ones are trimmed — by `appendJudgeDecision` and
 * `trimJudgeDecisionsToCap` on the device, and by
 * `PUT /api/judge-decisions/[decisionId]` in the account. Lives here, with
 * the other helpers both sides share; `state/judgeDecisions.ts` re-exports it.
 */
export const MAX_JUDGE_DECISIONS_PER_ROUND = 20;

/** The fields {@link judgeDecisionIdsOverCap} reads from each decision. */
export type JudgeDecisionCapEntry = Pick<JudgeDecisionRecord, "id" | "roundId" | "generatedAt">;

/**
 * The ids of every decision beyond `cap` in its round, so that each round
 * keeps its `cap` newest decisions. Ties on `generatedAt` keep the smaller
 * `id`, so the device (`trimJudgeDecisionsToCap`) and the account route trim
 * exactly the same decisions. Ids come round by round (in first-seen round
 * order), oldest first within a round. Never mutates `records`.
 */
export function judgeDecisionIdsOverCap(
  records: readonly JudgeDecisionCapEntry[],
  cap: number = MAX_JUDGE_DECISIONS_PER_ROUND,
): string[] {
  const byRound = new Map<string, JudgeDecisionCapEntry[]>();
  for (const record of records) {
    const round = byRound.get(record.roundId);
    if (round) round.push(record);
    else byRound.set(record.roundId, [record]);
  }

  const keep = Math.max(0, Math.floor(cap));
  const overCap: string[] = [];
  for (const round of byRound.values()) {
    if (round.length <= keep) continue;
    const newestFirst = [...round].sort(
      (a, b) => b.generatedAt - a.generatedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
    overCap.push(
      ...newestFirst
        .slice(keep)
        .reverse()
        .map((record) => record.id),
    );
  }
  return overCap;
}

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
  if (record.batchId !== undefined && typeof record.batchId !== "string") return false;

  return true;
}
