/**
 * @fileoverview Peer review queue — UI over `lib/peer-review.ts` reading and
 * writing the persisted reviews in `state/peerReviews.ts`.
 *
 * Drives a card review through its lifecycle (draft → in review → approved →
 * published), enforcing the slice's transition rules: every illegal
 * transition and every unresolved blocking comment surfaces as an inline
 * message rather than an exception.
 */

"use client";

import { useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";

import {
  EmptyState,
  LabeledField,
  PanelRow,
  PanelSection,
  PanelShell,
  Pill,
  StatGrid,
  StatTile,
  SummaryText,
  type PanelTone,
} from "debate-ui/src/panels/panel-shell";
import { useStoreSnapshot } from "debate-ui/src/panels/use-store-snapshot";
import { Button } from "debate-ui/src/primitives/button";
import { Input } from "debate-ui/src/primitives/input";
import { Textarea } from "debate-ui/src/primitives/textarea";

import {
  addReviewComment,
  approveReview,
  buildReviewSummary,
  createCardReview,
  getUnresolvedBlockingComments,
  isReadyToPublish,
  publishReview,
  rejectReview,
  requestChanges,
  resolveReviewComment,
  submitForReview,
  type CardReview,
  type CommentSeverity,
  type ReviewStatus,
} from "../lib/peer-review";
import { deletePeerReview, listPeerReviews, savePeerReview } from "../state/peerReviews";

const STATUS_TONE: Record<ReviewStatus, PanelTone> = {
  draft: "neutral",
  in_review: "info",
  changes_requested: "warning",
  approved: "positive",
  published: "positive",
  rejected: "critical",
};

/** Props for {@link PeerReviewPanel}. */
export interface PeerReviewPanelProps {
  /** Reviews to show. Defaults to the persisted review store. */
  reviews?: CardReview[];
  /** Reviewer id attributed to comments added from this panel. */
  reviewerId?: string;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Card review queue with lifecycle actions and comment threads.
 *
 * @param props - See {@link PeerReviewPanelProps}.
 * @returns The peer review panel.
 */
export function PeerReviewPanel({
  reviews,
  reviewerId = "me",
  className,
}: PeerReviewPanelProps) {
  const { data: persisted, refresh } = useStoreSnapshot<CardReview[]>(listPeerReviews, []);
  const source = reviews ?? persisted;
  const editable = reviews === undefined;

  const [newCardId, setNewCardId] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [severity, setSeverity] = useState<CommentSeverity>("suggestion");
  const [error, setError] = useState<string | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const tally: Partial<Record<ReviewStatus, number>> = {};
    for (const review of source) tally[review.status] = (tally[review.status] ?? 0) + 1;
    return tally;
  }, [source]);

  /** Applies a lifecycle transition, surfacing the slice's errors inline. */
  const apply = (review: CardReview, transition: (review: CardReview) => CardReview) => {
    try {
      savePeerReview(transition(review));
      setError(null);
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const startReview = () => {
    if (!newCardId.trim()) return;
    savePeerReview(createCardReview(newCardId.trim()));
    setNewCardId("");
    setError(null);
    refresh();
  };

  const addComment = (review: CardReview) => {
    const body = (commentDrafts[review.cardId] ?? "").trim();
    if (!body) return;
    savePeerReview(
      addReviewComment(review, {
        id: `comment-${Date.now()}`,
        reviewerId,
        body,
        severity,
      }),
    );
    setCommentDrafts({ ...commentDrafts, [review.cardId]: "" });
    refresh();
  };

  return (
    <PanelShell
      title="Peer Review"
      description="Card reviews from draft through publication."
      icon={<ClipboardCheck className="h-4 w-4" />}
      className={className}
      data-testid="peer-review-panel"
    >
      <StatGrid columns={4}>
        <StatTile label="In review" value={counts.in_review ?? 0} tone="info" />
        <StatTile label="Changes requested" value={counts.changes_requested ?? 0} tone="warning" />
        <StatTile label="Approved" value={counts.approved ?? 0} tone="positive" />
        <StatTile label="Published" value={counts.published ?? 0} tone="positive" />
      </StatGrid>

      {error ? (
        <p className="border-rose-500/30 bg-rose-500/10 rounded-lg border px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}

      <PanelSection title="Review queue">
        {source.length === 0 ? (
          <EmptyState
            title="Nothing under review"
            message={editable ? "Start a review for a card below." : undefined}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {source.map((review) => {
              const blocking = getUnresolvedBlockingComments(review);
              const open = openCardId === review.cardId;
              return (
                <PanelRow
                  key={review.cardId}
                  title={
                    <button
                      type="button"
                      className="text-left"
                      aria-expanded={open}
                      onClick={() => setOpenCardId(open ? null : review.cardId)}
                    >
                      {open ? "▾" : "▸"} {review.cardId}
                    </button>
                  }
                  subtitle={`${review.comments.length} comment${review.comments.length === 1 ? "" : "s"}${
                    blocking.length > 0 ? ` · ${blocking.length} blocking` : ""
                  }`}
                  trailing={
                    <>
                      {isReadyToPublish(review) ? <Pill tone="positive">Ready</Pill> : null}
                      <Pill tone={STATUS_TONE[review.status]}>{review.status.replace("_", " ")}</Pill>
                    </>
                  }
                >
                  {open ? (
                    <>
                      {review.comments.length > 0 ? (
                        <ul className="flex flex-col gap-1">
                          {review.comments.map((comment) => (
                            <li
                              key={comment.id}
                              className="border-border flex items-start justify-between gap-2 rounded border px-2 py-1 text-xs"
                            >
                              <div>
                                <div className="flex items-center gap-1">
                                  <Pill
                                    tone={comment.severity === "blocking" ? "critical" : "info"}
                                  >
                                    {comment.severity}
                                  </Pill>
                                  <span className="text-muted-foreground">{comment.reviewerId}</span>
                                </div>
                                <p className={comment.resolved ? "line-through opacity-60" : ""}>
                                  {comment.body}
                                </p>
                              </div>
                              {editable && !comment.resolved ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    apply(review, (r) => resolveReviewComment(r, comment.id))
                                  }
                                >
                                  Resolve
                                </Button>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      {editable ? (
                        <>
                          <LabeledField label="Add comment">
                            <Textarea
                              rows={2}
                              value={commentDrafts[review.cardId] ?? ""}
                              onChange={(e) =>
                                setCommentDrafts({
                                  ...commentDrafts,
                                  [review.cardId]: e.target.value,
                                })
                              }
                            />
                          </LabeledField>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {(["suggestion", "blocking"] as const).map((option) => (
                              <button key={option} type="button" onClick={() => setSeverity(option)}>
                                <Pill tone={severity === option ? "info" : "neutral"}>{option}</Pill>
                              </button>
                            ))}
                            <Button size="sm" variant="outline" onClick={() => addComment(review)}>
                              Comment
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <Button size="sm" variant="outline" onClick={() => apply(review, submitForReview)}>
                              Submit
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => apply(review, requestChanges)}>
                              Request changes
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => apply(review, approveReview)}>
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => apply(review, publishReview)}>
                              Publish
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => apply(review, rejectReview)}>
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                deletePeerReview(review.cardId);
                                refresh();
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        </>
                      ) : null}
                      <SummaryText text={buildReviewSummary(review)} />
                    </>
                  ) : null}
                </PanelRow>
              );
            })}
          </div>
        )}
      </PanelSection>

      {editable ? (
        <PanelSection title="Start a review">
          <div className="flex items-end gap-2">
            <LabeledField label="Card id" className="flex-1">
              <Input value={newCardId} onChange={(e) => setNewCardId(e.target.value)} />
            </LabeledField>
            <Button size="sm" onClick={startReview} disabled={!newCardId.trim()}>
              Create draft
            </Button>
          </div>
        </PanelSection>
      ) : null}
    </PanelShell>
  );
}
