# debate-videos

LEARN — the video library: search and filtering, video grids and cards, the persistent
YouTube player (with picture-in-picture and a queue), lecture and dictionary pages, and
the rankings leaderboards.

```tsx
import {
  LecturesPage,
  PersistentVideoPlayer,
  CategoryDockProvider,
  useVideoPlayerStore,
} from "debate-videos"
```

Video and ranking data comes from `debate-data-sync`; player state is a zustand store that
survives navigation, which is why the player is mounted once in the app's root layout.
