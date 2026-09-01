# Contributions Feed

Lets a contributor submit an `AttributedContribution` (a card, summary,
highlight, annotation, original argument, or refutation), then renders every
persisted contribution ranked by blended helpfulness score, with Like/Save/
Endorse actions per entry.

- **Route:** `/cards/contributions`
- **Nav:** the Tools page's Community & Progress group; `ResearchHub.tsx`'s
  Rewards tab
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

A submission form (Contributor ID, Kind, optional Argument block / Topic /
Case area / Tags / Content), followed by the ranked feed. Each entry shows
its kind badge, contributor, helpfulness score, an `isPopularityOnlyOutlier`
flag when the score is driven by raw popularity rather than quality/
reviewer-credibility signals, its likes/saves/endorsement counts, any topic/
case-area/tags, and Like/Save/Endorse buttons.

The "helpfulness score" mention in the panel's intro line carries an
Info-icon tooltip — `lib/community-rating.ts`'s `buildHelpfulnessScoreExplanation`
spells out the popularity/quality/reviewer-weight blend (percentages derived
from `HelpfulnessWeights`, not hardcoded) and the `isPopularityOnlyOutlier`
threshold, so a contributor doesn't have to guess how the score is produced.

### Moderator view: flagged for review

A "Flagged for review (N)" toggle sits above the feed list. Clicking it
switches the rendered feed from every contribution to only those
`state/contributions.ts`'s `filterFlaggedFeedEntries` selects — entries
`community-rating.ts` marked `isPopularityOnlyOutlier` (high popularity,
low quality, low reviewer-credibility) — so a moderator can review just the
popularity-driven contributions instead of scanning the full feed for the
inline flag. The toggle label and heading both carry a live count of
currently-flagged entries; toggling back to "Show all" restores the full
ranked feed. `filterFlaggedFeedEntries` preserves the feed's existing
helpfulness-score ranking order among the entries it keeps.

Filling in both **Topic** and **Case area** also files the contribution into
the Common Argument Library (`ArgumentLibraryPanel`, via
`state/evidenceLibraryEntries.ts#buildCombinedPersistedArgumentLibrary`).
Filling in both **Argument block** and **Content** also counts it toward the
Topic Coverage Dashboard (`state/trackedArguments.ts#buildPersistedTopicCoverageReport`).
The Tags field autocompletes from tags known to both the Evidence Library and
past contributions (`listCombinedPersistedTags`).

## Data flow

```
state/contributions.ts (localStorage: "contributions")
  → saveContribution() / recordPersistedLike() / recordPersistedSave() /
    recordPersistedEndorsementFromReviewer()
  → buildPersistedContributionFeed()
  → filterFlaggedFeedEntries()  — moderator "Flagged for review" toggle
  → panels/ContributionsFeedPanel.tsx (renders the form + ranked feed)
  → apps/debate-ai.com/app/cards/contributions/page.tsx (mounts the panel as a route)

state/evidenceLibraryEntries.ts (localStorage: "evidenceLibraryEntries")
  → listCombinedPersistedTags()   — tag-autocomplete suggestions
```

An endorsement's weight is derived from the endorsing reviewer's own
persisted contribution history (`lib/community-rating.ts#computeReviewerCredibility`)
rather than a fixed placeholder — a reviewer with no contributions of their
own still gets a low, non-zero `MIN_REVIEWER_CREDIBILITY` weight.

## Cross-tab live update

`ContributionsFeedPanel` subscribes to the browser's `storage` event (which
the spec fires only in *other* same-origin tabs/windows, never the one that
made the write), so a contribution submitted, liked, saved, or endorsed in
another tab — or a tag added via the Evidence Library — refreshes this tab's
feed and tag suggestions without a manual reload. A new pure helper,
`state/live-update.ts`'s `isContributionsFeedLiveUpdateStorageEvent`, checks
whether the event's `key` is one of the feed-backing stores (`contributions`,
`evidenceLibraryEntries`), or `null` for a `localStorage.clear()`; when it
is, the panel re-derives both the feed and the tag list via `refresh()`.
This closes, for this panel, the "Every other localStorage-backed panel in
this repo still has no cross-tab live-update mechanism" Known gap noted in
[`shared-flow-sync.md`](shared-flow-sync.md), mirroring the existing
`DailyBestCardPanel`/`isDailyBestCardLiveUpdateStorageEvent` precedent.
Vitest-covered in `packages/debate-card-search/test/live-update.test.ts`
(every backing-store key, the `null`-key clear-all case, and unrelated/
substring-matching keys staying ignored).

## Known gaps

- A submitted contribution starts with a neutral `qualitySignals: [0.5]`
  placeholder — no automated quality scorer is wired into this submission
  form yet.
- No reviewer-identity/permission checks (no auth/roles in this repo yet) —
  a "Reviewer ID" is just a typed string, so nothing stops one person from
  endorsing under many different reviewer ids to inflate an endorsement's
  weight.
- Every other localStorage-backed panel in this repo beyond the ones listed
  in [`shared-flow-sync.md`](shared-flow-sync.md)'s Known gaps still has no
  cross-tab live-update mechanism.
