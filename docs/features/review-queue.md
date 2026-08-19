# Review Queue

Lets a user move a submitted card through peer review — start a review,
submit it, leave and resolve comments, request changes, approve, and
publish — before it goes live in the shared evidence library.

- **Route:** `/cards/reviews`
- **Nav:** the global dock's Settings menu → **Review Queue**
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

Every persisted `CardReview` (from `state/peerReviews.ts`, keyed by
`cardId`), sorted by `cardId`:

| Field | Source |
| --- | --- |
| Status | `review.status` — `draft` / `in_review` / `changes_requested` / `approved` / `published` / `rejected` |
| Lifecycle actions | Buttons for whichever transitions `lib/peer-review.ts`'s state machine allows from the review's current status |
| Comment thread | `review.comments`, each showing reviewer, severity (`blocking`/`suggestion`), resolved state, and a "Resolve" action for unresolved ones |
| Unresolved-blocking warning | Shown whenever `getUnresolvedBlockingComments` is non-empty — approval is blocked until they're resolved |
| Summary | `buildReviewSummary(review)` |

A form at the top starts a new card's review (`createCardReview`), and each
review card has an "Add comment" form (reviewer id, severity, body) and a
"Remove" action. A `rejected` review gets a "Revise" action
(`reviseRejectedReview`), sending it back to `draft` so its author can revise
and resubmit — the `ALLOWED_TRANSITIONS.rejected = ["draft"]` edge the state
machine already permitted.

## Data flow

```
state/peerReviews.ts (localStorage: peerReviews)
  → buildReviewQueuePanelView()      — sorts every persisted review by
                                        cardId for a stable display order
  → panels/ReviewQueuePanel.tsx      — renders it

Taking an action:
panels/ReviewQueuePanel.tsx
  → lib/peer-review.ts's pure transition (submitForReview/requestChanges/
    approveReview/rejectReview/reviseRejectedReview/publishReview/
    addReviewComment/resolveReviewComment)
  → savePeerReview(review)           — state/peerReviews.ts
  → panel re-reads buildReviewQueuePanelView() to refresh
```

Every review-lifecycle/persistence rule already existed and was
Vitest-covered; this feature adds one new composition function,
`buildReviewQueuePanelView` (`packages/debate-card-search/src/state/peerReviews.ts`),
which sorts the existing persisted store into a stable panel-ready shape —
no new lifecycle or mutation logic was introduced. Vitest-covered in
`packages/debate-card-search/test/peerReviews.test.ts`.

## Gating the Shared Evidence Library

A `CardReview`'s `cardId` is a free-form key — when it matches an
`EvidenceLibraryEntry.id` in the [Shared Evidence Library](./evidence-library.md),
that entry's visibility in the library's search results is gated by the
review's lifecycle. This closes follow-up (c) named under the "🗣️ Peer
Review System" bullet in TODO.md: "wiring a review's lifecycle to whatever
eventually persists submitted cards, so `publishReview` can gate a card
actually going live."

Peer review is opt-in, not required: an entry with no `CardReview` at all
stays live, matching this repo's existing "works standalone, gated further
once the gating feature exists" convention. Once a review exists, the entry
is held back from `searchPersistedEvidenceLibrary`'s results for every
status except `published` — starting a review (even leaving it in `draft`)
is enough to pull an already-submitted entry out of search until it's
published again. `state/evidenceLibraryEntries.ts`'s `isEntryLive`/
`listPendingReviewEntries` do the lookup (via `lib/peer-review.ts`'s
`isCardLive`), and `EvidenceLibraryPanel` renders a "Pending review" section
listing every held-back entry so its author can still find and edit it.

## Known gaps

- No reviewer identity/permission checks (no auth/roles in this repo yet),
  so any visitor can act as any reviewer and take any lifecycle action.
