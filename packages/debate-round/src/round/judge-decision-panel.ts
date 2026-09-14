/**
 * @fileoverview Pure combination logic for idea #5's ("AI Judge Decision
 * Modes") "a multi-judge 'panel' mode that runs several paradigms against
 * the same round and shows a combined decision" follow-up in TODO.md's
 * Product Feature Ideas list.
 *
 * A "panel run" requests one `JudgeDecisionAiResult` per selected paradigm
 * (each via the existing single-paradigm `requestJudgeDecision` — no change
 * to the AI request itself) and combines them into one summary: a majority
 * winner (or "split" on an even tie), the vote count on each side, whether
 * every paradigm agreed, and the union of every paradigm's key voting
 * issues. This mirrors `flow/response-outcome.ts#buildHypotheticalScenarioComparison`'s
 * "throws below the minimum comparable count" convention.
 *
 * @module round/judge-decision-panel
 */

import type { JudgeDecisionAiResult, JudgeDecisionWinner } from "./judge-decision-ai";

/** One paradigm's result within a panel run, identified by that paradigm's display name. */
export type JudgePanelParadigmResult = {
  paradigmName: string;
  result: JudgeDecisionAiResult;
};

export type JudgePanelCombinedDecision = {
  /** The side most paradigms voted for, or `"split"` on an exact tie. */
  winner: JudgeDecisionWinner | "split";
  primaryVotes: number;
  secondaryVotes: number;
  /** Whether every paradigm in the panel voted the same way. */
  unanimous: boolean;
  /** Union of every paradigm's `keyVotingIssues`, de-duplicated, first-seen order. */
  keyVotingIssues: string[];
};

/**
 * Combines two or more paradigms' judge decisions for the same round into
 * one panel summary. Throws when fewer than two results are given — a
 * "panel" of one paradigm is just a regular single decision.
 */
export function combineJudgePanelDecisions(
  results: readonly JudgePanelParadigmResult[],
): JudgePanelCombinedDecision {
  if (results.length < 2) {
    throw new Error("combineJudgePanelDecisions requires at least 2 paradigm results.");
  }

  let primaryVotes = 0;
  let secondaryVotes = 0;
  const seenIssues = new Set<string>();
  const keyVotingIssues: string[] = [];

  for (const { result } of results) {
    if (result.winner === "primary") primaryVotes++;
    else secondaryVotes++;

    for (const issue of result.keyVotingIssues) {
      if (!seenIssues.has(issue)) {
        seenIssues.add(issue);
        keyVotingIssues.push(issue);
      }
    }
  }

  const winner: JudgeDecisionWinner | "split" =
    primaryVotes > secondaryVotes ? "primary" : secondaryVotes > primaryVotes ? "secondary" : "split";

  return {
    winner,
    primaryVotes,
    secondaryVotes,
    unanimous: primaryVotes === 0 || secondaryVotes === 0,
    keyVotingIssues,
  };
}
