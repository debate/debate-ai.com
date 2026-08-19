/**
 * @fileoverview Pure card peer-review lifecycle helpers for the "Peer
 * Review System" idea in TODO.md ("Allow teammates to review, comment on,
 * and refine submitted cards before they go live"). Models a submitted
 * card's review as an explicit status state machine plus a thread of
 * reviewer comments, and blocks a review from being approved while any
 * blocking comment is still unresolved, and guards the transitions that move
 * a card toward or away from actually going live (approve/reject/publish)
 * against a reviewer acting on their own submission (`CardReview.authorId`).
 * This is pure
 * state-transition logic over a caller-supplied `CardReview`; it doesn't
 * persist reviews, notify reviewers, or render a review UI. See the
 * follow-ups noted in TODO.md.
 *
 * @module lib/peer-review
 */

/** Where a card sits in the peer-review lifecycle. */
export type ReviewStatus = "draft" | "in_review" | "changes_requested" | "approved" | "published" | "rejected";

/** How much a comment should hold up publishing. */
export type CommentSeverity = "blocking" | "suggestion";

/** One reviewer's comment on a card under review. */
export interface ReviewComment {
  id: string;
  reviewerId: string;
  body: string;
  severity: CommentSeverity;
  resolved: boolean;
}

/** A card's full peer-review state: its lifecycle status plus its comment thread. */
export interface CardReview {
  cardId: string;
  status: ReviewStatus;
  comments: ReviewComment[];
  /** Free-text id of whoever submitted the card, mirroring this package's existing `authorId` convention (e.g. `SprintNote.authorId`). Optional so reviews started before this field existed keep working. */
  authorId?: string;
  /** Free-text id of whoever last took a gatekeeping action (request changes/approve/reject/publish), for accountability. */
  reviewedBy?: string;
}

/** Legal next statuses for each current status — anything else is rejected. */
const ALLOWED_TRANSITIONS: Record<ReviewStatus, ReviewStatus[]> = {
  draft: ["in_review"],
  in_review: ["changes_requested", "approved", "rejected"],
  changes_requested: ["in_review"],
  approved: ["published"],
  published: [],
  rejected: ["draft"],
};

/** Thrown when a caller attempts a status change the state machine doesn't allow. */
export class InvalidReviewTransitionError extends Error {
  constructor(from: ReviewStatus, to: ReviewStatus) {
    super(`Cannot move a card review from "${from}" to "${to}"`);
    this.name = "InvalidReviewTransitionError";
  }
}

/** Thrown by `approveReview` when blocking comments are still unresolved. */
export class UnresolvedBlockingCommentsError extends Error {
  constructor(count: number) {
    super(`Cannot approve a review with ${count} unresolved blocking comment(s)`);
    this.name = "UnresolvedBlockingCommentsError";
  }
}

/** Thrown when a gatekeeping action (request changes/approve/reject/publish) is attempted without a reviewer id. */
export class ReviewerIdRequiredError extends Error {
  constructor(action: string) {
    super(`A reviewer id is required to ${action}`);
    this.name = "ReviewerIdRequiredError";
  }
}

/** Thrown when a reviewer id matches the review's own `authorId` — no self-review. */
export class SelfReviewNotAllowedError extends Error {
  constructor(reviewerId: string) {
    super(`Reviewer "${reviewerId}" cannot take this action on their own submission`);
    this.name = "SelfReviewNotAllowedError";
  }
}

/** Starts a new, empty review for a card in the "draft" status. `authorId` is optional free-text, matching this package's existing author-id convention. */
export function createCardReview(cardId: string, authorId?: string): CardReview {
  const trimmedAuthorId = authorId?.trim();
  return { cardId, status: "draft", comments: [], ...(trimmedAuthorId ? { authorId: trimmedAuthorId } : {}) };
}

/**
 * Guards a gatekeeping transition (approve/reject/publish): a reviewer id
 * is required, and it can't match the review's own `authorId`
 * — closes follow-up (b) named under the "🗣️ Peer Review System" bullet in
 * TODO.md ("reviewer identity/permission checks"). A review with no
 * recorded `authorId` (started before this field existed, or by a caller
 * who left it blank) has no self-review to guard against, matching this
 * repo's "works standalone, gated further once the gating data exists"
 * convention.
 */
function assertReviewerAllowed(review: CardReview, reviewerId: string, action: string): string {
  const trimmed = reviewerId.trim();
  if (!trimmed) {
    throw new ReviewerIdRequiredError(action);
  }
  if (review.authorId && trimmed === review.authorId) {
    throw new SelfReviewNotAllowedError(trimmed);
  }
  return trimmed;
}

/** Whether `to` is a legal next status from `from`. */
export function canTransitionReviewStatus(from: ReviewStatus, to: ReviewStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

function transitionReview(review: CardReview, to: ReviewStatus, reviewedBy?: string): CardReview {
  if (!canTransitionReviewStatus(review.status, to)) {
    throw new InvalidReviewTransitionError(review.status, to);
  }
  return { ...review, status: to, ...(reviewedBy ? { reviewedBy } : {}) };
}

/** Submits a draft (or a review with requested changes) for teammate review. */
export function submitForReview(review: CardReview): CardReview {
  return transitionReview(review, "in_review");
}

/** All comments still marked unresolved with `severity: "blocking"`. */
export function getUnresolvedBlockingComments(review: CardReview): ReviewComment[] {
  return review.comments.filter((comment) => comment.severity === "blocking" && !comment.resolved);
}

/**
 * Appends a reviewer comment to the thread. A blocking comment posted while
 * the review is "in_review" automatically moves it to "changes_requested",
 * so the author is notified refinement is needed without a separate action.
 */
export function addReviewComment(review: CardReview, comment: Omit<ReviewComment, "resolved">): CardReview {
  const comments = [...review.comments, { ...comment, resolved: false }];
  if (comment.severity === "blocking" && review.status === "in_review") {
    return { ...review, comments, status: "changes_requested" };
  }
  return { ...review, comments };
}

/** Marks one comment resolved by id; leaves the review unchanged if the id isn't found. */
export function resolveReviewComment(review: CardReview, commentId: string): CardReview {
  return {
    ...review,
    comments: review.comments.map((comment) => (comment.id === commentId ? { ...comment, resolved: true } : comment)),
  };
}

/**
 * Explicitly sends an in-review card back to the author for changes. Stays
 * open to anyone (no reviewer-id/self-review guard) — only the three
 * transitions that move a card toward or away from actually going live
 * (approve/reject/publish) are gated.
 */
export function requestChanges(review: CardReview): CardReview {
  return transitionReview(review, "changes_requested");
}

/**
 * Approves a review. Throws `UnresolvedBlockingCommentsError` if any
 * blocking comment hasn't been resolved yet, so approval can't skip past
 * requested changes. `reviewerId` is required and can't match the review's
 * own `authorId` (see `assertReviewerAllowed`).
 */
export function approveReview(review: CardReview, reviewerId: string): CardReview {
  const trimmed = assertReviewerAllowed(review, reviewerId, "approve a review");
  const unresolved = getUnresolvedBlockingComments(review);
  if (unresolved.length > 0) {
    throw new UnresolvedBlockingCommentsError(unresolved.length);
  }
  return transitionReview(review, "approved", trimmed);
}

/**
 * Rejects an in-review card outright; it can be revised back to "draft"
 * afterward. `reviewerId` is required and can't match the review's own
 * `authorId` (see `assertReviewerAllowed`).
 */
export function rejectReview(review: CardReview, reviewerId: string): CardReview {
  const trimmed = assertReviewerAllowed(review, reviewerId, "reject a review");
  return transitionReview(review, "rejected", trimmed);
}

/** Sends a rejected card back to "draft" so its author can revise and resubmit it. */
export function reviseRejectedReview(review: CardReview): CardReview {
  return transitionReview(review, "draft");
}

/**
 * Publishes an approved card, making it live. `reviewerId` is required and
 * can't match the review's own `authorId` (see `assertReviewerAllowed`).
 */
export function publishReview(review: CardReview, reviewerId: string): CardReview {
  const trimmed = assertReviewerAllowed(review, reviewerId, "publish a review");
  return transitionReview(review, "published", trimmed);
}

/** Whether a review is currently eligible to be published. */
export function isReadyToPublish(review: CardReview): boolean {
  return review.status === "approved" && getUnresolvedBlockingComments(review).length === 0;
}

/**
 * Whether a card is live — visible in the shared library — under peer-review
 * gating. Closes follow-up (c) named under the "🗣️ Peer Review System"
 * bullet in TODO.md: "wiring a review's lifecycle to whatever eventually
 * persists submitted cards, so `publishReview` can gate a card actually
 * going live." Peer review is opt-in, not required — a card with no review
 * at all (`review` is `undefined`) stays live, matching every other
 * "works standalone, gated further once the gating feature exists" slice in
 * this repo. Once a review exists, the card is held back from "live" for
 * every status except `"published"`.
 */
export function isCardLive(review: CardReview | undefined): boolean {
  return review === undefined || review.status === "published";
}

/**
 * Renders a short, human-readable summary of a review's current state —
 * status plus outstanding/resolved comment counts — for a review-queue or
 * card-detail panel.
 */
export function buildReviewSummary(review: CardReview): string {
  const unresolvedBlocking = getUnresolvedBlockingComments(review).length;
  const totalComments = review.comments.length;
  const resolvedComments = review.comments.filter((comment) => comment.resolved).length;

  const lines = [
    `Status: ${review.status}`,
    totalComments === 0
      ? "Comments: none yet"
      : `Comments: ${resolvedComments}/${totalComments} resolved` +
        (unresolvedBlocking > 0 ? ` (${unresolvedBlocking} blocking)` : ""),
  ];
  if (review.reviewedBy) {
    lines.push(`Last reviewed by: ${review.reviewedBy}`);
  }
  return lines.join("\n");
}
