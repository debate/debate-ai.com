# Revision Incentives

Rewards contributors for improving weak cards, strengthening citations, and refreshing stale
evidence, and ranks them by total reward points earned.

- **Route:** `/cards/revisions`
- **Nav:** the global dock's Settings menu → **Revision Incentives**
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

| Column | Source |
| --- | --- |
| Rank | Position in `buildRevisionIncentiveLeaderboard`'s sort order (total reward points, descending) |
| Contributor | `contributorId` |
| Revisions | Count of persisted revision records attributed to that contributor |
| Rewarded | Count of those revisions that earned a nonzero reward |
| Reward points | Sum of every revision's reward points |
| Weak cards improved | Count of revisions that improved a card that was weak beforehand |

A revision earns points from three signals (`lib/revision-incentives.ts`): a quality-score gain
(doubled if the card was weak beforehand), a meaningful citation-completeness gain, and citing
newer evidence than the prior snapshot — reusing the existing idea #11 `community-rating.ts`
quality scoring.

## Data flow

```
panels/EvidenceLibraryPanel.tsx (Edit action, /cards/library)
  → saveEvidenceLibraryEntryRevision(entry, contributorId) — state/evidenceLibraryEntries.ts
      → buildEvidenceEntryRevision(before, after, contributorId) — lib/shared-evidence-library.ts (pure)
          → deriveCardSnapshotFromEntry(entry) — lib/shared-evidence-library.ts (pure)
      → saveRevisionRecord(record)         — state/revisionHistory.ts (localStorage)
state/revisionHistory.ts (localStorage)
  → buildPersistedRevisionIncentiveLeaderboard()   — lib/revision-incentives.ts
  → panels/RevisionIncentivesPanel.tsx (renders the table)
  → apps/debate-ai.com/app/cards/revisions/page.tsx (mounts the panel as a route)
```

Every scoring/aggregation rule already existed and was Vitest-covered; this feature is a
read-only composition and rendering layer over that store — it introduces one new function,
`buildPersistedRevisionIncentiveLeaderboard`, which composes the existing pure
`buildRevisionIncentiveLeaderboard` directly against the persisted revision-history store (see
`packages/debate-card-search/test/revisionHistory.test.ts`).

The Shared Evidence Library's Edit action (see
[`evidence-library.md`](./evidence-library.md)) is the real card-edit/save flow: editing an
existing `EvidenceLibraryEntry` derives a before/after `CardSnapshot` pair via
`deriveCardSnapshotFromEntry` (reusing `llm-card-scoring.ts`'s `scoreClarity`/`scoreUsability` for
`qualitySignals`, and a parsed citation year for `evidenceYear`/`citationCompleteness`) and records
it as a `CardRevisionRecord`, so this leaderboard now reflects real edits rather than only
caller-supplied snapshots.

## Known gaps

- No evidence-staleness signal beyond rewarding a refresh after the fact.
