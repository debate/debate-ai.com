# CLAUDE.md — `debate-videos-admin`

Public (`@debate-ai/` scope). Everything staff use to run the video library:
the admin page's video panels, the `/api/admin/videos` and `/api/admin/youtube`
handlers, and the YouTube ingest. Entry `src/index.ts` (the panels), `./api`
(the handlers), tests in `test/`.

## Layout

| Folder | What | Runs in |
| --- | --- | --- |
| `src/components/` | Round queue, YouTube sync, library table, reports, channels, transcript scraper, speech AI panels and their dialogs. `debate-webview`'s `AdminDashboard` mounts them. `VideoStaffControls` is the staff-only Edit/Content buttons on the watch page. | browser |
| `src/api/admin/` | Route handlers mirrored from the app's `app/api/admin/{videos,youtube}`. They import the app's auth, D1 and job modules through its `@/` alias (see `tsconfig.json` and `vitest.config.ts`), like `debate-webview-admin`'s. | Worker |
| `src/sync/` | The YouTube ingest moved out of `debate-data-sync`: channel config, title parsers, the sync/stats/view-count CLIs, the curated round queue and the seed/stack/view-count SQL builders. | Node / Worker |
| `migrations/` | The video D1 migrations, applied by `.github/scripts/migrate-d1.ts`. | — |
| `data/youtube-stats.json` | Bundled channel stats behind `/api/youtube-stats`. | — |

## Rules

- **Depends on `debate-videos`, never the reverse.** The read model both sides
  share (`video-rows`, `video-query`, `video-stacks`, the lecture and
  round-level classifiers) lives in `debate-videos/src/data/`. Don't move it
  here: the public library would then depend on the admin package.
- **The migrations keep their old tracking key.** `migrate-d1.ts` still
  records them as `debate-data-sync/<file>` so a database that applied them
  before the move does not run them again. Don't rename that key.
- **`0001_youtube_channels.sql` mirrors `src/sync/youtube/channel-config.ts`.**
  Adding a channel means adding it to both; the app's
  `youtube-channels-seed.test.ts` fails on drift. A channel added later needs a
  new migration, not an edit to `0001`.
- **The panels own their primitives** (`src/ui/`), copied from
  `debate-webview`'s, like every other package — there is no shared UI package.
- The YouTube API has a quota. A change that multiplies per-video calls can
  exhaust it and stall the weekly scan.
