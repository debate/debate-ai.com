/**
 * @fileoverview Reviewer permission gating for `lib/peer-review.ts`'s
 * highest-stakes lifecycle transitions — closes follow-up (b) named under
 * the "🗣️ Peer Review System" bullet in TODO.md ("reviewer identity/
 * permission checks once auth/roles exist") and `docs/features/review-queue.md`'s
 * "Known gaps" entry ("No reviewer identity/permission checks ... so any
 * visitor can act as any reviewer and take any lifecycle action").
 *
 * This repo has no auth/roles system, so — mirroring `tiered-task-routing.ts`'s
 * identical "derive eligibility from a contributor's own track record
 * instead of a caller-supplied value" approach — a reviewer's permission to
 * approve, reject, or publish a card is derived from their own persisted
 * contribution history via `progress-unlocks.ts`'s existing `UnlockTier`,
 * not a fabricated role. A reviewer with no track record of their own
 * (including one who has never contributed) can still submit a card,
 * request changes, and comment — only the three transitions that move a
 * card toward or away from actually going live require a track record.
 *
 * @module lib/reviewer-permissions
 */

import { approveReview, publishReview, rejectReview, type CardReview } from "./peer-review";
import { computeContributorTier, DEFAULT_UNLOCK_TIER_REQUIREMENTS, type UnlockTier, type UnlockTierRequirement } from "./progress-unlocks";
import type { ContributorStats } from "./contribution-leaderboard";

/** Mirrors `progress-unlocks.ts`'s `TIER_ORDER`, least to most experienced. */
const TIER_RANK: Record<UnlockTier, number> = { novice: 0, apprentice: 1, veteran: 2, expert: 3 };

/**
 * The minimum `UnlockTier` a reviewer needs to approve, reject, or publish a
 * card review — a contributor with a "veteran" track record (see
 * `progress-unlocks.ts`'s `DEFAULT_UNLOCK_TIER_REQUIREMENTS`) has shown
 * enough judgment of their own to gate someone else's.
 */
export const MIN_REVIEWER_TIER: UnlockTier = "veteran";

/** A lifecycle transition gated by reviewer permission. */
export type GatedReviewAction = "approve" | "reject" | "publish";

/** Whether `tier` meets or exceeds `minTier` (defaults to `MIN_REVIEWER_TIER`). */
export function hasReviewerPermission(tier: UnlockTier, minTier: UnlockTier = MIN_REVIEWER_TIER): boolean {
  return TIER_RANK[tier] >= TIER_RANK[minTier];
}

/** Thrown when a reviewer's tier doesn't meet the threshold for a gated action. */
export class InsufficientReviewerPermissionError extends Error {
  constructor(action: GatedReviewAction, tier: UnlockTier, minTier: UnlockTier) {
    super(`Cannot ${action} a review: reviewer tier "${tier}" does not meet the required "${minTier}" tier`);
    this.name = "InsufficientReviewerPermissionError";
  }
}

function requirePermission(action: GatedReviewAction, tier: UnlockTier, minTier: UnlockTier): void {
  if (!hasReviewerPermission(tier, minTier)) {
    throw new InsufficientReviewerPermissionError(action, tier, minTier);
  }
}

/**
 * Approves a review on behalf of a reviewer at `reviewerTier`. Throws
 * `InsufficientReviewerPermissionError` before `approveReview` gets a chance
 * to run, so a reviewer without the required tier never even reaches the
 * "unresolved blocking comments" check.
 */
export function approveReviewAsReviewer(
  review: CardReview,
  reviewerTier: UnlockTier,
  minTier: UnlockTier = MIN_REVIEWER_TIER,
): CardReview {
  requirePermission("approve", reviewerTier, minTier);
  return approveReview(review);
}

/** Rejects a review on behalf of a reviewer at `reviewerTier`; see `approveReviewAsReviewer`. */
export function rejectReviewAsReviewer(
  review: CardReview,
  reviewerTier: UnlockTier,
  minTier: UnlockTier = MIN_REVIEWER_TIER,
): CardReview {
  requirePermission("reject", reviewerTier, minTier);
  return rejectReview(review);
}

/** Publishes a review on behalf of a reviewer at `reviewerTier`; see `approveReviewAsReviewer`. */
export function publishReviewAsReviewer(
  review: CardReview,
  reviewerTier: UnlockTier,
  minTier: UnlockTier = MIN_REVIEWER_TIER,
): CardReview {
  requirePermission("publish", reviewerTier, minTier);
  return publishReview(review);
}

/**
 * Derives a reviewer's `UnlockTier` by looking up their `ContributorStats`
 * in a leaderboard (e.g. `state/contributions.ts`'s `buildPersistedLeaderboard`)
 * by contributor id. A reviewer with no contributions of their own — the
 * same "no track record yet" case `progress-unlocks.ts` treats every
 * contributor as satisfying at minimum — is `"novice"`, not an error.
 */
export function deriveReviewerTier(
  reviewerId: string,
  statsList: ContributorStats[],
  requirements: UnlockTierRequirement[] = DEFAULT_UNLOCK_TIER_REQUIREMENTS,
): UnlockTier {
  const stats = statsList.find((candidate) => candidate.contributorId === reviewerId);
  if (!stats) return "novice";
  return computeContributorTier(stats, requirements);
}
