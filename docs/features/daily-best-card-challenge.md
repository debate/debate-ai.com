# Daily Best Card Challenge

Highlights the highest-helpfulness card contribution submitted on each UTC
calendar day, letting the community's existing likes/saves/quality/reviewer
signals crown a "card of the day" without any separate voting mechanism.

- **Route:** `/cards/daily-best`
- **Nav:** the global dock's Settings menu → **Daily Best Card**
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it shows

- A highlight banner for **today's** winning card (by UTC day), or an empty
  state prompting a submission if none has been made yet today.
- A history list of every prior day's winner, newest first, each showing its
  day, contribution id, and helpfulness score.

A day with no card contributions is simply absent from the history — there is
no winner-less placeholder entry.

## Data flow

```
panels/ContributionsFeedPanel.tsx (submit) — stamps submittedAt: Date.now()
  → state/contributions.ts (localStorage, "contributions" key)
      → buildPersistedDailyBestCards() / getPersistedBestCardForDay(now)  — new
          → lib/daily-best-card.ts (pure)
              groupCardsByDay() / pickBestCardOfDay() / buildDailyBestCards() / getBestCardForDay()
              reusing lib/community-rating.ts's computeHelpfulnessBreakdown
  → panels/DailyBestCardPanel.tsx (renders today's winner + history)
  → apps/debate-ai.com/app/cards/daily-best/page.tsx (mounts the panel as a route)
```

This slice closes two follow-ups named under "🕵️ Daily Best Card Challenge"
in `TODO.md`:

- **(a)** `AttributedContribution` (`lib/contribution-leaderboard.ts`) now has
  an optional `submittedAt` field, stamped by the Contributions Feed's submit
  handler. `state/contributions.ts`'s `readTimestampedCardContributions`
  narrows the persisted store to timestamped `kind: "card"` contributions —
  the shape `lib/daily-best-card.ts`'s pure functions require — so
  contributions saved before this change (or of another kind) are excluded
  rather than assumed to have a timestamp.
- **(c)** `DailyBestCardPanel` renders the banner/widget UI described in the
  idea.

No new scoring or grouping logic is introduced — this only wires the
already-built `lib/daily-best-card.ts` slice (see
`packages/debate-card-search/test/daily-best-card.test.ts`) to real,
timestamped persisted data (see
`packages/debate-card-search/test/contributions.test.ts`).

## Known gaps

- Follow-up **(b)**, a scheduled job that periodically persists/announces the
  day's winner, remains open — no scheduler exists in this repo today. The
  panel always computes the *current* standings on page load instead.
- Contributions saved before this change have no `submittedAt` and are
  permanently excluded from any day's grouping — there's no backfill.
