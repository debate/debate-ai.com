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
 * exists via `state/memberRoundAssignments.ts` (resolved against a live
 * flow through `state/liveFlows.ts`), closing the remaining half of the
 * "(b-continued)" follow-up: `memberFlows` is composed from that mapping
 * whenever a caller doesn't supply its own, the same "compose every input
 * from its own store, but let a caller override" convention
 * `state/topicSprints.ts` already uses.
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
import { listMemberRoundAssignments } from "./memberRoundAssignments";
import { getLiveFlowByRoundId } from "./liveFlows";

/**
 * Resolves a coaching program's persisted round assignments
 * (`state/memberRoundAssignments.ts`) against the live flow editor's own
 * storage (`state/liveFlows.ts`) into `buildCoachingProgramBoard`'s
 * `memberFlows` input. An assignment whose `roundId` doesn't resolve to a
 * stored flow (never flowed, or since deleted) is skipped rather than
 * producing a broken drill set.
 */
export function buildMemberFlowsFromAssignments(programId: string): CoachingProgramMemberFlow[] {
  const memberFlows: CoachingProgramMemberFlow[] = [];
  for (const assignment of listMemberRoundAssignments(programId)) {
    const flow = getLiveFlowByRoundId(assignment.roundId);
    if (!flow) continue;
    memberFlows.push({ contributorId: assignment.contributorId, flow, sideKey: assignment.sideKey });
  }
  return memberFlows;
}

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
 * than throwing. `memberFlows` defaults to `buildMemberFlowsFromAssignments`'s
 * composition of this program's persisted round assignments — pass an
 * explicit list (even `[]`) to override it.
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
    memberFlows: memberFlows ?? buildMemberFlowsFromAssignments(programId),
  });
}
