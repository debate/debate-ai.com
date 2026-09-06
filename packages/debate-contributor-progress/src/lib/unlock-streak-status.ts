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
 * it lists every contributor with at least one persisted contribution or
 * completed research task and builds each one's unlock+streak status via
 * `buildContributorUnlockStatusWithStreakFromStore`, giving a panel a single
 * call that renders the whole roster instead of requiring the caller to
 * already know every contributor id.
 *
 * `buildContributorUnlockStatusWithStreakFromStore`/`buildUnlockStatusRoster`
 * now source their `ContributorStats` from `state/researchProgress.ts`'s
 * `buildPersistedLeaderboardWithCompletedTasks` (instead of
 * `state/contributions.ts` alone), which closes the "Research Progress
 * Tracking" idea's own follow-up (c), "feeding a contributor's
 * topic-progress history back into `progress-unlocks.ts`'s tier
 * computation" — a contributor's real, persisted completed-task count is
 * now an alternate tier-qualifying signal (see `progress-unlocks.ts`'s
 * `minCompletedTaskCount`), and a contributor who has completed research
 * tasks but no scored contribution yet now appears in the roster too.
 *
 * @module lib/unlock-streak-status
 */

import type { ContributorStats } from "debate-research-evidence/src/lib/contribution-leaderboard";
import {
  applyStreakFreezes,
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
} from "debate-research-evidence/src/lib/progress-unlocks";
import { listDailyMissionResultsForContributor } from "../state/dailyMissionResults";
import { listStreakFreezeDayKeysForContributor } from "../state/streakFreezes";
import { buildPersistedLeaderboardWithCompletedTasks } from "debate-team-collaboration/src/state/researchProgress";

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
    completedTaskCount: 0,
  };
}

/**
 * Builds a contributor's combined unlock+streak status straight from
 * persisted state, instead of requiring the caller to hold and pass in a
 * `ContributorStats`/`DailyMissionResult[]` list themselves — mirroring the
 * existing `dailyMissionResults.ts` `buildPersistedContributorQuestStreak`
 * "compose the pure function directly against the persisted store"
 * convention. Sources `ContributorStats` from
 * `state/researchProgress.ts`'s `buildPersistedLeaderboardWithCompletedTasks`
 * rather than building it fresh from `state/contributions.ts` alone, so a
 * contributor's real completed-research-task count (not just their scored
 * contributions) feeds `progress-unlocks.ts`'s tier computation. A
 * contributor with neither persisted contributions nor completed tasks yet
 * gets an all-zero, `novice` status rather than a thrown error. Persisted
 * streak freezes are applied to the mission-result history
 * (`applyStreakFreezes`), so this roster's Streak column agrees with
 * `/cards/streaks`' own freeze-bridged view of the same contributor instead
 * of showing a shorter, unfrozen streak.
 */
export function buildContributorUnlockStatusWithStreakFromStore(
  contributorId: string,
  asOfDayKey: string,
  tierRequirements: UnlockTierRequirement[] = DEFAULT_UNLOCK_TIER_REQUIREMENTS,
  streakMilestones: StreakMilestone[] = DEFAULT_STREAK_MILESTONES,
): ContributorUnlockStatusWithStreak {
  const stats =
    buildPersistedLeaderboardWithCompletedTasks().find((row) => row.contributorId === contributorId) ??
    buildEmptyContributorStats(contributorId);
  const missionResults = applyStreakFreezes(
    listDailyMissionResultsForContributor(contributorId),
    listStreakFreezeDayKeysForContributor(contributorId),
  );

  return buildContributorUnlockStatusWithStreak(stats, missionResults, asOfDayKey, tierRequirements, streakMilestones);
}

/**
 * Builds the full contributor roster's unlock+streak status: every
 * contributor with at least one persisted contribution or completed
 * research task (via `state/researchProgress.ts`'s
 * `buildPersistedLeaderboardWithCompletedTasks`, which already unions both
 * signals — see its own "task-only contributor" case), each resolved
 * through `buildContributorUnlockStatusWithStreakFromStore`, sorted
 * alphabetically by `contributorId` for a stable, deterministic roster
 * order (unlike the Contribution Leaderboard, this view isn't ranked by
 * score). An empty store returns an empty roster rather than throwing.
 */
export function buildUnlockStatusRoster(
  asOfDayKey: string,
  tierRequirements: UnlockTierRequirement[] = DEFAULT_UNLOCK_TIER_REQUIREMENTS,
  streakMilestones: StreakMilestone[] = DEFAULT_STREAK_MILESTONES,
): ContributorUnlockStatusWithStreak[] {
  const contributorIds = buildPersistedLeaderboardWithCompletedTasks()
    .map((row) => row.contributorId)
    .sort();

  return contributorIds.map((contributorId) =>
    buildContributorUnlockStatusWithStreakFromStore(contributorId, asOfDayKey, tierRequirements, streakMilestones),
  );
}
