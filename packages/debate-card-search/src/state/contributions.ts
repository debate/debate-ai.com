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
 * @module state/contributions
 */

import type { AttributedContribution, ContributorStats } from "../lib/contribution-leaderboard";
import { buildLeaderboard, groupContributionsByContributor } from "../lib/contribution-leaderboard";
import type { HelpfulnessWeights, ReviewerEndorsement } from "../lib/community-rating";
import { DEFAULT_HELPFULNESS_WEIGHTS } from "../lib/community-rating";

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
