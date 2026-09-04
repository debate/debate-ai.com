/**
 * @fileoverview Composes one coaching program's roster analytics entirely
 * from real, persisted state — the persistence half of idea #13's
 * ("Coaching Programs and Group Challenges") own follow-up in TODO.md: "A
 * coach-facing roster analytics dashboard (completion rates, streaks,
 * standings in one place)." Mirrors `debate-team-collaboration`'s own
 * `state/persistedCoachingProgramBoard.ts` "compose every input from its own
 * store" convention and this package's `dailyMissionResults.ts`
 * `buildPersistedContributorQuestStreak` "compose the pure function directly
 * against the persisted store" convention.
 *
 * @module state/coachingProgramRosterAnalytics
 */

import { getCoachingProgram } from "debate-team-collaboration/src/state/coachingPrograms";
import { buildPersistedGroupChallengeBoard } from "debate-team-collaboration/src/state/challengeWinEvents";
import { getUtcDayKey } from "debate-research-evidence/src/lib/daily-best-card";
import {
  buildCoachingProgramRosterAnalytics,
  type CoachingProgramRosterMemberAnalytics,
} from "../lib/coaching-program-roster-analytics";
import { listDailyMissionResultsForContributor } from "./dailyMissionResults";

/**
 * Builds one coaching program's roster analytics directly from persisted
 * state: its saved config (`debate-team-collaboration`'s
 * `state/coachingPrograms.ts`, for the roster), the persisted group-challenge
 * board (`debate-team-collaboration`'s `state/challengeWinEvents.ts`'s
 * `buildPersistedGroupChallengeBoard`), and each member's own persisted
 * daily-mission-result history (`state/dailyMissionResults.ts`). Returns
 * `undefined` if no program is stored under `programId`, mirroring
 * `buildPersistedCoachingProgramBoard`'s identical convention, rather than
 * throwing.
 */
export function buildPersistedCoachingProgramRosterAnalytics(
  programId: string,
  now: number,
): CoachingProgramRosterMemberAnalytics[] | undefined {
  const program = getCoachingProgram(programId);
  if (!program) return undefined;

  const challengeBoard = buildPersistedGroupChallengeBoard(now);
  return buildCoachingProgramRosterAnalytics(
    program.memberIds,
    challengeBoard,
    listDailyMissionResultsForContributor,
    getUtcDayKey(now),
  );
}
