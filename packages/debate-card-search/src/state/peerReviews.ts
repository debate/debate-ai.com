/**
 * @fileoverview Persistent storage for `peer-review.ts`'s `CardReview`
 * records — the "(a) persisting `CardReview`/`ReviewComment` alongside
 * submitted cards" follow-up named for the "Peer Review System" idea in
 * TODO.md. Stores reviews in localStorage, mirroring the existing
 * `sprintNotes.ts` persistence convention in this package.
 *
 * @module state/peerReviews
 */

import type { CardReview } from "../lib/peer-review";
import { approveReviewAsReviewer, deriveReviewerTier, publishReviewAsReviewer, rejectReviewAsReviewer } from "../lib/reviewer-permissions";
import type { UnlockTier } from "../lib/progress-unlocks";
import { buildPersistedLeaderboard } from "./contributions";

const STORAGE_KEY = "peerReviews";

function readAll(): CardReview[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CardReview[]) : [];
  } catch {
    return [];
  }
}

function writeAll(reviews: CardReview[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
}

/** Lists every persisted card review. */
export function listPeerReviews(): CardReview[] {
  return readAll();
}

/** Looks up a single persisted card review by `cardId`, if any. */
export function getPeerReview(cardId: string): CardReview | undefined {
  return readAll().find((review) => review.cardId === cardId);
}

/** Saves a card review, overwriting any existing record for the same `cardId`. */
export function savePeerReview(review: CardReview): void {
  const reviews = readAll();
  const index = reviews.findIndex((existing) => existing.cardId === review.cardId);
  if (index === -1) {
    reviews.push(review);
  } else {
    reviews[index] = review;
  }
  writeAll(reviews);
}

/** Deletes a persisted card review by `cardId`; a no-op if it isn't stored. */
export function deletePeerReview(cardId: string): void {
  writeAll(readAll().filter((review) => review.cardId !== cardId));
}

/**
 * Lists every persisted card review sorted by `cardId`, for a stable
 * display order in the review-queue panel — mirrors the
 * `buildJudgeParadigmSelectionsPanelView`/`buildPrepNotesPanelView`
 * convention used by this repo's other panel-view helpers.
 */
export function buildReviewQueuePanelView(): CardReview[] {
  return [...readAll()].sort((a, b) => a.cardId.localeCompare(b.cardId));
}

/**
 * Derives `reviewerId`'s `UnlockTier` from the real Contribution Leaderboard
 * (`state/contributions.ts`'s `buildPersistedLeaderboard`) instead of
 * requiring a caller-supplied tier — closes follow-up (b) named under the
 * "🗣️ Peer Review System" bullet in TODO.md the same way every other
 * "derive eligibility from persisted history" slice in this package does.
 */
export function derivePersistedReviewerTier(reviewerId: string): UnlockTier {
  return deriveReviewerTier(reviewerId, buildPersistedLeaderboard());
}

/**
 * Applies a reviewer-permission-gated transition to the stored review for
 * `cardId` and saves the result. Returns `undefined` if no review is stored
 * for `cardId` (mirroring `state/contributions.ts`'s
 * `applyPersistedContributionUpdate` "no-op on missing id" convention);
 * otherwise re-throws whatever `gatedTransition` throws (an
 * `InsufficientReviewerPermissionError`, `InvalidReviewTransitionError`, or
 * `UnresolvedBlockingCommentsError`) without saving.
 */
function applyGatedPersistedReviewTransition(
  cardId: string,
  reviewerId: string,
  gatedTransition: (review: CardReview, reviewerId: string, reviewerTier: UnlockTier) => CardReview,
): CardReview | undefined {
  const review = getPeerReview(cardId);
  if (!review) return undefined;

  const updated = gatedTransition(review, reviewerId, derivePersistedReviewerTier(reviewerId));
  savePeerReview(updated);
  return updated;
}

/** Approves the stored review for `cardId` on behalf of `reviewerId`, gated by their derived tier. */
export function approvePersistedReviewAsReviewer(cardId: string, reviewerId: string): CardReview | undefined {
  return applyGatedPersistedReviewTransition(cardId, reviewerId, approveReviewAsReviewer);
}

/** Rejects the stored review for `cardId` on behalf of `reviewerId`, gated by their derived tier. */
export function rejectPersistedReviewAsReviewer(cardId: string, reviewerId: string): CardReview | undefined {
  return applyGatedPersistedReviewTransition(cardId, reviewerId, rejectReviewAsReviewer);
}

/** Publishes the stored review for `cardId` on behalf of `reviewerId`, gated by their derived tier. */
export function publishPersistedReviewAsReviewer(cardId: string, reviewerId: string): CardReview | undefined {
  return applyGatedPersistedReviewTransition(cardId, reviewerId, publishReviewAsReviewer);
}
