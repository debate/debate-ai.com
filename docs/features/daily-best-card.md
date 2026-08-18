# Daily Best Card Challenge

Highlights the single highest-helpfulness card submitted each UTC calendar
day, and lets the community "vote" on it through the existing like/save
signals already used elsewhere in the Contributions Feed.

- **Route:** `/cards/best-card`
- **Nav:** the global dock's Settings menu → **Daily Best Card**
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

- **Card of the day** — a banner for the current UTC day's highest-scoring
  card contribution, if one was submitted today, with its contributor,
  helpfulness score, likes, and saves.
- **Past winners** — every earlier day's winner, most recent first, rendered
  as a one-line highlight (`lib/daily-best-card.ts`'s `buildDailyBestCardHighlight`).

The "vote" itself isn't a separate ballot — a card's existing likes/saves in
the Contributions Feed (`/cards/contributions`) already model community
approval, so the winner is simply the day's highest blended helpfulness score
(`lib/community-rating.ts`).

## Data flow

```
panels/ContributionsFeedPanel.tsx        — stamps submittedAt on every submission
  → state/contributions.ts (localStorage)
      → getTodaysBestCardFromStore() / buildDailyBestCardsFromStore()
          → lib/daily-best-card.ts       — groups by UTC day, picks each day's winner
  → panels/DailyBestCardPanel.tsx        — renders today's banner + past-winner history
  → apps/debate-ai.com/app/cards/best-card/page.tsx — mounts the panel as a route
```

`state/contributions.ts` filters persisted contributions down to `kind: "card"`
entries that carry a `submittedAt` timestamp before handing them to
`lib/daily-best-card.ts`'s pure `buildDailyBestCards`/`getBestCardForDay` — no
new scoring or grouping logic was introduced here.

## Known gaps

- No scheduled job persists or announces a day's winner automatically — the
  banner is computed live, on every render, from whatever is currently
  persisted.
- Any card submitted before `ContributionsFeedPanel.tsx` started stamping
  `submittedAt` (or submitted through some future flow that omits it) is
  excluded from every day's grouping.
