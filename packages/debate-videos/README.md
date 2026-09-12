# debate-videos

LEARN — the video library: search and filtering, video grids and cards, the persistent
YouTube player (with picture-in-picture and a queue), a per-video watch page, lecture and
dictionary pages, and the rankings leaderboards.

```tsx
import {
  LecturesPage,
  VideoWatchPage,
  PersistentVideoPlayer,
  CategoryDockProvider,
  useVideoPlayerStore,
  videoWatchHref,
} from "debate-videos"
```

`VideoWatchPage` backs `/videos/watch/<title-slug>-<videoId>`: one video, its synced
transcript beside it, related videos underneath. It does not add a second embed — it
takes playback over from the persistent player for as long as it is mounted and hands
it back, at the same second, on the way out. See
[internals/video-watch-page.mdx](../debate-help-docs/content/docs/internals/video-watch-page.mdx).

Video and ranking data comes from `debate-data-sync`, projected into the app's `videos` SQL
table and served a page at a time by `/api/videos` — `hooks/useVideoFeed.ts` pages through
it as the grid is scrolled, so no screen loads the whole library (see
[packages/debate-help-docs/content/docs/internals/video-library.mdx](../../docs/features/video-library.md)). Player state is a
zustand store that survives navigation, which is why the player is mounted once in the
app's root layout.

## Package layout

Logic lives under `src/`, grouped by role; tests live under `test/`.

```
debate-videos/
├── src/
│   ├── components/   # cards, grids, search bar, player, watch page, stats modal
│   ├── context/      # category dock context
│   ├── data/         # category descriptions
│   ├── hooks/        # paginated video feed, infinite scroll, leaderboard data
│   ├── lib/          # watch-page slugs
│   ├── panels/       # lectures, watch, dictionary, leaderboard, rankings pages
│   ├── state/        # persistent video player store
│   ├── types/        # video and topic types
│   └── index.ts      # public entry point
└── test/             # Vitest suites for the card and leaderboard helpers
```

## Tests

```bash
bun run test        # or: npx vitest run
bun run coverage    # writes ./coverage for this package alone
```

Suites live in `test/` and mirror the `src/` layout. Coverage for every package is
merged at the repo root by `bun run coverage` and uploaded to
[Codecov](https://app.codecov.io/gh/debate/debate-ai.com) by CI.

Current Codecov package coverage on `master` at commit `50322f5` is **7.36%** (tracked under
the `debate-videos` flag).
