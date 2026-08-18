/**
 * @fileoverview Pure tier/unlock logic for the "Progress Unlocks" idea under
 * Research Crowdsourcing Organizer Features in TODO.md ("Unlock harder
 * research tasks, advanced topics, and special badges as users contribute
 * more"). Builds directly on the existing "Contribution Leaderboard" slice
 * in `contribution-leaderboard.ts` — turns a contributor's already-aggregated
 * `ContributorStats` into an unlock tier, the `research-task-routing.ts`
 * `SkillLevel` that tier grants access to, and the badges earned along the
 * way. This is the first slice only — it works entirely off a
 * caller-supplied `ContributorStats`; it doesn't persist a contributor's
 * tier/badges, gate any actual UI or task list, or feed the derived
 * `SkillLevel` into `research-task-routing.ts`'s `ContributorAvailability`
 * itself. See the follow-ups noted in TODO.md.
 *
 * `minCompletedTaskCount`/`computeContributorTier`'s OR-path closes the
 * "Research Progress Tracking" idea's own follow-up (c), "feeding a
 * contributor's topic-progress history back into `progress-unlocks.ts`'s
 * tier computation": `ContributorStats.completedTaskCount` (already sourced
 * from real, persisted task-completion history by
 * `state/researchProgress.ts`'s `buildPersistedLeaderboardWithCompletedTasks`,
 * see `lib/unlock-streak-status.ts`) is now a genuine, alternate qualifying
 * signal here, not just a leaderboard column — a contributor can reach a
 * tier by clearing its completed-task threshold alone, even without
 * matching contribution volume/quality.
 *
 * @module lib/progress-unlocks
 */

import type { ContributorStats } from "./contribution-leaderboard";
import type { SkillLevel } from "./research-task-routing";

/** Unlock tiers a contributor progresses through, least to most experienced. */
export type UnlockTier = "novice" | "apprentice" | "veteran" | "expert";

const TIER_ORDER: UnlockTier[] = ["novice", "apprentice", "veteran", "expert"];

/**
 * Minimum contribution volume/quality, or completed-research-task count, a
 * contributor needs to reach a tier — see `computeContributorTier` for how
 * the two paths combine.
 */
export interface UnlockTierRequirement {
  tier: UnlockTier;
  minContributionCount: number;
  minTotalHelpfulnessScore: number;
  /** Completed `research-task-routing.ts` tasks needed to reach this tier via that path alone. */
  minCompletedTaskCount: number;
}

/**
 * A contributor reaches a tier once they clear both its volume
 * (`minContributionCount`) and quality (`minTotalHelpfulnessScore`)
 * thresholds, **or** its `minCompletedTaskCount` alone — completing routed
 * research tasks (`research-task-routing.ts` /
 * `docs/features/research-progress-tracking.md`) is real research
 * contribution in its own right, so a contributor who takes on and finishes
 * enough assigned tasks can unlock a tier even without matching scored-
 * contribution volume. Ordered least to most demanding.
 */
export const DEFAULT_UNLOCK_TIER_REQUIREMENTS: UnlockTierRequirement[] = [
  { tier: "novice", minContributionCount: 0, minTotalHelpfulnessScore: 0, minCompletedTaskCount: 0 },
  { tier: "apprentice", minContributionCount: 5, minTotalHelpfulnessScore: 25, minCompletedTaskCount: 3 },
  { tier: "veteran", minContributionCount: 15, minTotalHelpfulnessScore: 100, minCompletedTaskCount: 8 },
  { tier: "expert", minContributionCount: 30, minTotalHelpfulnessScore: 300, minCompletedTaskCount: 20 },
];

/** The `SkillLevel` a tier grants for taking on `research-task-routing.ts` tasks. */
const TIER_SKILL_LEVEL: Record<UnlockTier, SkillLevel> = {
  novice: "novice",
  apprentice: "novice",
  veteran: "intermediate",
  expert: "advanced",
};

/** The badge a contributor earns on first reaching a tier; `novice` earns none. */
const TIER_BADGE: Partial<Record<UnlockTier, string>> = {
  apprentice: "Rising Researcher",
  veteran: "Seasoned Contributor",
  expert: "Master Researcher",
};

/**
 * Finds the highest tier a contributor's stats satisfy. Requirements are
 * checked from most to least demanding so a contributor who clears a higher
 * tier's thresholds isn't stuck at a lower one; every contributor satisfies
 * `novice` at minimum. A tier is met via the contribution-count-and-score
 * path, via the completed-task-count path alone, or both.
 */
export function computeContributorTier(
  stats: ContributorStats,
  requirements: UnlockTierRequirement[] = DEFAULT_UNLOCK_TIER_REQUIREMENTS,
): UnlockTier {
  const ordered = [...requirements].sort((a, b) => TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier));
  const met = ordered.find(
    (requirement) =>
      (stats.contributionCount >= requirement.minContributionCount &&
        stats.totalHelpfulnessScore >= requirement.minTotalHelpfulnessScore) ||
      stats.completedTaskCount >= requirement.minCompletedTaskCount,
  );
  return met?.tier ?? "novice";
}

/** The `SkillLevel` a tier unlocks for `research-task-routing.ts` task eligibility. */
export function getUnlockedSkillLevel(tier: UnlockTier): SkillLevel {
  return TIER_SKILL_LEVEL[tier];
}

/** Every badge earned on the way to (and including) a tier, in the order they're first earned. */
export function getUnlockedBadges(tier: UnlockTier): string[] {
  const reachedIndex = TIER_ORDER.indexOf(tier);
  return TIER_ORDER.slice(0, reachedIndex + 1)
    .map((step) => TIER_BADGE[step])
    .filter((badge): badge is string => badge !== undefined);
}

/** How much further a contributor's stats need to go to reach the next tier, or `null` at the top tier. */
export interface NextTierProgress {
  tier: UnlockTier;
  contributionsNeeded: number;
  helpfulnessScoreNeeded: number;
  /** Completed research tasks still needed to reach the next tier via that path alone. */
  completedTasksNeeded: number;
}

function getNextTierProgress(
  stats: ContributorStats,
  tier: UnlockTier,
  requirements: UnlockTierRequirement[],
): NextTierProgress | null {
  const currentIndex = TIER_ORDER.indexOf(tier);
  const nextTier = TIER_ORDER[currentIndex + 1];
  if (!nextTier) return null;

  const requirement = requirements.find((candidate) => candidate.tier === nextTier);
  if (!requirement) return null;

  return {
    tier: nextTier,
    contributionsNeeded: Math.max(0, requirement.minContributionCount - stats.contributionCount),
    helpfulnessScoreNeeded: Math.max(0, requirement.minTotalHelpfulnessScore - stats.totalHelpfulnessScore),
    completedTasksNeeded: Math.max(0, requirement.minCompletedTaskCount - stats.completedTaskCount),
  };
}

/** A contributor's full unlock standing, derived from their leaderboard stats. */
export interface ContributorUnlockStatus {
  contributorId: string;
  tier: UnlockTier;
  unlockedSkillLevel: SkillLevel;
  badges: string[];
  /** Progress toward the next tier, or `null` once a contributor has reached `expert`. */
  nextTier: NextTierProgress | null;
  /** Completed research tasks counted toward `tier`, from the same `stats` this status was built from. */
  completedTaskCount: number;
}

/**
 * Builds a contributor's unlock status from their leaderboard stats: the
 * tier they've reached, the `SkillLevel` that tier grants, every badge
 * earned so far, and how far they are from the next tier.
 */
export function buildContributorUnlockStatus(
  stats: ContributorStats,
  requirements: UnlockTierRequirement[] = DEFAULT_UNLOCK_TIER_REQUIREMENTS,
): ContributorUnlockStatus {
  const tier = computeContributorTier(stats, requirements);
  return {
    contributorId: stats.contributorId,
    tier,
    unlockedSkillLevel: getUnlockedSkillLevel(tier),
    badges: getUnlockedBadges(tier),
    nextTier: getNextTierProgress(stats, tier, requirements),
    completedTaskCount: stats.completedTaskCount,
  };
}

/** Renders a contributor's unlock status as a short human-readable line for a profile/progress view. */
export function buildUnlockStatusText(status: ContributorUnlockStatus): string {
  const badgeText = status.badges.length > 0 ? `, badges: ${status.badges.join(", ")}` : "";
  const nextTierText = status.nextTier
    ? ` (${status.nextTier.contributionsNeeded} contributions and ${status.nextTier.helpfulnessScoreNeeded} pts, or ${status.nextTier.completedTasksNeeded} completed tasks, to ${status.nextTier.tier})`
    : "";

  return `${status.contributorId}: ${status.tier} tier — unlocked ${status.unlockedSkillLevel} tasks${badgeText}${nextTierText}`;
}
