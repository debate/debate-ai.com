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

## Known gaps

- No real card-edit/save flow exists yet — the store only has whatever a caller (or, currently,
  nothing in the UI) calls `saveRevisionRecord` with. The leaderboard is empty until revisions
  are persisted some other way (e.g. via a future card-editing flow).
- No evidence-staleness signal beyond rewarding a refresh after the fact.
