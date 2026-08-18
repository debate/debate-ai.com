/**
 * @fileoverview Composes a round's AI judge-decision request directly from
 * its already-persisted flow summary (`state/flowSummaries.ts`) and judge
 * paradigm selection (debate-speech-writer's
 * `state/judgeParadigmSelections.ts`) — the store-composition half of
 * follow-up (a) under idea #5 ("AI Judge Decision Modes") in TODO.md,
 * mirroring `pre-round-briefing.ts`'s `buildPreRoundBriefingFromStores`
 * convention of resolving inputs from persisted stores by id rather than
 * requiring a caller to supply pre-fetched objects.
 *
 * @module round/judge-decision-from-stores
 */

import { getJudgeParadigmSelection } from "debate-speech-writer/src/state/judgeParadigmSelections";
import { buildFlowSummaryTextFromRows } from "../flow/flow-transcript-summary";
import { getFlowSummary } from "../state/flowSummaries";
import type { JudgeDecisionAiInput } from "./judge-decision-ai";

/**
 * Builds a round's `JudgeDecisionAiInput` from its persisted flow summary
 * and judge paradigm selection stores. Returns `null` when either isn't
 * saved yet for `roundId`, rather than throwing, so a caller (e.g.
 * `panels/JudgeDecisionPanel.tsx`) can prompt the user to save the missing
 * piece first instead of crashing.
 */
export function buildJudgeDecisionAiInputFromStores(
  roundId: string,
  sideLabels: [string, string],
): JudgeDecisionAiInput | null {
  const flowSummary = getFlowSummary(roundId);
  const paradigmSelection = getJudgeParadigmSelection(roundId);
  if (!flowSummary || !paradigmSelection) return null;

  const rows = flowSummary.summaries.filter((row) => !row.isHeading);
  return {
    paradigm: paradigmSelection.paradigm,
    flowSummaryText: buildFlowSummaryTextFromRows(rows),
    sideLabels,
  };
}
