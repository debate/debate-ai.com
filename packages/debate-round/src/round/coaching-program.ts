/**
 * @fileoverview Coaching-program/space composition — the follow-up named in
 * the "Group Challenges" slice (PR #97) for idea #13 ("Coaching Programs and
 * Group Challenges") in TODO.md: "a coaching-program/space model that
 * composes this with `drill-generator.ts`'s `buildDrillSet`,
 * `team-collaboration-mode.ts`'s `buildTopicSprint`, and
 * `practice-round-simulator.ts`'s
 * `buildPracticeRoundSetup`/`buildPracticeRoundFeedback`." Ties a coach's
 * squad roster to its shared topic sprint (`debate-card-search`'s
 * `team-collaboration-mode.ts`), its friendly group challenges
 * (`debate-card-search`'s `group-challenges.ts`), and a practice-drill set
 * per member (this package's `flow/drill-generator.ts`) — reusing all three
 * directly rather than reimplementing any of their quest/challenge/drill
 * logic. `debate-round` now depends on `debate-card-search` to make this
 * composition possible, mirroring the existing precedent of
 * `pre-round-briefing.ts` depending on `debate-data-sync`/`debate-speech-writer`.
 * This is the first slice only — it works entirely off caller-supplied
 * inputs; it doesn't persist a program, its roster, or its board anywhere.
 * See the follow-ups noted in TODO.md.
 *
 * A later slice composes `practice-round-simulator.ts`'s
 * `PracticeRoundSetup`/`PracticeRoundFeedback` too, closing idea #13's
 * remaining "(c) wiring a member's practice-round setup/feedback (Practice
 * Round Simulator) into the space" follow-up — `memberPracticeRounds` is
 * optional and per-member/per-session (like `memberFlows`), rather than a
 * fixed part of every program's board.
 *
 * @module round/coaching-program
 */

import type { Flow } from "debate-core/src/types/flow";
import {
  buildGroupChallengeBoard,
  buildGroupChallengeSummaryText,
  type ChallengeWinEvent,
  type GroupChallenge,
  type GroupChallengeProgress,
} from "debate-card-search/src/lib/group-challenges";
import {
  buildTopicSprint,
  buildTopicSprintSummaryText,
  type BuildTopicSprintInput,
  type TopicSprint,
} from "debate-card-search/src/lib/team-collaboration-mode";
import { buildDrillSet, buildDrillSummaryText, type Drill } from "../flow/drill-generator";
import {
  buildPracticeRoundFeedbackText,
  buildPracticeRoundSetupText,
  type PracticeRoundFeedback,
  type PracticeRoundSetup,
} from "./practice-round-simulator";

/** A coach-created group coaching space, scoped to a squad roster. */
export interface CoachingProgramConfig {
  id: string;
  name: string;
  /** The squad roster this coaching space is scoped to. */
  memberIds: string[];
}

/** One member's already-flowed practice round, to be turned into a drill set for their side. */
export interface CoachingProgramMemberFlow {
  contributorId: string;
  flow: Pick<Flow, "children" | "columns">;
  sideKey: string;
}

/** One member's simulated Practice Round Simulator session — its setup, and feedback once generated. */
export interface CoachingProgramMemberPracticeRound {
  contributorId: string;
  setup: PracticeRoundSetup;
  /** Absent while the member's practice round is still in progress. */
  feedback?: PracticeRoundFeedback;
}

export interface BuildCoachingProgramBoardInput {
  program: CoachingProgramConfig;
  /** This program's shared topic sprint (research, quests, task routing, progress, and prep notes). */
  topicSprint: BuildTopicSprintInput;
  challenges: GroupChallenge[];
  contributions: BuildTopicSprintInput["contributions"];
  winEvents: ChallengeWinEvent[];
  /** A member's flowed practice round, one per member who currently has one — members without one get no drill set. */
  memberFlows: CoachingProgramMemberFlow[];
  /** A member's simulated Practice Round Simulator session, one per member who currently has one. */
  memberPracticeRounds?: CoachingProgramMemberPracticeRound[];
  drillOptions?: { collapseLimit?: number };
}

/** One coaching space's full board: shared topic sprint, group-challenge standings, and each member's drill set. */
export interface CoachingProgramBoard {
  program: CoachingProgramConfig;
  topicSprint: TopicSprint;
  challengeBoard: GroupChallengeProgress[];
  /** Keyed by `contributorId`, only for members with a supplied practice-round flow. */
  memberDrills: Record<string, Drill[]>;
  /** Keyed by `contributorId`, only for members with a supplied Practice Round Simulator session. */
  memberPracticeRounds: Record<string, CoachingProgramMemberPracticeRound>;
}

/**
 * Composes a coaching space's shared topic sprint (`team-collaboration-mode.ts`'s
 * `buildTopicSprint`), its friendly group-challenge standings
 * (`group-challenges.ts`'s `buildGroupChallengeBoard`), and a practice-drill
 * set per roster member who has a flowed practice round
 * (`drill-generator.ts`'s `buildDrillSet`) into one renderable board. Member
 * flows for contributors outside `program.memberIds` are ignored — this
 * program's board only reflects its own roster.
 */
export function buildCoachingProgramBoard(input: BuildCoachingProgramBoardInput): CoachingProgramBoard {
  const memberSet = new Set(input.program.memberIds);

  const topicSprint = buildTopicSprint(input.topicSprint);
  const challengeBoard = buildGroupChallengeBoard(
    input.challenges,
    input.contributions,
    input.winEvents,
    input.topicSprint.now,
  );

  const memberDrills: Record<string, Drill[]> = {};
  for (const memberFlow of input.memberFlows) {
    if (!memberSet.has(memberFlow.contributorId)) continue;
    memberDrills[memberFlow.contributorId] = buildDrillSet(
      memberFlow.flow,
      memberFlow.sideKey,
      input.drillOptions,
    );
  }

  const memberPracticeRounds: Record<string, CoachingProgramMemberPracticeRound> = {};
  for (const memberPracticeRound of input.memberPracticeRounds ?? []) {
    if (!memberSet.has(memberPracticeRound.contributorId)) continue;
    memberPracticeRounds[memberPracticeRound.contributorId] = memberPracticeRound;
  }

  return { program: input.program, topicSprint, challengeBoard, memberDrills, memberPracticeRounds };
}

/**
 * Renders a coaching space's board as a short, human-readable status block
 * for a coaching-space dashboard header — reusing each composed slice's own
 * summary line rather than introducing a separate rendering.
 */
export function buildCoachingProgramSummaryText(board: CoachingProgramBoard): string {
  const memberCount = board.program.memberIds.length;
  const drillCount = Object.keys(board.memberDrills).length;
  const practiceRoundCount = Object.keys(board.memberPracticeRounds).length;

  const lines = [
    `${board.program.name} coaching space (${memberCount} member${memberCount === 1 ? "" : "s"})`,
    buildTopicSprintSummaryText(board.topicSprint),
    ...board.challengeBoard.map(buildGroupChallengeSummaryText),
    drillCount === 0
      ? "No member drill sets yet"
      : `${drillCount} member drill set${drillCount === 1 ? "" : "s"} generated`,
    practiceRoundCount === 0
      ? "No member practice rounds recorded yet"
      : `${practiceRoundCount} member practice round${practiceRoundCount === 1 ? "" : "s"} recorded`,
  ];
  return lines.join("\n");
}

/** Renders one member's drill set, or a placeholder line when they have none yet. */
export function buildMemberDrillSummaryText(board: CoachingProgramBoard, contributorId: string): string {
  const drills = board.memberDrills[contributorId];
  if (!drills) return "No practice round flowed yet — no drills available.";
  return buildDrillSummaryText(drills);
}

/**
 * Renders one member's Practice Round Simulator session — its setup, plus
 * feedback once generated — or a placeholder line when they have none yet.
 */
export function buildMemberPracticeRoundSummaryText(board: CoachingProgramBoard, contributorId: string): string {
  const practiceRound = board.memberPracticeRounds[contributorId];
  if (!practiceRound) return "No practice round session recorded yet.";
  const sections = [buildPracticeRoundSetupText(practiceRound.setup)];
  if (practiceRound.feedback) sections.push(buildPracticeRoundFeedbackText(practiceRound.feedback));
  return sections.join("\n\n");
}
