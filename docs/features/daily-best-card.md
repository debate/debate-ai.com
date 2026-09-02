# Daily Best Card Challenge

Highlights the single highest-helpfulness card submitted each UTC calendar
day, lets the community "vote" on it through the existing like/save signals
already used elsewhere in the Contributions Feed, and lets a day's winner be
frozen as an official "announced" result rather than always reflecting
whatever is currently winning.

- **Route:** `/cards/best-card`
- **Nav:** the Tools page's Community & Progress group; the Reason Editor's
  Workspace menu (`t best card` in Ctrl/Cmd-Shift-Space's command palette)
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

- **Today's leader** — the highest-helpfulness `card`-kind contribution
  submitted on the current UTC calendar day, computed live from the persisted
  Contributions Feed and shown with its contributor, helpfulness score,
  likes, and saves. An **Announce today's winner** action freezes that
  result.
- Once a day is announced, the panel shows the frozen winner instead of the
  live leader for that day — a stronger card submitted later the same day no
  longer changes the announced result.
- **Announced history** — every previously announced day's winner, oldest
  first, rendered as a one-line highlight
  (`lib/daily-best-card.ts`'s `buildDailyBestCardHighlight`) plus the
  contributor who submitted it.
- **Comment thread** — every announced day's winner (today's, once frozen,
  and every past day in the history list) carries its own comment thread. A
  "Your name" field (prefilled from a signed-in visitor's derived identity
  via `DailyBestCardWithIdentity`, same convention as
  `ProgressUnlocksWithIdentity`) plus a text box post a comment
  (`state/dailyBestCardComments.ts#postDailyBestCardComment`), rendered
  oldest-first with a per-comment "Delete" action. A comment only exists once
  a day is announced — the live, not-yet-frozen leader has no thread, since
  it can still change. Comment history is account-synced: signed in, a
  comment follows the visitor across devices via
  `hooks/useDailyBestCardComments.ts` (local-first, merged with the account
  once per page load — mirrors `debate-round`'s `useJudgeDecisions`), backed
  by a new `saved_daily_best_card_comments` D1 table and
  `/api/daily-best-card-comments` routes.

A day with no card contributions shows a prompt to submit one in the
Contributions Feed instead of an announce action.

The "vote" itself isn't a separate ballot — a card's existing likes/saves in
the Contributions Feed (`/cards/contributions`) already model community
approval, so the winner is simply the day's highest blended helpfulness score
(`lib/community-rating.ts`).

## Data flow

```
panels/ContributionsFeedPanel.tsx          — stamps submittedAt on every submission
  → state/contributions.ts (localStorage, "contributions")
      → getTodaysBestCardFromStore() / buildDailyBestCardsFromStore()
          → lib/daily-best-card.ts         — groups by UTC day, picks each day's winner
  → state/dailyBestCardAnnouncements.ts
      → getPersistedBestCardForDay()       — today's live (unannounced) leader
      → buildPersistedDailyBestCards()     — every represented day's live winner
      → announceDailyBestCard()            — idempotent: freezes a day's winner
                                              under a separate
                                              "dailyBestCardAnnouncements" key
      → listAnnouncedDailyBestCards() / getAnnouncedDailyBestCard()
  → state/dailyBestCardComments.ts (localStorage, "dailyBestCardComments")
      → postDailyBestCardComment() / listDailyBestCardComments() / deleteDailyBestCardComment()
  → hooks/useDailyBestCardComments.ts        — local-first, best-effort account-synced
      → lib/daily-best-card-comments-client.ts → apps/debate-ai.com's /api/daily-best-card-comments routes
                                                  → saved_daily_best_card_comments (D1)
  → panels/DailyBestCardPanel.tsx          — today's leader, announce action, history, comment threads
  → apps/debate-ai.com/components/research/DailyBestCardWithIdentity.tsx — prefills "Your name" from the signed-in session
  → apps/debate-ai.com/app/cards/best-card/page.tsx — mounts the panel (via the identity wrapper) as a route
```

`state/contributions.ts` filters persisted contributions down to `kind: "card"`
entries that carry a `submittedAt` timestamp before handing them to
`lib/daily-best-card.ts`'s pure `buildDailyBestCards`/`getBestCardForDay`, and
keeps each winner's `contributorId` attached (`AttributedDailyBestCard`).
`state/dailyBestCardAnnouncements.ts` is purely the announcement layer on top
of those helpers — no new scoring or grouping logic was introduced in either.
It reuses `ContributionsFeedPanel`'s submission flow, which already stamps
every submitted contribution's `submittedAt: Date.now()`, so no separate
timestamp wiring was needed (see
`packages/debate-card-search/test/dailyBestCardAnnouncements.test.ts`).

## Known gaps

- No scheduled job announces automatically — a person has to open the panel
  and click **Announce today's winner**.
- ~~No real-time updates across browser tabs/sessions — like every other
  localStorage-backed panel in this repo, the panel reflects a snapshot as of
  its last load or action.~~ Closed: `DailyBestCardPanel` now listens for the
  browser's `storage` event (which fires only in *other* same-origin tabs,
  never the tab that wrote the change) via
  `state/live-update.ts#isDailyBestCardLiveUpdateStorageEvent` and refreshes
  today's leader and the announced history when it fires for the
  `contributions`/`dailyBestCardAnnouncements` keys, mirroring
  `debate-round`'s identical `flow/live-update.ts` fix (see
  [`flow-annotations.md`](flow-annotations.md)).
- Any card submitted before `ContributionsFeedPanel.tsx` started stamping
  `submittedAt` (or submitted through some future flow that omits it) is
  excluded from every day's grouping.
- Same upstream gaps as the [Contribution Leaderboard](contribution-leaderboard.md)
  and [Top Contributor Awards](contributor-awards.md): no real
  submitted-contribution flow beyond the Contributions Feed form, no
  reviewer-identity/permission checks.
- A comment's "Your name" field is a free-form prefill, not a real identity
  gate (same convention as most other panels' "my id" fields) — anyone can
  post or delete a comment under any name, including someone else's.
