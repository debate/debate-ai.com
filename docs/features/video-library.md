# Video Library — SQL-backed feed with scroll pagination

The debate video library (rounds, lectures, top picks) is stored in SQL and
served one page at a time. Opening `/videos` used to download the entire
dataset — every round and lecture, ~1.1 MB of JSON — before a single card
could render; now the first screen costs one small page and the rest arrives
as the grid is scrolled.

- **Where:** `/videos`, `/videos/[category]` (LEARN), and the rounds grid
- **Package:** [`debate-videos`](../../packages/debate-videos/README.md),
  [`debate-data-sync`](../../packages/debate-data-sync/README.md)

## How it fits together

The JSON assets under `debate-data-sync/data/videos/` remain the source of
truth that the YouTube sync writes to. They are projected into the `videos`
table, which is what the API queries:

```
data/videos/rounds-{policy,pf,ld,college}.json ─┐
data/videos/debate-lectures.json                ├─► buildVideoRows()  ──► videos (SQL table)
data/videos/debate-top-picks.json               ─┘   (src/videos/video-rows.ts)
```

The four round assets and the lectures asset are merged into one row per
video id (rounds win a collision, matching the old response's de-duplication),
and `debate-top-picks.json` sets the `is_top_pick` flag.

Two derived columns keep filtering cheap: `season_year` is the competition
season a video falls in (June-to-June, `0` for legacy pre-2010 content), and
`search_text` is the lowercased title + channel + description that free-text
search matches with `LIKE`. `published_ms` is the parsed publish timestamp,
because a handful of rows carry long-form dates ("May 14, 2013") that sort
wrongly as text.

## Serving a page

```
GET /api/videos?source=round&style=2&year=2026&q=finals&sort=Views&limit=60&offset=60&facets=1
  → { videos: [...], total, offset, limit, hasMore, facets, backend }

GET /api/videos/meta
  → { counts, lectureCategories, topics, champions, history, backend }
```

`lib/videos/video-repository.ts` owns both. Filtering, search, sorting and
pagination are pushed into SQL; ties are broken by video id so paging never
repeats or skips a video. `facets=1` adds the per-season and per-style counts
the filter dropdowns show — each dimension ignores its own filter and both
ignore the search term, so every dropdown option keeps showing a live total
even though the client no longer holds the whole library.

`/api/videos/meta` is the small, fetch-once companion: library counts for the
quick-link cards, the lecture-category cards, and the season topic/champion
tables. Nothing in it grows with the number of videos.

**JSON fallback.** If the `videos` table is missing, unreachable, or not yet
seeded, both endpoints rebuild the same rows from the JSON assets and answer
from memory with identical semantics (`src/videos/video-query.ts` is the
in-memory twin of the SQL). The response's `backend` field says which one
answered — `"sql"` or `"json"`. A fresh clone or a fresh preview database
therefore still renders the full library; seeding is an optimisation, not a
prerequisite.

## Client paging

```
hooks/useVideoFeed.ts
  useVideoFeed(filters)   — one feed: refetches from offset 0 when the filters
                            change, appends the next page on loadMore()
  useVideoMeta()          — /api/videos/meta, fetched once
  → panels/LecturesPage.tsx, panels/DebateVideosPanel.tsx
      → hooks/useInfiniteScroll.ts — observes the sentinel below the grid and
        calls loadMore() when it comes into view
```

Filter state (search, season, style, sort, category, top picks) lives in
`useVideoState` and is sent to the server. Two preferences stay on the client
because the server has no knowledge of them: **favourites** are sent as an
explicit `ids` allow-list when the favourites filter is on, and **hidden
videos** are filtered out of the loaded pages in the browser (an explicit
search still surfaces them, as it always has).

## Seeding the table

```bash
cd apps/debate-ai.com
bun run db:generate                     # migrations, after a schema change
bun run db:seed:videos                  # JSON → drizzle/seed/videos-seed.sql, applied locally
bun run db:seed:videos:d1               # same file, applied to Cloudflare D1
```

The seed is idempotent: rows are upserted by video id and any row the JSON no
longer carries is pruned, so re-running after a YouTube sync mirrors the
assets exactly. The generated SQL file is not committed — regenerate it from
the assets.

## Known gaps

- Search is `LIKE`-based token matching (every token must appear in title,
  channel or description). The previous client-side search used Fuse.js
  fuzzy matching, so a misspelled query that used to return near-matches now
  returns nothing.
- Facet counts do not deduct locally hidden videos: hiding a video removes it
  from the grid, but the season and style dropdowns still count it.
- The seed runs as a separate step from `sync-youtube`, so newly synced videos
  reach the site only after `db:seed:videos:d1` is run (until then the JSON
  fallback, not the table, is what carries them).
