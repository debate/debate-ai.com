# Judge Paradigm Picker

Lets a user pick a round's AI judge paradigm — one of the six built-in
paradigms (Flow, Lay, Policymaker, Kritikal, Educator, Truth Over Tech) or a
custom paradigm built from a real judge's own publicly stated preferences —
and lists every round with a saved selection, with a "Clear" action per
round.

- **Route:** `/paradigms`
- **Nav:** the global dock's Settings menu → **Judge Paradigm Picker**
- **Package:** [`debate-speech-writer`](../../packages/debate-speech-writer/README.md)

## What it shows

A form to save a round's paradigm: a round ID, a radio choice among the six
built-in paradigms (each showing its name and description) or "Custom judge
paradigm," which reveals a judge-name and preferences-notes field. Below the
form, every round with a saved `JudgeParadigmSelection` is listed — round ID
and the paradigm's name — sorted by `roundId`.

## Data flow

```
state/judgeParadigmSelections.ts (localStorage: judgeParadigmSelections)
  → buildJudgeParadigmSelectionsPanelView() — sorts every persisted
                                                JudgeParadigmSelection by roundId
  → panels/JudgeParadigmPickerPanel.tsx     — renders the picker form + list
  → apps/debate-ai.com/app/paradigms/page.tsx — mounts the panel as a route

Saving a round's paradigm:
panels/JudgeParadigmPickerPanel.tsx
  → judge/judge-paradigms.ts's buildCustomJudgeParadigm() for a custom paradigm,
    or a lookup into listJudgeParadigms() for a built-in one
  → saveJudgeParadigmSelection({ roundId, paradigm }) — state/judgeParadigmSelections.ts
  → panel re-reads buildJudgeParadigmSelectionsPanelView() to refresh

Clearing a round's paradigm:
panels/JudgeParadigmPickerPanel.tsx
  → deleteJudgeParadigmSelection(roundId) — state/judgeParadigmSelections.ts
  → panel re-reads buildJudgeParadigmSelectionsPanelView() to refresh
```

Every paradigm definition and persistence rule already existed and was
Vitest-covered; this feature closes follow-up (b), "a paradigm-picker UI for
selecting a built-in paradigm or entering a custom judge's notes that
reads/writes through the persistence store," named under idea #5 ("AI Judge
Decision Modes") in `TODO.md`'s Product Feature Ideas list, adding one small
ordering helper (`buildJudgeParadigmSelectionsPanelView`) to
`state/judgeParadigmSelections.ts` rather than introducing new
paradigm-resolution logic. Vitest-covered in
`packages/debate-speech-writer/test/judgeParadigmSelections.test.ts`.

## Known gaps

- Follow-up (a), an AI judge-decision call that uses
  `buildJudgeParadigmPrompt`'s output instead of (or alongside) the existing
  static `judgeDecisionPrompt`, remains open — not started.
- This panel only saves/clears a selection; it doesn't itself invoke a judge
  decision or show the resulting `buildJudgeParadigmPrompt` text.
