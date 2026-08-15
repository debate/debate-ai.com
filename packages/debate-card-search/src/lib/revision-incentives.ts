/**
 * @fileoverview Pure revision-scoring helpers for the "Revision Incentives"
 * idea under Research Crowdsourcing Organizer Features in TODO.md ("Reward
 * users for improving weak cards, updating outdated evidence, and
 * strengthening citations"). Given a before/after snapshot of a submitted
 * card, reuses the idea #11 `community-rating.ts` quality scoring to detect
 * a meaningful quality gain, then blends in citation-strengthening and
 * evidence-refresh bonuses (with an extra bonus for improving a card that
 * was weak to begin with) into a reward-points total, and aggregates
 * per-contributor totals into a ranked incentive leaderboard. This is the
 * first slice only — it works entirely off caller-supplied before/after
 * snapshots; it doesn't track card revision history itself, persist reward
 * points, or render an incentives UI. See the follow-ups noted in TODO.md.
 *
 * @module lib/revision-incentives
 */

import { scoreQualitySignal } from "./community-rating";

/** A submitted card's state at one point in time, as needed to score a revision. */
export interface CardSnapshot {
  /** Popularity-independent quality signals, each 0-1 — same shape `community-rating.ts` scores. */
  qualitySignals: number[];
  /** Citation completeness/strength, 0-1 (author credentials, date, publication all cited). */
  citationCompleteness: number;
  /** Year the underlying evidence was published or last updated. */
  evidenceYear: number;
  wordCount: number;
}

/** One contributor's edit of a card, captured as a before/after snapshot pair. */
export interface CardRevision {
  cardId: string;
  contributorId: string;
  before: CardSnapshot;
  after: CardSnapshot;
}

/** Quality score (0-100, per `scoreQualitySignal`) below this counts a card as "weak" before revision. */
const WEAK_QUALITY_THRESHOLD = 50;
/** Minimum citation-completeness gain (0-1 scale) to count as "strengthened" rather than noise. */
const CITATION_STRENGTHENED_DELTA = 0.15;

/** Point weights for each way a revision can earn a reward. */
export interface RevisionRewardWeights {
  /** Points awarded per 1-point gain in quality score (0-100 scale). */
  qualityPoint: number;
  /** Multiplier applied to quality points when the card was weak before this revision. */
  weakCardBonusMultiplier: number;
  /** Flat bonus for a meaningful citation-completeness gain. */
  citationStrengthenedBonus: number;
  /** Flat bonus for citing newer evidence than the prior snapshot. */
  evidenceRefreshedBonus: number;
}

/**
 * A middling default: quality gains earn half a point each (doubled for a
 * weak card), and strengthening a citation or refreshing stale evidence
 * each earns a flat bonus roughly equivalent to a 10-16 point quality gain.
 */
export const DEFAULT_REVISION_REWARD_WEIGHTS: RevisionRewardWeights = {
  qualityPoint: 0.5,
  weakCardBonusMultiplier: 2,
  citationStrengthenedBonus: 8,
  evidenceRefreshedBonus: 5,
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** The scored evaluation of one card revision. */
export interface RevisionEvaluation {
  cardId: string;
  contributorId: string;
  qualityScoreBefore: number;
  qualityScoreAfter: number;
  qualityDelta: number;
  /** True when the card's quality score was below `WEAK_QUALITY_THRESHOLD` before this revision. */
  wasWeakCard: boolean;
  /** True when citation completeness gained at least `CITATION_STRENGTHENED_DELTA`. */
  citationStrengthened: boolean;
  /** True when the revision cites evidence from a later year than the prior snapshot. */
  evidenceRefreshed: boolean;
  /** Total points earned by this revision, per `weights`. */
  rewardPoints: number;
  /** True when `rewardPoints` is greater than zero. */
  isRewardedImprovement: boolean;
}

/**
 * Scores one card revision: how much its quality score improved (doubled if
 * the card was weak beforehand), whether its citation was meaningfully
 * strengthened, and whether it now cites newer evidence, then blends those
 * into a total reward-points figure.
 */
export function evaluateRevision(
  revision: CardRevision,
  weights: RevisionRewardWeights = DEFAULT_REVISION_REWARD_WEIGHTS,
): RevisionEvaluation {
  const qualityScoreBefore = scoreQualitySignal(revision.before.qualitySignals);
  const qualityScoreAfter = scoreQualitySignal(revision.after.qualitySignals);
  const qualityDelta = qualityScoreAfter - qualityScoreBefore;
  const wasWeakCard = qualityScoreBefore < WEAK_QUALITY_THRESHOLD;

  const citationStrengthened =
    revision.after.citationCompleteness - revision.before.citationCompleteness >= CITATION_STRENGTHENED_DELTA;
  const evidenceRefreshed = revision.after.evidenceYear > revision.before.evidenceYear;

  const qualityPoints =
    Math.max(0, qualityDelta) * weights.qualityPoint * (wasWeakCard ? weights.weakCardBonusMultiplier : 1);
  const citationPoints = citationStrengthened ? weights.citationStrengthenedBonus : 0;
  const evidencePoints = evidenceRefreshed ? weights.evidenceRefreshedBonus : 0;

  const rewardPoints = round1(qualityPoints + citationPoints + evidencePoints);

  return {
    cardId: revision.cardId,
    contributorId: revision.contributorId,
    qualityScoreBefore,
    qualityScoreAfter,
    qualityDelta,
    wasWeakCard,
    citationStrengthened,
    evidenceRefreshed,
    rewardPoints,
    isRewardedImprovement: rewardPoints > 0,
  };
}

/** Groups revisions by `contributorId`, preserving each group's original relative order. */
export function groupRevisionsByContributor(revisions: CardRevision[]): Map<string, CardRevision[]> {
  const byContributor = new Map<string, CardRevision[]>();
  for (const revision of revisions) {
    const group = byContributor.get(revision.contributorId);
    if (group) {
      group.push(revision);
    } else {
      byContributor.set(revision.contributorId, [revision]);
    }
  }
  return byContributor;
}

/** One contributor's aggregated revision-incentive standing. */
export interface ContributorRevisionStats {
  contributorId: string;
  revisionCount: number;
  /** Count of this contributor's revisions that earned a nonzero reward. */
  rewardedRevisionCount: number;
  /** Sum of every revision's reward points. */
  totalRewardPoints: number;
  /** Count of this contributor's revisions that improved a card that was weak beforehand. */
  weakCardsImprovedCount: number;
}

/**
 * Aggregates one contributor's revisions into their incentive stats. Throws
 * if `revisions` is empty — callers should skip contributors with no
 * evaluated revisions rather than producing an empty entry.
 */
export function buildContributorRevisionStats(
  contributorId: string,
  revisions: CardRevision[],
  weights: RevisionRewardWeights = DEFAULT_REVISION_REWARD_WEIGHTS,
): ContributorRevisionStats {
  if (revisions.length === 0) {
    throw new Error(`buildContributorRevisionStats: contributor "${contributorId}" has no revisions`);
  }

  const evaluations = revisions.map((revision) => evaluateRevision(revision, weights));

  return {
    contributorId,
    revisionCount: evaluations.length,
    rewardedRevisionCount: evaluations.filter((evaluation) => evaluation.isRewardedImprovement).length,
    totalRewardPoints: round1(evaluations.reduce((sum, evaluation) => sum + evaluation.rewardPoints, 0)),
    weakCardsImprovedCount: evaluations.filter(
      (evaluation) => evaluation.wasWeakCard && evaluation.isRewardedImprovement,
    ).length,
  };
}

/**
 * Builds a ranked revision-incentive leaderboard from a flat list of
 * revisions: groups by contributor, scores and aggregates each group, then
 * sorts by `totalRewardPoints` descending, tie-broken by `contributorId` for
 * a stable, deterministic order.
 */
export function buildRevisionIncentiveLeaderboard(
  revisions: CardRevision[],
  weights: RevisionRewardWeights = DEFAULT_REVISION_REWARD_WEIGHTS,
): ContributorRevisionStats[] {
  const byContributor = groupRevisionsByContributor(revisions);
  const stats = Array.from(byContributor.entries()).map(([contributorId, group]) =>
    buildContributorRevisionStats(contributorId, group, weights),
  );

  return stats.sort(
    (a, b) => b.totalRewardPoints - a.totalRewardPoints || a.contributorId.localeCompare(b.contributorId),
  );
}

/** Renders a one-line notification for a single scored revision. */
export function buildRevisionRewardText(evaluation: RevisionEvaluation): string {
  if (!evaluation.isRewardedImprovement) {
    return `No reward earned revising card "${evaluation.cardId}" — no meaningful quality, citation, or evidence improvement detected.`;
  }

  const reasons: string[] = [];
  if (evaluation.qualityDelta > 0) {
    reasons.push(`+${evaluation.qualityDelta} quality${evaluation.wasWeakCard ? " (weak card bonus)" : ""}`);
  }
  if (evaluation.citationStrengthened) reasons.push("citation strengthened");
  if (evaluation.evidenceRefreshed) reasons.push("evidence refreshed");

  return `${evaluation.contributorId} earned ${evaluation.rewardPoints} points revising card "${evaluation.cardId}" (${reasons.join(", ")}).`;
}
