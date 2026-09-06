# Practice Round Simulator

Lets a debater configure and track a simulated tournament round — format,
side, AI judge paradigm, and AI opponent persona — the "(b) a
round-simulator UI that reads/writes through the persistence store"
follow-up named under the "🧪 Practice Round Simulator" bullet in
`TODO.md`'s Research Crowdsourcing Organizer Features list.

- **Route:** `/practice-round`
- **Nav:** the Tools page's Prep & Practice group; the Reason Editor's
  Workspace menu (`t simulator` in Ctrl/Cmd-Shift-Space's command palette)
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

A form to pick a round ID, `debate-timer` format, side, an AI judge
paradigm (one of the six built-in paradigms from
`judge-paradigms.ts`, or a custom paradigm built from a real judge's own
publicly stated preferences via `buildCustomJudgeParadigm`), an
optional AI opponent persona (one of the four built-in personas from
`opponent-personas.ts`), and a difficulty for that opponent (one of the
four `opponentDifficulties` levels — Beginner/Intermediate/Advanced/Elite —
defaulting to Intermediate). Saving composes these into a
`PracticeRoundSetup` via the already-existing `buildPracticeRoundSetup` and
stores it through `state/practiceRounds.ts`.

Below the form, every persisted round renders as its own card (sorted by
`roundId`): the judge-paradigm, opponent-persona, and (when a persona is
set) opponent-difficulty badges, how many of the round's speeches have been
submitted (looked up through the existing "Online Debate Versus AI"
`aiVersusRounds.ts` store, with a link to `/versus-ai` to actually submit
them), a "Generate AI opponent speech" action once it's the AI's turn
(showing the same persona/difficulty badges above the button when a
persona is set), the rendered setup sections (speech order, judge paradigm,
AI opponent), a "Generate post-round feedback for current round" form,
post-round feedback once one has been generated, and a "Get AI judge
decision" action — with a "Clear" action per round.

Once a round has been started at `/versus-ai` (so an `aiVersusRounds.ts`
record exists for the same `roundId`) and it's the AI's turn, "Generate AI
opponent speech" builds the request via the existing `buildAiResponseRequest`
and calls `requestAiVersusSpeech` — or, when the round's own saved
`setup.opponentPersona` is set, the persona- and difficulty-conditioned
`requestAiVersusSpeechWithPersona` (passing the round's own saved
`setup.opponentDifficulty`) — saving the result back through
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
  → buildPracticeRoundSetup({ styleKey, userSide, judgeParadigm, opponentPersona, opponentDifficulty })
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

A further slice added `opponentDifficulty` — the "🤖 AI Practice Opponent"
idea's "extend the Practice Round Simulator's own separate persona setup to
carry a difficulty too" Next item. `PracticeRoundSetupInput`/
`PracticeRoundSetup` gained an `opponentDifficulty` field (an
`OpponentDifficulty`, defaulting to `DEFAULT_OPPONENT_DIFFICULTY`) that
`buildPracticeRoundSetup` layers onto the persona's own prompt section via
`buildOpponentPersonaPrompt`'s existing `difficulty` parameter — the same
mechanism `OpponentPersonaPickerPanel`/`AiVersusRoundPanel` already use.
The panel's form gained a second "Difficulty" radio group next to AI
opponent persona, saving the chosen level alongside the persona and showing
it as a second badge per round and on the "Generate AI opponent speech"
prompt; "Generate AI opponent speech" now passes the round's own saved
`setup.opponentDifficulty` through to `requestAiVersusSpeechWithPersona`.
An older persisted round with no saved `opponentDifficulty` (from before
this slice) resolves to `DEFAULT_OPPONENT_DIFFICULTY` wherever it's read,
rather than being backfilled on save. Vitest-covered:
`packages/debate-round/test/practice-round-simulator.test.ts`'s
`buildPracticeRoundSetup` suite (the default vs. explicit difficulty, and
its layering into the "AI opponent" section body).

A further slice added the "comparison across a debater's past attempts"
follow-up: a "Compare your past attempts" section renders once at least one
persisted round carries a `createdAt` (stamped by `savePracticeRound` on a
round's first save, mirroring `wordCountRounds.ts`'s `createdAt` convention —
not backfilled onto a round saved before this field existed, and preserved
rather than refreshed on a later update to the same `roundId`). The new
`state/practiceRounds.ts#buildPracticeRoundAttemptsComparison` builds a
chronological win/loss trend across every such round: each round's outcome
(`"won"`/`"lost"`/`"pending"`) is derived by comparing its saved
`judgeDecision.winner` against the side the user actually argued — read off
`setup.speechOrder` (`PracticeRoundSetup` doesn't store `userSide`
directly) — staying `"pending"` until a judge decision has been requested for
that round. Each attempt also carries its judge paradigm, opponent (or "No AI
opponent"), and its post-round feedback's coaching-prompt count once
generated. The section shows a summary line (attempts logged, win/loss/
pending counts, win rate among decided attempts) above one row per attempt
with a Won/Lost/Pending badge, plus a "Download comparison" action exporting
the same data as a plain-text file via `buildPracticeRoundAttemptsComparisonText`
(mirroring `CoachingSessionsPanel`'s anchor+Blob download pattern). No new
feedback or judging logic is introduced — this reuses each round's
already-persisted `feedback`/`judgeDecision` directly. Vitest-covered:
`packages/debate-round/test/practiceRounds.test.ts`'s
`buildPracticeRoundAttemptsComparison`/`buildPracticeRoundAttemptsComparisonText`
suites (createdAt stamping/preservation, won/lost/pending derivation for both
sides, chronological sorting, win/loss/pending tallying and win-rate
calculation, feedback-issue-count carry-through, and the rendered text's
summary and per-attempt lines).

## Scoring rubric alongside the AI judge decision

Closes this bullet's "a scoring rubric shown alongside the AI judge decision"
Next item. Once a round has a `judgeDecision`, a "Scoring rubric — `<paradigm
name>`" card renders next to it, listing that round's own judge paradigm's
`votingPriorities` each with a ✅ (addressed) or ⬜ (not addressed) mark —
so a debater can see which of the paradigm's own priorities the decision
actually engaged with, not just the winner and a prose rationale. The card's
heading also counts how many of the priorities came out addressed ("N of M
priorities addressed"), and an addressed row shows the `keyVotingIssues`
entry that matched it underneath the criterion.

`debate-round`'s new `round/judge-decision-ai.ts#buildJudgeDecisionRubric`
builds the checklist: for each voting-priority string, it extracts that
criterion's significant words (4+ letters, common stopwords like "the"/"and"
filtered out) and marks the row addressed when one of those words appears in
any of the decision's `keyVotingIssues` (recording which issue matched) or
in its `rationale` (no specific issue to point at, but still addressed).
This is a heuristic keyword match, not a second AI call — it can miss a
criterion addressed in different words, or loosely match on a common word,
but is good enough to flag when a paradigm's own priority (e.g. "framework")
never comes up in the decision at all. A paradigm with no fixed
`votingPriorities` (the custom-judge paradigm) renders a note that there's
nothing to check instead of an empty list.

Vitest-covered in `packages/debate-round/test/judge-decision-ai.test.ts`'s
`buildJudgeDecisionRubric` suite (per-criterion ordering, matching via a
`keyVotingIssues` entry with the matched issue recorded, matching via the
rationale alone with no issue recorded, a criterion neither mentions, and
the empty-rubric case for a paradigm with no voting priorities).

## Known gaps

No known gaps remain for this idea. The "🧪 Practice Round Simulator" bullet
in TODO.md's Research Crowdsourcing Organizer Features list still has one
open Next item beyond this one: a round replay/playback view.
