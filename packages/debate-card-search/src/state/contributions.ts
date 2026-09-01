/**
 * @fileoverview Persistent storage for `contribution-leaderboard.ts`'s
 * `AttributedContribution` records — the "(a) wiring a `contributorId` into
 * wherever contributions are eventually persisted" follow-up named in that
 * slice for the "Contribution Leaderboard" idea in TODO.md. Stores
 * contributions in localStorage, mirroring the existing
 * `sprintNotes.ts`/`peerReviews.ts` persistence convention. `AttributedContribution`
 * already extends `community-rating.ts`'s `CommunityContribution`, so this
 * store also persists what a "Community-Rated Summaries and Highlights"
 * (idea #11) contribution needs.
 *
 * `recordPersistedLike`/`recordPersistedSave`/`recordPersistedEndorsement`
 * close the "wiring real like/save/endorse actions and persisting those
 * counts per contribution" follow-up shared by the "Contribution
 * Leaderboard" bullet and idea #11 in TODO.md — they apply a like/save/
 * endorsement event directly to a stored contribution's `likes`/`saves`/
 * `reviewerEndorsements` and save the result, mirroring
 * `contributorAvailability.ts`'s `recordPersistedTaskAssigned`/
 * `recordPersistedTaskCompleted` "compose the mutation directly against the
 * persisted store" convention.
 *
 * `buildPersistedContributionFeed` closes follow-up (a) named under both the
 * "Contribution Leaderboard" bullet and idea #11 ("Community-Rated Summaries
 * and Highlights") in TODO.md — "a real like/save/endorse UI" — by giving a
 * feed panel a ranked, per-contribution (rather than per-contributor) view
 * to render like/save/endorse actions against, reusing
 * `community-rating.ts`'s pure `rankContributions` directly.
 *
 * `recordPersistedEndorsementFromReviewer` closes idea #11's follow-up (b)
 * in TODO.md ("a real reviewer-credibility system instead of a
 * caller-supplied weight per endorsement") by deriving an endorsement's
 * weight from the endorsing reviewer's own persisted contribution history,
 * via `community-rating.ts`'s `computeReviewerCredibility`, instead of
 * requiring the caller (the feed panel's "Endorse" button) to supply an
 * arbitrary fixed weight.
 *
 * `filterFlaggedFeedEntries` closes idea #11's follow-up (c) in TODO.md —
 * "a moderator view that surfaces `isPopularityOnlyOutlier`-flagged
 * contributions for review" — narrowing a ranked feed down to just the
 * entries `community-rating.ts` flagged as popularity-driven, so
 * `ContributionsFeedPanel`'s moderator toggle has a dedicated, testable
 * filter to call rather than re-deriving the predicate inline.
 *
 * `listEndorsementsByContributor` closes idea #11's "An endorsement history
 * list per contributor" follow-up in TODO.md. `recordPersistedEndorsement`/
 * `recordPersistedEndorsementFromReviewer` now stamp each `ReviewerEndorsement`
 * with the endorsing `reviewerId` and an `endorsedAt` timestamp (both
 * optional on the type, so pre-existing weight-only endorsements and test
 * fixtures still typecheck), which this new lookup reads back out — either a
 * contributor's received endorsements (on their own contributions) or their
 * given ones (as a reviewer), newest first.
 *
 * @module state/contributions
 */

import type { AttributedContribution, ContributorStats } from "../lib/contribution-leaderboard";
import { buildLeaderboard, groupContributionsByContributor } from "../lib/contribution-leaderboard";
import { renameTagInList } from "../lib/argument-library";
import type { ContributionKind, HelpfulnessWeights, ReviewerEndorsement } from "../lib/community-rating";
import { DEFAULT_HELPFULNESS_WEIGHTS, computeReviewerCredibility, rankContributions } from "../lib/community-rating";
import type { ContributorAward } from "../lib/contributor-awards";
import { DEFAULT_AWARD_CATEGORY_LABELS, buildTopContributorAwards } from "../lib/contributor-awards";
import type { DailyBestCard, TimestampedCardContribution } from "../lib/daily-best-card";
import { buildDailyBestCards, getBestCardForDay } from "../lib/daily-best-card";

const STORAGE_KEY = "contributions";

function readAll(): AttributedContribution[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AttributedContribution[]) : [];
  } catch {
    return [];
  }
}

function writeAll(contributions: AttributedContribution[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contributions));
}

/** Lists every persisted contribution, across all contributors. */
export function listContributions(): AttributedContribution[] {
  return readAll();
}

/** Lists every persisted contribution attributed to one contributor. */
export function listContributionsByContributor(contributorId: string): AttributedContribution[] {
  return groupContributionsByContributor(readAll()).get(contributorId) ?? [];
}

/** Looks up a single persisted contribution by id, if any. */
export function getContribution(id: string): AttributedContribution | undefined {
  return readAll().find((contribution) => contribution.id === id);
}

/** Saves a contribution, overwriting any existing record with the same id. */
export function saveContribution(contribution: AttributedContribution): void {
  const contributions = readAll();
  const index = contributions.findIndex((existing) => existing.id === contribution.id);
  if (index === -1) {
    contributions.push(contribution);
  } else {
    contributions[index] = contribution;
  }
  writeAll(contributions);
}

/** Deletes a persisted contribution by id; a no-op if it isn't stored. */
export function deleteContribution(id: string): void {
  writeAll(readAll().filter((contribution) => contribution.id !== id));
}

/**
 * Applies `update` to a stored contribution and saves the result. Returns
 * the updated contribution, or `undefined` — leaving storage untouched — if
 * no contribution is stored for `id`.
 */
function applyPersistedContributionUpdate(
  id: string,
  update: (contribution: AttributedContribution) => AttributedContribution,
): AttributedContribution | undefined {
  const contribution = getContribution(id);
  if (!contribution) return undefined;

  const updated = update(contribution);
  saveContribution(updated);
  return updated;
}

/**
 * Records a "like" on a stored contribution — increments its `likes` by one
 * and saves the result. Returns the updated contribution, or `undefined` if
 * no contribution is stored for `id`.
 */
export function recordPersistedLike(id: string): AttributedContribution | undefined {
  return applyPersistedContributionUpdate(id, (contribution) => ({
    ...contribution,
    likes: contribution.likes + 1,
  }));
}

/**
 * Records a "save" on a stored contribution — increments its `saves` by one
 * and saves the result. Returns the updated contribution, or `undefined` if
 * no contribution is stored for `id`.
 */
export function recordPersistedSave(id: string): AttributedContribution | undefined {
  return applyPersistedContributionUpdate(id, (contribution) => ({
    ...contribution,
    saves: contribution.saves + 1,
  }));
}

/**
 * Records a reviewer endorsement on a stored contribution — appends a
 * `ReviewerEndorsement` carrying `reviewerWeight`, `reviewerId`, and
 * `endorsedAt` to its `reviewerEndorsements` and saves the result. Returns
 * the updated contribution, or `undefined` if no contribution is stored for
 * `id`. `endorsedAt` defaults to the current time; a caller only needs to
 * pass it explicitly in a test.
 */
export function recordPersistedEndorsement(
  id: string,
  reviewerWeight: number,
  reviewerId: string,
  endorsedAt: number = Date.now(),
): AttributedContribution | undefined {
  const endorsement: ReviewerEndorsement = { reviewerWeight, reviewerId, endorsedAt };
  return applyPersistedContributionUpdate(id, (contribution) => ({
    ...contribution,
    reviewerEndorsements: [...contribution.reviewerEndorsements, endorsement],
  }));
}

/**
 * Records a reviewer endorsement on a stored contribution, deriving the
 * endorsement's weight from `reviewerId`'s own persisted contribution
 * history via `community-rating.ts`'s `computeReviewerCredibility` instead
 * of taking a caller-supplied weight directly — closes idea #11's follow-up
 * (b) in TODO.md ("a real reviewer-credibility system instead of a
 * caller-supplied weight per endorsement"). A reviewer with no persisted
 * contributions of their own still gets `MIN_REVIEWER_CREDIBILITY`, not the
 * old fixed full-credibility placeholder. Returns the updated contribution,
 * or `undefined` if no contribution is stored for `id`.
 */
export function recordPersistedEndorsementFromReviewer(
  id: string,
  reviewerId: string,
): AttributedContribution | undefined {
  const reviewerWeight = computeReviewerCredibility(listContributionsByContributor(reviewerId));
  return recordPersistedEndorsement(id, reviewerWeight, reviewerId);
}

/** Which side of an endorsement a `listEndorsementsByContributor` query looks at. */
export type EndorsementHistoryDirection = "received" | "given";

/** One entry in a contributor's endorsement history — either one they received or one they gave. */
export interface ContributorEndorsementHistoryEntry {
  contributionId: string;
  contributionKind: ContributionKind;
  /** The endorsed contribution's own contributor — the endorsement's recipient. */
  contributionContributorId: string;
  reviewerId: string;
  reviewerWeight: number;
  endorsedAt: number;
}

/**
 * Lists `contributorId`'s endorsement history — the idea #11 follow-up in
 * TODO.md ("An endorsement history list per contributor") under "Community-
 * Rated Summaries and Highlights". `direction: "received"` lists
 * endorsements on `contributorId`'s own contributions (from any reviewer);
 * `direction: "given"` lists endorsements `contributorId` made as a
 * reviewer, across every contributor's contributions. Newest first. Only
 * endorsements carrying both `reviewerId` and `endorsedAt` are included —
 * an endorsement recorded before those fields existed (or a raw
 * weight-only fixture) has no identity to attribute a history entry to.
 */
export function listEndorsementsByContributor(
  contributorId: string,
  direction: EndorsementHistoryDirection,
): ContributorEndorsementHistoryEntry[] {
  const entries: ContributorEndorsementHistoryEntry[] = [];
  for (const contribution of readAll()) {
    for (const endorsement of contribution.reviewerEndorsements) {
      if (!endorsement.reviewerId || endorsement.endorsedAt === undefined) continue;
      const matches =
        direction === "received"
          ? contribution.contributorId === contributorId
          : endorsement.reviewerId === contributorId;
      if (!matches) continue;

      entries.push({
        contributionId: contribution.id,
        contributionKind: contribution.kind,
        contributionContributorId: contribution.contributorId,
        reviewerId: endorsement.reviewerId,
        reviewerWeight: endorsement.reviewerWeight,
        endorsedAt: endorsement.endorsedAt,
      });
    }
  }
  return entries.sort((a, b) => b.endorsedAt - a.endorsedAt);
}

/**
 * Every distinct tag used across the persisted Contributions Feed, sorted —
 * the Contributions Feed's half of the tag corpus a tag-autocomplete
 * affordance suggests from. A contribution carrying no `tags` contributes
 * nothing. Mirrors `evidenceLibraryEntries.ts`'s `listPersistedTags`, which
 * covers the other store; `listCombinedPersistedTags` unions the two.
 */
export function listContributionTags(): string[] {
  const tags = new Set<string>();
  for (const contribution of readAll()) {
    for (const tag of contribution.tags ?? []) {
      tags.add(tag);
    }
  }
  return Array.from(tags).sort((a, b) => a.localeCompare(b));
}

/**
 * Renames (or, when `newTag` is already used elsewhere, merges into) a tag
 * across every persisted contribution that carries it, reusing
 * `argument-library.ts`'s pure `renameTagInList` per contribution — the
 * Contributions Feed half of the tag rename/merge tool, which used to rewrite
 * only `evidenceLibraryEntries.ts`'s own entries (a gap recorded in
 * `docs/features/evidence-library.md`). Returns the number of contributions
 * changed, writing back only when at least one actually changed. Throws on a
 * blank or unchanged tag pair, matching `renameTagAcrossCards`.
 */
export function renameTagAcrossPersistedContributions(oldTag: string, newTag: string): number {
  const trimmedOld = oldTag.trim();
  const trimmedNew = newTag.trim();
  if (!trimmedOld || !trimmedNew) {
    throw new Error("renameTagAcrossPersistedContributions requires non-blank oldTag and newTag");
  }
  if (trimmedOld === trimmedNew) {
    throw new Error("renameTagAcrossPersistedContributions requires oldTag and newTag to differ");
  }

  let changedCount = 0;
  const updated = readAll().map((contribution) => {
    if (!contribution.tags) return contribution;
    const renamed = renameTagInList(contribution.tags, trimmedOld, trimmedNew);
    if (renamed === contribution.tags) return contribution;
    changedCount++;
    return { ...contribution, tags: renamed };
  });

  if (changedCount > 0) {
    writeAll(updated);
  }
  return changedCount;
}

/**
 * Builds the Contribution Leaderboard directly from every persisted
 * contribution, composing this store with `contribution-leaderboard.ts`'s
 * pure `buildLeaderboard` rather than requiring a caller to hold and pass in
 * the full contribution list themselves — mirroring the existing
 * `dailyMissionResults.ts` `buildPersistedContributorQuestStreak` "compose
 * the pure function directly against the persisted store" convention. An
 * empty store returns an empty leaderboard rather than throwing.
 */
export function buildPersistedLeaderboard(weights: HelpfulnessWeights = DEFAULT_HELPFULNESS_WEIGHTS): ContributorStats[] {
  return buildLeaderboard(readAll(), weights);
}

/** One persisted contribution, ranked with its computed helpfulness breakdown. */
export interface ContributionFeedEntry extends AttributedContribution {
  helpfulnessScore: number;
  isPopularityOnlyOutlier: boolean;
}

/**
 * Builds a ranked, per-contribution feed directly from every persisted
 * contribution, composing this store with `community-rating.ts`'s pure
 * `rankContributions` rather than requiring a caller to hold and pass in the
 * full contribution list themselves — mirroring `buildPersistedLeaderboard`'s
 * "compose the pure function directly against the persisted store"
 * convention, but per-contribution instead of per-contributor so a feed
 * panel can render like/save/endorse actions against each entry. An empty
 * store returns an empty feed rather than throwing.
 */
export function buildPersistedContributionFeed(
  weights: HelpfulnessWeights = DEFAULT_HELPFULNESS_WEIGHTS,
): ContributionFeedEntry[] {
  const contributions = readAll();
  const byId = new Map(contributions.map((contribution) => [contribution.id, contribution]));

  return rankContributions(contributions, weights).map((breakdown) => ({
    ...(byId.get(breakdown.contributionId) as AttributedContribution),
    helpfulnessScore: breakdown.helpfulnessScore,
    isPopularityOnlyOutlier: breakdown.isPopularityOnlyOutlier,
  }));
}

/**
 * Narrows a ranked `ContributionFeedEntry` list down to only the entries
 * flagged `isPopularityOnlyOutlier` — the "Community-Rated Summaries and
 * Highlights" (idea #11) follow-up (c) in TODO.md: "a moderator view that
 * surfaces `isPopularityOnlyOutlier`-flagged contributions for review." The
 * flag is already computed by `community-rating.ts`'s scoring and carried on
 * every `buildPersistedContributionFeed` entry; this only filters down to
 * it, preserving the existing helpfulness-score ranking order. An empty or
 * all-clean feed returns an empty list.
 */
export function filterFlaggedFeedEntries(entries: ContributionFeedEntry[]): ContributionFeedEntry[] {
  return entries.filter((entry) => entry.isPopularityOnlyOutlier);
}

/**
 * Builds the Top Contributor Awards directly from every persisted
 * contribution, composing this store with `contributor-awards.ts`'s pure
 * `buildTopContributorAwards` rather than requiring a caller to hold and pass
 * in the full contribution list themselves — mirroring `buildPersistedLeaderboard`'s
 * "compose the pure function directly against the persisted store"
 * convention. An empty store returns an empty award list rather than throwing.
 */
export function buildTopContributorAwardsFromStore(
  categoryLabels: Record<ContributionKind, string> = DEFAULT_AWARD_CATEGORY_LABELS,
): ContributorAward[] {
  return buildTopContributorAwards(readAll(), categoryLabels);
}

/**
 * Narrows a persisted `AttributedContribution` to `daily-best-card.ts`'s
 * `TimestampedCardContribution` shape — a card-kind contribution that also
 * carries the `submittedAt` timestamp the "Daily Best Card Challenge" idea
 * groups by UTC day. Excludes non-card contributions and any card saved
 * before `submittedAt` was wired into the Contributions Feed submission
 * flow (see `ContributionsFeedPanel.tsx`).
 */
function isTimestampedCardContribution(
  contribution: AttributedContribution,
): contribution is AttributedContribution & TimestampedCardContribution {
  return contribution.kind === "card" && typeof contribution.submittedAt === "number";
}

/**
 * Lists every persisted card contribution that carries a `submittedAt`
 * timestamp, ready for `lib/daily-best-card.ts`'s day-grouping helpers.
 */
function readTimestampedCards(): TimestampedCardContribution[] {
  return readAll().filter(isTimestampedCardContribution);
}

/**
 * A day's winning card, still carrying the persisted `contributorId` that
 * `lib/daily-best-card.ts`'s plain `TimestampedCardContribution` type doesn't
 * declare (it only extends `CommunityContribution`, not the attributed
 * shape) — every card this store hands to it is actually an
 * `AttributedContribution`, so the field is safe to widen back in here for
 * a panel to render.
 */
export interface AttributedDailyBestCard extends DailyBestCard {
  contribution: TimestampedCardContribution & { contributorId: string };
}

/**
 * Builds the "Daily Best Card Challenge" result directly from every
 * persisted card contribution, composing this store with
 * `lib/daily-best-card.ts`'s pure `buildDailyBestCards` rather than requiring
 * a caller to hold and pass in the full contribution list themselves —
 * mirroring `buildPersistedLeaderboard`'s "compose the pure function directly
 * against the persisted store" convention. Closes the "(a) wiring a
 * `submittedAt` timestamp into wherever card contributions are eventually
 * persisted" follow-up under the "🕵️ Daily Best Card Challenge" bullet in
 * TODO.md — that timestamp is already stamped by `ContributionsFeedPanel.tsx`
 * on every submission, so this only needed to read it back out. An empty
 * store (or one with no card contributions) returns an empty list rather
 * than throwing.
 */
export function buildDailyBestCardsFromStore(
  weights: HelpfulnessWeights = DEFAULT_HELPFULNESS_WEIGHTS,
): AttributedDailyBestCard[] {
  return buildDailyBestCards(readTimestampedCards(), weights) as AttributedDailyBestCard[];
}

/**
 * Builds today's (the UTC day of `now`) winning card directly from every
 * persisted card contribution, or `null` if no card was submitted that day.
 * `now` is caller-supplied (epoch ms) rather than read from the clock here,
 * mirroring `lib/daily-best-card.ts`'s `getBestCardForDay` contract — a panel
 * calls this with `Date.now()` at render time.
 */
export function getTodaysBestCardFromStore(
  now: number,
  weights: HelpfulnessWeights = DEFAULT_HELPFULNESS_WEIGHTS,
): AttributedDailyBestCard | null {
  return getBestCardForDay(readTimestampedCards(), now, weights) as AttributedDailyBestCard | null;
}
