# Opponent Team Profiles

Shows every persisted opponent scouting profile as a roster — overall and
Aff/Neg side record, a "notably stronger" side badge, and the team's most
commonly run argument tags and cases — ordered by rounds recorded (most
scouted opponent first).

- **Route:** `/opponents`
- **Nav:** the global dock's Settings menu → **Opponent Team Profiles**
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

For every opposing team with a saved `OpponentTeamProfile`:

| Column | Meaning |
| --- | --- |
| Team | `teamId` |
| Rounds | Total rounds recorded against this team, across every tournament tracked |
| Record | Overall win-loss record and win rate |
| Side record | Aff/Neg win record, flagged "stronger on aff/neg" once it clears the `opponent-team-profile.ts` threshold |
| Common arguments | Up to 3 most-frequent `argumentTags`, most frequent first |
| Common cases | Up to 3 most-frequent `caseName`s, most frequent first |

## Data flow

```
state/opponentTeamProfiles.ts (localStorage: opponentTeamProfiles, in debate-data-sync)
  → buildOpponentTeamProfilesRoster()              — lists every persisted OpponentTeamProfile,
                                                       ordered by rounds recorded descending
                                                       (ties broken alphabetically)
  → panels/OpponentTeamProfilesPanel.tsx            — renders it as a scouting roster table
                                                       (in debate-round)
  → apps/debate-ai.com/app/opponents/page.tsx       — mounts the panel as a route
```

Every profile field already existed and was Vitest-covered by
`rankings/opponent-team-profile.ts`'s `buildOpponentTeamProfile`; this
feature closes follow-up (b), "a scouting-card/panel UI," named under the
"🕵️ Opponent Team Profiles" bullet in `TODO.md`, adding one small ordering
helper (`buildOpponentTeamProfilesRoster`) to `state/opponentTeamProfiles.ts`
rather than introducing new scouting logic. Vitest-covered in
`packages/debate-data-sync/test/opponentTeamProfiles.test.ts`.

## Known gaps

- No real round-history data source yet (follow-up (a) — no Tabroom/tab-service
  pairing or ballot sync produces `OpponentRoundRecord`s in this repo today);
  a profile only appears here once a caller has supplied
  `OpponentRoundRecord`s and saved the resulting profile through
  `saveOpponentTeamProfile`.
- No profile editing/creation UI here — this panel only renders existing
  persisted profiles.
