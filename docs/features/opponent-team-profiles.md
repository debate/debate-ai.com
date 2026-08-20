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

## Logging a scouted round

The **Log a scouted round** form above the roster is the in-app way to create
a profile. One round at a time is recorded for an opposing team:

| Field | Notes |
| --- | --- |
| Team ID | Required. The opposing team being scouted — this is what the round is aggregated under |
| Tournament | Required. Distinct names drive the profile's `tournamentsAttended` count |
| Date | Required |
| Division | Required |
| Side they debated | Aff or Neg — drives the profile's side split and its "notably stronger" flag |
| They won this round | Off by default; drives the overall and per-side win record |
| Case run | Optional. Feeds **Common cases** |
| Argument tags | Optional, comma-separated. Feeds **Common arguments** |
| Debated against | Optional. The other team's ID, kept for `getHeadToHeadRecords` lookups |

Submitting appends the round to the persisted round history and re-derives
that team's whole profile from its **full** logged history, so every roster
column stays a derived value — there is deliberately no direct editing of an
aggregate field. After a successful save the form keeps the team ID and
division (the fields most likely to repeat across a tournament) and clears the
rest.

The **Logged rounds** table below the roster lists every round recorded so
far, across every team, with a **Delete** action. Deleting re-aggregates the
affected team from whatever rounds remain, and deletes the derived profile
entirely once its last round is gone (rather than leaving a zero-round one).

## Data flow

```
state/opponentRoundRecords.ts (localStorage: opponentRoundRecords, in debate-data-sync)
  → recordOpponentRound(entry)                      — appends one OpponentRoundRecordEntry,
                                                       then re-aggregates that team via the
                                                       existing buildOpponentTeamProfile and
                                                       persists through saveOpponentTeamProfile
  → deleteOpponentRoundRecord(id)                   — removes one round, then re-aggregates
                                                       (deleting the profile if none remain)
  → rebuildOpponentTeamProfileFromRecords(teamId)   — re-aggregation alone

state/opponentTeamProfiles.ts (localStorage: opponentTeamProfiles, in debate-data-sync)
  → buildOpponentTeamProfilesRoster()              — lists every persisted OpponentTeamProfile,
                                                       ordered by rounds recorded descending
                                                       (ties broken alphabetically)
  → panels/OpponentTeamProfilesPanel.tsx            — renders the "Log a scouted round" form,
                                                       the scouting roster table, and the
                                                       logged-rounds list (in debate-round)
  → apps/debate-ai.com/app/opponents/page.tsx       — mounts the panel as a route
```

The two stores are deliberately split: `opponentTeamProfiles` holds only the
*aggregate*, so `opponentRoundRecords` persists the raw rounds behind it,
keyed by a per-round `id` (a team plays many rounds) the way
`debate-speech-writer`'s `judgeRoundRecords.ts` and this package's
`tournamentResults.ts` do. `debate-round`'s `state/ownRoundHistory.ts` stores
the same record type from *this* team's own perspective for pre-round
briefings and stays separate — a team's own rounds shouldn't surface as an
opponent's scouting profile.

Every profile field already existed and was Vitest-covered by
`rankings/opponent-team-profile.ts`'s `buildOpponentTeamProfile`; this
feature closes follow-up (b), "a scouting-card/panel UI," named under the
"🕵️ Opponent Team Profiles" bullet in `TODO.md`, adding one small ordering
helper (`buildOpponentTeamProfilesRoster`) to `state/opponentTeamProfiles.ts`
rather than introducing new scouting logic. Vitest-covered in
`packages/debate-data-sync/test/opponentTeamProfiles.test.ts` and
`packages/debate-data-sync/test/opponentRoundRecords.test.ts`.

## Known gaps

- No real round-history data source yet (follow-up (a) — no Tabroom/tab-service
  pairing or ballot sync produces `OpponentRoundRecord`s in this repo today);
  every round is entered by hand through this panel's form, or supplied by a
  caller of `recordOpponentRound`/`saveOpponentTeamProfile` directly. This is
  the same gap the [Standings](standings.md) and
  [Judge Profiles](judge-profiles.md) panels have.
- A logged round can be deleted but not edited in place — correcting a
  mistyped round means deleting it and logging it again.
- The logged-rounds list shows every team's rounds together, with no
  per-team filter; on a long history the row for the team you just logged
  can be far down the table.
- Profiles are per-browser localStorage, not a shared team resource, and
  there are no identity/permission checks on who may log a round against a
  team (no auth in this repo yet).
