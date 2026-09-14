<!-- template-git-repo:badges:start -->
<p align="center">
    <a href="https://debate-ai.com/docs"><img src="https://img.shields.io/badge/Docs-blue?logo=ReadTheDocs&logoColor=white" alt="Documentation" /></a>
    <br />
    <a href="https://github.com/debate/debate-ai.com/stargazers"><img src="https://img.shields.io/github/stars/debate/debate-ai.com" alt="GitHub Stars" /></a>
    <br />
    <a href="https://github.com/debate/debate-ai.com/issues"><img src="https://img.shields.io/github/issues/debate/debate-ai.com?logo=github" alt="GitHub Issues" /></a>
    <a href="https://github.com/debate/debate-ai.com/pulls"><img src="https://img.shields.io/github/issues-pr/debate/debate-ai.com?logo=github&label=PRs" alt="Open Pull Requests" /></a>
    <a href="https://github.com/debate/debate-ai.com/pulls?q=is%3Apr+is%3Aclosed"><img src="https://img.shields.io/github/issues-pr-closed/debate/debate-ai.com?logo=github&label=PRs%20merged&color=8957e5" alt="Merged Pull Requests" /></a>
    <a href="https://github.com/debate/debate-ai.com/discussions"><img src="https://img.shields.io/github/discussions/debate/debate-ai.com" alt="GitHub Discussions" /></a>
    <a href="https://github.com/debate/debate-ai.com/commits/master/"><img src="https://img.shields.io/github/last-commit/debate/debate-ai.com.svg" alt="GitHub last commit" /></a>
    <br />
    <a href="https://stackblitz.com/github/debate/debate-ai.com/tree/master/packages/debate-videos"><img height="20px" src="https://developer.stackblitz.com/img/open_in_stackblitz.svg" alt="Open in StackBlitz" /></a>
    <img src="https://img.shields.io/badge/Bun-14151A?logo=bun&logoColor=white" alt="Bun" /> <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" /> <img src="https://img.shields.io/badge/Next.js-black?logo=nextdotjs&logoColor=white" alt="Next.js" /> <img src="https://img.shields.io/badge/React-20232A?logo=react&logoColor=white" alt="React" /> <img src="https://img.shields.io/badge/shadcn%2Fui-000000?logo=shadcnui&logoColor=white" alt="shadcn/ui" /> <img src="https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white" alt="Vitest" />
</p>
<!-- template-git-repo:badges:end -->

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
