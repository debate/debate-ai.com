/**
 * @fileoverview Pure card peer-review lifecycle helpers for the "Peer
 * Review System" idea in TODO.md ("Allow teammates to review, comment on,
 * and refine submitted cards before they go live"). Models a submitted
 * card's review as an explicit status state machine plus a thread of
 * reviewer comments, and blocks a review from being approved while any
 * blocking comment is still unresolved. This is the first slice only — it
 * is pure state-transition logic over a caller-supplied `CardReview`; it
 * doesn't persist reviews, notify reviewers, or render a review UI. See
 * the follow-ups noted in TODO.md.
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

/** Starts a new, empty review for a card in the "draft" status. */
export function createCardReview(cardId: string): CardReview {
  return { cardId, status: "draft", comments: [] };
}

/** Whether `to` is a legal next status from `from`. */
export function canTransitionReviewStatus(from: ReviewStatus, to: ReviewStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

function transitionReview(review: CardReview, to: ReviewStatus): CardReview {
  if (!canTransitionReviewStatus(review.status, to)) {
    throw new InvalidReviewTransitionError(review.status, to);
  }
  return { ...review, status: to };
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

/** Explicitly sends an in-review card back to the author for changes. */
export function requestChanges(review: CardReview): CardReview {
  return transitionReview(review, "changes_requested");
}

/**
 * Approves a review. Throws `UnresolvedBlockingCommentsError` if any
 * blocking comment hasn't been resolved yet, so approval can't skip past
 * requested changes.
 */
export function approveReview(review: CardReview): CardReview {
  const unresolved = getUnresolvedBlockingComments(review);
  if (unresolved.length > 0) {
    throw new UnresolvedBlockingCommentsError(unresolved.length);
  }
  return transitionReview(review, "approved");
}

/** Rejects an in-review card outright; it can be revised back to "draft" afterward. */
export function rejectReview(review: CardReview): CardReview {
  return transitionReview(review, "rejected");
}

/** Sends a rejected card back to "draft" so its author can revise and resubmit it. */
export function reviseRejectedReview(review: CardReview): CardReview {
  return transitionReview(review, "draft");
}

/** Publishes an approved card, making it live. */
export function publishReview(review: CardReview): CardReview {
  return transitionReview(review, "published");
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
  return lines.join("\n");
}
