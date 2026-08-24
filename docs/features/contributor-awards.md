# Top Contributor Awards

Recognizes the top contributor in each contribution category — best evidence
finder, best explainer, and so on — by total helpfulness score within that
category, and lets a day's standings be frozen as an official "announced"
result rather than always reflecting whatever is currently winning.

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
| `original-argument` | Best Original Argument |
| `refutation` | Best Refutation |

Each card shows the winning contributor, their contribution count in that
category, and their total helpfulness score. A kind with no contributions yet
is omitted rather than shown with no winner.

- **Live standings** — the current category winners, recomputed on every page
  load from persisted contributions.
- **Announce today's awards** — freezes the current UTC calendar day's
  standings. Once a day is announced, the panel shows that frozen snapshot
  instead of the live standings for the rest of the day — a later
  contribution that would change the live standings doesn't retroactively
  change an already-announced result.
- **Announced history** — every previously announced day's frozen standings,
  oldest first.

A day with no contributions in any category disables the announce action
instead of freezing an empty result.

## Data flow

```
state/contributions.ts (localStorage)
  → buildTopContributorAwardsFromStore()          — composes lib/contributor-awards.ts
      → groupContributionsByKind()                — lib/contributor-awards.ts
      → buildCategoryLeaderboard()                — reuses lib/contribution-leaderboard.ts's buildLeaderboard
  → state/contributorAwardAnnouncements.ts
      → buildPersistedTopContributorAwards()      — today's live (unannounced) standings
      → announceContributorAwards()               — idempotent: freezes a day's standings
                                                       under a separate
                                                       "contributorAwardAnnouncements" key
      → listAnnouncedContributorAwards() / getAnnouncedContributorAwards()
  → panels/ContributorAwardsPanel.tsx (live standings, announce action, history)
  → apps/debate-ai.com/app/cards/awards/page.tsx (mounts the panel as a route)
```

This feature is a read-only composition and rendering layer: it introduces
`buildTopContributorAwardsFromStore` in `state/contributions.ts`, which
composes the existing pure `buildTopContributorAwards` directly against the
persisted contributions store, plus `state/contributorAwardAnnouncements.ts`'s
freeze-on-announce layer on top of it (mirroring
`state/dailyBestCardAnnouncements.ts`'s identical "Daily Best Card Challenge"
pattern) — no new scoring or grouping logic (see
`packages/debate-card-search/test/contributions.test.ts` and
`packages/debate-card-search/test/contributorAwardAnnouncements.test.ts`).

## Known gaps

- No scheduled job announces automatically — a person has to open the panel
  and click **Announce today's awards**, same as the Daily Best Card
  Challenge.
- Same upstream gap as the [Contribution Leaderboard](contribution-leaderboard.md):
  no reviewer-identity/permission checks (a real submission flow already
  exists — `ContributionsFeedPanel.tsx` calls `saveContribution`/
  `recordPersistedLike`/`recordPersistedSave`/
  `recordPersistedEndorsementFromReviewer`).
