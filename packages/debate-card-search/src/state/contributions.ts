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
 * @module state/contributions
 */

import type { AttributedContribution, ContributorStats } from "../lib/contribution-leaderboard";
import { buildLeaderboard, groupContributionsByContributor } from "../lib/contribution-leaderboard";
import type { ContributionKind, HelpfulnessWeights, ReviewerEndorsement } from "../lib/community-rating";
import { DEFAULT_HELPFULNESS_WEIGHTS, computeReviewerCredibility, rankContributions } from "../lib/community-rating";
import type { ContributorAward } from "../lib/contributor-awards";
import { DEFAULT_AWARD_CATEGORY_LABELS, buildTopContributorAwards } from "../lib/contributor-awards";
import type { DailyBestCard, TimestampedCardContribution } from "../lib/daily-best-card";
import { buildDailyBestCards, getBestCardForDay } from "../lib/daily-best-card";
import type { CardReview, ReviewStatus } from "../lib/peer-review";
import { createCardReview } from "../lib/peer-review";
import { getPeerReview, savePeerReview } from "./peerReviews";

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
 * `ReviewerEndorsement` carrying `reviewerWeight` to its
 * `reviewerEndorsements` and saves the result. Returns the updated
 * contribution, or `undefined` if no contribution is stored for `id`.
 */
export function recordPersistedEndorsement(id: string, reviewerWeight: number): AttributedContribution | undefined {
  const endorsement: ReviewerEndorsement = { reviewerWeight };
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
  return recordPersistedEndorsement(id, reviewerWeight);
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

/**
 * A contribution's publication status: `"no_review"` if it was never sent to
 * peer review (the default for every contribution today — review stays
 * opt-in), or the underlying `CardReview`'s `ReviewStatus` once one exists.
 * Closes follow-up (c) named under the "🗣️ Peer Review System" bullet in
 * TODO.md ("wiring a review's lifecycle to whatever eventually persists
 * submitted cards, so `publishReview` can gate a card actually going live"),
 * by giving `state/contributions.ts` a way to read a contribution's review
 * state directly from `state/peerReviews.ts` — a `CardReview.cardId` is the
 * contribution's own `id`.
 */
export type ContributionPublicationStatus = "no_review" | ReviewStatus;

/** Looks up a contribution's current publication status; see `ContributionPublicationStatus`. */
export function getContributionPublicationStatus(id: string): ContributionPublicationStatus {
  const review = getPeerReview(id);
  return review ? review.status : "no_review";
}

/**
 * Whether a contribution should be visible in a review-gated "public" view
 * of the feed: either it was never sent to review (unreviewed contributions
 * stay visible, so this gate doesn't retroactively hide anything that
 * predates the Peer Review System), or its review has reached `"published"`.
 * Anything still `in_review`/`changes_requested`/`approved`/`draft`/`rejected`
 * is hidden until it's actually published.
 */
function isPublicationStatusVisible(status: ContributionPublicationStatus): boolean {
  return status === "no_review" || status === "published";
}

/** Whether a contribution should be visible in a review-gated public feed; see `isPublicationStatusVisible`. */
export function isContributionVisibleInPublicFeed(id: string): boolean {
  return isPublicationStatusVisible(getContributionPublicationStatus(id));
}

/**
 * Starts a contribution's peer review by creating a `"draft"` `CardReview`
 * keyed by the contribution's own `id`, mirroring `evidenceLibraryEntries.ts`'s
 * `saveEvidenceLibraryEntryRevision` "store A composes store B directly"
 * convention (here, `contributions.ts` composes `lib/peer-review.ts` +
 * `state/peerReviews.ts`). Idempotent: a contribution that already has a
 * review is returned unchanged rather than being reset back to `"draft"`. A
 * no-op (returns `undefined`) if `id` isn't a stored contribution.
 */
export function sendContributionToReview(id: string): CardReview | undefined {
  if (!getContribution(id)) return undefined;

  const existing = getPeerReview(id);
  if (existing) return existing;

  const review = createCardReview(id);
  savePeerReview(review);
  return review;
}

/** One persisted contribution, ranked with its computed helpfulness breakdown. */
export interface ContributionFeedEntry extends AttributedContribution {
  helpfulnessScore: number;
  isPopularityOnlyOutlier: boolean;
  publicationStatus: ContributionPublicationStatus;
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
 *
 * Every entry also carries its `publicationStatus`. Pass
 * `{ publicOnly: true }` to drop any entry `isPublicationStatusVisible`
 * excludes — closing follow-up (c) named under the "🗣️ Peer Review System"
 * bullet in TODO.md by letting a review's lifecycle actually gate whether a
 * contribution shows up in a public feed view.
 */
export function buildPersistedContributionFeed(
  weights: HelpfulnessWeights = DEFAULT_HELPFULNESS_WEIGHTS,
  options: { publicOnly?: boolean } = {},
): ContributionFeedEntry[] {
  const contributions = readAll();
  const byId = new Map(contributions.map((contribution) => [contribution.id, contribution]));

  const entries = rankContributions(contributions, weights).map((breakdown) => ({
    ...(byId.get(breakdown.contributionId) as AttributedContribution),
    helpfulnessScore: breakdown.helpfulnessScore,
    isPopularityOnlyOutlier: breakdown.isPopularityOnlyOutlier,
    publicationStatus: getContributionPublicationStatus(breakdown.contributionId),
  }));

  return options.publicOnly ? entries.filter((entry) => isPublicationStatusVisible(entry.publicationStatus)) : entries;
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
