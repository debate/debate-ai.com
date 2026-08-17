/**
 * @fileoverview Persistent storage for `peer-review.ts`'s `CardReview`
 * records — the "(a) persisting `CardReview`/`ReviewComment` alongside
 * submitted cards" follow-up named for the "Peer Review System" idea in
 * TODO.md. Stores reviews in localStorage, mirroring the existing
 * `sprintNotes.ts` persistence convention in this package.
 *
 * `applyPersistedReviewUpdate` and the `*PersistedReview*` functions below
 * close that same bullet's "(a) a review-queue/comment-thread UI that
 * reads/writes through this store" follow-up's write half — each applies
 * `peer-review.ts`'s corresponding pure state transition directly against
 * a stored review and saves the result, mirroring `prepNotes.ts`'s
 * `updatePersistedPrepNoteStatus` "compose the pure function directly
 * against the persisted store" convention. A transition that the state
 * machine rejects (an illegal status jump, or approving with unresolved
 * blocking comments) throws the same error `peer-review.ts` would, before
 * anything is saved, so a rejected transition leaves the stored review
 * untouched.
 *
 * `buildPeerReviewsPanelView` composes every persisted review into a
 * status-grouped, panel-ready view. `panels/PeerReviewsPanel.tsx` renders
 * it, closing the read half of the same follow-up.
 *
 * @module state/peerReviews
 */

import type { CardReview, ReviewComment, ReviewStatus } from "../lib/peer-review";
import {
  addReviewComment,
  approveReview,
  publishReview,
  rejectReview,
  requestChanges,
  resolveReviewComment,
  submitForReview,
} from "../lib/peer-review";

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
 * Applies a pure `peer-review.ts` state transition to the persisted review
 * with `cardId` and saves the result. Returns the updated review, or
 * `undefined` (leaving storage untouched) if no review with that `cardId`
 * is stored. If `transition` throws (an illegal status jump, or approving
 * with unresolved blocking comments), the throw propagates and nothing is
 * saved.
 */
function applyPersistedReviewUpdate(
  cardId: string,
  transition: (review: CardReview) => CardReview,
): CardReview | undefined {
  const review = getPeerReview(cardId);
  if (!review) return undefined;

  const updated = transition(review);
  savePeerReview(updated);
  return updated;
}

/** Submits a persisted draft (or changes-requested review) for teammate review. */
export function submitPersistedReviewForReview(cardId: string): CardReview | undefined {
  return applyPersistedReviewUpdate(cardId, submitForReview);
}

/** Sends a persisted in-review card back to the author for changes. */
export function requestPersistedReviewChanges(cardId: string): CardReview | undefined {
  return applyPersistedReviewUpdate(cardId, requestChanges);
}

/**
 * Approves a persisted review. Throws `UnresolvedBlockingCommentsError`
 * (from `peer-review.ts`) without saving if any blocking comment is still
 * unresolved.
 */
export function approvePersistedReview(cardId: string): CardReview | undefined {
  return applyPersistedReviewUpdate(cardId, approveReview);
}

/** Rejects a persisted in-review card outright. */
export function rejectPersistedReview(cardId: string): CardReview | undefined {
  return applyPersistedReviewUpdate(cardId, rejectReview);
}

/** Publishes a persisted approved review, making the card live. */
export function publishPersistedReview(cardId: string): CardReview | undefined {
  return applyPersistedReviewUpdate(cardId, publishReview);
}

/**
 * Appends a reviewer comment to a persisted review's thread. A blocking
 * comment posted while the review is "in_review" automatically moves it to
 * "changes_requested", matching `peer-review.ts`'s `addReviewComment`.
 */
export function addPersistedReviewComment(
  cardId: string,
  comment: Omit<ReviewComment, "resolved">,
): CardReview | undefined {
  return applyPersistedReviewUpdate(cardId, (review) => addReviewComment(review, comment));
}

/** Marks one comment on a persisted review resolved by id. */
export function resolvePersistedReviewComment(cardId: string, commentId: string): CardReview | undefined {
  return applyPersistedReviewUpdate(cardId, (review) => resolveReviewComment(review, commentId));
}

/** One status group of persisted card reviews, for the peer-review panel. */
export type PeerReviewPanelGroup = {
  status: ReviewStatus;
  reviews: CardReview[];
};

/**
 * Status groups in the order a peer-review panel should render them —
 * reviews actively needing teammate action surfaced first, terminal
 * statuses last.
 */
export const REVIEW_STATUS_ORDER: ReviewStatus[] = [
  "in_review",
  "changes_requested",
  "draft",
  "approved",
  "published",
  "rejected",
];

/**
 * Reads every persisted card review and groups it by status, in
 * `REVIEW_STATUS_ORDER`. Used by `PeerReviewsPanel` to render a
 * status-grouped review queue.
 */
export function buildPeerReviewsPanelView(): PeerReviewPanelGroup[] {
  const reviews = readAll();
  return REVIEW_STATUS_ORDER.map((status) => ({
    status,
    reviews: reviews.filter((review) => review.status === status),
  }));
}
