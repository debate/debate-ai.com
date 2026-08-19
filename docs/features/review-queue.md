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

## Publish gating

A `CardReview.cardId` is the same id a `state/contributions.ts` contribution
uses, so a review actually gates that contribution's visibility once one
exists:

```
state/contributions.ts
  getContributionPublicationStatus(id)      — "no_review" until a CardReview
                                               exists for id, else that
                                               review's ReviewStatus
  sendContributionToReview(id)              — idempotently starts a "draft"
                                               CardReview keyed by id
  isContributionVisibleInPublicFeed(id)     — true for "no_review" or
                                               "published"; false otherwise
  buildPersistedContributionFeed(weights, { publicOnly: true })
                                             — drops any entry that isn't
                                               visible in the public feed
```

See the [Contribution Leaderboard](contribution-leaderboard.md) doc for how
the Contributions Feed panel (`/cards/contributions`) surfaces this — a
"Send to review" action, a publication-status badge per entry, and a
"Public feed only" toggle. A contribution that was never sent to review
stays visible either way, so this doesn't retroactively hide anything that
predates the Peer Review System.

## Known gaps

- No reviewer identity/permission checks (no auth/roles in this repo yet),
  so any visitor can act as any reviewer and take any lifecycle action.
