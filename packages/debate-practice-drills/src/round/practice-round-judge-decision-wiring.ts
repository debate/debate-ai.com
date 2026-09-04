/**
 * @fileoverview Resolves a `JudgeDecisionAiInput` for a practice round —
 * the AI judge-decision half of follow-up (a) under the "🧪 Practice Round
 * Simulator" bullet in TODO.md's Research Crowdsourcing Organizer Features
 * list: "an actual AI speech-generation call for the AI opponent's speeches
 * and an AI judge-decision call under the chosen paradigm."
 *
 * Unlike `judge-decision-store-wiring.ts`'s `buildJudgeDecisionInputFromStores`
 * (built for idea #5's standalone AI Judge Decision panel, which reads its
 * paradigm from `debate-speech-writer`'s `judgeParadigmSelections.ts`), a
 * practice round already carries its own selected `JudgeParadigm` directly
 * on `PracticeRoundSetup.judgeParadigm` — so this wiring takes that paradigm
 * as a caller-supplied argument instead of looking it up from a second
 * store. The only source it still resolves from a store is this package's
 * own `state/flowSummaries.ts`, keyed by the same `roundId`, mirroring the
 * "same key across stores" convention `opponent-persona-speech-wiring.ts`
 * established for a round's saved opponent persona.
 *
 * @module round/practice-round-judge-decision-wiring
 */

import type { JudgeParadigm } from "debate-speech-writer/src/judge/judge-paradigms";
import { buildFlowSummaryTextFromRows } from "debate-round/src/flow/flow-transcript-summary";
import { getFlowSummary } from "../state/flowSummaries";
import type { JudgeDecisionAiInput, JudgeDecisionSideNames } from "debate-round/src/round/judge-decision-ai";

export type PracticeRoundJudgeDecisionSourcesResult =
  | { ok: true; input: JudgeDecisionAiInput }
  | { ok: false; missing: "flowSummary" };

/**
 * Resolves `roundId`'s persisted flow summary and combines it with a
 * practice round's already-selected `judgeParadigm` into a
 * `JudgeDecisionAiInput`, ready for `requestJudgeDecision`. Returns
 * `{ ok: false, missing: "flowSummary" }` — rather than throwing — when no
 * flow summary (or an empty one) is saved for the round yet, so a panel can
 * render an actionable message (e.g. "save a flow summary for this round
 * first").
 */
export function buildPracticeRoundJudgeDecisionInput(
  roundId: string,
  judgeParadigm: JudgeParadigm,
  sideNames: JudgeDecisionSideNames,
): PracticeRoundJudgeDecisionSourcesResult {
  const flowSummary = getFlowSummary(roundId);
  if (!flowSummary || flowSummary.summaries.length === 0) {
    return { ok: false, missing: "flowSummary" };
  }

  return {
    ok: true,
    input: {
      paradigm: judgeParadigm,
      flowSummaryText: buildFlowSummaryTextFromRows(flowSummary.summaries),
      sideNames,
    },
  };
}
