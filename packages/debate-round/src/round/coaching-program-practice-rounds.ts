/**
 * @fileoverview Coaching-program member practice-round composition — the
 * "(c) wiring a member's practice-round setup/feedback (Practice Round
 * Simulator) into the space" follow-up named under the "Coaching Programs
 * and Group Challenges" bullet (idea #13) in TODO.md.
 *
 * Resolves a program's roster against a caller-supplied `contributorId` →
 * `roundId` assignment map and the existing `state/practiceRounds.ts`
 * records into per-member, renderable setup/feedback text — reusing
 * `practice-round-simulator.ts`'s `buildPracticeRoundSetupText`/
 * `buildPracticeRoundFeedbackText` directly rather than introducing any new
 * setup/feedback rendering. A member with no assigned round, or one assigned
 * a `roundId` that has no matching persisted `PracticeRoundRecord`, is simply
 * omitted rather than throwing.
 *
 * @module round/coaching-program-practice-rounds
 */

import {
  buildPracticeRoundFeedbackText,
  buildPracticeRoundSetupText,
} from "./practice-round-simulator";
import type { CoachingProgramConfig } from "./coaching-program";
import type { PracticeRoundRecord } from "../state/practiceRounds";

/** One roster member's assigned practice round, rendered for a coaching-space view. */
export interface CoachingProgramMemberPracticeRoundView {
  contributorId: string;
  roundId: string;
  setupText: string;
  /** `null` until the assigned round's post-round feedback has been generated. */
  feedbackText: string | null;
}

/**
 * Composes a program's roster against a `contributorId` → `roundId`
 * assignment map and the full list of persisted practice rounds into one
 * rendered view per member with a resolvable assignment. Members outside
 * `program.memberIds`, members with no assignment, and assignments whose
 * `roundId` doesn't match any persisted record are all skipped rather than
 * throwing — this view only shows what can actually be resolved.
 */
export function buildCoachingProgramMemberPracticeRounds(
  program: CoachingProgramConfig,
  memberRoundIds: Record<string, string>,
  practiceRounds: PracticeRoundRecord[],
): CoachingProgramMemberPracticeRoundView[] {
  const recordsByRoundId = new Map(practiceRounds.map((record) => [record.roundId, record]));

  const views: CoachingProgramMemberPracticeRoundView[] = [];
  for (const contributorId of program.memberIds) {
    const roundId = memberRoundIds[contributorId];
    if (!roundId) continue;

    const record = recordsByRoundId.get(roundId);
    if (!record) continue;

    views.push({
      contributorId,
      roundId,
      setupText: buildPracticeRoundSetupText(record.setup),
      feedbackText: record.feedback ? buildPracticeRoundFeedbackText(record.feedback) : null,
    });
  }
  return views;
}
