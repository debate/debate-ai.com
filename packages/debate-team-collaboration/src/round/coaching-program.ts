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
 * `buildCoachingProgramRosterAnalytics`/`buildRosterAnalyticsText` close
 * idea #13's "(b) a coach-facing roster analytics dashboard (completion
 * rates, streaks, standings in one place)" follow-up — one row per roster
 * member, pulled straight off the already-composed board (task-completion
 * rate from `topicSprint.progressBoard`, per-challenge rank from
 * `challengeBoard.memberStandings`, drill/practice-round activity from
 * `memberDrills`/`memberPracticeRounds`). A member's quest streak is the one
 * piece this module can't compute itself — that tracking lives in
 * `debate-contributor-progress`, which already depends on this package, so
 * pulling it in here would create a cycle — hence `memberStreaks` on
 * `CoachingProgramBoard` stays a caller-supplied optional map, like
 * `memberPracticeRounds`, resolved by whichever app layer can see both
 * packages.
 *
 * @module round/coaching-program
 */

import type { Flow } from "debate-round/src/types/flow";
import {
  buildGroupChallengeBoard,
  buildGroupChallengeSummaryText,
  type ChallengeWinEvent,
  type GroupChallenge,
  type GroupChallengeProgress,
} from "../lib/group-challenges";
import {
  buildTopicSprint,
  buildTopicSprintSummaryText,
  type BuildTopicSprintInput,
  type TopicSprint,
} from "../lib/team-collaboration-mode";
import { buildDrillSet, buildDrillSummaryText, type Drill } from "debate-round/src/flow/drill-generator";
import {
  buildPracticeRoundFeedbackText,
  buildPracticeRoundSetupText,
  type PracticeRoundFeedback,
  type PracticeRoundSetup,
} from "debate-round/src/round/practice-round-simulator";

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

/**
 * A roster member's current/longest daily-quest-mission streak — the same
 * shape as `debate-contributor-progress`'s `gamified-quests.ts#StreakStatus`,
 * duplicated here as a plain structural type rather than imported, since
 * that package already depends on this one (importing it back would create
 * a cycle). Caller-supplied, like `CoachingProgramMemberPracticeRound`.
 */
export interface MemberQuestStreak {
  currentStreak: number;
  longestStreak: number;
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
  /** A member's quest streak, one per member who currently has one — see `MemberQuestStreak`. */
  memberStreaks?: Record<string, MemberQuestStreak>;
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
  /** Keyed by `contributorId`, only for members with a supplied quest streak. */
  memberStreaks: Record<string, MemberQuestStreak>;
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

  const memberStreaks: Record<string, MemberQuestStreak> = {};
  for (const [contributorId, streak] of Object.entries(input.memberStreaks ?? {})) {
    if (memberSet.has(contributorId)) memberStreaks[contributorId] = streak;
  }

  return { program: input.program, topicSprint, challengeBoard, memberDrills, memberPracticeRounds, memberStreaks };
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

/** One roster member's standing on one of this program's group challenges. */
export interface MemberChallengeStandingSummary {
  challengeId: string;
  challengeTitle: string;
  /** 1-based rank among that challenge's own ranked `memberStandings`, or `undefined` if this member has no matching activity on it yet. */
  rank?: number;
  matchingCount: number;
}

/** One roster member's row in the coach-facing roster analytics dashboard. */
export interface RosterAnalyticsRow {
  contributorId: string;
  /** From the topic sprint's `progressBoard` — `0` when the member has no tracked topic-sprint tasks yet. */
  completionRate: number;
  totalCompletedTasks: number;
  totalAssignedTasks: number;
  /** One entry per challenge on this program's `challengeBoard`, in the same order. */
  challengeStandings: MemberChallengeStandingSummary[];
  drillCount: number;
  hasPracticeRound: boolean;
  /** Absent when no streak was supplied for this member (see `CoachingProgramBoard.memberStreaks`). */
  streak?: MemberQuestStreak;
}

/**
 * Builds the coach-facing roster analytics dashboard for one program's board
 * — idea #13's "(b) a coach-facing roster analytics dashboard (completion
 * rates, streaks, standings in one place)" follow-up in TODO.md. One row per
 * roster member, in `program.memberIds` order: task-completion rate from the
 * topic sprint's `progressBoard`, per-challenge rank derived from
 * `challengeBoard`'s own ranked `memberStandings`, and drill/practice-round
 * activity from `memberDrills`/`memberPracticeRounds` — every input is
 * already composed onto the board, so this is pure aggregation over it, not
 * a new data source. `memberStreaks` folds in only for a member the caller
 * supplied one for.
 */
export function buildCoachingProgramRosterAnalytics(board: CoachingProgramBoard): RosterAnalyticsRow[] {
  return board.program.memberIds.map((contributorId): RosterAnalyticsRow => {
    const progress = board.topicSprint.progressBoard.find((entry) => entry.contributorId === contributorId);

    const challengeStandings: MemberChallengeStandingSummary[] = board.challengeBoard.map((challenge) => {
      const standingIndex = challenge.memberStandings.findIndex((s) => s.contributorId === contributorId);
      return {
        challengeId: challenge.challengeId,
        challengeTitle: challenge.title,
        rank: standingIndex === -1 ? undefined : standingIndex + 1,
        matchingCount: standingIndex === -1 ? 0 : challenge.memberStandings[standingIndex].matchingCount,
      };
    });

    return {
      contributorId,
      completionRate: progress?.overallCompletionRate ?? 0,
      totalCompletedTasks: progress?.totalCompletedTasks ?? 0,
      totalAssignedTasks: progress?.totalAssignedTasks ?? 0,
      challengeStandings,
      drillCount: board.memberDrills[contributorId]?.length ?? 0,
      hasPracticeRound: Boolean(board.memberPracticeRounds[contributorId]),
      streak: board.memberStreaks[contributorId],
    };
  });
}

/** Renders one roster analytics row as a single human-readable line. */
export function buildRosterAnalyticsRowText(row: RosterAnalyticsRow): string {
  const parts = [
    `${row.contributorId}: ${Math.round(row.completionRate * 100)}% task completion (${row.totalCompletedTasks}/${row.totalAssignedTasks})`,
  ];
  if (row.streak) {
    parts.push(`${row.streak.currentStreak}-day streak (longest ${row.streak.longestStreak})`);
  }
  parts.push(`${row.drillCount} drill${row.drillCount === 1 ? "" : "s"}`);
  parts.push(row.hasPracticeRound ? "practice round recorded" : "no practice round");
  for (const standing of row.challengeStandings) {
    parts.push(
      standing.rank
        ? `#${standing.rank} on "${standing.challengeTitle}" (${standing.matchingCount})`
        : `no activity on "${standing.challengeTitle}"`,
    );
  }
  return parts.join(" — ");
}

/**
 * Renders a program's full roster analytics dashboard as a plain-text block
 * — one line per member — the source text for a "Download roster analytics"
 * export, mirroring `buildCoachingProgramSummaryText`'s own reuse-the-slice's-
 * own-line convention.
 */
export function buildRosterAnalyticsText(board: CoachingProgramBoard): string {
  const rows = buildCoachingProgramRosterAnalytics(board);
  return [`${board.program.name} — roster analytics`, ...rows.map(buildRosterAnalyticsRowText)].join("\n");
}

/**
 * A filesystem-safe filename for a roster analytics download, e.g.
 * `roster-analytics-varsity-squad.txt` — same slugging rule as
 * `debate-round`'s `pre-round-briefing.ts#preRoundBriefingFilename`.
 */
export function rosterAnalyticsFilename(programId: string): string {
  const safeId = programId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `roster-analytics-${safeId || "program"}.txt`;
}
