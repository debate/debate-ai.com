# Top Contributor Awards

Recognizes the top contributor in each contribution category — best evidence
finder, best explainer, and so on — by total helpfulness score within that
category, and lets a day's standings be frozen as an official "announced"
result rather than always reflecting whatever is currently winning.

- **Route:** `/cards/awards`
- **Nav:** the Tools page's Community & Progress group; the Reason Editor's
  Workspace menu (`t awards` in Ctrl/Cmd-Shift-Space's command palette)
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
- **🏅 Hall of Fame** — every announced day's awards aggregated into one
  all-time ranking: each contributor's total win count plus a per-category
  breakdown (e.g. "Best Evidence Finder ×3"), ranked highest total first and
  tie-broken by contributor id. Shown once at least one day has been
  announced; a contributor who has never won an award doesn't appear.
- **Announced history** — every previously announced day's frozen standings,
  oldest first.
- **Peer Nominations** — a **Nominate a peer** form (category, nominee, your
  name, an optional short note) submits an informal nomination, separate
  from the score-based winners above. A nomination can't name the nominator
  themself as the nominee. Each live award card shows that category's top
  nominee(s) by nomination count (e.g. "🗳️ Nominated: alice ×2"), and a
  "Recent nominations" list below the form shows every nomination, newest
  first, each with a **Delete** action.

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
      → buildContributorAwardsHallOfFame()        — lib/contributor-awards.ts; aggregates every
                                                       announced day's awards into one all-time
                                                       per-contributor win ranking
  → panels/ContributorAwardsPanel.tsx (live standings, announce action, Hall of Fame, history)
  → apps/debate-ai.com/app/cards/awards/page.tsx (mounts the panel as a route)

state/contributorAwardNominations.ts (localStorage, separate "contributorAwardNominations" key)
  → submitPeerNomination() / listAllPeerNominations() / deletePeerNomination()
  → lib/contributor-awards.ts#tallyNominationsByKind()  — per-category nominee ranking
  → panels/ContributorAwardsPanel.tsx (Nominate a peer form, top-nominee chips, nomination list)

state/live-update.ts#isContributorAwardsLiveUpdateStorageEvent
  → panels/ContributorAwardsPanel.tsx (cross-tab `storage` listener → refresh())
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

`ContributorAwardsPanel` now also live-updates across browser tabs: a
`storage` event listener (which the browser fires only in *other*
same-origin tabs, never the tab that made the write) calls `state/
live-update.ts`'s `isContributorAwardsLiveUpdateStorageEvent` — true for its
two backing keys (`contributions`, `contributorAwardAnnouncements`) or a
`null` key (`localStorage.clear()`) — and re-runs `refresh()` when it
matches, mirroring `DailyBestCardPanel`'s identical `storage`-listener
pattern. This closes, for this panel, the "Every other localStorage-backed
panel in this repo still has no cross-tab live-update mechanism" Known gap
noted in [`shared-flow-sync.md`](shared-flow-sync.md). Vitest-covered in
`packages/debate-card-search/test/live-update.test.ts` (every backing-store
key, the `null`-key clear-all case, and unrelated/substring-matching keys
staying ignored); `ContributorAwardsPanel.tsx` itself remains
intentionally untested, matching every other panel in this repo whose
`storage`-listener wiring is exercised only through the shared pure
predicate's own tests.

Peer nominations are intentionally informal: `state/contributorAwardNominations.ts`
persists them local-first (mirroring `state/dailyBestCardComments.ts`'s
convention) and `lib/contributor-awards.ts`'s pure
`canNominatePeer`/`tallyNominationsByKind` never feed into the score-based
`buildTopContributorAwards` winner selection above — a nomination is a
signal shown alongside the real award, not a vote that changes it.

## Known gaps

- No scheduled job announces automatically — a person has to open the panel
  and click **Announce today's awards**, same as the Daily Best Card
  Challenge.
- Same upstream gap as the [Contribution Leaderboard](contribution-leaderboard.md):
  no reviewer-identity/permission checks (a real submission flow already
  exists — `ContributionsFeedPanel.tsx` calls `saveContribution`/
  `recordPersistedLike`/`recordPersistedSave`/
  `recordPersistedEndorsementFromReviewer`). Peer nominations share this gap
  too: any visitor can submit or delete any nomination under any name, and
  nominations aren't account-synced across devices — only localStorage.
