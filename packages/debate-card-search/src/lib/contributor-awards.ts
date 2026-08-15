/**
 * @fileoverview Pure per-category award selection for the "Top Contributor
 * Awards" idea under Research Crowdsourcing Organizer Features in TODO.md
 * ("Give recognition for best evidence finder, best explainers, best
 * original argument, and best refutations"). Builds directly on the
 * `contribution-leaderboard.ts` per-contributor aggregation (which itself
 * builds on the idea #11 `community-rating.ts` helpfulness scoring) by
 * grouping already-attributed contributions by their `ContributionKind` and
 * ranking contributors within each kind to pick a category winner. This is
 * the first slice only — it works entirely off already-collected
 * contributions passed in by the caller; the only categories it can produce
 * today are the ones `ContributionKind` already distinguishes ("card" and
 * "summary" — see `DEFAULT_AWARD_CATEGORY_LABELS`), it doesn't persist or
 * announce awards, and it doesn't render an awards UI. Follow-ups: (a) a
 * finer-grained `ContributionKind` (or separate tag) for "original
 * argument" and "refutation" contributions, neither of which exists as a
 * distinct kind today, (b) a scheduled job that periodically calls
 * `buildTopContributorAwards` and persists/announces the winners, (c) an
 * awards UI in `debate-card-search` that renders
 * `buildAwardsAnnouncementText`.
 *
 * @module lib/contributor-awards
 */

import { type ContributionKind } from "./community-rating";
import {
  buildLeaderboard,
  type AttributedContribution,
  type ContributorStats,
} from "./contribution-leaderboard";

/** Human-readable label for the award given to the top contributor of each `ContributionKind`. */
export const DEFAULT_AWARD_CATEGORY_LABELS: Record<ContributionKind, string> = {
  card: "Best Evidence Finder",
  summary: "Best Explainer",
  highlight: "Best Highlight Curator",
  annotation: "Best Annotator",
};

/** One category's award winner. */
export interface ContributorAward {
  kind: ContributionKind;
  label: string;
  contributorId: string;
  contributionCount: number;
  totalHelpfulnessScore: number;
}

/**
 * Groups attributed contributions by their `ContributionKind`, preserving
 * each group's original relative order.
 */
export function groupContributionsByKind(
  contributions: AttributedContribution[],
): Map<ContributionKind, AttributedContribution[]> {
  const byKind = new Map<ContributionKind, AttributedContribution[]>();
  for (const contribution of contributions) {
    const group = byKind.get(contribution.kind);
    if (group) {
      group.push(contribution);
    } else {
      byKind.set(contribution.kind, [contribution]);
    }
  }
  return byKind;
}

/**
 * Ranks contributors within a single `ContributionKind`'s contributions,
 * reusing `buildLeaderboard`'s scoring, grouping, and tie-breaking.
 */
export function buildCategoryLeaderboard(
  contributions: AttributedContribution[],
): ContributorStats[] {
  return buildLeaderboard(contributions);
}

/**
 * Selects one category winner per `ContributionKind` present in
 * `contributions` — the contributor with the highest total helpfulness
 * score for that kind (tie-broken by `contributorId`, per
 * `buildLeaderboard`). Kinds with no contributions are omitted rather than
 * producing an award with no winner. `categoryLabels` defaults to
 * `DEFAULT_AWARD_CATEGORY_LABELS` and may be overridden per kind, e.g. once
 * a real reviewer-facing copy deck exists. Awards are returned in a stable
 * order: `card`, `summary`, `highlight`, `annotation`, filtered to kinds
 * actually present.
 */
export function buildTopContributorAwards(
  contributions: AttributedContribution[],
  categoryLabels: Record<ContributionKind, string> = DEFAULT_AWARD_CATEGORY_LABELS,
): ContributorAward[] {
  const byKind = groupContributionsByKind(contributions);
  const kindOrder: ContributionKind[] = ["card", "summary", "highlight", "annotation"];

  const awards: ContributorAward[] = [];
  for (const kind of kindOrder) {
    const group = byKind.get(kind);
    if (!group || group.length === 0) continue;

    const [winner] = buildCategoryLeaderboard(group);
    if (!winner) continue;

    awards.push({
      kind,
      label: categoryLabels[kind],
      contributorId: winner.contributorId,
      contributionCount: winner.contributionCount,
      totalHelpfulnessScore: winner.totalHelpfulnessScore,
    });
  }

  return awards;
}

/**
 * Renders a short, human-readable announcement line per award (e.g. for an
 * awards banner or notification), one line per category in
 * `buildTopContributorAwards`'s stable kind order.
 */
export function buildAwardsAnnouncementText(awards: ContributorAward[]): string {
  if (awards.length === 0) return "No awards to announce yet.";

  return awards
    .map(
      (award) =>
        `🏆 ${award.label}: ${award.contributorId} (${award.contributionCount} contribution${
          award.contributionCount === 1 ? "" : "s"
        }, ${award.totalHelpfulnessScore} pts)`,
    )
    .join("\n");
}
