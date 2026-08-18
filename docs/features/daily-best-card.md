# Daily Best Card Challenge

Highlights the highest-helpfulness card submitted each day, and lets a day's
winner be frozen as an official "announced" result rather than always
reflecting whatever is currently winning.

- **Route:** `/cards/daily-best`
- **Nav:** the global dock's Settings menu → **Daily Best Card**
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

- **Today's leader** — the highest-helpfulness `card`-kind contribution
  submitted on the current UTC calendar day, computed live from the persisted
  Contributions Feed. An **Announce today's winner** action freezes that
  result.
- Once a day is announced, the panel shows the frozen winner instead of the
  live leader for that day — a stronger card submitted later the same day no
  longer changes the announced result.
- **Announced history** — every previously announced day's winner, oldest
  first.

A day with no card contributions shows "No cards submitted yet today"
instead of an announce action.

## Data flow

```
state/contributions.ts (localStorage, "contributions")
  → state/dailyBestCardAnnouncements.ts    — new
      → readTimestampedCardContributions() — narrows persisted contributions to
                                              timestamped `kind: "card"` submissions
      → buildPersistedDailyBestCards()     — composes lib/daily-best-card.ts's
                                              buildDailyBestCards
      → getPersistedBestCardForDay()       — composes lib/daily-best-card.ts's
                                              getBestCardForDay
      → announceDailyBestCard()            — idempotent: freezes a day's winner
                                              under a separate
                                              "dailyBestCardAnnouncements" key
  → panels/DailyBestCardPanel.tsx (today's leader, announce action, history)
  → apps/debate-ai.com/app/cards/daily-best/page.tsx (mounts the panel as a route)
```

This feature is a persistence and rendering layer over the existing pure
`lib/daily-best-card.ts` (`groupCardsByDay`, `pickBestCardOfDay`,
`buildDailyBestCards`, `getBestCardForDay`, `buildDailyBestCardHighlight`) —
no new scoring or grouping logic. It reuses `state/contributions.ts`'s
`ContributionsFeedPanel` submission flow, which already stamps every
submitted contribution's `submittedAt: Date.now()`, so no separate timestamp
wiring was needed (see
`packages/debate-card-search/test/dailyBestCardAnnouncements.test.ts`).

## Known gaps

- No scheduled job announces automatically — a person has to open the panel
  and click **Announce today's winner**.
- No real-time updates across browser tabs/sessions — like every other
  localStorage-backed panel in this repo, the panel reflects a snapshot as of
  its last load or action.
- Same upstream gaps as the [Contribution Leaderboard](contribution-leaderboard.md)
  and [Top Contributor Awards](contributor-awards.md): no real
  submitted-contribution flow beyond the Contributions Feed form, no
  reviewer-identity/permission checks.
