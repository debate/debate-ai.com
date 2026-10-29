# CLAUDE.md — `debate-videos` (LEARN)

Public (`@debate-ai/` scope). The debate video library: search and filtering, grids and cards, a
**persistent YouTube player with picture-in-picture**, a per-video watch page
and lecture pages. Entry `src/index.ts`, tests in `test/`.

Not here any more: the rankings leaderboard, team/school profiles, team labels
and follows are `@debate-ai/rankings/leaderboard` (this package depends
on it, never the reverse — the profile pages get `ProfileVideos` from the host
through `ProfileVideosProvider`); the admin panels and the YouTube sync are
`debate-videos-admin`.

## The player is persistent — that's the hard part

The YouTube player survives navigation and supports PiP, which means it lives
above the route tree, not inside a page. So:

- **Don't mount a second player.** A page that renders its own embed competes
  with the persistent one for playback and PiP.
- Navigation must not remount or reset it. Anything that would force a remount
  (a new key, a moved provider) stops a lecture mid-sentence.
- PiP is browser state you don't fully own — handle the user exiting PiP,
  or the browser refusing it, without losing playback position.

The one page that does have its own embed, `panels/watch/VideoWatchPage.tsx`,
is not an exception to that: it *takes over* from the persistent player rather
than joining it. It sets `theaterVideoId` on the store (which makes
`PersistentVideoPlayer` render nothing), claims `videoPlayerIframeRef` so
`sendYouTubeCommand` drives the embed the user is actually watching, and hands
both back — with the playback position — on unmount. If you add another
full-page player, do the same; don't mount one alongside.

The mini player window (`panels/watch/VideoMiniPlayer.tsx`, route
`/videos/mini/<videoId>`) is not an exception either: it is a separate
window and document, which `AppShell` renders with no chrome (so no
floating player), and the watch page pauses its own embed before opening
it. Opening it goes through `lib/mini-player-window.ts`, which calls the
desktop wrapper's `open_mini_player` (always-on-top) or falls back to a
browser popup.

Its toolbar is the popout player's toolbar: both compose
`components/video-player/PlayerIconButton.tsx`, so add a control there rather
than hand-rolling a button in one of them.

## Watch-page URLs are shareable

`/videos/watch/<title-slug>` links are shared and indexed. The slug is
built from the title with `slugifyVideoTitle` (`lib/video-slug.ts`) — no
video id is appended. A video that gets retitled gets a new address;
old links stop working by design, which is the trade-off for clean
URLs.

## Favourites, hidden videos and reports belong to the user

These three are the package's only per-user stores, and they all live in
`src/state/videoLibrary.ts` — not in `useVideoState`, which only mirrors them
into the `Set<string>` its filters need. Go through the store, because it does
three things a bare `localStorage.setItem` does not:

- **Keeps the record shape the account sync can store.** Favourites and hidden
  videos are `{ videoId, … }` objects, not the bare id strings they used to be,
  because `saved_tool_records` keys a row by a field on the record. The reader
  still normalizes the legacy strings — **don't drop that**, a user's
  favourites list can be a whole season's work.
- **Mirrors each change to the account** (see
  `.claude/architecture/` and the Tool Data Sync internals note).
- **Offers a signed-out user somewhere to keep it**, once per feature. The save
  happens either way — the prompt is an offer, never a gate.

## The watch history is a listing, not a fourth filter

`/videos/history` (the "Watch History" row under Lectures in the sidebar) is
the ordinary video listing over an explicit id allow-list — the same
mechanism My Favorites uses, because `state/videoWatchHistory.ts` stores only
the id, position, duration and title, and the listing's columns need the
channel, category and season the library holds. Two consequences:

- **An empty allow-list still filters.** A history with nothing in it must
  list nothing, not everything; `ids: []` is deliberate, and both the API and
  the browser-side index treat it that way.
- **The order is this side's.** The feed answers in the library's order, so
  `LecturesPage` re-sorts the page newest-watched first from the history's own
  `watchedAt` — no server sort knows about it.

## Stacked playlists are a property of the library, not of a row

A round and the round-analysis video made from it share one grid slot, flipped
with `<` / `>`. Two things follow from where that link comes from:

- **It is derived from descriptions, not curated.** `src/data/video-stacks.ts`
  unions videos whose YouTube descriptions link to each
  other, and stamps `stack_key` / `stack_position` onto the row. Don't add an
  overrides list here — linking two videos is an edit to a description.
- **The companion is usually not in the loaded page.** The feed carries the
  key, `/api/videos/stacks` carries the members, and `useVideoStacks` fetches
  each key once (infinite scroll would otherwise re-request the set per page).
  `components/video-grid/video-stacks.ts` does the collapsing: a stack takes
  the slot its *first* member occupies, so the grid keeps the feed's order.

## Data

`src/data/` is the read side both `/api/videos` and the in-browser index run
(row conversion, the shared filter/sort/facet query, stacks, the lecture and
round-level classifiers) — keep it free of React and of anything Node-only.

Video metadata comes from the `videos` table and bundled assets, kept fresh by a
**weekly cron** in the app (Mondays 08:00 UTC) that both scans subscribed
channels for new videos *and* refreshes view counts on existing ones. So:

- View counts are refreshed, not immutable — don't cache them as if they were.
- Don't hand-edit synced video data; change the sync script in
  `debate-videos-admin` (`src/sync/`).
- The YouTube API has a quota. A change that multiplies per-video calls can
  exhaust it and stall the whole weekly refresh.
- The next-season topic-area poll (`lib/topic-areas/topic-area-poll.ts`) is
  the one thing here backed by its own table: `topic_area_votes`, declared in
  the app's `schema.ts` and created by this package's `migrations/`, which
  `.github/scripts/migrate-d1.ts` applies after the app's own.
