# CLAUDE.md — `debate-rankings-adapter`

Public (`@debate-ai/` scope). The web UI's side of the `debate-rankings`
submodule. Two entry points with different rules:

- **`.` (`src/index.ts`) — data, no React.** The dataset list and CSV loader,
  the site's rating scale (`rating-offset.ts`), team and tournament lookups,
  college history, matchup models. The Worker imports it, so keep it free of
  React, `next/*` and DOM code.
- **`./leaderboard` (`src/leaderboard/index.ts`) — the rankings UI.** The
  `/practice/rankings` leaderboard, team and school profile pages, the matchup
  simulator, team labels and school logos, follows and "my ranked teams". Moved
  here from `debate-videos`.

## Rules

- **Never import `debate-videos`.** It depends on this package. A profile's
  Videos section is injected: `ProfileVideosProvider` takes the grid
  (`ProfileVideos` from `@debate-ai/videos`), and a profile rendered without a
  provider just has no Videos section. Hosts (`debate-webview`'s team and
  school routes) wrap the pages.
- **The UI owns its primitives** (`src/leaderboard/ui/`), copied from
  `debate-videos`'s — there is no shared UI package.
- **Don't edit the submodule.** Site-only additions belong here so
  `git submodule update --remote` stays a clean refresh.

## Rankings sync and bundled data (from the removed `debate-data-sync`)

- `src/sync/` holds the ranking and results scrapers/parsers (NDCA, debatedrills,
  debate.land, TOC bid list and sheet, CEDA/TOC champions, NDT school history,
  Elo merge) plus `opponent-team-profile.ts`, whose `OpponentTeamProfile` is
  cross-package API: `debate-round` persists it (`src/state/opponentTeamProfiles.ts`)
  and the app's D1 schema mirrors it. Grep before you rename a field.
- `src/state/` holds the qualification points table/cutoff and tournament-results
  stores the app's `/api/settings` and `/api/tournament-results` read.
- `src/topics/debate-topics.ts` formats `data/debate-topics.json`.
- `data/` is bundled assets (topics, champions, tournaments, NDT school history,
  school names), exported as `@debate-ai/rankings-adapter/data/*`. Excluded from
  coverage; it ships to the client, so don't add non-public fields.
- Sync scripts hit external services. Know what a run costs and overwrites before
  running one (`bun run build-ndt-history` rewrites `data/ndt-school-history.json`).
- Keep this package below the account sync: nothing here imports
  `debate-search-evidence`'s `account-sync/`; stores that mirror to the account
  (opponent profiles and scouted rounds) live in `debate-round`.
