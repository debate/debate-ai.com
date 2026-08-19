/**
 * @fileoverview Composes one coaching program's full `CoachingProgramBoard`
 * entirely from real, persisted state — the topic-sprint/challenge-board half
 * of the "(b-continued)" follow-up named under idea #13 ("Coaching Programs
 * and Group Challenges") in TODO.md: "wiring `CoachingProgramsPanel` (in
 * `debate-round`) to render a program's full `buildCoachingProgramBoard` off
 * this and the topic-sprint composition."
 *
 * `round/coaching-program.ts`'s `buildCoachingProgramBoard` already composes
 * a caller-supplied topic sprint, group-challenge roster/contributions/win
 * events, and per-member practice-round flows into one board. Every one of
 * those inputs except the member flows now has its own persisted store:
 * `debate-card-search`'s `state/topicSprints.ts` (topic sprint inputs),
 * `state/groupChallenges.ts` (the challenge roster), `state/contributions.ts`
 * (the contribution feed), and `state/challengeWinEvents.ts` (win events).
 * This module reads all four directly, mirroring `topicSprints.ts`'s own
 * "compose every input from its own store" convention, so a panel doesn't
 * need to assemble them itself.
 *
 * A `roundId`-to-contributor mapping for member practice-round flows now
 * exists too — `state/roundContributorFlows.ts`'s
 * `buildCoachingProgramMemberFlows` — so `memberFlows` defaults to that
 * store's roster-scoped resolution instead of an empty list, while staying
 * overridable by an explicit, caller-supplied list.
 *
 * @module state/persistedCoachingProgramBoard
 */

import { readPersistedTopicSprintInputs } from "debate-card-search/src/state/topicSprints";
import { listGroupChallenges } from "debate-card-search/src/state/groupChallenges";
import { listContributions } from "debate-card-search/src/state/contributions";
import { listChallengeWinEvents } from "debate-card-search/src/state/challengeWinEvents";
import type { AttributedContribution } from "debate-card-search/src/lib/contribution-leaderboard";
import type { QuestContribution } from "debate-card-search/src/lib/daily-quests";
import type { CoverageThresholds } from "debate-card-search/src/lib/topic-coverage";
import { buildCoachingProgramBoard, type CoachingProgramBoard, type CoachingProgramMemberFlow } from "../round/coaching-program";
import { getCoachingProgram } from "./coachingPrograms";
import { buildCoachingProgramMemberFlows } from "./roundContributorFlows";

/** Whether a persisted contribution carries the `submittedAt` timestamp `daily-quests.ts` needs to match it to a calendar day/window — mirrors `state/topicSprints.ts`'s identical guard. */
function hasSubmittedAt(
  contribution: AttributedContribution,
): contribution is AttributedContribution & { submittedAt: number } {
  return typeof (contribution as { submittedAt?: unknown }).submittedAt === "number";
}

/**
 * Builds one coaching program's full board directly from persisted state: its
 * saved config (`state/coachingPrograms.ts`), its topic sprint's inputs
 * (`debate-card-search`'s `state/topicSprints.ts`), the persisted group
 * challenge roster, the persisted contribution feed, and persisted win
 * events — composing all of them with `coaching-program.ts`'s
 * `buildCoachingProgramBoard` rather than requiring a caller to assemble
 * them. Returns `undefined` if no program is stored under `programId` rather
 * than throwing. `memberFlows` defaults to `roundContributorFlows.ts`'s
 * `buildCoachingProgramMemberFlows`, scoped to this program's roster, so a
 * roster member's currently recorded practice-round flow is picked up
 * automatically — pass an explicit list to override that lookup.
 */
export function buildPersistedCoachingProgramBoard(
  programId: string,
  topic: string,
  now: number,
  memberFlows?: CoachingProgramMemberFlow[],
  thresholds?: CoverageThresholds,
): CoachingProgramBoard | undefined {
  const program = getCoachingProgram(programId);
  if (!program) return undefined;

  const contributions = listContributions().filter(hasSubmittedAt) as QuestContribution[];

  return buildCoachingProgramBoard({
    program,
    topicSprint: { topic, now, ...readPersistedTopicSprintInputs(topic, thresholds) },
    challenges: listGroupChallenges(),
    contributions,
    winEvents: listChallengeWinEvents(),
    memberFlows: memberFlows ?? buildCoachingProgramMemberFlows(program.memberIds),
  });
}
