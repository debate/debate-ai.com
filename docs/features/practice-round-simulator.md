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
`/versus-ai` to actually submit them), a "Generate AI opponent speech"
action once it's the AI's turn, the rendered setup sections (speech order,
judge paradigm, AI opponent), a "Generate post-round feedback for current
round" form, post-round feedback once one has been generated, and a "Get AI
judge decision" action — with a "Clear" action per round.

Once a round has been started at `/versus-ai` (so an `aiVersusRounds.ts`
record exists for the same `roundId`) and it's the AI's turn, "Generate AI
opponent speech" builds the request via the existing `buildAiResponseRequest`
and calls `requestAiVersusSpeech` — or, when the round's own saved
`setup.opponentPersona` is set, the persona-conditioned
`requestAiVersusSpeechWithPersona` — saving the result back through
`aiVersusRounds.ts`.

"Generate post-round feedback for current round" reads the round
workspace's currently selected flow (the same `state/store.ts` `useFlowStore`
mechanism `CoachingSessionsPanel`'s "Generate coaching session for current
round" action uses) and, given a side, calls
`buildAndSavePracticeRoundFeedback` to derive that round's
`PracticeRoundFeedback` under its own already-saved judge paradigm and save
it onto the round's record. The button is only enabled while the
workspace's selected flow's id matches the card's `roundId` — feedback for
a round can only be generated once a round's own setup has been saved here
first.

"Get AI judge decision" resolves the round's own saved `setup.judgeParadigm`
against a saved flow summary (Speech Transcript Summaries, same `roundId`)
via `round/practice-round-judge-decision-wiring.ts`, calls the existing
`requestJudgeDecision`, and saves the verdict onto the round's own record.

## Data flow

```
round/practice-round-simulator.ts
  → buildPracticeRoundSetup({ styleKey, userSide, judgeParadigm, opponentPersona })
      — composes idea #3's buildAiVersusSpeechOrder, debate-speech-writer's
        judge-paradigms.ts / opponent-personas.ts prompt builders
  → buildPracticeRoundFeedback(flow, sideKey, judgeParadigm)
      — composes the round's judge paradigm with the existing AI Coach Mode
        buildCoachingSession

state/practiceRounds.ts (localStorage: practiceRounds)
  → buildPracticeRoundsPanelView()   — sorts every persisted
                                        PracticeRoundRecord by roundId
  → getPracticeRoundSubmittedSpeeches(roundId)   — reads through the
                                        existing aiVersusRounds.ts store
  → buildAndSavePracticeRoundFeedback(flow, roundId, sideKey)
                                    — derives + saves a round's feedback
                                      from an already-flowed Flow, under
                                      the round's own saved judge paradigm
  → panels/PracticeRoundSimulatorPanel.tsx   — renders the setup form and
                                        every persisted round
  → apps/debate-ai.com/app/practice-round/page.tsx  — mounts the panel as a route

round/practice-round-judge-decision-wiring.ts
  → buildPracticeRoundJudgeDecisionInput(roundId, judgeParadigm, sideNames)
      — resolves a saved flow summary (state/flowSummaries.ts) into a
        JudgeDecisionAiInput for the round's own judge paradigm
  → round/judge-decision-client.ts's requestJudgeDecision(...)
  → savePracticeRound({ ...record, judgeDecision })

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

A later slice wired a "Generate AI opponent speech" action (reusing the
existing AI-versus speech-generation calls against the round's own
`aiVersusRounds.ts` state and saved persona) and a "Get AI judge decision"
action (via `round/practice-round-judge-decision-wiring.ts`, composing the
round's own saved judge paradigm with a saved flow summary) into the panel,
closing follow-up (a)'s AI-speech and AI-judge-decision halves.

A further slice added `state/practiceRounds.ts`'s
`buildAndSavePracticeRoundFeedback` and the panel's "Generate post-round
feedback for current round" form, closing the "feedback generation isn't
wired to a live round flow" gap this doc previously called out — until this
slice, submitting speeches (at `/versus-ai`) progressed the round but
post-round feedback was never actually computed anywhere in the app.
Vitest-covered in `packages/debate-round/test/practiceRounds.test.ts`'s
`buildAndSavePracticeRoundFeedback` suite.

## Known gaps

No known gaps remain for this idea.
