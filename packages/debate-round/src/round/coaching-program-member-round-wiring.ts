/**
 * @fileoverview Resolves each roster member's linked Practice Round
 * Simulator setup/feedback for a coaching program — closing follow-up (c)
 * named under idea #13 ("Coaching Programs and Group Challenges") in
 * TODO.md: "wiring a member's Practice Round Simulator setup/feedback into
 * the coaching space."
 *
 * Composes two already-persisted stores — `state/coachingProgramMemberRounds.ts`
 * (which `roundId` belongs to which member) and `state/practiceRounds.ts`
 * (that round's own `PracticeRoundSetup`/`PracticeRoundFeedback`/AI judge
 * decision) — rather than duplicating either store's data, mirroring the
 * existing `pre-round-briefing.ts`'s `buildPreRoundBriefingFromStores`
 * store-composition convention. Renders through `practice-round-simulator.ts`'s
 * own `buildPracticeRoundSetupText`/`buildPracticeRoundFeedbackText` rather
 * than introducing a second rendering.
 *
 * @module round/coaching-program-member-round-wiring
 */

import type { CoachingProgramConfig } from "./coaching-program";
import {
  buildPracticeRoundFeedbackText,
  buildPracticeRoundSetupText,
} from "./practice-round-simulator";
import { getMemberRoundLink } from "../state/coachingProgramMemberRounds";
import { getPracticeRound, type PracticeRoundRecord } from "../state/practiceRounds";

/** One roster member's resolved Practice Round Simulator link, if any. */
export type MemberPracticeRoundStatus = {
  memberId: string;
  /** The linked `roundId`, or `null` if this member has no round linked yet. */
  roundId: string | null;
  /** The linked round's persisted record, or `null` if unlinked or the linked round was since cleared. */
  record: PracticeRoundRecord | null;
};

/**
 * Resolves every member of `program`'s roster to their linked practice-round
 * status, in roster order. A member with no saved `MemberRoundLink` gets
 * `{ roundId: null, record: null }`; a member whose linked round was since
 * cleared (e.g. via `deletePracticeRound`) gets `{ roundId, record: null }`
 * so a panel can distinguish "never linked" from "linked round was removed".
 */
export function buildCoachingProgramMemberRoundStatuses(
  program: CoachingProgramConfig,
): MemberPracticeRoundStatus[] {
  return program.memberIds.map((memberId) => {
    const link = getMemberRoundLink(program.id, memberId);
    if (!link) return { memberId, roundId: null, record: null };
    return { memberId, roundId: link.roundId, record: getPracticeRound(link.roundId) ?? null };
  });
}

/**
 * Renders one member's practice-round status as a short block: their linked
 * round's setup and (once generated) post-round feedback, or an actionable
 * placeholder line when nothing is linked or the linked round can't be
 * found.
 */
export function buildMemberPracticeRoundStatusText(status: MemberPracticeRoundStatus): string {
  if (!status.roundId) return "No practice round linked yet.";
  if (!status.record) return `Linked round "${status.roundId}" was not found — it may have been cleared.`;

  const parts = [buildPracticeRoundSetupText(status.record.setup)];
  parts.push(
    status.record.feedback
      ? buildPracticeRoundFeedbackText(status.record.feedback)
      : "No post-round feedback yet.",
  );
  return parts.join("\n\n");
}
