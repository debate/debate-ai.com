/**
 * @fileoverview Pure per-contributor leaderboard aggregation for the
 * "Contribution Leaderboard" idea under Research Crowdsourcing Organizer
 * Features in TODO.md ("Track who has submitted the most useful research,
 * highest-rated cards, and most completed tasks"). Builds directly on the
 * idea #11 helpfulness-scoring slice in `community-rating.ts` — attributes
 * each scored `CommunityContribution` to a `contributorId` and aggregates
 * per-contributor totals, averages, and outlier counts into a ranked
 * leaderboard. This is the first slice only — it works entirely off
 * already-collected contributions passed in by the caller; it doesn't track
 * "completed tasks" (no task system exists in this repo today), persist
 * standings, or render a leaderboard UI. See the follow-ups noted in
 * TODO.md.
 *
 * @module lib/contribution-leaderboard
 */

import {
  DEFAULT_HELPFULNESS_WEIGHTS,
  computeHelpfulnessBreakdown,
  type CommunityContribution,
  type HelpfulnessWeights,
} from "./community-rating";

/** A community contribution attributed to the contributor who submitted it. */
export interface AttributedContribution extends CommunityContribution {
  contributorId: string;
  /** Submission time, as epoch milliseconds (UTC) — same convention as `daily-best-card.ts`/`daily-quests.ts`. Optional: contributions saved before this field existed, or by callers that don't need day-scoping, omit it. */
  submittedAt?: number;
  /** Argument block this contribution supports, matching `topic-coverage.ts`'s `argBlock` tagging. Optional: not every contribution is tied to a tracked argument. */
  argBlock?: string;
}

/** One contributor's aggregated leaderboard standing. */
export interface ContributorStats {
  contributorId: string;
  /** Number of contributions scored for this contributor. */
  contributionCount: number;
  /** Sum of every contribution's blended helpfulness score. */
  totalHelpfulnessScore: number;
  /** `totalHelpfulnessScore` divided by `contributionCount`. */
  averageHelpfulnessScore: number;
  /** Id of the contributor's single highest-scoring contribution. */
  bestContributionId: string;
  /** That contribution's helpfulness score. */
  bestHelpfulnessScore: number;
  /** Count of this contributor's contributions flagged as popularity-only outliers. */
  popularityOnlyOutlierCount: number;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Groups attributed contributions by `contributorId`, preserving each
 * group's original relative order.
 */
export function groupContributionsByContributor(
  contributions: AttributedContribution[],
): Map<string, AttributedContribution[]> {
  const byContributor = new Map<string, AttributedContribution[]>();
  for (const contribution of contributions) {
    const group = byContributor.get(contribution.contributorId);
    if (group) {
      group.push(contribution);
    } else {
      byContributor.set(contribution.contributorId, [contribution]);
    }
  }
  return byContributor;
}

/**
 * Aggregates one contributor's contributions into their leaderboard stats.
 * Throws if `contributions` is empty — callers should skip contributors with
 * no scored contributions rather than producing an empty-average entry.
 */
export function buildContributorStats(
  contributorId: string,
  contributions: CommunityContribution[],
  weights: HelpfulnessWeights = DEFAULT_HELPFULNESS_WEIGHTS,
): ContributorStats {
  if (contributions.length === 0) {
    throw new Error(`buildContributorStats: contributor "${contributorId}" has no contributions`);
  }

  const breakdowns = contributions.map((contribution) => computeHelpfulnessBreakdown(contribution, weights));
  const totalHelpfulnessScore = round1(breakdowns.reduce((sum, breakdown) => sum + breakdown.helpfulnessScore, 0));
  const best = breakdowns.reduce((top, breakdown) =>
    breakdown.helpfulnessScore > top.helpfulnessScore ||
    (breakdown.helpfulnessScore === top.helpfulnessScore && breakdown.contributionId.localeCompare(top.contributionId) < 0)
      ? breakdown
      : top,
  );

  return {
    contributorId,
    contributionCount: contributions.length,
    totalHelpfulnessScore,
    averageHelpfulnessScore: round1(totalHelpfulnessScore / contributions.length),
    bestContributionId: best.contributionId,
    bestHelpfulnessScore: best.helpfulnessScore,
    popularityOnlyOutlierCount: breakdowns.filter((breakdown) => breakdown.isPopularityOnlyOutlier).length,
  };
}

/**
 * Builds a ranked leaderboard from a flat list of attributed contributions:
 * groups by contributor, scores and aggregates each group, then sorts by
 * `totalHelpfulnessScore` descending (so contributors with more numerous,
 * well-received contributions rank above single lucky hits), tie-broken by
 * `contributorId` for a stable, deterministic order.
 */
export function buildLeaderboard(
  contributions: AttributedContribution[],
  weights: HelpfulnessWeights = DEFAULT_HELPFULNESS_WEIGHTS,
): ContributorStats[] {
  const byContributor = groupContributionsByContributor(contributions);
  const stats = Array.from(byContributor.entries()).map(([contributorId, group]) =>
    buildContributorStats(contributorId, group, weights),
  );

  return stats.sort(
    (a, b) => b.totalHelpfulnessScore - a.totalHelpfulnessScore || a.contributorId.localeCompare(b.contributorId),
  );
}
