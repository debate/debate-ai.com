# CLAUDE.md — `debate-videos` (LEARN)

Private. The debate video library: search and filtering, grids and cards, a
**persistent YouTube player with picture-in-picture**, lecture pages, and
rankings leaderboards. Entry `src/index.ts`, tests in `test/`.

## The player is persistent — that's the hard part

The YouTube player survives navigation and supports PiP, which means it lives
above the route tree, not inside a page. So:

- **Don't mount a second player.** A page that renders its own embed competes
  with the persistent one for playback and PiP.
- Navigation must not remount or reset it. Anything that would force a remount
  (a new key, a moved provider) stops a lecture mid-sentence.
- PiP is browser state you don't fully own — handle the user exiting PiP,
  or the browser refusing it, without losing playback position.

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

## Data

Video metadata comes from `debate-data-sync`'s bundled assets, kept fresh by a
**weekly cron** in the app (Mondays 08:00 UTC) that both scans subscribed
channels for new videos *and* refreshes view counts on existing ones. So:

- View counts are refreshed, not immutable — don't cache them as if they were.
- Don't hand-edit synced video data; change the sync script in
  `debate-data-sync`.
- The YouTube API has a quota. A change that multiplies per-video calls can
  exhaust it and stall the whole weekly refresh.
