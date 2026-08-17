/**
 * @fileoverview Peer Review System panel — the "(a) a review-queue/
 * comment-thread UI that reads/writes through this store" follow-up named
 * under the "🗣️ Peer Review System" bullet in TODO.md's Research
 * Crowdsourcing Organizer Features list.
 *
 * Reads every persisted card review via `state/peerReviews.ts`'s
 * `buildPeerReviewsPanelView` (a thin grouping of `listPeerReviews` by
 * status, reviews actively needing action surfaced first) and renders it as
 * a status-grouped review queue. Every lifecycle action (submit, approve,
 * request changes, reject, publish) and comment action (add, resolve) calls
 * the already-persisted `*PersistedReview*` functions directly — no new
 * state-machine or comment-thread logic is introduced here. `approvePersistedReview`
 * can throw `UnresolvedBlockingCommentsError` (from `lib/peer-review.ts`)
 * when blocking comments are still unresolved; the panel catches it and
 * shows the message inline on that review rather than crashing.
 *
 * A minimal "start a review" form (cardId only) calls the already-existing
 * `createCardReview`/`savePeerReview` directly, since no card-submission
 * flow exists yet to seed a review automatically — see follow-up (c) in
 * TODO.md.
 *
 * @module panels/PeerReviewsPanel
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
  savePeerReview,
  submitPersistedReviewForReview,
  type PeerReviewPanelGroup,
} from "../state/peerReviews"
import { createCardReview, type CardReview, type CommentSeverity, type ReviewStatus } from "../lib/peer-review"

const STATUS_LABEL: Record<ReviewStatus, string> = {
  in_review: "In review",
  changes_requested: "Changes requested",
  draft: "Draft",
  approved: "Approved",
  published: "Published",
  rejected: "Rejected",
}

const STATUS_VARIANT: Record<ReviewStatus, "default" | "secondary" | "outline"> = {
  in_review: "default",
  changes_requested: "default",
  draft: "secondary",
  approved: "secondary",
  published: "outline",
  rejected: "outline",
}

type CommentDraft = { reviewerId: string; body: string; severity: CommentSeverity }

const EMPTY_DRAFT: CommentDraft = { reviewerId: "", body: "", severity: "suggestion" }

/**
 * Renders the Peer Review panel: every persisted `CardReview`, grouped by
 * status (reviews needing teammate action first), each with its comment
 * thread and the lifecycle actions legal from its current status.
 *
 * Reads localStorage on mount only (client-side), so it renders an empty
 * state during SSR/hydration rather than throwing.
 */
export function PeerReviewsPanel() {
  const [groups, setGroups] = useState<PeerReviewPanelGroup[] | null>(null)
  const [newCardId, setNewCardId] = useState("")
  const [commentDrafts, setCommentDrafts] = useState<Record<string, CommentDraft>>({})
  const [errorByCardId, setErrorByCardId] = useState<Record<string, string>>({})

  useEffect(() => {
    setGroups(buildPeerReviewsPanelView())
  }, [])

  const refresh = () => setGroups(buildPeerReviewsPanelView())

  const draftFor = (cardId: string): CommentDraft => commentDrafts[cardId] ?? EMPTY_DRAFT

  const runAction = (cardId: string, action: () => void) => {
    try {
      action()
      setErrorByCardId((prev) => {
        if (!(cardId in prev)) return prev
        const next = { ...prev }
        delete next[cardId]
        return next
      })
    } catch (error) {
      setErrorByCardId((prev) => ({
        ...prev,
        [cardId]: error instanceof Error ? error.message : "That action isn't allowed right now.",
      }))
    }
    refresh()
  }

  const handleStartReview = () => {
    const cardId = newCardId.trim()
    if (!cardId) return
    savePeerReview(createCardReview(cardId))
    setNewCardId("")
    refresh()
  }

  const handleAddComment = (cardId: string) => {
    const draft = draftFor(cardId)
    if (!draft.reviewerId.trim() || !draft.body.trim()) return
    runAction(cardId, () => {
      addPersistedReviewComment(cardId, {
        id: typeof crypto !== "undefined" ? crypto.randomUUID() : `comment-${Date.now()}`,
        reviewerId: draft.reviewerId.trim(),
        body: draft.body.trim(),
        severity: draft.severity,
      })
    })
    setCommentDrafts((prev) => ({ ...prev, [cardId]: EMPTY_DRAFT }))
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
          Review submitted cards before they go live: submit, comment, request changes, approve, and
          publish.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-3">
        <Input
          value={newCardId}
          onChange={(e) => setNewCardId(e.target.value)}
          placeholder="Card id to start a review for…"
          aria-label="Card id to start a review for"
          className="max-w-[280px]"
        />
        <Button size="sm" variant="outline" onClick={handleStartReview}>
          Start draft review
        </Button>
      </div>

      {totalReviews === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No card reviews yet. Start a draft review above once a card is ready for teammate feedback.
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
                {group.reviews.map((review) => (
                  <ReviewCard
                    key={review.cardId}
                    review={review}
                    error={errorByCardId[review.cardId]}
                    draft={draftFor(review.cardId)}
                    onDraftChange={(draft) =>
                      setCommentDrafts((prev) => ({ ...prev, [review.cardId]: draft }))
                    }
                    onAddComment={() => handleAddComment(review.cardId)}
                    onResolveComment={(commentId) =>
                      runAction(review.cardId, () => resolvePersistedReviewComment(review.cardId, commentId))
                    }
                    onSubmit={() => runAction(review.cardId, () => submitPersistedReviewForReview(review.cardId))}
                    onRequestChanges={() =>
                      runAction(review.cardId, () => requestPersistedReviewChanges(review.cardId))
                    }
                    onApprove={() => runAction(review.cardId, () => approvePersistedReview(review.cardId))}
                    onReject={() => runAction(review.cardId, () => rejectPersistedReview(review.cardId))}
                    onPublish={() => runAction(review.cardId, () => publishPersistedReview(review.cardId))}
                  />
                ))}
              </div>
            </div>
          ))
      )}
    </div>
  )
}

function ReviewCard({
  review,
  error,
  draft,
  onDraftChange,
  onAddComment,
  onResolveComment,
  onSubmit,
  onRequestChanges,
  onApprove,
  onReject,
  onPublish,
}: {
  review: CardReview
  error?: string
  draft: CommentDraft
  onDraftChange: (draft: CommentDraft) => void
  onAddComment: () => void
  onResolveComment: (commentId: string) => void
  onSubmit: () => void
  onRequestChanges: () => void
  onApprove: () => void
  onReject: () => void
  onPublish: () => void
}) {
  return (
    <div className="rounded-md border border-border px-3 py-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-foreground">{review.cardId}</span>
        <div className="flex flex-wrap gap-2">
          {review.status === "draft" && (
            <Button size="sm" variant="outline" onClick={onSubmit}>
              Submit for review
            </Button>
          )}
          {review.status === "changes_requested" && (
            <Button size="sm" variant="outline" onClick={onSubmit}>
              Resubmit for review
            </Button>
          )}
          {review.status === "in_review" && (
            <>
              <Button size="sm" variant="outline" onClick={onApprove}>
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={onRequestChanges}>
                Request changes
              </Button>
              <Button size="sm" variant="ghost" onClick={onReject}>
                Reject
              </Button>
            </>
          )}
          {review.status === "approved" && (
            <Button size="sm" variant="outline" onClick={onPublish}>
              Publish
            </Button>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {review.comments.length > 0 && (
        <div className="space-y-1.5">
          {review.comments.map((comment) => (
            <div
              key={comment.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-xs"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={comment.severity === "blocking" ? "default" : "outline"}>
                  {comment.severity}
                </Badge>
                <span className="font-medium text-foreground">{comment.reviewerId}:</span>
                <span className={comment.resolved ? "text-muted-foreground line-through" : "text-foreground"}>
                  {comment.body}
                </span>
              </div>
              {!comment.resolved && (
                <Button size="sm" variant="ghost" onClick={() => onResolveComment(comment.id)}>
                  Resolve
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={draft.reviewerId}
          onChange={(e) => onDraftChange({ ...draft, reviewerId: e.target.value })}
          placeholder="Your id…"
          aria-label={`Reviewer id for a comment on ${review.cardId}`}
          className="h-8 max-w-[140px] text-xs"
        />
        <Textarea
          value={draft.body}
          onChange={(e) => onDraftChange({ ...draft, body: e.target.value })}
          placeholder="Add a comment…"
          aria-label={`Comment body for ${review.cardId}`}
          className="h-8 min-h-8 flex-1 text-xs"
        />
        <Button
          size="sm"
          variant={draft.severity === "blocking" ? "default" : "outline"}
          onClick={() =>
            onDraftChange({ ...draft, severity: draft.severity === "blocking" ? "suggestion" : "blocking" })
          }
        >
          {draft.severity === "blocking" ? "Blocking" : "Suggestion"}
        </Button>
        <Button size="sm" variant="outline" onClick={onAddComment}>
          Comment
        </Button>
      </div>
    </div>
  )
}
