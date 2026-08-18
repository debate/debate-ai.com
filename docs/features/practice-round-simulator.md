# Practice Round Simulator

Lets a debater configure and track a simulated tournament round — format,
side, AI judge paradigm, and AI opponent persona — the "(b) a
round-simulator UI that reads/writes through the persistence store"
follow-up named under the "🧪 Practice Round Simulator" bullet in
`TODO.md`'s Research Crowdsourcing Organizer Features list.

- **Route:** `/practice-round`
- **Nav:** the global dock's Settings menu → **Practice Round Simulator**
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

A form to pick a round ID, `debate-timer` format, side, an AI judge
paradigm (one of the six built-in paradigms from
`judge-paradigms.ts`, or a custom paradigm built from a real judge's own
publicly stated preferences via `buildCustomJudgeParadigm`), and an
optional AI opponent persona (one of the four built-in personas from
`opponent-personas.ts`). Saving composes these into a
`PracticeRoundSetup` via the already-existing `buildPracticeRoundSetup` and
stores it through `state/practiceRounds.ts`.

Below the form, every persisted round renders as its own card (sorted by
`roundId`): the judge-paradigm and opponent-persona badges, how many of the
round's speeches have been submitted (looked up through the existing
"Online Debate Versus AI" `aiVersusRounds.ts` store, with a link to
`/versus-ai` to actually submit them), the rendered setup sections (speech
order, judge paradigm, AI opponent), and post-round feedback once one has
been generated — with a "Clear" action per round.

## Data flow

```
round/practice-round-simulator.ts
  → buildPracticeRoundSetup({ styleKey, userSide, judgeParadigm, opponentPersona })
      — composes idea #3's buildAiVersusSpeechOrder, debate-speech-writer's
        judge-paradigms.ts / opponent-personas.ts prompt builders

state/practiceRounds.ts (localStorage: practiceRounds)
  → buildPracticeRoundsPanelView()   — sorts every persisted
                                        PracticeRoundRecord by roundId
  → getPracticeRoundSubmittedSpeeches(roundId)   — reads through the
                                        existing aiVersusRounds.ts store
  → panels/PracticeRoundSimulatorPanel.tsx   — renders the setup form and
                                        every persisted round
  → apps/debate-ai.com/app/practice-round/page.tsx  — mounts the panel as a route

Saving a round's setup:
panels/PracticeRoundSimulatorPanel.tsx
  → buildPracticeRoundSetup(...)
  → savePracticeRound({ roundId, setup, feedback: <preserved if already set> })
  → panel re-reads buildPracticeRoundsPanelView() to refresh

Clearing a round:
panels/PracticeRoundSimulatorPanel.tsx
  → deletePracticeRound(roundId)
  → panel re-reads buildPracticeRoundsPanelView() to refresh
```

Every setup-composition, judge-paradigm, and opponent-persona rule already
existed and was Vitest-covered; this feature closes follow-up (b) on the
"🧪 Practice Round Simulator" bullet, adding one small helper to
`state/practiceRounds.ts` — `buildPracticeRoundsPanelView`, which sorts
`listPracticeRounds`'s output for a stable panel display order (mirroring
`aiVersusRounds.ts`'s `buildAiVersusRoundsPanelView`) — rather than
introducing new setup or persistence logic. Vitest-covered in
`packages/debate-round/test/practiceRounds.test.ts`.

## Known gaps

- Follow-up (a), an actual AI speech-generation call for the AI opponent's
  speeches and an AI judge-decision call under the chosen paradigm, remains
  open — not started. Until it exists, submitting speeches (at `/versus-ai`)
  only progresses as far as the user's own turns, and post-round feedback is
  never generated automatically — the panel shows "no post-round feedback
  yet" for every round.
