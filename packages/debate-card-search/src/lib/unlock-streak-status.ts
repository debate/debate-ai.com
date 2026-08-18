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
 * `buildContributorUnlockStatusWithStreakFromStore` is a second, thin slice
 * that closes the "Progress Unlocks" bullet's own follow-up (a),
 * "persisting a contributor's tier/badges", in TODO.md: rather than
 * introducing a separate tier/badge store, it derives a contributor's status
 * live from the already-persisted `state/contributions.ts`/
 * `state/dailyMissionResults.ts` stores, mirroring the existing
 * `dailyMissionResults.ts` `buildPersistedContributorQuestStreak` and
 * `prep-room.ts` `buildPrepRoomFromStore` "compose the pure function
 * directly against the persisted store" convention. A contributor with no
 * persisted contributions yet gets a `novice` status rather than the
 * `buildContributorStats` empty-contributions error, since a brand-new
 * contributor having no unlock status yet is an expected state, not a bug.
 *
 * `buildUnlockStatusRoster` is a third slice that closes the "Progress
 * Unlocks" bullet's own follow-up (b), "a progress/unlock UI", in TODO.md —
 * it lists every contributor with at least one persisted contribution (via
 * `state/contributions.ts`'s `listContributions`) and builds each one's
 * unlock+streak status via `buildContributorUnlockStatusWithStreakFromStore`,
 * giving a panel a single call that renders the whole roster instead of
 * requiring the caller to already know every contributor id.
 *
 * A fourth slice closes "Research Progress Tracking"'s own follow-up (c),
 * "feeding a contributor's topic-progress history back into
 * `progress-unlocks.ts`'s tier computation" — tier is now derived via
 * `lib/unlock-progress-status.ts`'s `buildContributorUnlockStatusWithProgress`
 * instead of `progress-unlocks.ts`'s plain `buildContributorUnlockStatus`,
 * so a contributor's *completed* research-task count (from
 * `state/researchProgress.ts`'s persisted board) now gates `veteran`/`expert`
 * alongside contribution volume/quality. `completedTaskCount` defaults to 0
 * so existing callers of the pure `buildContributorUnlockStatusWithStreak`
 * are unaffected unless they opt in.
 *
 * @module lib/unlock-streak-status
 */

import { buildContributorStats, groupContributionsByContributor, type ContributorStats } from "./contribution-leaderboard";
import {
  buildContributorQuestStreak,
  buildStreakSummaryText,
  DEFAULT_STREAK_MILESTONES,
  type DailyMissionResult,
  type StreakMilestone,
  type StreakStatus,
} from "./gamified-quests";
import {
  buildContributorUnlockStatusWithProgress,
  buildUnlockStatusWithProgressText,
  DEFAULT_PROGRESS_AWARE_UNLOCK_TIER_REQUIREMENTS,
  type ContributorUnlockStatusWithProgress,
  type ProgressAwareUnlockTierRequirement,
} from "./unlock-progress-status";
import { listContributions, listContributionsByContributor } from "../state/contributions";
import { listDailyMissionResultsForContributor } from "../state/dailyMissionResults";
import { getPersistedContributorProgress } from "../state/researchProgress";

/**
 * A contributor's unlock status extended with their streak standing.
 * `badges` (inherited from `ContributorUnlockStatusWithProgress`) holds tier
 * badges and streak badges combined, tier badges first; `streakBadges` holds
 * just the streak-earned subset for a caller that wants to render them
 * separately.
 */
export interface ContributorUnlockStatusWithStreak extends ContributorUnlockStatusWithProgress {
  streak: StreakStatus;
  streakBadges: string[];
}

/**
 * Builds a contributor's unlock status (tier — gated by both contribution
 * stats and completed-task count, via `unlock-progress-status.ts` — unlocked
 * skill level, tier badges, next-tier progress) and their streak status
 * (current/longest streak, streak badges) via `gamified-quests.ts` from the
 * same contributor, then merges both badge sets into one status.
 * `completedTaskCount` defaults to 0 (no task-completion history) so
 * existing callers are unaffected unless they opt in.
 */
export function buildContributorUnlockStatusWithStreak(
  stats: ContributorStats,
  missionResults: DailyMissionResult[],
  asOfDayKey: string,
  completedTaskCount = 0,
  tierRequirements: ProgressAwareUnlockTierRequirement[] = DEFAULT_PROGRESS_AWARE_UNLOCK_TIER_REQUIREMENTS,
  streakMilestones: StreakMilestone[] = DEFAULT_STREAK_MILESTONES,
): ContributorUnlockStatusWithStreak {
  const unlockStatus = buildContributorUnlockStatusWithProgress(stats, completedTaskCount, tierRequirements);
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
 * `unlock-progress-status.ts`'s `buildUnlockStatusWithProgressText` (tier +
 * completed-task count + all merged badges) with `gamified-quests.ts`'s
 * `buildStreakSummaryText` (streak length) directly rather than
 * reimplementing either.
 */
export function buildUnlockStatusWithStreakText(status: ContributorUnlockStatusWithStreak): string {
  const unlockText = buildUnlockStatusWithProgressText(status);
  const streakText = buildStreakSummaryText({
    contributorId: status.contributorId,
    streak: status.streak,
    earnedBadges: status.streakBadges,
  });

  return [unlockText, streakText].join("\n");
}

/**
 * A contributor with no persisted contributions yet has no scored activity
 * for `buildContributorStats` to aggregate (it throws on an empty list), but
 * they still have a well-defined `novice` status — every `DEFAULT_UNLOCK_TIER_REQUIREMENTS`
 * tier requires at least 0 contributions and 0 score, so this all-zero stats
 * object always resolves to `novice`.
 */
function buildEmptyContributorStats(contributorId: string): ContributorStats {
  return {
    contributorId,
    contributionCount: 0,
    totalHelpfulnessScore: 0,
    averageHelpfulnessScore: 0,
    bestContributionId: "",
    bestHelpfulnessScore: 0,
    popularityOnlyOutlierCount: 0,
  };
}

/**
 * Builds a contributor's combined unlock+streak status straight from the
 * persisted `state/contributions.ts`/`state/dailyMissionResults.ts`/
 * `state/researchProgress.ts` stores, instead of requiring the caller to
 * hold and pass in a `ContributorStats`/`DailyMissionResult[]`/completed-task
 * count themselves — mirroring the existing `dailyMissionResults.ts`
 * `buildPersistedContributorQuestStreak` "compose the pure function directly
 * against the persisted store" convention. A contributor with no persisted
 * contributions yet gets an all-zero, `novice` status rather than a thrown
 * error.
 */
export function buildContributorUnlockStatusWithStreakFromStore(
  contributorId: string,
  asOfDayKey: string,
  tierRequirements: ProgressAwareUnlockTierRequirement[] = DEFAULT_PROGRESS_AWARE_UNLOCK_TIER_REQUIREMENTS,
  streakMilestones: StreakMilestone[] = DEFAULT_STREAK_MILESTONES,
): ContributorUnlockStatusWithStreak {
  const contributions = listContributionsByContributor(contributorId);
  const stats =
    contributions.length === 0 ? buildEmptyContributorStats(contributorId) : buildContributorStats(contributorId, contributions);
  const missionResults = listDailyMissionResultsForContributor(contributorId);
  const completedTaskCount = getPersistedContributorProgress(contributorId).totalCompletedTasks;

  return buildContributorUnlockStatusWithStreak(
    stats,
    missionResults,
    asOfDayKey,
    completedTaskCount,
    tierRequirements,
    streakMilestones,
  );
}

/**
 * Builds the full contributor roster's unlock+streak status: every
 * contributor with at least one persisted contribution (via
 * `state/contributions.ts`'s `listContributions`/`groupContributionsByContributor`),
 * each resolved through `buildContributorUnlockStatusWithStreakFromStore`,
 * sorted alphabetically by `contributorId` for a stable, deterministic
 * roster order (unlike the Contribution Leaderboard, this view isn't ranked
 * by score). An empty store returns an empty roster rather than throwing.
 */
export function buildUnlockStatusRoster(
  asOfDayKey: string,
  tierRequirements: ProgressAwareUnlockTierRequirement[] = DEFAULT_PROGRESS_AWARE_UNLOCK_TIER_REQUIREMENTS,
  streakMilestones: StreakMilestone[] = DEFAULT_STREAK_MILESTONES,
): ContributorUnlockStatusWithStreak[] {
  const contributorIds = [...groupContributionsByContributor(listContributions()).keys()].sort();

  return contributorIds.map((contributorId) =>
    buildContributorUnlockStatusWithStreakFromStore(contributorId, asOfDayKey, tierRequirements, streakMilestones),
  );
}
