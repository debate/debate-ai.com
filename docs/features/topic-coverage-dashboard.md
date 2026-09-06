# Topic Coverage Dashboard

Tracks a topic's argument checklist and shows which of those arguments are
well-covered, thin, or missing entirely, based on the cards already
submitted to the shared evidence library — plus any submitted cards filed
under an argument block nobody added to the checklist.

- **Route:** `/cards/coverage`
- **Nav:** the Tools page's Community & Progress group; the Reason Editor's
  Workspace menu (`t coverage` in Ctrl/Cmd-Shift-Space's command palette)
- **Package:** [`debate-research-evidence`](../../packages/debate-search-evidence/README.md)

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
`packages/debate-search-evidence/test/trackedArguments.test.ts`.

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

## Coverage trend snapshots

Closes the "a coverage-over-time trend chart" follow-up. Since this repo has
no background-job infrastructure to snapshot a topic's coverage on a
schedule, a "Record snapshot" button next to the summary line lets a
teammate capture the topic's current missing/thin/covered/total tallies
on demand — `lib/topic-coverage.ts#computeCoverageCounts` tallies
`report.tracked` by level (factored out of `buildTopicCoverageSummaryText`,
which now composes it rather than duplicating the same count), and
`state/topicCoverageSnapshots.ts#recordCoverageSnapshot` persists the result
with a timestamp, mirroring `state/reuseCheckHistory.ts`'s
append-only-with-cap convention but capped per-topic
(`MAX_COVERAGE_SNAPSHOTS_PER_TOPIC`, 50) rather than globally, so one
heavily-tracked topic's history can't crowd out another topic's. A
"Coverage trend" section below the checklist lists every recorded snapshot
for the active topic oldest-first, each row showing its timestamp, a
covered/thin/missing breakdown, and a `MeterBar` for covered-of-total, plus
a "Clear trend history" action scoped to that topic. See
`packages/debate-search-evidence/test/topicCoverageSnapshots.test.ts`.

## Cross-topic comparison heatmap

Closes the "a cross-topic comparison view (a heatmap-style rollup across
every tracked topic at once)" follow-up. Once a second (or later) topic has
at least one tracked argument, a "Cross-topic comparison" table renders above
the topic switcher — independent of whichever topic is currently
selected — with one row per topic, worst-covered first. Each row shows that
topic's missing/thin/covered counts as shaded cells (`lib/topic-coverage.ts#buildCrossTopicCoverageComparison`
tallies each topic's `TopicCoverageReport` via the existing `computeCoverageCounts`
and adds a `coverageRatio`), plus an overall coverage percentage. Cell shade
intensity scales with that level's share of the topic's tracked arguments, so
a topic leaning heavily "missing" reads as a darker red cell than one with
just one or two missing arguments among many covered ones.
`state/trackedArguments.ts#buildPersistedCrossTopicCoverageComparison` builds
the rows entirely from persisted stores — every tracked topic's own
`buildPersistedTopicCoverageReport` — the same composition
`TopicCoverageDashboardPanel` already used per-topic, just run once per
tracked topic instead of once for the active one. See
`packages/debate-search-evidence/test/topic-coverage.test.ts`'s
`buildCrossTopicCoverageComparison` suite and
`test/trackedArguments.test.ts`'s `buildPersistedCrossTopicCoverageComparison`
suite.

## Known gaps

- The checklist is per-browser localStorage, not a shared team resource — two
  teammates on different devices see different checklists for the same topic
  name. Coverage snapshots and the cross-topic comparison are the same:
  per-browser, not account-synced.
- No reviewer-identity/permission checks (no auth/roles in this repo yet).
