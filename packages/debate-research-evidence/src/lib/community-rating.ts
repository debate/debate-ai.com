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
 * `computeReviewerCredibility` closes idea #11's follow-up (b) ("a real
 * reviewer-credibility system instead of a caller-supplied weight per
 * endorsement") — it derives a reviewer's endorsement weight from their own
 * scored contribution history (average helpfulness, dampened while their
 * contribution count is still low) instead of requiring the caller to
 * supply an arbitrary `reviewerWeight`.
 *
 * @module lib/community-rating
 */

/** The kind of community contribution being scored. */
export type ContributionKind = "summary" | "highlight" | "annotation" | "card" | "original-argument" | "refutation";

/** A single reviewer's endorsement of a contribution. */
export interface ReviewerEndorsement {
  /** Reviewer credibility, 0-1 (e.g. derived from past endorsement accuracy or role). */
  reviewerWeight: number;
  /**
   * Id of the endorsing reviewer, when known. Optional: endorsements
   * recorded before this field existed (and any raw `CommunityContribution`
   * fixture that only needs a weight for scoring) omit it — an endorsement
   * without a `reviewerId` still counts toward the score but can't appear
   * in a per-contributor endorsement history list.
   */
  reviewerId?: string;
  /** Endorsement time, as epoch milliseconds (UTC). Optional, same convention as `reviewerId`. */
  endorsedAt?: number;
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
 * Human-readable legend explaining how `computeHelpfulnessBreakdown` blends
 * its three signals into one score, for a tooltip next to a displayed
 * helpfulness score (`ContributionsFeedPanel`, `ContributionLeaderboardPanel`).
 * Percentages are derived from `weights` rather than hardcoded, so the
 * legend stays accurate if the defaults ever change.
 */
export function buildHelpfulnessScoreExplanation(
  weights: HelpfulnessWeights = DEFAULT_HELPFULNESS_WEIGHTS,
): string {
  const pct = (share: number) => Math.round(share * 100);
  return (
    `Helpfulness blends three signals: ${pct(weights.popularity)}% popularity ` +
    `(likes and saves, logarithmically dampened so raw vote counts alone ` +
    `can't dominate), ${pct(weights.quality)}% quality (citation ` +
    `completeness, clarity, and other popularity-independent signals), and ` +
    `${pct(weights.reviewer)}% reviewer credibility (weighted endorsements ` +
    `from reviewers, based on their own contribution track record). A ` +
    `"Popularity-only" flag appears when the popularity score reaches ` +
    `${POPULARITY_ONLY_THRESHOLD}+ while both quality and reviewer scores ` +
    `stay below ${LOW_SIGNAL_THRESHOLD} — a sign the score is being driven ` +
    `by raw votes rather than substance.`
  );
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

/**
 * Floor credibility granted to a reviewer with no scored contribution
 * history yet, so a first-time reviewer's endorsement still counts for
 * something without granting the full weight the old fixed placeholder did.
 */
export const MIN_REVIEWER_CREDIBILITY = 0.1;

/**
 * Number of scored contributions at which a reviewer's credibility fully
 * reflects their average helpfulness score. Below this, credibility is
 * dampened toward `MIN_REVIEWER_CREDIBILITY` so one or two lucky
 * contributions can't buy full endorsement weight immediately.
 */
const REVIEWER_CREDIBILITY_SATURATION_COUNT = 5;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Derives a reviewer's endorsement-credibility weight (0-1) from their own
 * track record as a contributor, rather than a caller-supplied constant:
 * the average blended helpfulness score of their own scored contributions,
 * dampened toward `MIN_REVIEWER_CREDIBILITY` while their contribution count
 * is still below `REVIEWER_CREDIBILITY_SATURATION_COUNT`. A reviewer with no
 * scored contributions yet gets exactly `MIN_REVIEWER_CREDIBILITY`.
 */
export function computeReviewerCredibility(
  reviewerContributions: CommunityContribution[],
  weights: HelpfulnessWeights = DEFAULT_HELPFULNESS_WEIGHTS,
): number {
  if (reviewerContributions.length === 0) return MIN_REVIEWER_CREDIBILITY;

  const breakdowns = reviewerContributions.map((contribution) => computeHelpfulnessBreakdown(contribution, weights));
  const averageHelpfulness = breakdowns.reduce((sum, breakdown) => sum + breakdown.helpfulnessScore, 0) / breakdowns.length;
  const qualityFactor = clamp01(averageHelpfulness / 100);
  const historyFactor = Math.min(1, reviewerContributions.length / REVIEWER_CREDIBILITY_SATURATION_COUNT);

  return round2(MIN_REVIEWER_CREDIBILITY + (1 - MIN_REVIEWER_CREDIBILITY) * qualityFactor * historyFactor);
}
