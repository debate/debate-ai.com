/**
 * @fileoverview Pure composition slice tying the "Progress Unlocks" and
 * "Gamified Quests" ideas under Research Crowdsourcing Organizer Features in
 * TODO.md together — the "Progress Unlocks" idea's own follow-ups named this
 * exact gap: `progress-unlocks.ts` derives a contributor's tier badges from
 * their leaderboard stats, but nothing surfaced `gamified-quests.ts`'s
 * streak-earned badges alongside them. `buildContributorUnlockStatusWithStreak`
 * builds a contributor's `progress-unlocks.ts` `ContributorUnlockStatus` and
 * `gamified-quests.ts` `ContributorQuestStreak` from the same caller-supplied
 * inputs and merges both badge sets, mirroring the existing
 * `tiered-task-routing.ts` composition precedent. Reuses both existing
 * slices directly rather than introducing a separate tier or streak signal.
 * This is the first slice only — it works entirely off caller-supplied
 * `ContributorStats`/`DailyMissionResult`s; it doesn't persist a
 * contributor's tier/streak/badges or render a progress/unlock UI.
 *
 * @module lib/unlock-streak-status
 */

import type { ContributorStats } from "./contribution-leaderboard";
import {
  buildContributorQuestStreak,
  buildStreakSummaryText,
  DEFAULT_STREAK_MILESTONES,
  type DailyMissionResult,
  type StreakMilestone,
  type StreakStatus,
} from "./gamified-quests";
import {
  buildContributorUnlockStatus,
  buildUnlockStatusText,
  DEFAULT_UNLOCK_TIER_REQUIREMENTS,
  type ContributorUnlockStatus,
  type UnlockTierRequirement,
} from "./progress-unlocks";

/**
 * A contributor's unlock status extended with their streak standing.
 * `badges` (inherited from `ContributorUnlockStatus`) holds tier badges and
 * streak badges combined, tier badges first; `streakBadges` holds just the
 * streak-earned subset for a caller that wants to render them separately.
 */
export interface ContributorUnlockStatusWithStreak extends ContributorUnlockStatus {
  streak: StreakStatus;
  streakBadges: string[];
}

/**
 * Builds a contributor's unlock status (tier, unlocked skill level, tier
 * badges, next-tier progress) via `progress-unlocks.ts` and their streak
 * status (current/longest streak, streak badges) via `gamified-quests.ts`
 * from the same contributor, then merges both badge sets into one status.
 */
export function buildContributorUnlockStatusWithStreak(
  stats: ContributorStats,
  missionResults: DailyMissionResult[],
  asOfDayKey: string,
  tierRequirements: UnlockTierRequirement[] = DEFAULT_UNLOCK_TIER_REQUIREMENTS,
  streakMilestones: StreakMilestone[] = DEFAULT_STREAK_MILESTONES,
): ContributorUnlockStatusWithStreak {
  const unlockStatus = buildContributorUnlockStatus(stats, tierRequirements);
  const questStreak = buildContributorQuestStreak(stats.contributorId, missionResults, asOfDayKey, streakMilestones);

  return {
    ...unlockStatus,
    badges: [...unlockStatus.badges, ...questStreak.earnedBadges],
    streak: questStreak.streak,
    streakBadges: questStreak.earnedBadges,
  };
}

/**
 * Renders a contributor's combined unlock+streak status as a short
 * human-readable line for a profile/progress view, composing
 * `progress-unlocks.ts`'s `buildUnlockStatusText` (tier + all merged badges)
 * with `gamified-quests.ts`'s `buildStreakSummaryText` (streak length)
 * directly rather than reimplementing either.
 */
export function buildUnlockStatusWithStreakText(status: ContributorUnlockStatusWithStreak): string {
  const unlockText = buildUnlockStatusText(status);
  const streakText = buildStreakSummaryText({
    contributorId: status.contributorId,
    streak: status.streak,
    earnedBadges: status.streakBadges,
  });

  return [unlockText, streakText].join("\n");
}
