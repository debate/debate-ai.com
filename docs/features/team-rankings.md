# Team Rankings

A division-and-season leaderboard of debate teams — TOC score, bid count,
and Debate Elo rating side by side, for PF, LD, Policy (CX), and NDT.

- **Route:** `/rank`
- **Nav:** the Tools page's Coaching & Analytics group; the Reason Editor's
  Workspace menu (`t rankings` in Ctrl/Cmd-Shift-Space's command palette)
- **Package:** [`debate-videos`](../../packages/debate-videos/README.md)

## What it shows

A division tab (`VPF`/`VLD`/`VCX`/`NDT`) and season-year selector drive a
sortable table (`RankingsLeaderboardPanel` → `LeaderboardTable`) of every
team on record for that division/year, each row carrying:

- **State** — the team's home state.
- **Bids** — TOC bid count for the season.
- **TOC Score** — the season's TOC-qualification scoring metric.
- **Debate Elo**, **Elo Rank**, **Elo → Bid**, **Elo × Times Bid** — a
  separately computed Elo rating and its derived columns
  (`leaderboardUtils.ts`'s `sortEntries`/`DIVISION_CONFIG`).

A champion banner (`LeaderboardChampionBanner`) surfaces the recorded
champion/topic history for the selected division and year when available.

## Standings tab

A second top-level tab, **Standings** (`StandingsPanel`), sits alongside the
Elo/TOC leaderboard above — the rebuild of the removed `/standings` page
(idea #1, "CX NDCA Standings", in `TODO.md`'s Product Feature Ideas list),
reusing the scoring helpers that survived that removal
(`debate-data-sync`'s `rankings/ndca-standings.ts`) rather than
re-deriving them:

- **Log a result** — a manual entry form for one tournament result (team,
  tournament, date, division, outround finish, bid level, prelim
  record), saved via `state/tournamentResults.ts#saveTournamentResult`.
- **Bulk import (CSV)** — since live Tabroom results scraping is blocked
  (see `TODO.md`'s "Confirmed blocker" section) and hand-entry alone
  doesn't scale, a textarea accepts a CSV of results (header row plus
  `teamId`/`tournamentName`/`date`/`division`/`finish` required,
  `bidLevel`/`prelimWins`/`prelimLosses` optional, defaulting to 0),
  parsed and persisted in one pass via
  `state/tournamentResults.ts#bulkImportTournamentResults` (a thin
  composition of `rankings/tournament-results-csv-import.ts`'s pure
  `parseTournamentResultsCsv`), reporting an imported/skipped-row count
  rather than failing the whole batch on one malformed row — mirrors
  `OpponentTeamProfilesPanel`'s bulk-CSV pattern.
- **Qualification points table** — a collapsible editor for the point
  weights standings are scored with (per-outround-finish points, points
  per prelim win, bid-level bonus rate), backed by the already-existing
  `state/qualificationPointsTable.ts` (get/save/reset) — no public,
  authoritative NDCA point table exists for this app to hardcode, so
  `DEFAULT_QUALIFICATION_POINTS_TABLE` is illustrative only and a team is
  expected to save their own circuit's values here.
- The ranked standings table itself (rank, team, total points, overall
  prelim record, best finish, tournaments counted vs. attended when
  `countBestN` caps which results count), each row expandable to see —
  and delete — its individual logged results.

## Known gaps

- Was reachable only by typing `/rank` directly or browsing `/features`
  before this change added it to the Tools page and the Reason Editor's
  Workspace menu/command palette — no in-app entry point linked to it.
- Elo and TOC-score computation aren't documented here in detail; see
  `packages/debate-videos/src/panels/leaderboard/leaderboardUtils.ts`.
- Standings data (logged/imported tournament results and the custom
  points table) is stored in `localStorage` only — it doesn't yet follow
  a signed-in user across devices the way flows/rounds/word-count rounds
  and the other `saved_*` D1-backed records do.
