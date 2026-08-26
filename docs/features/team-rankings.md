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

## Relationship to CX NDCA Standings

[CX NDCA Standings](standings.md) (`/standings`) is a separate, newer
surface: it builds ranked season standings from individually recorded
`TournamentResult`s against a configurable NDCA-style qualification-points
table. Team Rankings instead reads a pre-loaded per-division/year dataset
or its Elo computation — the two aren't reconciled against each other, and
a team can appear differently ranked on each page.

## Known gaps

- Was reachable only by typing `/rank` directly or browsing `/features`
  before this change added it to the Tools page and the Reason Editor's
  Workspace menu/command palette — no in-app entry point linked to it.
- Elo and TOC-score computation aren't documented here in detail; see
  `packages/debate-videos/src/panels/leaderboard/leaderboardUtils.ts`.
