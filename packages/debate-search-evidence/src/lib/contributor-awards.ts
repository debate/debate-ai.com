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
 * today are the ones `ContributionKind` already distinguishes. Persistence,
 * announcement, and the awards UI itself live in `state/contributions.ts`
 * (`buildTopContributorAwardsFromStore`), `state/contributorAwardAnnouncements.ts`,
 * and `panels/ContributorAwardsPanel.tsx` respectively — see those modules
 * for how this pure selection logic is composed against the persisted
 * contribution store and rendered. Follow-up (a) is closed: `ContributionKind`
 * now distinguishes `"original-argument"` and `"refutation"` contributions,
 * each with their own "Best Original Argument"/"Best Refutation" award
 * category below.
 *
 * Also closes this bullet's own next-named follow-up, "a 'nominate a peer'
 * action": `PeerNomination`/`tallyNominationsByKind`/`canNominatePeer` below
 * are the pure model for a lightweight, informal nomination — anyone can
 * nominate anyone (but not themself) for one of the same six award
 * categories, tallied per category rather than fed back into the
 * helpfulness-score-based winner selection above. Persistence lives in
 * `state/contributorAwardNominations.ts` (mirroring
 * `state/dailyBestCardComments.ts`'s local-first convention) and the form/
 * list UI lives in `panels/ContributorAwardsPanel.tsx` — see those modules.
 *
 * Also closes that bullet's own next-named follow-up after that, "per-
 * nomination 'seconding'/upvoting instead of only a raw count":
 * `PeerNomination.seconderIds`/`canSecondNomination` below let anyone else
 * add their support to an existing nomination instead of only being able to
 * submit a brand-new duplicate one, and `tallyNominationsByKind` now ranks
 * nominees by total support (nominations plus seconds) rather than raw
 * nomination count alone.
 *
 * @module lib/contributor-awards
 */

import { type ContributionKind } from "./community-rating";
import {
  buildLeaderboard,
  type AttributedContribution,
  type ContributorStats,
} from "./contribution-leaderboard";

/**
 * Stable display order for the six award categories — shared by
 * `buildTopContributorAwards` (below) and, for the nomination form/tally
 * grouping, `panels/ContributorAwardsPanel.tsx`.
 */
export const AWARD_KIND_ORDER: ContributionKind[] = [
  "card",
  "summary",
  "highlight",
  "annotation",
  "original-argument",
  "refutation",
];

/** Human-readable label for the award given to the top contributor of each `ContributionKind`. */
export const DEFAULT_AWARD_CATEGORY_LABELS: Record<ContributionKind, string> = {
  card: "Best Evidence Finder",
  summary: "Best Explainer",
  highlight: "Best Highlight Curator",
  annotation: "Best Annotator",
  "original-argument": "Best Original Argument",
  refutation: "Best Refutation",
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
 * order: `card`, `summary`, `highlight`, `annotation`, `original-argument`,
 * `refutation`, filtered to kinds actually present.
 */
export function buildTopContributorAwards(
  contributions: AttributedContribution[],
  categoryLabels: Record<ContributionKind, string> = DEFAULT_AWARD_CATEGORY_LABELS,
): ContributorAward[] {
  const byKind = groupContributionsByKind(contributions);

  const awards: ContributorAward[] = [];
  for (const kind of AWARD_KIND_ORDER) {
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

/** One contributor's aggregate Top Contributor Awards win record across every announced day. */
export interface HallOfFameEntry {
  contributorId: string;
  totalWins: number;
  winsByKind: Partial<Record<ContributionKind, number>>;
}

/**
 * Aggregates every announced day's awards (the "🏆 Top Contributor Awards"
 * bullet's own next-named follow-up under Research Crowdsourcing Organizer
 * Features in TODO.md: "an awards history / hall-of-fame page") into one
 * all-time win record per contributor — the `announced history` list
 * already surfaces each day's standings chronologically, but not who has
 * actually won the most overall.
 *
 * Purely a reshape of whatever award list the caller supplies (typically
 * every announced day's `awards` flattened together, via
 * `state/contributorAwardAnnouncements.ts#listAnnouncedContributorAwards`)
 * — this module takes no dependency on that state layer, matching every
 * other pure helper here. Ranked by total win count descending, tie-broken
 * by `contributorId` ascending for a stable order. A contributor who has
 * never won is absent rather than listed with a zero count.
 */
export function buildContributorAwardsHallOfFame(allAwards: ContributorAward[]): HallOfFameEntry[] {
  const byContributor = new Map<string, HallOfFameEntry>();
  for (const award of allAwards) {
    let entry = byContributor.get(award.contributorId);
    if (!entry) {
      entry = { contributorId: award.contributorId, totalWins: 0, winsByKind: {} };
      byContributor.set(award.contributorId, entry);
    }
    entry.totalWins += 1;
    entry.winsByKind[award.kind] = (entry.winsByKind[award.kind] ?? 0) + 1;
  }

  return Array.from(byContributor.values()).sort(
    (a, b) => b.totalWins - a.totalWins || a.contributorId.localeCompare(b.contributorId),
  );
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

/**
 * One informal nomination of a peer for a specific award category — the
 * "🏆 Top Contributor Awards" bullet's own next-named follow-up in TODO.md,
 * "a 'nominate a peer' action". Distinct from `ContributorAward`: a
 * nomination is a human's opinion, not a computed helpfulness-score winner,
 * and doesn't feed back into `buildTopContributorAwards`.
 */
export interface PeerNomination {
  id: string;
  kind: ContributionKind;
  nomineeId: string;
  nominatorId: string;
  /** Optional short reason for the nomination. */
  note?: string;
  /** Nomination time, as epoch milliseconds. */
  nominatedAt: number;
  /**
   * Ids of contributors who "seconded" (upvoted) this nomination — a
   * lightweight way to add support to an existing nomination instead of
   * only being able to submit a brand-new duplicate one. Absent/empty for a
   * nomination nobody has seconded yet; see `canSecondNomination`.
   */
  seconderIds?: string[];
}

/** One nominee's aggregate support within a single award category. */
export interface NominationTally {
  nomineeId: string;
  /** Number of distinct nominations submitted for this nominee within the category. */
  count: number;
  /** Total seconds (upvotes) across every one of this nominee's nominations in the category. */
  secondCount: number;
  /** `count + secondCount` — the value nominees are ranked by. */
  totalSupport: number;
}

/**
 * Ranks nominees within a single award category by total support
 * (nomination count plus every second/upvote across those nominations)
 * descending, tie-broken by `nomineeId` ascending for a stable order.
 * Nominations for other kinds are ignored. A nominee with no seconds ranks
 * the same as it did before seconding existed — `totalSupport` reduces to
 * `count` when `secondCount` is zero.
 */
export function tallyNominationsByKind(
  nominations: PeerNomination[],
  kind: ContributionKind,
): NominationTally[] {
  const byNominee = new Map<string, { count: number; secondCount: number }>();
  for (const nomination of nominations) {
    if (nomination.kind !== kind) continue;
    const entry = byNominee.get(nomination.nomineeId) ?? { count: 0, secondCount: 0 };
    entry.count += 1;
    entry.secondCount += nomination.seconderIds?.length ?? 0;
    byNominee.set(nomination.nomineeId, entry);
  }

  return Array.from(byNominee.entries())
    .map(([nomineeId, { count, secondCount }]) => ({
      nomineeId,
      count,
      secondCount,
      totalSupport: count + secondCount,
    }))
    .sort((a, b) => b.totalSupport - a.totalSupport || a.nomineeId.localeCompare(b.nomineeId));
}

/**
 * Whether `nominatorId` may nominate `nomineeId`: both must be non-blank
 * after trimming, and a contributor can't nominate themself (compared
 * case-insensitively, since contributor ids elsewhere in this repo are
 * free-text display names rather than stable account ids).
 */
export function canNominatePeer(nominatorId: string, nomineeId: string): boolean {
  const nominator = nominatorId.trim();
  const nominee = nomineeId.trim();
  if (!nominator || !nominee) return false;
  return nominator.toLowerCase() !== nominee.toLowerCase();
}

/**
 * Whether `seconderId` may second (upvote) `nomination`: must be non-blank
 * after trimming, can't be the nomination's own nominee or nominator
 * (compared case-insensitively — the nominee shouldn't upvote themself, and
 * the nominator already registered their support by nominating), and can't
 * already appear in `nomination.seconderIds` (no double-seconding).
 */
export function canSecondNomination(nomination: PeerNomination, seconderId: string): boolean {
  const seconder = seconderId.trim();
  if (!seconder) return false;

  const lowerSeconder = seconder.toLowerCase();
  if (lowerSeconder === nomination.nomineeId.trim().toLowerCase()) return false;
  if (lowerSeconder === nomination.nominatorId.trim().toLowerCase()) return false;

  const alreadySeconded = (nomination.seconderIds ?? []).some(
    (id) => id.trim().toLowerCase() === lowerSeconder,
  );
  return !alreadySeconded;
}
