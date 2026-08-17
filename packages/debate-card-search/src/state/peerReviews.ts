/**
 * @fileoverview Persistent storage for `peer-review.ts`'s `CardReview`
 * records — the "(a) persisting `CardReview`/`ReviewComment` alongside
 * submitted cards" follow-up named for the "Peer Review System" idea in
 * TODO.md. Stores reviews in localStorage, mirroring the existing
 * `sprintNotes.ts` persistence convention in this package.
 *
 * Also adds the "(a) a review-queue/comment-thread UI that reads/writes
 * through this store" follow-up's write-side composition: thin wrappers
 * that apply `peer-review.ts`'s pure status transitions/comment mutations
 * directly against a stored `CardReview` and save the result, mirroring
 * `prepNotes.ts`'s `updatePersistedPrepNoteStatus` "compose the pure
 * transition directly against the persisted store" convention. Each
 * wrapper returns `undefined` (and leaves storage untouched) for a
 * `cardId` that isn't stored; a transition that the state machine itself
 * rejects still throws `InvalidReviewTransitionError`/
 * `UnresolvedBlockingCommentsError` rather than being swallowed here.
 *
 * @module state/peerReviews
 */

import {
  addReviewComment,
  approveReview,
  createCardReview,
  publishReview,
  rejectReview,
  requestChanges,
  resolveReviewComment,
  reviseRejectedReview,
  submitForReview,
  type CardReview,
  type ReviewComment,
  type ReviewStatus,
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
 * Starts a new persisted review for `cardId` in the "draft" status, or
 * returns the existing one unchanged if a review for that card is already
 * stored — idempotent, so a panel can call this on every "start review"
 * click without risking overwriting an in-flight review.
 */
export function startPersistedCardReview(cardId: string): CardReview {
  const existing = getPeerReview(cardId);
  if (existing) return existing;
  const created = createCardReview(cardId);
  savePeerReview(created);
  return created;
}

function applyPersistedTransition(cardId: string, transition: (review: CardReview) => CardReview): CardReview | undefined {
  const review = getPeerReview(cardId);
  if (!review) return undefined;
  const updated = transition(review);
  savePeerReview(updated);
  return updated;
}

/** Submits a persisted draft (or a review with requested changes) for teammate review. */
export function submitPersistedReviewForReview(cardId: string): CardReview | undefined {
  return applyPersistedTransition(cardId, submitForReview);
}

/** Sends a persisted in-review card back to the author for changes. */
export function requestPersistedReviewChanges(cardId: string): CardReview | undefined {
  return applyPersistedTransition(cardId, requestChanges);
}

/**
 * Approves a persisted review. Throws `UnresolvedBlockingCommentsError` if
 * any blocking comment hasn't been resolved yet, same as the underlying
 * pure `approveReview`.
 */
export function approvePersistedReview(cardId: string): CardReview | undefined {
  return applyPersistedTransition(cardId, approveReview);
}

/** Rejects a persisted in-review card outright. */
export function rejectPersistedReview(cardId: string): CardReview | undefined {
  return applyPersistedTransition(cardId, rejectReview);
}

/** Publishes a persisted approved card, making it live. */
export function publishPersistedReview(cardId: string): CardReview | undefined {
  return applyPersistedTransition(cardId, publishReview);
}

/** Sends a persisted rejected card back to "draft" so its author can revise it. */
export function revisePersistedRejectedReview(cardId: string): CardReview | undefined {
  return applyPersistedTransition(cardId, reviseRejectedReview);
}

/** Appends a reviewer comment to a persisted review's thread. */
export function addPersistedReviewComment(
  cardId: string,
  comment: Omit<ReviewComment, "resolved">,
): CardReview | undefined {
  return applyPersistedTransition(cardId, (review) => addReviewComment(review, comment));
}

/** Marks one comment resolved by id on a persisted review. */
export function resolvePersistedReviewComment(cardId: string, commentId: string): CardReview | undefined {
  return applyPersistedTransition(cardId, (review) => resolveReviewComment(review, commentId));
}

/** Status display order for the review-queue panel — needs-action statuses first. */
const PANEL_STATUS_ORDER: ReviewStatus[] = [
  "in_review",
  "changes_requested",
  "draft",
  "approved",
  "published",
  "rejected",
];

/** One status group in the review-queue panel view. */
export interface PeerReviewsPanelGroup {
  status: ReviewStatus;
  reviews: CardReview[];
}

/**
 * Groups every persisted `CardReview` by status, in `PANEL_STATUS_ORDER`
 * (statuses needing action first), for the review-queue panel.
 */
export function buildPeerReviewsPanelView(): PeerReviewsPanelGroup[] {
  const all = listPeerReviews();
  return PANEL_STATUS_ORDER.map((status) => ({
    status,
    reviews: all.filter((review) => review.status === status),
  }));
}
