# Opponent Team Profiles

Shows every persisted opponent scouting profile as a roster — overall and
Aff/Neg side record, a "notably stronger" side badge, and the team's most
commonly run argument tags and cases — ordered by rounds recorded (most
scouted opponent first).

- **Route:** `/opponents`
- **Nav:** the Tools page's Prep & Practice group; the Reason Editor's
  Workspace menu (`t opponent` in Ctrl/Cmd-Shift-Space's command palette)
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

## Correcting a logged round

The **Logged rounds** table below the roster lists every round recorded so
far, filtered to one team by typing into **Filter by team ID** (a
case-insensitive substring match on the team id, so a long history doesn't
bury the team you just logged).

Each row has up to four actions:

- **Edit** loads the round back into the form above, which switches to
  "Edit logged round" with **Save changes** / **Cancel** buttons. Saving
  rewrites that round in place (keeping its `id` and its position in the
  history) and re-aggregates the team from the updated history. Changing the
  **Team ID** while editing reassigns the round to a different team and
  re-aggregates *both* — dropping the previous team's derived profile if
  that was its last round.
- **Delete** removes the round and re-aggregates the affected team from
  whatever rounds remain, deleting the derived profile entirely once its
  last round is gone (rather than leaving a zero-round one). Deleting the
  round currently being edited also cancels the edit.
- **Undo last edit** appears only on a round that has at least one edit still
  undoable, and steps it back to the version it held immediately before its
  most recent edit — re-aggregating the affected team (or teams, if that
  edit reassigned the round) the same way an Edit/Save would. Clicking it
  repeatedly walks further back through up to the last 10 corrections, one
  edit at a time; deleting the round discards its undo history along with it.
- **Redo** appears only on a round that has at least one undone edit still
  redoable — i.e. right after clicking Undo — and steps it forward again to
  the version Undo just replaced, the same way Undo itself re-aggregates.
  Clicking it repeatedly walks forward through however many times Undo was
  just clicked in a row. Making a fresh Edit/Save after an Undo discards the
  redo history (the same way any undo/redo stack invalidates "the future"
  once a new edit branches off from it), and deleting the round discards it
  too.

## Data flow

```
state/opponentRoundRecords.ts (localStorage: opponentRoundRecords, in debate-data-sync)
  → recordOpponentRound(entry)                      — appends one OpponentRoundRecordEntry,
                                                       then re-aggregates that team via the
                                                       existing buildOpponentTeamProfile and
                                                       persists through saveOpponentTeamProfile
  → updateOpponentRoundRecord(entry)                — replaces one round by id, in place, saving
                                                       its pre-edit version to a small per-round
                                                       undo history first, then re-aggregates its
                                                       team (and the previous team too, when the
                                                       round is reassigned)
  → undoLastOpponentRoundRecordEdit(id)              — restores a round to the version held
                                                       before its most recent edit, popping that
                                                       version off the id's undo history, then
                                                       re-aggregates the same way
                                                       updateOpponentRoundRecord would
  → hasOpponentRoundRecordEditHistory(id)            — whether a round has at least one edit
                                                       still undoable
  → listOpponentRoundRecordEditHistory(id)           — a round's prior versions,
                                                       most-recent-edit-first
  → redoLastOpponentRoundRecordEdit(id)              — re-applies the version replaced by the
                                                       most recent undo, popping that version off
                                                       the id's redo history and pushing the
                                                       version it replaces back onto the undo
                                                       history, then re-aggregates the same way
                                                       undoLastOpponentRoundRecordEdit would
  → hasOpponentRoundRecordRedoHistory(id)            — whether a round has at least one undone
                                                       edit still redoable
  → listOpponentRoundRecordRedoHistory(id)           — a round's undone versions,
                                                       most-recently-undone-first
  → deleteOpponentRoundRecord(id)                   — removes one round and its undo/redo
                                                       history, then re-aggregates (deleting the
                                                       profile if none remain)
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
opponent's scouting profile. A third store,
`opponentRoundRecordEditHistory` (keyed by round id, capped at the 10 most
recent prior versions per round), holds what each round looked like before
each edit, so a correction can be undone via
`undoLastOpponentRoundRecordEdit` instead of being permanent. A fourth
store, `opponentRoundRecordRedoHistory` (same per-round cap), holds
whatever version `undoLastOpponentRoundRecordEdit` most recently replaced,
so `redoLastOpponentRoundRecordEdit` can step forward through it again; a
fresh edit or a delete discards it, the same way it discards the undo
history — mirroring `debate-speech-writer`'s `judgeRoundRecords.ts` undo/redo
stacks exactly.

Every profile field already existed and was Vitest-covered by
`rankings/opponent-team-profile.ts`'s `buildOpponentTeamProfile`; this
feature closes follow-up (b), "a scouting-card/panel UI," named under the
"🕵️ Opponent Team Profiles" bullet in `TODO.md`, adding one small ordering
helper (`buildOpponentTeamProfilesRoster`) to `state/opponentTeamProfiles.ts`
rather than introducing new scouting logic. Vitest-covered in
`packages/debate-data-sync/test/opponentTeamProfiles.test.ts` and
`packages/debate-data-sync/test/opponentRoundRecords.test.ts`, which also
Vitest-covers the undo/redo edit history described above.

The "Filter by team ID" input on the logged-rounds list now backs onto a
`<datalist>` of `listOpponentTeamIds()` — every distinct team id with at
least one logged round, sorted alphabetically — so typing offers the ids
actually on record instead of a blank guess. When the typed filter matches
nothing, `findNearestOpponentTeamId(query)` (a small case-insensitive
Levenshtein edit-distance search over the same id list, local to
`state/opponentRoundRecords.ts`, mirroring `debate-speech-writer`'s
`findNearestJudgeId`) suggests the closest known id as a clickable "Did you
mean `<id>`?" prompt that refills the filter. Both are Vitest-covered in
`opponentRoundRecords.test.ts`.

## Known gaps

- No real round-history data source yet (follow-up (a) — no Tabroom/tab-service
  pairing or ballot sync produces `OpponentRoundRecord`s in this repo today);
  every round is entered by hand through this panel's form, or supplied by a
  caller of `recordOpponentRound`/`saveOpponentTeamProfile` directly. This is
  the same gap the [Judge Profiles](judge-profiles.md) panel has.
- ~~Editing a round is all-or-nothing per round: there is no history of what
  a round looked like before an edit, so a correction can't be undone.~~
  Closed: **Undo last edit** / **Redo** actions now step a round back to
  (and forward from) any of its last 10 prior versions (see "Correcting a
  logged round" above), mirroring the same fix already shipped for
  [Judge Profiles](judge-profiles.md).
- Profiles are per-browser localStorage, not a shared team resource, and
  there are no identity/permission checks on who may log a round against a
  team (no auth in this repo yet).
