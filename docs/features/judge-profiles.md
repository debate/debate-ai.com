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

## Data flow

```
state/judgeRoundRecords.ts (localStorage: judgeRoundRecords)
  → recordJudgeRound(entry)                — appends one JudgeRoundRecord to the
                                              persisted ballot history, then …
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
  → panels/JudgeProfilesPanel.tsx          — renders the log form + roster table
  → apps/debate-ai.com/app/judges/page.tsx — mounts the panel as a route
```

The two stores are deliberately separate: `judgeRoundRecords` is the raw
ballot history (a judge decides many rounds, so each entry carries its own
`id`, mirroring `debate-data-sync`'s `tournamentResults.ts` convention),
while `judgeProfiles` holds only the aggregate a caller looks up by
`judgeId`. Deleting a logged round (`deleteJudgeRoundRecord`) re-aggregates
the affected judge the same way.

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
- No delete/edit affordance in the panel for an already-logged round —
  `state/judgeRoundRecords.ts`'s `deleteJudgeRoundRecord` (which
  re-aggregates the affected judge) exists and is covered, but nothing in
  the UI calls it, so a mistyped ballot can only be corrected by logging
  further rounds.
- Profiles are per-browser localStorage, not a shared team resource, and
  there are no identity/permission checks on who may log a round for a
  judge (no auth in this repo yet).
