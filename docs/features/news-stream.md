# News Stream

A lightweight, in-app changelog surfacing recently shipped features across
the whole product — not just the ones already listed on `/tools` — so a
visitor can discover new functionality without reading `TODO.md`
themselves.

- **Route:** `/news`
- **Package:** [`debate-card-search`](../../packages/debate-card-search/README.md)

## What it is

`lib/news-stream.ts` holds a small, hand-curated `NewsItem[]` seeded from
entries already recorded as "Completed" in `TODO.md`'s Tracker Status /
Product Feature Ideas sections — this module doesn't invent features, it
makes the ones that already shipped visible in the product itself. Each
item carries a reverse-chronological `order` rank rather than a fabricated
calendar date, since `TODO.md`'s log records *what* shipped and in what
sequence, not a wall-clock timestamp.

`state/newsStream.ts` persists which item ids a browser has "read" to
localStorage (`newsStreamReadIds`), mirroring the existing
`contributions.ts`/`sprintNotes.ts` store convention. `NewsStreamPanel`
renders every item newest-first, grouped by an unread indicator and
filterable by category, with a "Mark all as read" action.

## Cross-linking with `/tools`

`findLatestNewsItemForHref` looks up the most recent news item for a given
in-app route. `app/tools/page.tsx` uses it to render an "Updated" badge
(plus the news item's own summary) on any tool card whose route has a
recent update — closing the "not just on the tools page" half of the
gap this feature addresses: a tool's own directory card now surfaces what
changed about it, not just its static description.

## Known gaps

- News items are hand-curated, not derived automatically from `TODO.md` or
  git history — adding a new one means editing `NEWS_ITEMS` by hand.
- No cross-tab live update for the read-id set (see
  `docs/features/shared-flow-sync.md`'s "Known gap" list of panels that
  still lack this).
