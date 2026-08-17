/**
 * @fileoverview Peer Review panel — the "(a) a review-queue/comment-thread
 * UI that reads/writes through this store" follow-up named under the
 * "🗣️ Peer Review System" bullet in TODO.md's Research Crowdsourcing
 * Organizer Features list.
 *
 * Reads every persisted `CardReview` via `state/peerReviews.ts`'s
 * `buildPeerReviewsPanelView` (a thin grouping-by-status helper) and
 * renders it as a review queue. Every action (start a review, submit,
 * request changes, approve, reject, publish, revise-to-draft, add/resolve a
 * comment) calls the already-composed persisted mutators directly —
 * introducing no new review-lifecycle logic here.
 *
 * @module panels/PeerReviewPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { Textarea } from "debate-ui/src/primitives/textarea"
import {
  addPersistedReviewComment,
  approvePersistedReview,
  buildPeerReviewsPanelView,
  publishPersistedReview,
  rejectPersistedReview,
  requestPersistedReviewChanges,
  resolvePersistedReviewComment,
  revisePersistedRejectedReview,
  startPersistedCardReview,
  submitPersistedReviewForReview,
  type PeerReviewsPanelGroup,
} from "../state/peerReviews"
import { buildReviewSummary, getUnresolvedBlockingComments, type CommentSeverity, type ReviewStatus } from "../lib/peer-review"

const STATUS_LABEL: Record<ReviewStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
  published: "Published",
  rejected: "Rejected",
}

const STATUS_VARIANT: Record<ReviewStatus, "default" | "secondary" | "outline"> = {
  draft: "outline",
  in_review: "default",
  changes_requested: "default",
  approved: "secondary",
  published: "secondary",
  rejected: "outline",
}

interface CommentDraft {
  reviewerId: string
  body: string
  severity: CommentSeverity
}

const EMPTY_DRAFT: CommentDraft = { reviewerId: "", body: "", severity: "suggestion" }

/**
 * Renders the Peer Review queue: every persisted `CardReview` grouped by
 * status (statuses needing action first), each with its comment thread and
 * the lifecycle actions legal from its current status.
 *
 * Reads localStorage on mount only (client-side), so it renders an empty
 * state during SSR/hydration rather than throwing.
 */
export function PeerReviewPanel() {
  const [groups, setGroups] = useState<PeerReviewsPanelGroup[] | null>(null)
  const [newCardId, setNewCardId] = useState("")
  const [commentDrafts, setCommentDrafts] = useState<Record<string, CommentDraft>>({})

  useEffect(() => {
    setGroups(buildPeerReviewsPanelView())
  }, [])

  const refresh = () => setGroups(buildPeerReviewsPanelView())

  const handleStartReview = () => {
    const cardId = newCardId.trim()
    if (!cardId) return
    startPersistedCardReview(cardId)
    setNewCardId("")
    refresh()
  }

  const handleAddComment = (cardId: string) => {
    const draft = commentDrafts[cardId] ?? EMPTY_DRAFT
    const reviewerId = draft.reviewerId.trim()
    const body = draft.body.trim()
    if (!reviewerId || !body) return
    addPersistedReviewComment(cardId, {
      id: `${cardId}-${Date.now()}`,
      reviewerId,
      body,
      severity: draft.severity,
    })
    setCommentDrafts((prev) => ({ ...prev, [cardId]: EMPTY_DRAFT }))
    refresh()
  }

  if (groups === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading peer reviews…</div>
  }

  const totalReviews = groups.reduce((sum, group) => sum + group.reviews.length, 0)

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Peer Review</h1>
        <p className="text-sm text-muted-foreground">
          Review, comment on, and refine submitted cards before they go live.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-4 sm:flex-row sm:items-center">
        <Input
          value={newCardId}
          onChange={(e) => setNewCardId(e.target.value)}
          placeholder="Card id…"
          className="sm:max-w-xs"
          aria-label="Card id to start a review for"
        />
        <Button size="sm" onClick={handleStartReview}>
          Start review
        </Button>
      </div>

      {totalReviews === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No card reviews yet. Start one above by entering a card id.
        </div>
      ) : (
        groups
          .filter((group) => group.reviews.length > 0)
          .map((group) => (
            <div key={group.status} className="rounded-lg border border-border p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Badge variant={STATUS_VARIANT[group.status]}>{STATUS_LABEL[group.status]}</Badge>
                <span className="text-muted-foreground font-normal">({group.reviews.length})</span>
              </h2>
              <div className="space-y-3">
                {group.reviews.map((review) => {
                  const unresolvedBlocking = getUnresolvedBlockingComments(review)
                  const draft = commentDrafts[review.cardId] ?? EMPTY_DRAFT
                  return (
                    <div key={review.cardId} className="rounded-md border border-border px-3 py-2 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-foreground">{review.cardId}</span>
                        <div className="flex flex-wrap gap-2">
                          {review.status === "draft" && (
                            <Button size="sm" variant="outline" onClick={() => { submitPersistedReviewForReview(review.cardId); refresh() }}>
                              Submit for review
                            </Button>
                          )}
                          {review.status === "in_review" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={unresolvedBlocking.length > 0}
                                title={
                                  unresolvedBlocking.length > 0
                                    ? `${unresolvedBlocking.length} blocking comment(s) unresolved`
                                    : undefined
                                }
                                onClick={() => { approvePersistedReview(review.cardId); refresh() }}
                              >
                                Approve
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => { requestPersistedReviewChanges(review.cardId); refresh() }}>
                                Request changes
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { rejectPersistedReview(review.cardId); refresh() }}>
                                Reject
                              </Button>
                            </>
                          )}
                          {review.status === "changes_requested" && (
                            <Button size="sm" variant="outline" onClick={() => { submitPersistedReviewForReview(review.cardId); refresh() }}>
                              Resubmit
                            </Button>
                          )}
                          {review.status === "approved" && (
                            <Button size="sm" variant="outline" onClick={() => { publishPersistedReview(review.cardId); refresh() }}>
                              Publish
                            </Button>
                          )}
                          {review.status === "rejected" && (
                            <Button size="sm" variant="outline" onClick={() => { revisePersistedRejectedReview(review.cardId); refresh() }}>
                              Revise
                            </Button>
                          )}
                        </div>
                      </div>

                      <p className="whitespace-pre-line text-xs text-muted-foreground">{buildReviewSummary(review)}</p>

                      {review.comments.length > 0 && (
                        <div className="space-y-1.5">
                          {review.comments.map((comment) => (
                            <div
                              key={comment.id}
                              className="flex flex-wrap items-start justify-between gap-2 rounded border border-border/60 px-2 py-1.5 text-xs"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-foreground">{comment.reviewerId}</span>
                                  <Badge variant={comment.severity === "blocking" ? "default" : "outline"} className="text-[10px]">
                                    {comment.severity}
                                  </Badge>
                                  {comment.resolved && (
                                    <Badge variant="secondary" className="text-[10px]">
                                      resolved
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-muted-foreground">{comment.body}</p>
                              </div>
                              {!comment.resolved && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => { resolvePersistedReviewComment(review.cardId, comment.id); refresh() }}
                                >
                                  Resolve
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {review.status !== "published" && (
                        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end">
                          <Input
                            value={draft.reviewerId}
                            onChange={(e) =>
                              setCommentDrafts((prev) => ({ ...prev, [review.cardId]: { ...draft, reviewerId: e.target.value } }))
                            }
                            placeholder="Reviewer id…"
                            className="h-8 max-w-[160px] text-xs"
                          />
                          <Textarea
                            value={draft.body}
                            onChange={(e) =>
                              setCommentDrafts((prev) => ({ ...prev, [review.cardId]: { ...draft, body: e.target.value } }))
                            }
                            placeholder="Comment…"
                            className="min-h-8 flex-1 text-xs"
                          />
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              variant={draft.severity === "suggestion" ? "default" : "outline"}
                              onClick={() =>
                                setCommentDrafts((prev) => ({ ...prev, [review.cardId]: { ...draft, severity: "suggestion" } }))
                              }
                            >
                              Suggestion
                            </Button>
                            <Button
                              size="sm"
                              variant={draft.severity === "blocking" ? "default" : "outline"}
                              onClick={() =>
                                setCommentDrafts((prev) => ({ ...prev, [review.cardId]: { ...draft, severity: "blocking" } }))
                              }
                            >
                              Blocking
                            </Button>
                            <Button size="sm" onClick={() => handleAddComment(review.cardId)}>
                              Comment
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
      )}
    </div>
  )
}
