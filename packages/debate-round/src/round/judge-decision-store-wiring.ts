/**
 * @fileoverview Resolves a `JudgeDecisionAiInput` for a round directly from
 * two already-persisted stores instead of requiring a caller to supply
 * pre-fetched data — the "Pre-Round Briefing Store Wiring" convention
 * (`round/pre-round-briefing.ts`'s `buildPreRoundBriefingFromStores`)
 * applied to idea #5's ("AI Judge Decision Modes") follow-up (a).
 *
 * Composes this package's own `state/flowSummaries.ts` (a round's derived
 * `FlowRowSummary[]`, keyed by `roundId`) with `debate-speech-writer`'s
 * `state/judgeParadigmSelections.ts` (a round's selected `JudgeParadigm`,
 * also keyed by `roundId`) — both slices already exist and are already
 * keyed the same way, so no new persistence is introduced here.
 *
 * @module round/judge-decision-store-wiring
 */

import { getJudgeParadigmSelection } from "debate-speech-writer/src/state/judgeParadigmSelections";
import { buildFlowSummaryTextFromRows } from "../flow/flow-transcript-summary";
import { getFlowSummary } from "../state/flowSummaries";
import type { JudgeDecisionAiInput, JudgeDecisionSideNames } from "./judge-decision-ai";

/** Which of the two required sources (if any) is missing for a round. */
export type JudgeDecisionSource = "flowSummary" | "judgeParadigm";

export type JudgeDecisionSourcesResult =
  | { ok: true; input: JudgeDecisionAiInput }
  | { ok: false; missing: JudgeDecisionSource[] };

/**
 * Resolves `roundId`'s persisted flow summary and judge-paradigm selection
 * into a `JudgeDecisionAiInput`, ready for `requestJudgeDecision`. Returns
 * `{ ok: false, missing }` — naming which source(s) aren't persisted yet —
 * rather than throwing, so a panel can render an actionable message (e.g.
 * "save a flow summary and a judge paradigm for this round first").
 */
export function buildJudgeDecisionInputFromStores(
  roundId: string,
  sideNames: JudgeDecisionSideNames,
): JudgeDecisionSourcesResult {
  const missing: JudgeDecisionSource[] = [];

  const flowSummary = getFlowSummary(roundId);
  if (!flowSummary || flowSummary.summaries.length === 0) missing.push("flowSummary");

  const paradigmSelection = getJudgeParadigmSelection(roundId);
  if (!paradigmSelection) missing.push("judgeParadigm");

  if (missing.length > 0 || !flowSummary || !paradigmSelection) {
    return { ok: false, missing };
  }

  return {
    ok: true,
    input: {
      paradigm: paradigmSelection.paradigm,
      flowSummaryText: buildFlowSummaryTextFromRows(flowSummary.summaries),
      sideNames,
    },
  };
}
