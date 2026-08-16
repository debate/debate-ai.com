/**
 * @fileoverview Pure composition slice tying the "Progress Unlocks" and
 * "Research Task Routing" ideas under Research Crowdsourcing Organizer
 * Features in TODO.md together — both ideas' own follow-ups named this
 * exact gap: `progress-unlocks.ts` derives the `SkillLevel` a contributor
 * has unlocked from their leaderboard stats, but `research-task-routing.ts`'s
 * `ContributorAvailability.skillLevel` still required a caller-supplied
 * value with no wiring between the two. This module derives it instead:
 * `deriveContributorAvailability`/`deriveContributorAvailabilityList` build a
 * `ContributorAvailability` from a contributor's `contribution-leaderboard.ts`
 * `ContributorStats` via `progress-unlocks.ts`'s `buildContributorUnlockStatus`,
 * and `buildRoutingResultFromContributorStats` composes that straight into
 * `research-task-routing.ts`'s existing `buildTaskQueue`/`routeTasks`. Reuses
 * all three existing slices directly rather than introducing a separate
 * skill-derivation or routing path. This is the first slice only — task load
 * (`activeTaskCount`/`maxConcurrentTasks`) still isn't tracked anywhere in
 * this repo, so it remains caller-supplied; this only removes the need for a
 * caller-supplied `skillLevel`.
 *
 * @module lib/tiered-task-routing
 */

import type { ContributorStats } from "./contribution-leaderboard";
import {
  buildContributorUnlockStatus,
  DEFAULT_UNLOCK_TIER_REQUIREMENTS,
  type UnlockTierRequirement,
} from "./progress-unlocks";
import {
  buildTaskQueue,
  routeTasks,
  type ContributorAvailability,
  type RoutingResult,
} from "./research-task-routing";
import type { TopicCoverageReport } from "./topic-coverage";

/**
 * The task-load side of `ContributorAvailability` that this repo has no
 * source for yet (no persisted active-task tracking exists), so it stays
 * caller-supplied alongside the stats-derived `skillLevel`.
 */
export interface ContributorTaskLoad {
  contributorId: string;
  activeTaskCount: number;
  maxConcurrentTasks: number;
}

/**
 * Builds one contributor's `ContributorAvailability` by deriving their
 * `skillLevel` from their leaderboard stats (via `progress-unlocks.ts`'s
 * unlock-tier logic) instead of a caller-supplied value. Throws if `stats`
 * and `load` don't refer to the same contributor, since silently pairing
 * mismatched ids would misroute tasks.
 */
export function deriveContributorAvailability(
  stats: ContributorStats,
  load: ContributorTaskLoad,
  requirements: UnlockTierRequirement[] = DEFAULT_UNLOCK_TIER_REQUIREMENTS,
): ContributorAvailability {
  if (stats.contributorId !== load.contributorId) {
    throw new Error(
      `deriveContributorAvailability: stats contributorId "${stats.contributorId}" does not match load contributorId "${load.contributorId}"`,
    );
  }

  const status = buildContributorUnlockStatus(stats, requirements);
  return {
    contributorId: stats.contributorId,
    skillLevel: status.unlockedSkillLevel,
    activeTaskCount: load.activeTaskCount,
    maxConcurrentTasks: load.maxConcurrentTasks,
  };
}

/**
 * Derives `ContributorAvailability` for every contributor present in both
 * `statsList` and `loads`. A contributor with stats but no matching load
 * entry is skipped rather than guessed at — there's no sensible default for
 * `maxConcurrentTasks`.
 */
export function deriveContributorAvailabilityList(
  statsList: ContributorStats[],
  loads: ContributorTaskLoad[],
  requirements: UnlockTierRequirement[] = DEFAULT_UNLOCK_TIER_REQUIREMENTS,
): ContributorAvailability[] {
  const loadById = new Map(loads.map((load) => [load.contributorId, load]));
  const availability: ContributorAvailability[] = [];

  for (const stats of statsList) {
    const load = loadById.get(stats.contributorId);
    if (!load) continue;
    availability.push(deriveContributorAvailability(stats, load, requirements));
  }

  return availability;
}

/**
 * Convenience wrapper: builds the task queue from a coverage report and
 * routes it to contributors whose `skillLevel` is derived from their
 * leaderboard stats, rather than requiring a caller-supplied skill level for
 * every contributor.
 */
export function buildRoutingResultFromContributorStats(
  report: TopicCoverageReport,
  statsList: ContributorStats[],
  loads: ContributorTaskLoad[],
  requirements: UnlockTierRequirement[] = DEFAULT_UNLOCK_TIER_REQUIREMENTS,
): RoutingResult {
  const tasks = buildTaskQueue(report);
  const contributors = deriveContributorAvailabilityList(statsList, loads, requirements);
  return routeTasks(tasks, contributors);
}
