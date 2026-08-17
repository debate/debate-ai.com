# Top Contributor Awards

Recognizes the top contributor in each contribution category — best evidence
finder, best explainer, and so on — by total helpfulness score within that
category.

- **Route:** `/cards/awards`
- **Nav:** the global dock's Settings menu → **Contributor Awards**
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

One card per `ContributionKind` present among persisted contributions:

| Kind | Award label |
| --- | --- |
| `card` | Best Evidence Finder |
| `summary` | Best Explainer |
| `highlight` | Best Highlight Curator |
| `annotation` | Best Annotator |

Each card shows the winning contributor, their contribution count in that
category, and their total helpfulness score. A kind with no contributions yet
is omitted rather than shown with no winner.

## Data flow

```
state/contributions.ts (localStorage)
  → buildTopContributorAwardsFromStore()   — new, composes lib/contributor-awards.ts
      → groupContributionsByKind()         — lib/contributor-awards.ts
      → buildCategoryLeaderboard()         — reuses lib/contribution-leaderboard.ts's buildLeaderboard
  → panels/ContributorAwardsPanel.tsx (renders one card per category)
  → apps/debate-ai.com/app/cards/awards/page.tsx (mounts the panel as a route)
```

This feature is a read-only composition and rendering layer: it introduces
one new function, `buildTopContributorAwardsFromStore` in
`state/contributions.ts`, which composes the existing pure
`buildTopContributorAwards` directly against the persisted contributions
store — no new scoring or grouping logic (see
`packages/debate-card-search/test/contributions.test.ts`).

## Known gaps

- No finer-grained `ContributionKind` (or separate tag) for "original
  argument" and "refutation" contributions — only the four kinds
  `contribution-leaderboard.ts` already distinguishes can win an award today.
- No scheduled job that periodically recomputes and announces winners — the
  panel always shows the *current* standings, computed on page load.
- Same upstream gaps as the [Contribution Leaderboard](contribution-leaderboard.md):
  no real submitted-contribution flow, no reviewer-identity/permission checks.
