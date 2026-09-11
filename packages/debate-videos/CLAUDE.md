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

## Data

Video metadata comes from `debate-data-sync`'s bundled assets, kept fresh by a
**weekly cron** in the app (Mondays 08:00 UTC) that both scans subscribed
channels for new videos *and* refreshes view counts on existing ones. So:

- View counts are refreshed, not immutable — don't cache them as if they were.
- Don't hand-edit synced video data; change the sync script in
  `debate-data-sync`.
- The YouTube API has a quota. A change that multiplies per-video calls can
  exhaust it and stall the whole weekly refresh.
