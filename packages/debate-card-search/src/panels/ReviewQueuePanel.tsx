/**
 * @fileoverview Review Queue panel — the "(a) a review-queue/comment-thread
 * UI that reads/writes through this store" follow-up named under the
 * "🗣️ Peer Review System" bullet in TODO.md's Research Crowdsourcing
 * Organizer Features list.
 *
 * Lets a user start a card's review (optionally recording an author id),
 * move it through the `lib/peer-review.ts` state machine (submit, request
 * changes, approve, reject, publish), and leave/resolve comments on its
 * thread — all through the already-persisted `state/peerReviews.ts`
 * (`savePeerReview`, `deletePeerReview`, `buildReviewQueuePanelView`).
 *
 * Approve/reject/publish — the three transitions that move a card toward or
 * away from actually going live — are permission-gated two ways, closing
 * follow-up (b) named under the "🗣️ Peer Review System" bullet: the acting
 * reviewer id typed into "Your reviewer ID" must meet
 * `reviewer-permissions.ts`'s `MIN_REVIEWER_TIER` (derived from their own
 * Contribution Leaderboard record, via `state/peerReviews.ts`'s
 * `approve/reject/publishPersistedReviewAsReviewer`), and — enforced inside
 * `lib/peer-review.ts` itself — it can't match the review's own `authorId`.
 * Submitting, commenting, and requesting changes stay open to anyone.
 *
 * An optional `signedInContributorId` prop (mirroring `TaskInboxPanel`'s
 * identical convention) prefills "Your reviewer ID" and, per card, the
 * comment thread's "Reviewer ID" field with a real signed-in visitor's
 * derived id — a starting value only; typing over either field is always
 * respected afterward, and a signed-out visitor sees the same blank fields
 * as before.
 *
 * @module panels/ReviewQueuePanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { Label } from "debate-ui/src/primitives/label"
import { RadioGroup, RadioGroupItem } from "debate-ui/src/primitives/radio-group"
import { Textarea } from "debate-ui/src/primitives/textarea"
import {
  addReviewComment,
  buildReviewSummary,
  createCardReview,
  requestChanges,
  resolveReviewComment,
  reviseRejectedReview,
  submitForReview,
  type CardReview,
  type CommentSeverity,
  type ReviewStatus,
} from "../lib/peer-review"
import { MIN_REVIEWER_TIER } from "../lib/reviewer-permissions"
import {
  approvePersistedReviewAsReviewer,
  buildReviewQueuePanelView,
  deletePeerReview,
  publishPersistedReviewAsReviewer,
  rejectPersistedReviewAsReviewer,
  savePeerReview,
} from "../state/peerReviews"

const STATUS_LABEL: Record<ReviewStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
  published: "Published",
  rejected: "Rejected",
}

const STATUS_VARIANT: Record<ReviewStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  in_review: "secondary",
  changes_requested: "default",
  approved: "secondary",
  published: "outline",
  rejected: "destructive",
}

type CommentDraft = { reviewerId: string; severity: CommentSeverity; body: string }

const EMPTY_COMMENT_DRAFT: CommentDraft = { reviewerId: "", severity: "suggestion", body: "" }

export interface ReviewQueuePanelProps {
  /**
   * A real signed-in visitor's derived contributor id (see
   * `lib/session-identity.ts`'s `deriveContributorIdFromSessionIdentity`).
   * Prefills "Your reviewer ID" and each card's comment "Reviewer ID"
   * field's *initial* value only — never overwrites a visitor's own edit.
   */
  signedInContributorId?: string
}

/**
 * Renders the Review Queue panel: a form to start a new card's review, plus
 * every persisted `CardReview` (sorted by `cardId`), each with lifecycle
 * actions for its current status and a comment thread with an add/resolve
 * form.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function ReviewQueuePanel({ signedInContributorId }: ReviewQueuePanelProps = {}) {
  const [reviews, setReviews] = useState<CardReview[] | null>(null)
  const [newCardId, setNewCardId] = useState("")
  const [newAuthorId, setNewAuthorId] = useState("")
  const [actingReviewerId, setActingReviewerId] = useState("")
  const [hasEditedActingReviewerId, setHasEditedActingReviewerId] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [commentDrafts, setCommentDrafts] = useState<Record<string, CommentDraft>>({})

  useEffect(() => {
    setReviews(buildReviewQueuePanelView())
  }, [])

  useEffect(() => {
    if (!hasEditedActingReviewerId && signedInContributorId) {
      setActingReviewerId(signedInContributorId)
    }
  }, [signedInContributorId, hasEditedActingReviewerId])

  const refresh = () => setReviews(buildReviewQueuePanelView())

  const commentDraftFor = (cardId: string): CommentDraft =>
    commentDrafts[cardId] ?? { ...EMPTY_COMMENT_DRAFT, reviewerId: signedInContributorId ?? "" }

  const setCommentDraft = (cardId: string, patch: Partial<CommentDraft>) => {
    setCommentDrafts((prev) => ({ ...prev, [cardId]: { ...commentDraftFor(cardId), ...patch } }))
  }

  const handleStartReview = () => {
    const cardId = newCardId.trim()
    if (!cardId) {
      setError("Card ID is required.")
      return
    }
    savePeerReview(createCardReview(cardId, newAuthorId))
    setError(null)
    setNewCardId("")
    setNewAuthorId("")
    refresh()
  }

  const applyTransition = (review: CardReview, transition: (review: CardReview) => CardReview) => {
    try {
      savePeerReview(transition(review))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the review.")
    }
    refresh()
  }

  const applyGatedTransition = (
    cardId: string,
    gatedTransition: (cardId: string, reviewerId: string) => CardReview | undefined,
  ) => {
    const reviewerId = actingReviewerId.trim()
    if (!reviewerId) {
      setError(`Enter your reviewer ID above — approving, rejecting, and publishing need a ${MIN_REVIEWER_TIER} contribution record.`)
      return
    }
    try {
      gatedTransition(cardId, reviewerId)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the review.")
    }
    refresh()
  }

  const handleAddComment = (review: CardReview) => {
    const draft = commentDraftFor(review.cardId)
    const reviewerId = draft.reviewerId.trim()
    const body = draft.body.trim()
    if (!reviewerId || !body) {
      setError("Reviewer ID and comment text are required.")
      return
    }
    savePeerReview(
      addReviewComment(review, {
        id: `${review.cardId}-${review.comments.length}-${reviewerId}-${draft.severity}`,
        reviewerId,
        body,
        severity: draft.severity,
      }),
    )
    setError(null)
    setCommentDrafts((prev) => ({ ...prev, [review.cardId]: EMPTY_COMMENT_DRAFT }))
    refresh()
  }

  const handleResolveComment = (review: CardReview, commentId: string) => {
    savePeerReview(resolveReviewComment(review, commentId))
    refresh()
  }

  const handleRemove = (cardId: string) => {
    deletePeerReview(cardId)
    refresh()
  }

  if (reviews === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading review queue…</div>
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Review Queue</h1>
        <p className="text-sm text-muted-foreground">
          Move a submitted card through peer review — comment, request changes, approve, and
          publish — before it goes live in the shared library.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="review-acting-reviewer-id">Your reviewer ID</Label>
          <Input
            id="review-acting-reviewer-id"
            value={actingReviewerId}
            onChange={(e) => {
              setActingReviewerId(e.target.value)
              setHasEditedActingReviewerId(true)
            }}
            placeholder="alice"
            className="max-w-xs"
          />
          <p className="text-xs text-muted-foreground">
            Approving, rejecting, and publishing are gated on your own contribution record — they need a{" "}
            {MIN_REVIEWER_TIER} tier on the Contribution Leaderboard — and can't be the review's own author.
            Submitting, commenting, and requesting changes are open to anyone.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="review-new-card-id">Card ID</Label>
            <Input
              id="review-new-card-id"
              value={newCardId}
              onChange={(e) => setNewCardId(e.target.value)}
              placeholder="card-1"
              className="max-w-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="review-new-author-id">Author ID (optional)</Label>
            <Input
              id="review-new-author-id"
              value={newAuthorId}
              onChange={(e) => setNewAuthorId(e.target.value)}
              placeholder="alice"
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              Recording an author blocks that same id from approving, rejecting, or publishing this review.
            </p>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={handleStartReview}>Start review</Button>
      </div>

      {reviews.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No cards in review yet. Start one above to see it here.
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => {
            const draft = commentDraftFor(review.cardId)
            const unresolvedBlocking = review.comments.filter(
              (comment) => comment.severity === "blocking" && !comment.resolved,
            )

            return (
              <div key={review.cardId} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{review.cardId}</span>
                    <Badge variant={STATUS_VARIANT[review.status]}>{STATUS_LABEL[review.status]}</Badge>
                    {review.authorId && (
                      <span className="text-xs text-muted-foreground">by {review.authorId}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(review.status === "draft" || review.status === "changes_requested") && (
                      <Button size="sm" variant="outline" onClick={() => applyTransition(review, submitForReview)}>
                        {review.status === "draft" ? "Submit for review" : "Resubmit"}
                      </Button>
                    )}
                    {review.status === "in_review" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => applyTransition(review, requestChanges)}>
                          Request changes
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => applyGatedTransition(review.cardId, approvePersistedReviewAsReviewer)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => applyGatedTransition(review.cardId, rejectPersistedReviewAsReviewer)}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {review.status === "approved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => applyGatedTransition(review.cardId, publishPersistedReviewAsReviewer)}
                      >
                        Publish
                      </Button>
                    )}
                    {review.status === "rejected" && (
                      <Button size="sm" variant="outline" onClick={() => applyTransition(review, reviseRejectedReview)}>
                        Revise
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => handleRemove(review.cardId)}>
                      Remove
                    </Button>
                  </div>
                </div>

                {review.comments.length > 0 && (
                  <div className="space-y-1.5">
                    {review.comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-foreground">{comment.reviewerId}</span>
                            <Badge variant={comment.severity === "blocking" ? "destructive" : "outline"}>
                              {comment.severity}
                            </Badge>
                            {comment.resolved && <Badge variant="secondary">resolved</Badge>}
                          </div>
                          <p className="text-muted-foreground">{comment.body}</p>
                        </div>
                        {!comment.resolved && (
                          <Button size="sm" variant="ghost" onClick={() => handleResolveComment(review, comment.id)}>
                            Resolve
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {unresolvedBlocking.length > 0 && (
                  <p className="text-xs text-destructive">
                    {unresolvedBlocking.length} unresolved blocking comment(s) — approval is blocked until they're
                    resolved.
                  </p>
                )}

                <div className="flex flex-wrap items-end gap-3 rounded-md border border-border p-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`review-comment-reviewer-${review.cardId}`}>Reviewer ID</Label>
                    <Input
                      id={`review-comment-reviewer-${review.cardId}`}
                      value={draft.reviewerId}
                      onChange={(e) => setCommentDraft(review.cardId, { reviewerId: e.target.value })}
                      placeholder="alice"
                      className="h-8 w-32 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Severity</Label>
                    <RadioGroup
                      value={draft.severity}
                      onValueChange={(value) => setCommentDraft(review.cardId, { severity: value as CommentSeverity })}
                      className="flex items-center gap-3"
                    >
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="suggestion" id={`review-comment-suggestion-${review.cardId}`} />
                        <Label htmlFor={`review-comment-suggestion-${review.cardId}`} className="font-normal">
                          Suggestion
                        </Label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="blocking" id={`review-comment-blocking-${review.cardId}`} />
                        <Label htmlFor={`review-comment-blocking-${review.cardId}`} className="font-normal">
                          Blocking
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="min-w-[200px] flex-1 space-y-1.5">
                    <Label htmlFor={`review-comment-body-${review.cardId}`}>Comment</Label>
                    <Textarea
                      id={`review-comment-body-${review.cardId}`}
                      value={draft.body}
                      onChange={(e) => setCommentDraft(review.cardId, { body: e.target.value })}
                      placeholder="Cite this claim…"
                      className="min-h-[36px] text-xs"
                    />
                  </div>
                  <Button size="sm" onClick={() => handleAddComment(review)}>
                    Add comment
                  </Button>
                </div>

                <p className="whitespace-pre-line text-xs text-muted-foreground">{buildReviewSummary(review)}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
