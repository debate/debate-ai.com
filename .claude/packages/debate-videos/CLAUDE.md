# CLAUDE.md — `debate-videos` (LEARN)

Private. The debate video library: search and filtering, grids and cards, a
**persistent YouTube player with picture-in-picture**, a per-video watch page,
lecture pages, and rankings leaderboards. Entry `src/index.ts`, tests in
`test/`.

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

Its toolbar is the popout player's toolbar: both compose
`components/video-player/PlayerIconButton.tsx`, so add a control there rather
than hand-rolling a button in one of them.

## Watch-page URLs are permanent

`/videos/watch/<title-slug>-<videoId>` links are shared and indexed. The id is
parsed positionally from the end of the slug (`lib/video-slug.ts`) — never
`split("-")`, because YouTube ids contain `-` and `_`. The title half is
decoration, so changing how titles are slugified must not stop old links
resolving.

## Data

Video metadata comes from `debate-data-sync`'s bundled assets, kept fresh by a
**weekly cron** in the app (Mondays 08:00 UTC) that both scans subscribed
channels for new videos *and* refreshes view counts on existing ones. So:

- View counts are refreshed, not immutable — don't cache them as if they were.
- Don't hand-edit synced video data; change the sync script in
  `debate-data-sync`.
- The YouTube API has a quota. A change that multiplies per-video calls can
  exhaust it and stall the whole weekly refresh.
