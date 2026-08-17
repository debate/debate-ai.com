# Peer Review

Lets teammates review a submitted card before it goes live: submit a draft for review, leave
blocking or suggestion comments, request changes, approve, and publish — all through an explicit
status state machine that blocks approval until every blocking comment is resolved.

- **Route:** `/cards/reviews`
- **Nav:** the global dock's Settings menu → **Peer Review**
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

Every persisted `CardReview`, grouped by status — reviews needing teammate action
(`in_review`/`changes_requested`) surfaced first, then `draft`, `approved`, `published`, and
`rejected`:

| Field | Source |
| --- | --- |
| Card id | `review.cardId` |
| Status badge | `review.status` |
| Comment thread | `review.comments` — reviewer id, severity (blocking/suggestion), resolved state |
| Lifecycle action(s) | Whichever transition is legal from the review's current status |

A minimal "start a review" form (card id only) calls `createCardReview`/`savePeerReview`
directly, since no card-submission flow exists yet to seed a review automatically.

## Data flow

```
state/peerReviews.ts (localStorage: peerReviews)
  → buildPeerReviewsPanelView()          — groups every persisted CardReview by status
  → panels/PeerReviewsPanel.tsx          — renders the queue, grouped by status
  → apps/debate-ai.com/app/cards/reviews/page.tsx (mounts the panel as a route)

Taking an action (submit, approve, request changes, reject, publish, comment, resolve):
panels/PeerReviewsPanel.tsx
  → submitPersistedReviewForReview(cardId)      ┐
  → requestPersistedReviewChanges(cardId)       │ each applies the matching pure
  → approvePersistedReview(cardId)              │ lib/peer-review.ts transition to the
  → rejectPersistedReview(cardId)                │ stored review and saves the result
  → publishPersistedReview(cardId)              │ (state/peerReviews.ts)
  → addPersistedReviewComment(cardId, comment)  │
  → resolvePersistedReviewComment(cardId, id)   ┘
  → panel re-reads buildPeerReviewsPanelView() to refresh
```

Every state-transition and comment-thread rule already existed in `lib/peer-review.ts` and was
Vitest-covered; this feature adds seven thin wrapper functions in `state/peerReviews.ts` (each an
`applyPersistedReviewUpdate` composition) plus `buildPeerReviewsPanelView` — no new
state-machine or comment-thread logic was introduced. `approvePersistedReview` still throws
`UnresolvedBlockingCommentsError` when blocking comments are unresolved (before saving); the
panel catches it and shows the message inline on that review. Vitest-covered in
`packages/debate-card-search/test/peerReviews.test.ts`.

## Known gaps

- No reviewer identity/permission checks (no auth/roles in this repo yet) — any visitor can act as
  any reviewer, and the "start a review"/comment forms take a free-text id.
- No real card-submission flow — a review's lifecycle isn't wired to whatever eventually persists
  submitted cards, so `publishReview` doesn't yet gate a card actually going live.
