# Peer Review

Lets teammates move a submitted card through a review lifecycle — draft, in review, changes
requested, approved, published, or rejected — with a threaded comment discussion, blocking a
review from being approved while any blocking comment is still unresolved.

- **Route:** `/cards/reviews`
- **Nav:** the global dock's Settings menu → **Peer Review**
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

Reviews are grouped into six sections, in this order (statuses that need action first):

| Group | Meaning |
| --- | --- |
| In review | Submitted and awaiting a reviewer decision |
| Changes requested | A blocking comment (or an explicit request) needs addressing before resubmission |
| Draft | Started but not yet submitted for review |
| Approved | Ready to publish |
| Published | Live |
| Rejected | Rejected outright; can be revised back to draft |

Each review card shows its `cardId`, a one-line status/comment-count summary
(`buildReviewSummary`), its full comment thread (reviewer, body, severity, resolved state, with a
"Resolve" action on unresolved comments), a comment-composer (reviewer id, body, suggestion/
blocking toggle), and whichever lifecycle actions are legal from its current status:

| Status | Actions |
| --- | --- |
| draft | Submit for review |
| in_review | Approve (disabled while blocking comments are unresolved), Request changes, Reject |
| changes_requested | Resubmit |
| approved | Publish |
| rejected | Revise (back to draft) |
| published | none — terminal |

A "Start review" box at the top lets a teammate begin a review for any card id — this repo has
no real card-submission flow yet, so a review's `cardId` is whatever a caller types here.

## Data flow

```
state/peerReviews.ts (localStorage: peerReviews)
  → buildPeerReviewsPanelView()                — groups every persisted CardReview by status
  → panels/PeerReviewPanel.tsx                 — renders it, grouped by status
  → apps/debate-ai.com/app/cards/reviews/page.tsx  — mounts the panel as a route

Starting a review:
panels/PeerReviewPanel.tsx
  → startPersistedCardReview(cardId)            — state/peerReviews.ts
      (creates via lib/peer-review.ts's createCardReview if none is stored; idempotent)

Moving a review through its lifecycle:
panels/PeerReviewPanel.tsx
  → submitPersistedReviewForReview(cardId)      — state/peerReviews.ts
  → requestPersistedReviewChanges(cardId)       — state/peerReviews.ts
  → approvePersistedReview(cardId)              — state/peerReviews.ts
  → rejectPersistedReview(cardId)               — state/peerReviews.ts
  → publishPersistedReview(cardId)              — state/peerReviews.ts
  → revisePersistedRejectedReview(cardId)       — state/peerReviews.ts
      (each applies lib/peer-review.ts's matching pure transition and saves the result)
  → panel re-reads buildPeerReviewsPanelView() to refresh

Commenting:
panels/PeerReviewPanel.tsx
  → addPersistedReviewComment(cardId, comment)      — state/peerReviews.ts
  → resolvePersistedReviewComment(cardId, commentId) — state/peerReviews.ts
      (apply lib/peer-review.ts's addReviewComment/resolveReviewComment and save)
  → panel re-reads buildPeerReviewsPanelView() to refresh
```

Every status transition and comment rule already existed in `lib/peer-review.ts` and was
Vitest-covered; this feature adds one small new pure transition, `reviseRejectedReview`
(rejected → draft — the only transition in `ALLOWED_TRANSITIONS` that had no exported function
yet), plus a set of thin persisted-mutation wrappers in `state/peerReviews.ts` that compose each
pure transition directly against the stored `CardReview` and save the result, mirroring
`prepNotes.ts`'s `updatePersistedPrepNoteStatus` convention. `approvePersistedReview` still
throws `UnresolvedBlockingCommentsError` when a blocking comment is unresolved — the panel avoids
triggering it by disabling the Approve button in that case rather than swallowing the error.
Vitest-covered in `packages/debate-card-search/test/peerReviews.test.ts` and
`packages/debate-card-search/test/peer-review.test.ts`.

## Known gaps

- No reviewer identity/permission checks — no auth/roles exist yet, so any reviewer id can be
  typed into the comment composer.
- No real card-submission flow wires a review's lifecycle to whatever eventually persists
  submitted cards, so `publishReview` doesn't yet gate a card actually going live — a review's
  `cardId` here is only ever a string a teammate typed into the "Start review" box.
