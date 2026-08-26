/**
 * @fileoverview Pure group-challenge progress tracking for the "friendly
 * challenges" half of the "Coaching Programs and Group Challenges" idea in
 * TODO.md ("friendly challenges such as completing a set of blocks or
 * winning a rebuttal exercise"). Given a caller-supplied squad roster, a
 * challenge window, and either contributions or win events, computes squad
 * progress toward the challenge's goal and a per-member standing. Reuses the
 * existing `daily-quests.ts` `QuestTarget` matching and
 * `contribution-leaderboard.ts` helpfulness-ranked leaderboard directly
 * rather than introducing a separate matching or scoring path. This is the
 * first slice only — it doesn't model coaching "spaces"/rosters, assigned
 * drills, research-sprint wiring, or a practice-round composition (the rest
 * of idea #13), persist a challenge or its progress, notify the squad when a
 * challenge completes, or render a challenge UI. See the follow-ups noted in
 * TODO.md.
 *
 * @module lib/group-challenges
 */

import { buildLeaderboard, type AttributedContribution } from "./contribution-leaderboard";
import { matchesQuestTarget, type QuestContribution, type QuestTarget } from "./daily-quests";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Reach `targetCount` matching contributions (e.g. cards filed under an argument block) to complete the goal. */
export interface ContributionTargetGoal {
  kind: "contribution_target";
  target: QuestTarget;
  targetCount: number;
}

/** Reach `targetCount` caller-recorded wins (e.g. rebuttal-exercise wins) to complete the goal. */
export interface WinTargetGoal {
  kind: "win_target";
  targetCount: number;
}

export type ChallengeGoal = ContributionTargetGoal | WinTargetGoal;

/** A single squad member's recorded win toward a `win_target` challenge. */
export interface ChallengeWinEvent {
  contributorId: string;
  /** When the win was recorded, as epoch milliseconds (UTC) — same convention as `daily-quests.ts`. */
  occurredAt: number;
}

/** A coach-created, squad-scoped friendly challenge. */
export interface GroupChallenge {
  id: string;
  title: string;
  goal: ChallengeGoal;
  /** The squad roster this challenge is scoped to — contributions/wins from anyone else don't count. */
  memberIds: string[];
  /** Challenge window start, inclusive, as epoch milliseconds (UTC). */
  startsAt: number;
  /** Challenge window end, exclusive, as epoch milliseconds (UTC). */
  endsAt: number;
}

/** One member's standing within a challenge, best first. */
export interface MemberChallengeStanding {
  contributorId: string;
  /** Raw count of this member's matching contributions or wins. */
  matchingCount: number;
  /** Sum of this member's blended helpfulness score across matching contributions — only set for `contribution_target` goals. */
  helpfulnessScore?: number;
}

/** One challenge's computed progress. */
export interface GroupChallengeProgress {
  challengeId: string;
  title: string;
  targetCount: number;
  completedCount: number;
  remainingCount: number;
  isComplete: boolean;
  /** True once `now` has reached the challenge's `endsAt`. */
  hasEnded: boolean;
  /** Whole days left until `endsAt`, floored at 0 (0 once the challenge has ended). */
  daysRemaining: number;
  /** Ranked member standings, best first — `contribution_target` goals rank by helpfulness score, `win_target` goals by raw win count. */
  memberStandings: MemberChallengeStanding[];
  /** The top-standing member's id, or `undefined` when nobody has any matching activity yet. */
  mvpContributorId?: string;
}

function daysRemaining(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / MS_PER_DAY));
}

function isWithinWindow(challenge: GroupChallenge, timestamp: number): boolean {
  return timestamp >= challenge.startsAt && timestamp < challenge.endsAt;
}

function buildContributionStandings(
  challenge: GroupChallenge,
  target: QuestTarget,
  contributions: QuestContribution[],
): { completedCount: number; memberStandings: MemberChallengeStanding[] } {
  const memberSet = new Set(challenge.memberIds);
  const matching: AttributedContribution[] = contributions.filter(
    (contribution) =>
      memberSet.has(contribution.contributorId) &&
      isWithinWindow(challenge, contribution.submittedAt) &&
      matchesQuestTarget(contribution, target),
  );

  const matchingCountByContributor = new Map<string, number>();
  for (const contribution of matching) {
    matchingCountByContributor.set(
      contribution.contributorId,
      (matchingCountByContributor.get(contribution.contributorId) ?? 0) + 1,
    );
  }

  const memberStandings = buildLeaderboard(matching).map((stats) => ({
    contributorId: stats.contributorId,
    matchingCount: matchingCountByContributor.get(stats.contributorId) ?? 0,
    helpfulnessScore: stats.totalHelpfulnessScore,
  }));

  return { completedCount: matching.length, memberStandings };
}

function buildWinStandings(
  challenge: GroupChallenge,
  winEvents: ChallengeWinEvent[],
): { completedCount: number; memberStandings: MemberChallengeStanding[] } {
  const memberSet = new Set(challenge.memberIds);
  const matching = winEvents.filter(
    (event) => memberSet.has(event.contributorId) && isWithinWindow(challenge, event.occurredAt),
  );

  const matchingCountByContributor = new Map<string, number>();
  for (const event of matching) {
    matchingCountByContributor.set(event.contributorId, (matchingCountByContributor.get(event.contributorId) ?? 0) + 1);
  }

  const memberStandings = Array.from(matchingCountByContributor.entries())
    .map(([contributorId, matchingCount]) => ({ contributorId, matchingCount }))
    .sort((a, b) => b.matchingCount - a.matchingCount || a.contributorId.localeCompare(b.contributorId));

  return { completedCount: matching.length, memberStandings };
}

/**
 * Computes one challenge's squad-wide progress and per-member standings from
 * caller-supplied contributions and win events (only the list matching the
 * challenge's goal kind is consulted). Standings for a `contribution_target`
 * goal are ranked by blended helpfulness score (via `buildLeaderboard`), not
 * raw count, so a member with fewer but higher-quality contributions can
 * still lead the challenge.
 */
export function computeGroupChallengeProgress(
  challenge: GroupChallenge,
  contributions: QuestContribution[],
  winEvents: ChallengeWinEvent[],
  now: number,
): GroupChallengeProgress {
  const { completedCount, memberStandings } =
    challenge.goal.kind === "contribution_target"
      ? buildContributionStandings(challenge, challenge.goal.target, contributions)
      : buildWinStandings(challenge, winEvents);

  return {
    challengeId: challenge.id,
    title: challenge.title,
    targetCount: challenge.goal.targetCount,
    completedCount,
    remainingCount: Math.max(0, challenge.goal.targetCount - completedCount),
    isComplete: completedCount >= challenge.goal.targetCount,
    hasEnded: now >= challenge.endsAt,
    daysRemaining: daysRemaining(challenge.endsAt, now),
    memberStandings,
    mvpContributorId: memberStandings[0]?.contributorId,
  };
}

/**
 * Builds progress for every challenge, incomplete challenges first, tie-broken
 * by `id` for a stable, deterministic order — mirrors `daily-quests.ts`'s
 * `buildDailyQuestBoard` ordering convention.
 */
export function buildGroupChallengeBoard(
  challenges: GroupChallenge[],
  contributions: QuestContribution[],
  winEvents: ChallengeWinEvent[],
  now: number,
): GroupChallengeProgress[] {
  return challenges
    .map((challenge) => computeGroupChallengeProgress(challenge, contributions, winEvents, now))
    .sort((a, b) => Number(a.isComplete) - Number(b.isComplete) || a.challengeId.localeCompare(b.challengeId));
}

/** Renders a short status line for a challenge card or board. */
export function buildGroupChallengeSummaryText(progress: GroupChallengeProgress): string {
  if (progress.isComplete) {
    return `"${progress.title}" complete! (${progress.completedCount}/${progress.targetCount})`;
  }
  if (progress.hasEnded) {
    return `"${progress.title}" ended at ${progress.completedCount}/${progress.targetCount} — not completed`;
  }
  const dayLabel = progress.daysRemaining === 1 ? "1 day" : `${progress.daysRemaining} days`;
  return `"${progress.title}": ${progress.completedCount}/${progress.targetCount} — ${dayLabel} left`;
}

/**
 * The timestamp a challenge's goal was first satisfied — when its
 * `targetCount`-th matching contribution or win event landed — or `null` if
 * it hasn't been reached yet. Purely derived from the same inputs
 * `computeGroupChallengeProgress` already scores, so a challenge's
 * completion moment never needs a separately persisted "completed at"
 * field: replaying the same contributions/win events always yields the same
 * instant.
 */
export function computeChallengeCompletionTimestamp(
  challenge: GroupChallenge,
  contributions: QuestContribution[],
  winEvents: ChallengeWinEvent[],
): number | null {
  const memberSet = new Set(challenge.memberIds);
  const timestamps =
    challenge.goal.kind === "contribution_target"
      ? contributions
          .filter(
            (contribution) =>
              memberSet.has(contribution.contributorId) &&
              isWithinWindow(challenge, contribution.submittedAt) &&
              matchesQuestTarget(contribution, (challenge.goal as ContributionTargetGoal).target),
          )
          .map((contribution) => contribution.submittedAt)
      : winEvents
          .filter((event) => memberSet.has(event.contributorId) && isWithinWindow(challenge, event.occurredAt))
          .map((event) => event.occurredAt);

  if (timestamps.length < challenge.goal.targetCount) return null;
  return [...timestamps].sort((a, b) => a - b)[challenge.goal.targetCount - 1];
}

/**
 * Renders a short third-person announcement for a challenge that just
 * reached its goal, for a feed item — `buildGroupChallengeSummaryText`'s
 * complete-case line plus the MVP contributor, if any.
 */
export function buildChallengeCompletionAnnouncementText(
  progress: Pick<GroupChallengeProgress, "title" | "completedCount" | "targetCount" | "mvpContributorId">,
): string {
  const summary = `"${progress.title}" complete! (${progress.completedCount}/${progress.targetCount})`;
  return progress.mvpContributorId ? `${summary} — top contributor: ${progress.mvpContributorId}` : summary;
}
