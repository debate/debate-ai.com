# Judge Profiles

Shows every persisted judge profile as a roster — side-vote bias, average
speaker points, delivery-speed tolerance, theory receptiveness, and the
paradigm each judge is most often tagged with — ordered by rounds judged
(most experienced first).

- **Route:** `/judges`
- **Nav:** the Tools page's Prep & Practice group; the Reason Editor's
  Workspace menu (`t judge` in Ctrl/Cmd-Shift-Space's command palette)
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
| Paradigm | The judge's most-tagged paradigm, if any round was tagged with one, with a "N% confidence" badge showing its share of paradigm-tagged rounds |

The confidence badge is `mostCommonParadigmConfidence` (`judge-profile.ts`):
the most-tagged paradigm's tag count divided by the judge's total number of
paradigm-tagged rounds (untagged rounds don't count toward the denominator).
A judge tagged `flow` in 2 of 3 tagged rounds shows "67% confidence"; a judge
tagged the same paradigm every time shows "100% confidence." The same figure
is folded into `buildJudgeTendencySummary`'s "Most-tagged paradigm" line (used
by the [Pre-Round Intelligence Panel](pre-round-briefings.md)) and into
`scout-to-strategy.ts`'s `buildJudgeAdaptationNotes`, so a low-confidence tag
reads as a tentative signal everywhere it's surfaced, not just here.

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

Each row has up to three actions:

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
- **Undo last edit** appears only on a round that has at least one edit still
  undoable, and steps it back to the version it held immediately before its
  most recent edit — re-aggregating the affected judge (or judges, if that
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
state/judgeRoundRecords.ts (localStorage: judgeRoundRecords)
  → recordJudgeRound(entry)                — appends one JudgeRoundRecord to the
                                              persisted ballot history, then …
  → updateJudgeRoundRecord(entry)          — replaces one ballot by id, in place, saving
                                              its pre-edit version to a small per-round undo
                                              history first, then re-aggregates its judge
                                              (and the previous judge too, when the ballot
                                              is reassigned)
  → undoLastJudgeRoundRecordEdit(id)       — restores a ballot to the version held before
                                              its most recent edit, popping that version off
                                              the id's undo history, then re-aggregates the
                                              same way updateJudgeRoundRecord would
  → hasJudgeRoundRecordEditHistory(id)     — whether a ballot has at least one edit still
                                              undoable
  → listJudgeRoundRecordEditHistory(id)    — a ballot's prior versions, most-recent-edit-first
  → redoLastJudgeRoundRecordEdit(id)       — re-applies the version replaced by the most
                                              recent undo, popping that version off the id's
                                              redo history and pushing the version it replaces
                                              back onto the undo history, then re-aggregates
                                              the same way undoLastJudgeRoundRecordEdit would
  → hasJudgeRoundRecordRedoHistory(id)     — whether a ballot has at least one undone edit
                                              still redoable
  → listJudgeRoundRecordRedoHistory(id)    — a ballot's undone versions, most-recently-undone-first
  → deleteJudgeRoundRecord(id)             — removes one ballot and its undo/redo history,
                                              then re-aggregates (deleting the profile if
                                              none remain)
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
the same way. A third store, `judgeRoundRecordEditHistory` (keyed by round
id, capped at the 10 most recent prior versions per round), holds what each
round looked like before each edit, so a correction can be undone via
`undoLastJudgeRoundRecordEdit` instead of being permanent. A fourth store,
`judgeRoundRecordRedoHistory` (same per-round cap), holds whatever version
`undoLastJudgeRoundRecordEdit` most recently replaced, so
`redoLastJudgeRoundRecordEdit` can step forward through it again; a fresh
edit or a delete discards it, the same way it discards the undo history.

Every profile field already existed and was Vitest-covered by
`judge/judge-profile.ts`'s `buildJudgeProfile`; this feature closes
follow-up (b), "a judge-profile card/panel UI," named under the "⚖️ Judge
Profiles" bullet in `TODO.md`, adding one small ordering helper
(`buildJudgeProfilesRoster`) to `state/judgeProfiles.ts` rather than
introducing new aggregation logic. Vitest-covered in
`packages/debate-speech-writer/test/judgeProfiles.test.ts`;
`state/judgeRoundRecords.ts` in
`packages/debate-speech-writer/test/judgeRoundRecords.test.ts`.

The "Filter by judge ID" input on the logged-rounds list now backs onto a
`<datalist>` of `listJudgeIds()` — every distinct judge id with at least one
logged round, sorted alphabetically — so typing offers the ids actually on
record instead of a blank guess. When the typed filter matches nothing,
`findNearestJudgeId(query)` (a small case-insensitive Levenshtein
edit-distance search over the same id list, local to
`state/judgeRoundRecords.ts`) suggests the closest known id as a clickable
"Did you mean `<id>`?" prompt that refills the filter. Both are Vitest-covered
in `judgeRoundRecords.test.ts`.

## Comparing judges on a panel

The **Compare judges** section below the roster lets a debater prep for a
panel round (two or more judges deciding together) instead of only ever
reading one judge's profile at a time. Checking two or more judges in the
roster's leftmost checkbox column reveals a panel-level read, built by
`judge/judge-panel-comparison.ts#buildJudgePanelComparison` from the
checked judges' already-persisted profiles:

| Section | Meaning |
| --- | --- |
| Side leans | Every checked judge with a notable side bias (the same `hasNotableSideBias` threshold as the roster), and which side they lean |
| Recommended pace | The **slowest** tracked average pace among the checked judges, so prep targets the panel's least speed-tolerant vote rather than its fastest — with the judge that pace came from named alongside it |
| Theory | `safe` (every tracked judge is `medium`/`high` receptiveness), `risky` (every tracked judge is `low`), `mixed` (the panel is split), or `unknown` (no checked judge tracked theory receptiveness) — a `risky`/`mixed` verdict also lists which judges are averse |
| Paradigms | Each checked judge's most-tagged paradigm, flagged "conflicting" once two or more disagree (an untagged judge, or judges who all agree, don't count as a conflict) |

"Clear selection" empties the checked set. The section itself only appears
once at least two judge profiles exist to compare; with zero or one judge
checked it shows a prompt instead of a comparison.

This is read-only — it doesn't persist anything of its own, doesn't feed
back into `research-task-routing.ts`/`progress-unlocks.ts`, and (like the
roster it draws from) only ever compares judges that already have a saved
profile logged through this same panel.

## Known gaps

- No real ballot data source yet (follow-up (a) — no `Round`/ballot schema
  in this repo captures speaker points, pace, or theory outcomes today);
  every round is entered by hand through this panel's form, or supplied by
  a caller of `recordJudgeRound`/`saveJudgeProfile` directly. This is the
  same gap the [Opponent Team Profiles](opponent-team-profiles.md) panel has.
- ~~Undo has no matching "redo"~~ Closed: a Redo action now steps forward
  again to whatever version Undo just replaced (see "Correcting a logged
  round" above). Undo (and now redo) history is still capped at the 10 most
  recent edits per round, so a round corrected more than 10 times can't be
  undone all the way back to its first-ever logged version.
- Profiles are per-browser localStorage, not a shared team resource, and
  there are no identity/permission checks on who may log a round for a
  judge (no auth in this repo yet).
