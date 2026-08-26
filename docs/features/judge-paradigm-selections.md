# Judge Paradigm Picker

Lets a user pick a round's AI judge paradigm — one of the six built-in
paradigms (Flow, Lay, Policymaker, Kritikal, Educator, Truth Over Tech) or a
custom paradigm built from a real judge's own publicly stated preferences —
and lists every round with a saved selection, with a "Clear" action per
round.

- **Route:** `/paradigms`
- **Nav:** the Tools page's Prep & Practice group; the Reason Editor's
  Workspace menu (`t paradigm` in Ctrl/Cmd-Shift-Space's command palette)
- **Package:** [`debate-speech-writer`](../../packages/debate-speech-writer/README.md)

## What it shows

A form to save a round's paradigm: a round ID, a radio choice among the six
built-in paradigms (each showing its name and description) or "Custom judge
paradigm," which reveals a judge-name and preferences-notes field. Below the
form, every round with a saved `JudgeParadigmSelection` is listed — round ID,
the paradigm's name, a "Get AI judge decision →" link to `/judge-decision`
pre-filled with that round's ID (see "AI Judge Decision" under Data flow
below), and a "Clear" action — sorted by `roundId`.

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

AI Judge Decision (a saved selection's "Get AI judge decision →" link):
panels/JudgeParadigmPickerPanel.tsx
  → buildJudgeDecisionDeepLink(roundId) — state/judgeParadigmSelections.ts,
    e.g. "/judge-decision?roundId=round-1"
  → apps/debate-ai.com/app/judge-decision/page.tsx (debate-round)
  → panels/JudgeDecisionPanel.tsx — reads `?roundId=` via next/navigation's
    useSearchParams to pre-fill the Round ID field, then resolves that
    round's saved paradigm via getJudgeParadigmSelection as usual
```

Every paradigm definition and persistence rule already existed and was
Vitest-covered; this feature closes follow-up (b), "a paradigm-picker UI for
selecting a built-in paradigm or entering a custom judge's notes that
reads/writes through the persistence store," named under idea #5 ("AI Judge
Decision Modes") in `TODO.md`'s Product Feature Ideas list, adding one small
ordering helper (`buildJudgeParadigmSelectionsPanelView`) to
`state/judgeParadigmSelections.ts` rather than introducing new
paradigm-resolution logic. Vitest-covered in
`packages/debate-speech-writer/test/judgeParadigmSelections.test.ts`. A
later slice closed follow-up (a): `round/judge-decision-ai.ts` composes
`buildJudgeParadigmPrompt`'s output with a round's flow summary into an AI
judge-decision request, `round/judge-decision-client.ts` calls the existing
`/api/reason-ai` proxy with it, and `round/judge-decision-store-wiring.ts`'s
`buildJudgeDecisionInputFromStores` resolves the round's saved paradigm via
`getJudgeParadigmSelection` — wired into `panels/JudgeDecisionPanel.tsx`
(mounted at `/judge-decision`) and `panels/PracticeRoundSimulatorPanel.tsx`.
A further slice closed the "doesn't itself invoke a judge decision" Known
gap below: `state/judgeParadigmSelections.ts`'s new
`buildJudgeDecisionDeepLink(roundId)` builds a `/judge-decision?roundId=…`
link, rendered as a "Get AI judge decision →" button next to each saved
selection in `JudgeParadigmPickerPanel.tsx`; `JudgeDecisionPanel.tsx` reads
that `roundId` query param via `next/navigation`'s `useSearchParams` to
pre-fill its form, mirroring `debate-card-search`'s
`EvidenceLibraryPanel`/`?checkUrl=`/`buildReuseCheckDeepLink` convention.
Vitest-covered in
`packages/debate-speech-writer/test/judgeParadigmSelections.test.ts`.

## Known gaps

- This panel (`JudgeParadigmPickerPanel.tsx`, at `/paradigms`) still doesn't
  show the resulting `buildJudgeParadigmPrompt` text inline — the "Get AI
  judge decision →" link above only gets a user to the separate
  `JudgeDecisionPanel.tsx`/`PracticeRoundSimulatorPanel.tsx` flows one click
  closer than typing the round ID a second time, not into an inline preview
  or the decision itself.
