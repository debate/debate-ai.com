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

## Reviewer permission gating

Approving, rejecting, and publishing — the three transitions that move a card
toward or away from actually going live — are gated on the acting reviewer's
own contribution record. This closes follow-up (b) named under the "🗣️ Peer
Review System" bullet in TODO.md ("reviewer identity/permission checks").

This repo has no auth/roles system, so rather than fabricating a role model,
`lib/reviewer-permissions.ts` derives permission from the reviewer's existing
[Progress Unlocks](./progress-unlocks.md) `UnlockTier` — the same
"derive eligibility from a contributor's own track record instead of a
caller-supplied value" approach `lib/tiered-task-routing.ts` already uses for
task routing. A reviewer needs `MIN_REVIEWER_TIER` (`veteran`: 15
contributions and 100 helpfulness points, or 8 completed research tasks) to
take a gated action; below that,
`InsufficientReviewerPermissionError` is thrown and the stored review is left
untouched. Submitting, requesting changes, commenting, and resolving comments
stay open to anyone.

```
panels/ReviewQueuePanel.tsx ("Your reviewer ID" field)
  → state/peerReviews.ts's approve/reject/publishPersistedReviewAsReviewer
  → derivePersistedReviewerTier(reviewerId)
      → state/contributions.ts's buildPersistedLeaderboard()
      → lib/reviewer-permissions.ts's deriveReviewerTier
        → lib/progress-unlocks.ts's computeContributorTier
  → lib/reviewer-permissions.ts's approve/reject/publishReviewAsReviewer
    → lib/peer-review.ts's own transition (state machine + blocking-comment
      checks still apply, after the permission check)
  → savePeerReview(review)
```

A reviewer with no persisted contributions at all derives `novice`, not an
error — the same "every contributor satisfies `novice` at minimum" rule
`progress-unlocks.ts` already applies.

## Known gaps

- Reviewer identity is a free-form id typed into the panel, not an
  authenticated user — the tier gate reflects that id's contribution record,
  but nothing stops a visitor from typing someone else's id. A real identity
  check needs the auth system this repo doesn't have yet.
