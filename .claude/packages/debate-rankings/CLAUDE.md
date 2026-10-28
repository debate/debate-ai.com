# CLAUDE.md — `debate-rankings`

Public (`@debate-ai/` scope). The web UI's side of the `debate-rankings-sync-data`
submodule. Two entry points with different rules:

- **`.` (`src/index.ts`) — data, no React.** The dataset list and CSV loader,
  the site's rating scale (`rating-offset.ts`), team and tournament lookups,
  college history, matchup models. The Worker imports it, so keep it free of
  React, `next/*` and DOM code.
- **`./leaderboard` (`src/leaderboard/index.ts`) — the rankings UI.** The
  `/practice/rankings` leaderboard, team and school profile pages, the matchup
  simulator, team labels and school logos, follows and "my ranked teams". Moved
  here from `debate-videos`.
- **`src/schools/` (via `./src/schools/…`)** — the school-claim rules
  (`school-claims.ts`: codes, TTLs, body parsers, logo limits — shared by the
  app's `/api/school-claims` routes and the UI) and the owner UI
  (`ui/MySchoolSettings`, `ui/SchoolOwnerPanel`). `SchoolProfileView` stays in
  `debate-webview` because it is the one that wires in `@debate-ai/videos`.

## Rules

- **Never import `debate-videos`.** It depends on this package. A profile's
  Videos section is injected: `ProfileVideosProvider` takes the grid
  (`ProfileVideos` from `@debate-ai/videos`), and a profile rendered without a
  provider just has no Videos section. Hosts (`debate-webview`'s team and
  school routes) wrap the pages.
- **The leaderboard UI owns its primitives** (`src/leaderboard/ui/`), copied
  from `debate-videos`'s; `src/schools/ui` already uses `@debate-ai/ui`.
- **Don't edit the submodule.** Site-only additions belong here so
  `git submodule update --remote` stays a clean refresh.
