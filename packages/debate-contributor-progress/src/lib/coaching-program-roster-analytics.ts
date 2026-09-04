/**
 * @fileoverview Pure composition slice for idea #13's ("Coaching Programs
 * and Group Challenges") own follow-up in TODO.md: "A coach-facing roster
 * analytics dashboard (completion rates, streaks, standings in one place)."
 *
 * A coach today has to open `debate-team-collaboration`'s Group Challenges
 * panel to see a squad's challenge standings and this package's own Quest
 * Streaks panel to see a contributor's daily-quest streak — two separate
 * panel visits to answer "how is my roster doing?" This module composes
 * both signals, scoped to one coaching program's roster, into a single
 * ranked view. Reuses `debate-team-collaboration`'s `GroupChallengeProgress`
 * (already computed by `group-challenges.ts`) and this package's own
 * `gamified-quests.ts` `buildContributorQuestStreak` directly rather than
 * introducing a separate standings or streak computation — mirroring
 * `unlock-streak-status.ts`'s existing "tie two ideas' pure slices together"
 * precedent in this same package.
 *
 * This lives in `debate-contributor-progress` (package name `debate-community`)
 * rather than `debate-team-collaboration` because `debate-community` already
 * depends on `debate-team-collaboration` (for `daily-quests.ts`) — the
 * reverse dependency would be circular. This is the first slice only — it
 * works entirely off caller-supplied inputs; it doesn't persist anything or
 * render a UI. See `state/coachingProgramRosterAnalytics.ts` for the
 * persisted-store composition and `panels/CoachingProgramRosterAnalyticsPanel.tsx`
 * for the UI.
 *
 * @module lib/coaching-program-roster-analytics
 */

import type { GroupChallengeProgress } from "debate-team-collaboration/src/lib/group-challenges";
import {
  buildContributorQuestStreak,
  buildStreakSummaryText,
  DEFAULT_STREAK_MILESTONES,
  type ContributorQuestStreak,
  type DailyMissionResult,
  type StreakMilestone,
} from "./gamified-quests";

/** One roster member's standing across every group challenge they're scoped to, summed across the whole persisted challenge board. */
export interface RosterMemberChallengeStanding {
  /** How many persisted challenges this member's roster is scoped to (whether or not they have any matching activity yet). */
  challengesParticipated: number;
  /** How many of those challenges have reached their goal. */
  challengesCompleted: number;
  /** How many of those challenges this member is currently the top-standing (`mvpContributorId`) member of. */
  challengesLeading: number;
  /** Sum of this member's `matchingCount` across every challenge they're scoped to. */
  totalMatchingCount: number;
}

const EMPTY_CHALLENGE_STANDING: RosterMemberChallengeStanding = {
  challengesParticipated: 0,
  challengesCompleted: 0,
  challengesLeading: 0,
  totalMatchingCount: 0,
};

/**
 * Summarizes one contributor's standing across a full `GroupChallengeProgress[]`
 * board — every challenge whose roster includes them, whether or not they
 * have any matching contributions/wins recorded yet. A challenge the
 * contributor isn't scoped to (not in its `memberIds`, so absent from its
 * `memberStandings`) doesn't count toward `challengesParticipated`.
 */
export function summarizeMemberChallengeStanding(
  contributorId: string,
  challengeBoard: GroupChallengeProgress[],
): RosterMemberChallengeStanding {
  return challengeBoard.reduce((standing, progress) => {
    const memberStanding = progress.memberStandings.find((entry) => entry.contributorId === contributorId);
    if (!memberStanding) return standing;
    return {
      challengesParticipated: standing.challengesParticipated + 1,
      challengesCompleted: standing.challengesCompleted + (progress.isComplete ? 1 : 0),
      challengesLeading: standing.challengesLeading + (progress.mvpContributorId === contributorId ? 1 : 0),
      totalMatchingCount: standing.totalMatchingCount + memberStanding.matchingCount,
    };
  }, EMPTY_CHALLENGE_STANDING);
}

/** One coaching-program roster member's combined challenge standing and quest streak, in one place. */
export interface CoachingProgramRosterMemberAnalytics {
  contributorId: string;
  challengeStanding: RosterMemberChallengeStanding;
  questStreak: ContributorQuestStreak;
}

/**
 * Builds a coaching program roster's analytics: every member's challenge
 * standing (via `summarizeMemberChallengeStanding`) and quest streak (via
 * `gamified-quests.ts`'s `buildContributorQuestStreak`), one row per member.
 * `missionResultsForContributor` is a caller-supplied lookup rather than a
 * flat list so this stays a thin composition over whatever history source a
 * caller already has (a persisted store, or a test fixture) — mirrors
 * `unlock-streak-status.ts`'s `buildContributorUnlockStatusWithStreak`
 * "caller supplies the per-contributor history" convention.
 *
 * Sorted by total challenge-matching activity first (most active member
 * leads the roster view), then current streak length, then `contributorId`
 * for a stable, deterministic order when both are tied or zero.
 */
export function buildCoachingProgramRosterAnalytics(
  memberIds: string[],
  challengeBoard: GroupChallengeProgress[],
  missionResultsForContributor: (contributorId: string) => DailyMissionResult[],
  asOfDayKey: string,
  streakMilestones: StreakMilestone[] = DEFAULT_STREAK_MILESTONES,
): CoachingProgramRosterMemberAnalytics[] {
  return memberIds
    .map((contributorId) => ({
      contributorId,
      challengeStanding: summarizeMemberChallengeStanding(contributorId, challengeBoard),
      questStreak: buildContributorQuestStreak(
        contributorId,
        missionResultsForContributor(contributorId),
        asOfDayKey,
        streakMilestones,
      ),
    }))
    .sort(
      (a, b) =>
        b.challengeStanding.totalMatchingCount - a.challengeStanding.totalMatchingCount ||
        b.questStreak.streak.currentStreak - a.questStreak.streak.currentStreak ||
        a.contributorId.localeCompare(b.contributorId),
    );
}

/** Renders one roster member's combined analytics as a short human-readable line, for a coaching-space dashboard header. */
export function buildRosterMemberAnalyticsSummaryText(analytics: CoachingProgramRosterMemberAnalytics): string {
  const { challengeStanding } = analytics;
  const challengeText =
    challengeStanding.challengesParticipated === 0
      ? "no group challenges yet"
      : `${challengeStanding.challengesCompleted}/${challengeStanding.challengesParticipated} challenges completed` +
        (challengeStanding.challengesLeading > 0 ? `, leading ${challengeStanding.challengesLeading}` : "");

  return `${buildStreakSummaryText(analytics.questStreak)} — ${challengeText}`;
}
