# Topic Coverage Dashboard

Tracks a topic's argument checklist and shows which of those arguments are
well-covered, thin, or missing entirely, based on the cards already
submitted to the shared evidence library — plus any submitted cards filed
under an argument block nobody added to the checklist.

- **Route:** `/cards/coverage`
- **Nav:** the Tools page's Community & Progress group; the Reason Editor's
  Workspace menu (`t coverage` in Ctrl/Cmd-Shift-Space's command palette)
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
state/contributions.ts (localStorage — Contributions Feed submissions)
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

`buildPersistedTopicCoverageReport` now also folds in every topic-scoped
`state/contributions.ts` entry that carries both `argBlock` and `wordCount`
as a second `CoverageCardSummary` source. `ContributionsFeedPanel` (see
[Contribution Leaderboard](contribution-leaderboard.md)) gained an optional
"Content" body-text field that stamps `AttributedContribution.wordCount` via
the same `computeWordCount` helper `EvidenceLibraryPanel` uses — closing the
"an `argBlock`/word-count field wired into a real card-submission flow
beyond the existing `/cards/library` evidence-library form" follow-up. A
contribution missing either field (both stay optional there, matching the
rest of that form) is silently excluded rather than counted with a
fabricated word count.

## Known gaps

- The checklist is per-browser localStorage, not a shared team resource — two
  teammates on different devices see different checklists for the same topic
  name.
- No reviewer-identity/permission checks (no auth/roles in this repo yet).
