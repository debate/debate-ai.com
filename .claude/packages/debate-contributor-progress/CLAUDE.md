# CLAUDE.md — `debate-community` (`packages/debate-contributor-progress`)

**Package name:** `debate-community` — filter on that, not the directory.
Private. Entry `src/index.ts`, tests in `test/`.

Community and contributor-progress surfaces: contribution leaderboard, news
stream, contributor awards, daily best card, progress unlocks, quest streaks,
daily quests.

## Where it sits

Split out of the old `debate-card-search` alongside `debate-search-evidence`
and `debate-team-collaboration`, and **depends on both**. It is downstream —
changes here are cheap; changes in `debate-search-evidence` reach you.

## Rules

- **Gamification touches real people's standing.** Leaderboards, awards and
  streaks are computed from contribution records; a scoring change rewrites
  everyone's history at once. Treat a scoring formula change as a product
  decision and say so in the PR.
- Users here include minors. The leaderboard and news stream display names and
  contributions — don't add a field that exposes more than the user chose to
  share, and don't widen a visibility default.
- Streak and quest logic is timezone-sensitive. Pin the timezone assumption in a
  test rather than relying on the runner's locale.
