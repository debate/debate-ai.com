/**
 * @fileoverview Feeds a contributor's completed *assigned* research-task
 * count (from the "Research Progress Tracking" idea's `lib/research-progress.ts`
 * topic-progress tracking) back into `progress-unlocks.ts`'s tier
 * computation — the follow-up named in TODO.md under both "Research
 * Progress Tracking" ("(c) feeding a contributor's topic-progress history
 * back into `progress-unlocks.ts`'s tier computation") and "Progress
 * Unlocks" ("(a) persisting a contributor's tier/badges" — this closes the
 * companion gap of what feeds the tier itself). Mirrors `progress-unlocks.ts`'s
 * own shape (a `UnlockTierRequirement`-like search, ordered most to least
 * demanding) rather than reimplementing tier/badge/skill-level logic —
 * `computeContributorTierWithProgress` adds one more gate
 * (`minCompletedTaskCount`) on top of the existing volume/quality
 * thresholds, and `getUnlockedSkillLevel`/`getUnlockedBadges` are reused
 * directly from `progress-unlocks.ts` unchanged.
 *
 * A contributor now needs to have actually *finished* research tasks routed
 * to them — not just racked up contribution volume/quality — to reach
 * `veteran`/`expert`. `novice`/`apprentice` require zero completed tasks by
 * default, so a brand-new contributor's early progression is unaffected;
 * only the higher tiers gate on follow-through.
 *
 * This module works entirely off a caller-supplied `ContributorStats` and
 * completed-task count — it doesn't itself read persisted state. See
 * `lib/unlock-streak-status.ts`'s `buildContributorUnlockStatusWithStreakFromStore`
 * for the composition that derives both from the persisted
 * `state/contributions.ts`/`state/researchProgress.ts` stores.
 *
 * @module lib/unlock-progress-status
 */

import type { ContributorStats } from "./contribution-leaderboard";
import {
  DEFAULT_UNLOCK_TIER_REQUIREMENTS,
  getUnlockedBadges,
  getUnlockedSkillLevel,
  type UnlockTier,
  type UnlockTierRequirement,
} from "./progress-unlocks";
import type { SkillLevel } from "./research-task-routing";

const TIER_ORDER: UnlockTier[] = ["novice", "apprentice", "veteran", "expert"];

/**
 * A `progress-unlocks.ts` tier requirement extended with the minimum
 * *completed* research-task count a contributor also needs to reach that
 * tier.
 */
export interface ProgressAwareUnlockTierRequirement extends UnlockTierRequirement {
  minCompletedTaskCount: number;
}

/**
 * The same volume/quality thresholds as `DEFAULT_UNLOCK_TIER_REQUIREMENTS`,
 * plus a completed-task-count gate for the two higher tiers: `veteran`
 * requires 5 completed tasks, `expert` requires 15. `novice`/`apprentice`
 * require none.
 */
export const DEFAULT_PROGRESS_AWARE_UNLOCK_TIER_REQUIREMENTS: ProgressAwareUnlockTierRequirement[] =
  DEFAULT_UNLOCK_TIER_REQUIREMENTS.map((requirement) => ({
    ...requirement,
    minCompletedTaskCount: requirement.tier === "veteran" ? 5 : requirement.tier === "expert" ? 15 : 0,
  }));

/**
 * Finds the highest tier a contributor's stats *and* completed-task count
 * both satisfy. Mirrors `progress-unlocks.ts`'s `computeContributorTier`
 * search order (most to least demanding tier first) with the added
 * task-completion check; every contributor satisfies `novice` at minimum.
 */
export function computeContributorTierWithProgress(
  stats: ContributorStats,
  completedTaskCount: number,
  requirements: ProgressAwareUnlockTierRequirement[] = DEFAULT_PROGRESS_AWARE_UNLOCK_TIER_REQUIREMENTS,
): UnlockTier {
  const ordered = [...requirements].sort((a, b) => TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier));
  const met = ordered.find(
    (requirement) =>
      stats.contributionCount >= requirement.minContributionCount &&
      stats.totalHelpfulnessScore >= requirement.minTotalHelpfulnessScore &&
      completedTaskCount >= requirement.minCompletedTaskCount,
  );
  return met?.tier ?? "novice";
}

/** How much further a contributor needs to go to reach the next tier, including its task-completion gate. */
export interface NextTierProgressWithTasks {
  tier: UnlockTier;
  contributionsNeeded: number;
  helpfulnessScoreNeeded: number;
  tasksNeeded: number;
}

function getNextTierProgress(
  stats: ContributorStats,
  completedTaskCount: number,
  tier: UnlockTier,
  requirements: ProgressAwareUnlockTierRequirement[],
): NextTierProgressWithTasks | null {
  const currentIndex = TIER_ORDER.indexOf(tier);
  const nextTier = TIER_ORDER[currentIndex + 1];
  if (!nextTier) return null;

  const requirement = requirements.find((candidate) => candidate.tier === nextTier);
  if (!requirement) return null;

  return {
    tier: nextTier,
    contributionsNeeded: Math.max(0, requirement.minContributionCount - stats.contributionCount),
    helpfulnessScoreNeeded: Math.max(0, requirement.minTotalHelpfulnessScore - stats.totalHelpfulnessScore),
    tasksNeeded: Math.max(0, requirement.minCompletedTaskCount - completedTaskCount),
  };
}

/** A contributor's full unlock standing, gated by both contribution stats and completed-task history. */
export interface ContributorUnlockStatusWithProgress {
  contributorId: string;
  tier: UnlockTier;
  unlockedSkillLevel: SkillLevel;
  badges: string[];
  completedTaskCount: number;
  /** Progress toward the next tier, or `null` once a contributor has reached `expert`. */
  nextTier: NextTierProgressWithTasks | null;
}

/**
 * Builds a contributor's unlock status from their leaderboard stats and
 * completed-task count: the tier they've reached (gated by both), the
 * `SkillLevel` that tier grants, every badge earned so far, and how far
 * they are from the next tier.
 */
export function buildContributorUnlockStatusWithProgress(
  stats: ContributorStats,
  completedTaskCount: number,
  requirements: ProgressAwareUnlockTierRequirement[] = DEFAULT_PROGRESS_AWARE_UNLOCK_TIER_REQUIREMENTS,
): ContributorUnlockStatusWithProgress {
  const tier = computeContributorTierWithProgress(stats, completedTaskCount, requirements);
  return {
    contributorId: stats.contributorId,
    tier,
    unlockedSkillLevel: getUnlockedSkillLevel(tier),
    badges: getUnlockedBadges(tier),
    completedTaskCount,
    nextTier: getNextTierProgress(stats, completedTaskCount, tier, requirements),
  };
}

/** Renders a contributor's task-gated unlock status as a short human-readable line. */
export function buildUnlockStatusWithProgressText(status: ContributorUnlockStatusWithProgress): string {
  const badgeText = status.badges.length > 0 ? `, badges: ${status.badges.join(", ")}` : "";
  const nextTierText = status.nextTier
    ? ` (${status.nextTier.contributionsNeeded} contributions, ${status.nextTier.helpfulnessScoreNeeded} pts, and ${status.nextTier.tasksNeeded} completed tasks to ${status.nextTier.tier})`
    : "";

  return `${status.contributorId}: ${status.tier} tier — unlocked ${status.unlockedSkillLevel} tasks (${status.completedTaskCount} tasks completed)${badgeText}${nextTierText}`;
}
