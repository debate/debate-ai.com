# Review Queue

Lets a user move a submitted card through peer review — start a review,
submit it, leave and resolve comments, request changes, approve, and
publish — before it goes live in the shared evidence library.

- **Route:** `/cards/reviews`
- **Nav:** the Tools page's Community & Progress group; the Reason Editor's
  Workspace menu (`t review queue` in Ctrl/Cmd-Shift-Space's command palette)
- **Package:** [`debate-research-evidence`](../../packages/debate-search-evidence/README.md)

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

A form at the top starts a new card's review (`createCardReview`, with an
optional Author ID), and each review card has an "Add comment" form
(reviewer id, severity, body) and a "Remove" action. A `rejected` review gets
a "Revise" action (`reviseRejectedReview`), sending it back to `draft` so its
author can revise and resubmit — the `ALLOWED_TRANSITIONS.rejected = ["draft"]`
edge the state machine already permitted.

### Self-review guard

Approve, reject, and publish each require a reviewer id (passed by whichever
caller drives them — see "Reviewer permission gating" below) and reject the
attempt when that id matches the review's own `authorId`:

- `ReviewerIdRequiredError` — no reviewer id was given
- `SelfReviewNotAllowedError` — the reviewer id matches `CardReview.authorId`

A review started with no author id (the Author ID field on the start-review
form was left blank, or the review predates this field) has nothing to guard
against, matching this repo's "works standalone, gated further once the
gating data exists" convention — any reviewer id is accepted. The reviewer
id that successfully took the last gatekeeping action is recorded on
`CardReview.reviewedBy` and shown in the panel's summary line. Submitting,
commenting, and requesting changes stay open to anyone, including a review's
own author.

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
`buildReviewQueuePanelView` (`packages/debate-search-evidence/src/state/peerReviews.ts`),
which sorts the existing persisted store into a stable panel-ready shape —
no new lifecycle or mutation logic was introduced. Vitest-covered in
`packages/debate-search-evidence/test/peerReviews.test.ts`.

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
own contribution record, on top of the self-review guard above. This closes
follow-up (b) named under the "🗣️ Peer Review System" bullet in TODO.md
("reviewer identity/permission checks").

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
    → requirePermission (tier check)
    → lib/peer-review.ts's own transition (self-review guard, state machine,
      and blocking-comment checks still apply, after the tier check)
  → savePeerReview(review)
```

A reviewer with no persisted contributions at all derives `novice`, not an
error — the same "every contributor satisfies `novice` at minimum" rule
`progress-unlocks.ts` already applies. A reviewer who clears the tier
threshold can still be rejected by the self-review guard above if their id
matches the review's own `authorId`.

## Signed-in prefill

An optional `signedInContributorId` prop (mirroring
[Task Inbox](./task-inbox.md)'s identical convention) prefills two of this
panel's free-form id fields from a real signed-in session — a starting
value only, never a login or a permission gate on its own (the tier/
self-review checks above still apply to whatever id ends up in the field).

```
components/research/ReviewQueueWithIdentity.tsx  — "use client" wrapper
  → useSession()                          — lib/hooks/useSession.ts, the
                                              better-auth React session hook
  → deriveContributorIdFromSessionIdentity(user)
      — debate-research-evidence's lib/session-identity.ts: name, else the
        email's local part, else the raw account id, else ""
  → <ReviewQueuePanel signedInContributorId={...} />
      — seeds "Your reviewer ID" initial value only; a visitor who edits it
        (hasEditedActingReviewerId) keeps their own typed value from then on
      — seeds each card's comment "Reviewer ID" field until that card's own
        comment draft is first touched (severity, body, or the field
        itself), after which that card's typed value always wins
```

## Review aging

Each card's `CardReview` now carries a `statusChangedAt` epoch-ms timestamp
(`lib/peer-review.ts`), set by `createCardReview` and refreshed by every
status-changing transition — `submitForReview`, `requestChanges`,
`approveReview`, `rejectReview`, `reviseRejectedReview`, `publishReview`, and
`addReviewComment`'s auto-transition to `changes_requested` on a blocking
comment. Reviews persisted before this field existed simply have no age.

`getReviewAgeDays(review, now?)` returns whole days since the last status
change (or `undefined` with no `statusChangedAt`), and `isReviewStale(review,
now?, thresholdDays?)` is `true` once a card sitting in `in_review` or
`changes_requested` (the two "someone else's queue" statuses — `draft`,
`approved`, `published`, and `rejected` aren't anyone's backlog) has aged past
`STALE_REVIEW_THRESHOLD_DAYS` (3, by default). `ReviewQueuePanel` shows a
"pending N days" badge next to the status badge for any `in_review`/
`changes_requested` card, switching to a destructive variant once it's
stale — closing the "a review-aging indicator for stale pending reviews"
follow-up named under the "🗣️ Peer Review System" bullet in TODO.md.
Vitest-covered in `packages/debate-search-evidence/test/peer-review.test.ts`.

## Reviewer workload

A "Reviewer workload" table sits above the queue itself — the third and
final follow-up named under the "🗣️ Peer Review System" bullet in TODO.md
("a reviewer-workload balancing view"), after the first two (signed-in
reviewer identity, review aging) were already done.

This data model has no explicit review-assignment concept — any reviewer
who clears `MIN_REVIEWER_TIER` can act on any queued card — so "workload" is
derived from actual engagement rather than an assignment field:
`lib/peer-review.ts`'s `buildReviewerWorkload(reviews)` tallies, per
reviewer id seen in the queue:

| Column | Meaning |
| --- | --- |
| Active reviews | Distinct cards currently `in_review`/`changes_requested` that this reviewer has commented on — their present backlog. Commenting twice on the same pending card still counts as one. |
| Comments posted | Total comments this reviewer has ever left, across every review regardless of its current status. |
| Actions taken | Times this reviewer's id appears as a review's `reviewedBy` — approve/reject/publish actions, all-time. |

The table sorts busiest-first (active reviews desc, then comments posted
desc, then reviewer id) so a coach or organizer scanning it sees at a
glance who to steer a new review request away from — and, toward the
bottom, who has room to take one on. The "Active reviews" count gets a
destructive badge at 3+ as a lightweight overload flag. The section is
omitted entirely once no reviewer has any recorded activity (a fresh
queue).

Vitest-covered with 8 new cases in
`packages/debate-search-evidence/test/peer-review.test.ts` (empty input,
non-pending vs. pending comments, same-card dedup, cross-card counting,
`reviewedBy` tallying independent of comments, sort order, and a
reviewer's comment + action activity combining into one entry).

## Cross-tab live update

`ReviewQueuePanel` subscribes to the browser's `storage` event (fires only
in *other* same-origin tabs/windows, never the one that made the write) via
`state/live-update.ts`'s `isReviewQueueLiveUpdateStorageEvent` and re-reads
`buildReviewQueuePanelView()` when it fires for one of its backing keys
(`peerReviews`, `evidenceLibraryEntries`) — so a review started, advanced,
or commented on in a second tab refreshes this tab's queue without a manual
reload. Vitest-covered in
`packages/debate-search-evidence/test/live-update.test.ts`.

## Error placement

Lifecycle and comment-form errors (an invalid transition, a tier rejection,
a missing reviewer id or comment body) render inside the review card whose
action failed, keyed per card — not as one panel-global message above the
queue — so a rejection on the tenth review in the list surfaces next to the
button that was clicked. The start-review form keeps its own error line.
After posting a comment, the card's draft resets but re-seeds the signed-in
reviewer id, so a signed-in visitor can comment on the same card repeatedly
without retyping their id.

## Known gaps

- Reviewer identity is still a free-form id, not an authenticated user — a
  real signed-in session only *prefills* "Your reviewer ID" and each card's
  comment reviewer field (see "Signed-in prefill" above), so a visitor can
  still overwrite either to type someone else's id. The tier gate and
  self-review guard still check whatever id is actually in the field, same
  as before — a real identity check needs the auth system this repo
  doesn't gate these calls with server-side.
