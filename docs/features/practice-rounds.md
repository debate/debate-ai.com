# Practice Round Simulator

Shows every persisted practice round — a recreated tournament round's setup
(speech order, judge paradigm, AI opponent persona) and, once generated, its
post-round coaching feedback — with a "Clear" action per round.

- **Route:** `/practice-round`
- **Nav:** the global dock's Settings menu → **Practice Round Simulator**
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

Each persisted `PracticeRoundRecord` (keyed by `roundId`) renders as its own
card, sorted by `roundId` for a stable order:

| Section | Source |
| --- | --- |
| Setup | `round.setup.sections` — speech order, judge paradigm prompt, and AI opponent persona prompt from `buildPracticeRoundSetup` |
| Feedback | `round.feedback.sections`, shown only once feedback has been generated and saved — the paradigm the round was judged under plus the AI Coach Mode coaching session from `buildPracticeRoundFeedback` |

## Data flow

```
state/practiceRounds.ts (localStorage: practiceRounds)
  → buildPracticeRoundsPanelView()      — sorts every persisted
                                           PracticeRoundRecord by roundId
  → panels/PracticeRoundsPanel.tsx      — renders it
  → apps/debate-ai.com/app/practice-round/page.tsx  — mounts the panel as a route

Clearing a round's practice-round state:
panels/PracticeRoundsPanel.tsx
  → deletePracticeRound(roundId)        — state/practiceRounds.ts
  → panel re-reads buildPracticeRoundsPanelView() to refresh
```

Every round-setup/feedback composition and persistence rule already existed
and was Vitest-covered; this feature closes follow-up (b), "a
round-simulator UI that reads/writes through the persistence store," named
under the "🧪 Practice Round Simulator" bullet in `TODO.md`, adding one
small helper to `state/practiceRounds.ts` — `buildPracticeRoundsPanelView`,
which sorts `listPracticeRounds`'s output for a stable panel display
order — rather than introducing new setup/feedback logic. Vitest-covered in
`packages/debate-round/test/practiceRounds.test.ts`.

## Known gaps

- No actual AI speech-generation call for the AI opponent's speeches or an
  AI judge-decision call under the chosen paradigm — follow-up (a) on the
  same bullet, not started.
- No affordance in this panel to start a new practice round or submit
  speeches — a round only appears here once something elsewhere calls
  `buildPracticeRoundSetup`/`buildPracticeRoundFeedback` and
  `savePracticeRound` for that round.
