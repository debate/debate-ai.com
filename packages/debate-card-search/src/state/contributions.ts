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
 * @module state/contributions
 */

import type { AttributedContribution, ContributorStats } from "../lib/contribution-leaderboard";
import { buildLeaderboard, groupContributionsByContributor } from "../lib/contribution-leaderboard";
import type { ContributionKind, HelpfulnessWeights, ReviewerEndorsement } from "../lib/community-rating";
import { DEFAULT_HELPFULNESS_WEIGHTS, rankContributions } from "../lib/community-rating";
import type { ContributorAward } from "../lib/contributor-awards";
import { DEFAULT_AWARD_CATEGORY_LABELS, buildTopContributorAwards } from "../lib/contributor-awards";

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
