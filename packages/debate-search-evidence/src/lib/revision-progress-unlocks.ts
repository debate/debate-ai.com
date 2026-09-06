/**
 * @fileoverview Ties `revision-incentives.ts`'s per-contributor revision
 * reward stats into the "Progress Unlocks" tier/badge system
 * (`progress-unlocks.ts`) — the "a reward-points redemption or tie-in to the
 * leaderboard" follow-up named under the "🔁 Revision Incentives" bullet in
 * TODO.md's Research Crowdsourcing Organizer Features section.
 *
 * Unlike `debate-practice-drills`' `state/drillProgressUnlocks.ts` (which had
 * to synthesize a single, contributor-less placeholder id because that
 * package tracks no real per-contributor signal at all), the Revision
 * Incentives leaderboard already aggregates real revisions under real
 * `contributorId`s via `buildContributorRevisionStats`/
 * `buildRevisionIncentiveLeaderboard` — so this maps each row's own stats
 * straight onto `ContributorStats`'s existing contribution-count-and-score
 * path directly, with no synthetic id and no new threshold table:
 * `rewardedRevisionCount` stands in for `contributionCount`, and
 * `totalRewardPoints` — already the same rough 0-300+ scale
 * `community-rating.ts`'s helpfulness scores use, being built from the same
 * `scoreQualitySignal` quality signal `evaluateRevision` reads — stands in
 * for `totalHelpfulnessScore`. A contributor who has racked up enough
 * rewarded revisions and points reaches the same tiers/badges
 * (`DEFAULT_UNLOCK_TIER_REQUIREMENTS`) the real Contribution Leaderboard
 * shows, without inventing a parallel points scale to calibrate.
 *
 * This is deliberately a local, Revision-Incentives-scoped tier display —
 * same as the drill-practice tie-in — rather than posting into the real,
 * cross-tool `state/contributions.ts`-backed Contribution Leaderboard/
 * Progress Unlocks roster: `RevisionIncentivesPanel`'s `contributorId` is a
 * freely-typed field (`EvidenceLibraryPanel`'s "Edit" form), not yet locked
 * to a real signed-in session the way `ContributionsFeedPanel`'s endorsement
 * flow is, so crediting it onto the real roster would let anyone claim any
 * contributor's tier just by typing their id.
 *
 * @module lib/revision-progress-unlocks
 */

import type { ContributorStats } from "./contribution-leaderboard";
import {
  buildContributorUnlockStatus,
  DEFAULT_UNLOCK_TIER_REQUIREMENTS,
  type ContributorUnlockStatus,
  type UnlockTierRequirement,
} from "./progress-unlocks";
import type { ContributorRevisionStats } from "./revision-incentives";

/**
 * Builds a synthetic `ContributorStats` from one Revision Incentives
 * leaderboard row: `rewardedRevisionCount` as the contribution count and
 * `totalRewardPoints` as the helpfulness score, so
 * `computeContributorTier`'s existing AND-path (count and score both clear a
 * tier's threshold) applies directly — no completed-task signal is used.
 */
export function buildRevisionRewardContributorStats(stats: ContributorRevisionStats): ContributorStats {
  return {
    contributorId: stats.contributorId,
    contributionCount: stats.rewardedRevisionCount,
    totalHelpfulnessScore: stats.totalRewardPoints,
    averageHelpfulnessScore:
      stats.rewardedRevisionCount > 0 ? stats.totalRewardPoints / stats.rewardedRevisionCount : 0,
    bestContributionId: "",
    bestHelpfulnessScore: 0,
    popularityOnlyOutlierCount: 0,
    completedTaskCount: 0,
  };
}

/**
 * Builds the Progress Unlocks tier/badge status for one Revision Incentives
 * leaderboard row, via `debate-card-search`'s (same-package)
 * `buildContributorUnlockStatus` — the same tier thresholds and badge names
 * (`Rising Researcher`/`Seasoned Contributor`/`Master Researcher`) shown on
 * the real Contribution Leaderboard-backed roster.
 */
export function buildRevisionRewardUnlockStatus(
  stats: ContributorRevisionStats,
  tierRequirements: UnlockTierRequirement[] = DEFAULT_UNLOCK_TIER_REQUIREMENTS,
): ContributorUnlockStatus {
  return buildContributorUnlockStatus(buildRevisionRewardContributorStats(stats), tierRequirements);
}
