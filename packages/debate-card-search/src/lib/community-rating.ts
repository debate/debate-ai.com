/**
 * @fileoverview Pure helpfulness-scoring and ranking helpers for idea #11 in
 * TODO.md ("Community-Rated Summaries and Highlights"). Given a
 * contribution's raw community signals (likes, saves) alongside
 * popularity-independent quality signals and weighted reviewer
 * endorsements, computes a blended helpfulness score and ranks a list of
 * contributions by it — guarding against popularity-only scoring by
 * logarithmically dampening raw vote counts and capping their share of the
 * blended score. This is the first slice only — it works entirely off
 * already-collected signal counts passed in by the caller; it doesn't track
 * likes/saves/endorsements itself, persist scores, or render a leaderboard
 * UI. See the follow-ups noted in TODO.md.
 *
 * @module lib/community-rating
 */

/** The kind of community contribution being scored. */
export type ContributionKind = "summary" | "highlight" | "annotation" | "card";

/** A single reviewer's endorsement of a contribution. */
export interface ReviewerEndorsement {
  /** Reviewer credibility, 0-1 (e.g. derived from past endorsement accuracy or role). */
  reviewerWeight: number;
}

/** Raw community signals collected for one contribution. */
export interface CommunityContribution {
  id: string;
  kind: ContributionKind;
  /** Raw "like" count from any user. */
  likes: number;
  /** Raw "save" count from any user — a more deliberate signal than a like. */
  saves: number;
  /** Popularity-independent quality signals, each 0-1 (e.g. citation completeness, clarity). */
  qualitySignals: number[];
  /** Endorsements from reviewers, each carrying its own credibility weight. */
  reviewerEndorsements: ReviewerEndorsement[];
}

/** Relative share of each signal group in the blended helpfulness score. Should sum to 1. */
export interface HelpfulnessWeights {
  popularity: number;
  quality: number;
  reviewer: number;
}

/**
 * Popularity is capped at 30% of the blended score so raw vote count alone
 * can never outweigh quality and reviewer-credibility signals combined.
 */
export const DEFAULT_HELPFULNESS_WEIGHTS: HelpfulnessWeights = {
  popularity: 0.3,
  quality: 0.4,
  reviewer: 0.3,
};

/** Popularity score at or above this is considered "high" for outlier detection. */
const POPULARITY_ONLY_THRESHOLD = 70;
/** Quality/reviewer scores below this are considered "low" for outlier detection. */
const LOW_SIGNAL_THRESHOLD = 30;

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

/**
 * Scores raw popularity (likes plus more-heavily-weighted saves) 0-100 with
 * logarithmic dampening, so a contribution needs roughly an order of
 * magnitude more votes to gain the same score a strongly-endorsed,
 * high-quality contribution can reach on far fewer.
 */
export function scorePopularitySignal(likes: number, saves: number): number {
  const raw = Math.max(0, likes) + Math.max(0, saves) * 1.5;
  return clampScore(Math.round(Math.log1p(raw) * 18));
}

/** Averages popularity-independent quality signals (each 0-1) into a 0-100 score. */
export function scoreQualitySignal(qualitySignals: number[]): number {
  if (qualitySignals.length === 0) return 0;
  const average = qualitySignals.reduce((sum, signal) => sum + signal, 0) / qualitySignals.length;
  return clampScore(Math.round(average * 100));
}

/**
 * Scores weighted reviewer endorsements 0-100. Weights are summed then
 * dampened the same way as popularity, so a handful of high-credibility
 * endorsements outweighs many low-credibility ones without letting an
 * unbounded endorsement count dominate the score.
 */
export function scoreReviewerSignal(endorsements: ReviewerEndorsement[]): number {
  const totalWeight = endorsements.reduce((sum, endorsement) => sum + Math.max(0, endorsement.reviewerWeight), 0);
  return clampScore(Math.round(Math.log1p(totalWeight) * 40));
}

/** The scored breakdown of one contribution's helpfulness. */
export interface HelpfulnessBreakdown {
  contributionId: string;
  popularityScore: number;
  qualityScore: number;
  reviewerScore: number;
  /** Weighted blend of the three signals above, 0-100. */
  helpfulnessScore: number;
  /**
   * True when popularity is high but quality and reviewer signals are both
   * low — a sign the score is being driven by raw votes rather than
   * substance, useful for flagging a contribution for moderator review.
   */
  isPopularityOnlyOutlier: boolean;
}

/**
 * Computes the full helpfulness breakdown for one contribution, blending
 * popularity, quality, and reviewer-weight signals per `weights` (defaults
 * to `DEFAULT_HELPFULNESS_WEIGHTS`).
 */
export function computeHelpfulnessBreakdown(
  contribution: CommunityContribution,
  weights: HelpfulnessWeights = DEFAULT_HELPFULNESS_WEIGHTS,
): HelpfulnessBreakdown {
  const popularityScore = scorePopularitySignal(contribution.likes, contribution.saves);
  const qualityScore = scoreQualitySignal(contribution.qualitySignals);
  const reviewerScore = scoreReviewerSignal(contribution.reviewerEndorsements);

  const helpfulnessScore =
    Math.round(
      (popularityScore * weights.popularity + qualityScore * weights.quality + reviewerScore * weights.reviewer) *
        10,
    ) / 10;

  return {
    contributionId: contribution.id,
    popularityScore,
    qualityScore,
    reviewerScore,
    helpfulnessScore,
    isPopularityOnlyOutlier:
      popularityScore >= POPULARITY_ONLY_THRESHOLD &&
      qualityScore < LOW_SIGNAL_THRESHOLD &&
      reviewerScore < LOW_SIGNAL_THRESHOLD,
  };
}

/**
 * Ranks contributions by blended helpfulness score, descending, with ties
 * broken by `id` for a stable, deterministic order.
 */
export function rankContributions(
  contributions: CommunityContribution[],
  weights: HelpfulnessWeights = DEFAULT_HELPFULNESS_WEIGHTS,
): HelpfulnessBreakdown[] {
  return contributions
    .map((contribution) => computeHelpfulnessBreakdown(contribution, weights))
    .sort((a, b) => b.helpfulnessScore - a.helpfulnessScore || a.contributionId.localeCompare(b.contributionId));
}
