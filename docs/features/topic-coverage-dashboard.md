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

## Cross-topic comparison heatmap

Closes the "a cross-topic comparison heatmap" follow-up: once at least two
topics have a tracked-argument checklist, a "Cross-topic comparison" section
renders below the topic switcher (regardless of which topic, if any, is
currently selected) showing every such topic against every category seen
across their checklists — one row per topic, one column per category, each
cell a `covered/total` badge tallied from that topic's tracked arguments in
that category. A tracked argument with no `category` set is grouped under an
"Uncategorized" column, always sorted last. This lets a coach spot a
systemically weak category (e.g. every topic thin on "K") across the whole
research effort at a glance, rather than checking one topic at a time.

- `lib/topic-coverage.ts#buildTopicCoverageComparisonHeatmap` — pure pivot
  over a list of `{ topic, report }` pairs into the grid, zero-filling a
  topic's cell for a category none of its tracked arguments use so the grid
  always renders as a complete rectangle. Only each report's `tracked`
  arguments feed the grid — an `untracked` argument block has no
  team-planned category to place it in, the same way
  `buildTopicCoverageSummaryText` treats it as a separate concern.
- `state/trackedArguments.ts#buildPersistedTopicCoverageComparisonHeatmap` —
  composes it from persisted stores, defaulting to every topic
  `listTrackedTopics()` returns (or a caller-supplied subset).
- `panels/TopicCoverageDashboardPanel.tsx`'s `CoverageComparisonHeatmap`
  renders the grid as a table, reusing the existing missing/thin/covered
  `Badge` variants for each cell.

See `packages/debate-search-evidence/test/topic-coverage.test.ts` and
`test/trackedArguments.test.ts` for coverage. No further follow-up is
currently tracked for this idea.

## Known gaps

- The checklist is per-browser localStorage, not a shared team resource — two
  teammates on different devices see different checklists for the same topic
  name.
- No reviewer-identity/permission checks (no auth/roles in this repo yet).
