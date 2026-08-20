# Judge Profiles

Shows every persisted judge profile as a roster — side-vote bias, average
speaker points, delivery-speed tolerance, theory receptiveness, and the
paradigm each judge is most often tagged with — ordered by rounds judged
(most experienced first).

- **Route:** `/judges`
- **Nav:** the global dock's Settings menu → **Judge Profiles**
- **Package:** [`debate-speech-writer`](../../packages/debate-speech-writer/README.md)

## What it shows

For every judge with a saved `JudgeProfile`:

| Column | Meaning |
| --- | --- |
| Judge | `judgeId` |
| Rounds | Total rounds judged, across every tournament tracked |
| Side record | Aff/Neg win record, flagged "notable bias" once it clears the `judge-profile.ts` threshold |
| Avg speaker pts | Overall average speaker points awarded |
| Speed tolerance | `low` / `medium` / `high`, or "unknown" if no round tracked pace |
| Theory receptiveness | `low` / `medium` / `high`, or "unknown" if no round raised a theory argument |
| Paradigm | The judge's most-tagged paradigm, if any round was tagged with one |

## Logging a judged round

The panel's **Log a judged round** form is the in-app way to create or
update a profile. One ballot at a time is entered — judge id, tournament,
date, division, winning side, each side's speaker points, optionally the
pace (wpm) the judge followed and the paradigm they were tagged with, and
whether a theory argument was raised and won — and saved as a
`JudgeRoundRecord`. The judge's `JudgeProfile` is then re-derived from
their **full** logged history, so every column in the roster stays a
derived value: there is no way to edit an aggregate directly.

"Theory argument won" is only meaningful when "Theory argument raised" is
on; turning the latter off clears and disables the former, so a round can't
be logged as won-but-never-raised.

## Correcting a logged round

The **Logged rounds** table below the roster lists every ballot logged so
far, filtered to one judge by typing into **Filter by judge ID** (a
case-insensitive substring match on the judge id, so a long history doesn't
bury the judge you just logged).

Each row has two actions:

- **Edit** loads the ballot back into the form above, which switches to
  "Edit logged round" with **Save changes** / **Cancel** buttons. Saving
  rewrites that round in place (keeping its `id` and its position in the
  history) and re-aggregates the judge from the updated history. Changing
  the **Judge ID** while editing reassigns the ballot to a different judge
  and re-aggregates *both* — dropping the previous judge's derived profile
  if that was their last round.
- **Delete** removes the ballot and re-aggregates the affected judge from
  whatever rounds remain, deleting the derived profile entirely once their
  last round is gone (rather than leaving a zero-round one). Deleting the
  round currently being edited also cancels the edit.

## Data flow

```
state/judgeRoundRecords.ts (localStorage: judgeRoundRecords)
  → recordJudgeRound(entry)                — appends one JudgeRoundRecord to the
                                              persisted ballot history, then …
  → updateJudgeRoundRecord(entry)          — replaces one ballot by id, in place, then
                                              re-aggregates its judge (and the previous
                                              judge too, when the ballot is reassigned)
  → deleteJudgeRoundRecord(id)             — removes one ballot, then re-aggregates
                                              (deleting the profile if none remain)
  → rebuildJudgeProfileFromRecords(judgeId) — … re-runs judge-profile.ts's existing
                                              buildJudgeProfile over that judge's
                                              full history and persists the result
                                              through saveJudgeProfile (or deletes
                                              the derived profile when no rounds
                                              remain, rather than leaving a
                                              zero-round one)

state/judgeProfiles.ts (localStorage: judgeProfiles)
  → buildJudgeProfilesRoster()             — lists every persisted JudgeProfile,
                                              ordered by rounds judged descending
                                              (ties broken alphabetically)
  → panels/JudgeProfilesPanel.tsx          — renders the log/edit form, the roster
                                              table, and the logged-rounds list
  → apps/debate-ai.com/app/judges/page.tsx — mounts the panel as a route
```

The two stores are deliberately separate: `judgeRoundRecords` is the raw
ballot history (a judge decides many rounds, so each entry carries its own
`id`, mirroring `debate-data-sync`'s `tournamentResults.ts` convention),
while `judgeProfiles` holds only the aggregate a caller looks up by
`judgeId`. Editing (`updateJudgeRoundRecord`) and deleting
(`deleteJudgeRoundRecord`) a logged round re-aggregate the affected judge
the same way.

Every profile field already existed and was Vitest-covered by
`judge/judge-profile.ts`'s `buildJudgeProfile`; this feature closes
follow-up (b), "a judge-profile card/panel UI," named under the "⚖️ Judge
Profiles" bullet in `TODO.md`, adding one small ordering helper
(`buildJudgeProfilesRoster`) to `state/judgeProfiles.ts` rather than
introducing new aggregation logic. Vitest-covered in
`packages/debate-speech-writer/test/judgeProfiles.test.ts`;
`state/judgeRoundRecords.ts` in
`packages/debate-speech-writer/test/judgeRoundRecords.test.ts`.

## Known gaps

- No real ballot data source yet (follow-up (a) — no `Round`/ballot schema
  in this repo captures speaker points, pace, or theory outcomes today);
  every round is entered by hand through this panel's form, or supplied by
  a caller of `recordJudgeRound`/`saveJudgeProfile` directly. This is the
  same gap the [Standings](standings.md) and
  [Opponent Team Profiles](opponent-team-profiles.md) panels have.
- The logged-rounds filter is a free-text substring match on the judge id,
  not a picker of the judges actually on record — a typo shows an empty
  list rather than suggesting the nearest judge.
- Editing a ballot is all-or-nothing per round: there is no history of what
  a round looked like before an edit, so a correction can't be undone.
- Profiles are per-browser localStorage, not a shared team resource, and
  there are no identity/permission checks on who may log a round for a
  judge (no auth in this repo yet).
