# Topic Coverage Dashboard

Tracks a topic's argument checklist and shows which of those arguments are
well-covered, thin, or missing entirely, based on the cards already
submitted to the shared evidence library — plus any submitted cards filed
under an argument block nobody added to the checklist.

- **Route:** `/cards/coverage`
- **Nav:** the global dock's Settings menu → **Topic Coverage Dashboard**
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

| Element | Source |
| --- | --- |
| Topic switcher | `listTrackedTopics()` — every distinct topic with at least one checklist entry |
| "Add to checklist" form | Saves a `TrackedArgumentRecord` (argument block + optional category) for the active topic |
| Coverage rows | Each tracked argument's `missing` / `thin` / `covered` status, card count, and total word count |
| Summary line | `buildTopicCoverageSummaryText` — e.g. "1/3 arguments covered, 1 thin, 1 missing" |
| "Needs the most work" | `getUnderCoveredArguments` — missing before thin, then fewest cards |
| Untracked section | Argument blocks with submitted cards that aren't on the checklist |

Coverage is classified by `lib/topic-coverage.ts`'s `classifyCoverage`: zero
cards is `missing`; below the card-count or word-count threshold (3 cards /
600 words by default) is `thin`; otherwise `covered`.

## Data flow

```
state/trackedArguments.ts (localStorage — topic checklist)
state/evidenceLibraryEntries.ts (localStorage — submitted cards/blocks)
  → buildPersistedTopicCoverageReport(topic)   — state/trackedArguments.ts
      → buildTopicCoverageReport()             — lib/topic-coverage.ts (pure)
  → panels/TopicCoverageDashboardPanel.tsx (renders the checklist + report)
  → apps/debate-ai.com/app/cards/coverage/page.tsx (mounts the panel as a route)
```

`lib/topic-coverage.ts`'s scoring rule already existed and was Vitest-covered
from an earlier slice, but had no persisted checklist or dashboard UI. This
feature adds `state/trackedArguments.ts` (a small CRUD store for a topic's
checklist, mirroring the existing `evidenceLibraryEntries.ts` convention) and
its `buildPersistedTopicCoverageReport`, which composes that checklist with
the already-persisted evidence library directly — every `EvidenceLibraryEntry`
is already a `CoverageCardSummary` (it carries `argBlock`/`wordCount`), so no
new card shape was needed. See
`packages/debate-card-search/test/trackedArguments.test.ts`.

## Known gaps

- The checklist is per-browser localStorage, not a shared team resource — two
  teammates on different devices see different checklists for the same topic
  name.
- No reviewer-identity/permission checks (no auth/roles in this repo yet).
