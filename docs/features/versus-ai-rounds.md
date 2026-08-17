# Online Debate Versus AI

Lets a debater set up an online practice round against an AI opponent, pick a
`debate-timer` format and side, and submit speeches in turn order — the "(b) a
round-setup + submission UI in `debate-round` that lets a user pick a
format/side, type or record a speech, calls `validateSpeechSubmission`, and
reads/writes through the persistence store" follow-up named under idea #3
("Online Debate Versus AI") in `TODO.md`'s Product Feature Ideas list.

- **Route:** `/versus-ai`
- **Nav:** the global dock's Settings menu → **Debate vs AI**
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

A form to pick a round ID, a `debate-timer` timed format, and which side the
user is debating. Starting (or resuming) a round renders the full turn order
from `buildAiVersusSpeechOrder`, each slot tagged "You" or "AI" with a
checkmark badge once delivered.

- On the user's turn, a textarea plus Submit calls `validateSpeechSubmission`
  against the next expected slot and, on success, appends
  `{ name, speaker: "user", text }` to the round's `submittedSpeeches` and
  saves it.
- On the AI's turn, since follow-up (a) (an actual AI speech-generation call)
  isn't wired up yet, `buildAiResponseRequest` is only used to show which
  slot/prior speeches the AI would respond to and whether it's a
  cross-examination turn; the AI's response is entered manually through its
  own textarea + Submit, appending `{ name, speaker: "ai", text }`.
- Once `getNextSpeechSlot` returns `null`, the round shows a "Round complete"
  state instead of either form.

Below the form, every persisted round renders as its own card (sorted by
`roundId`) with its delivered speeches speaker-tagged, a "Resume" button that
loads it back into the active setup state, and a "Clear" action.

## Data flow

```
round/ai-versus-speech-order.ts (pure logic, unchanged)
  → buildAiVersusSpeechOrder(styleKey, userSide)  — full turn order
  → getNextSpeechSlot / isUsersTurn               — whose turn is next
  → validateSpeechSubmission                       — checks a submitted name
  → buildAiResponseRequest                         — AI's next-slot request (no AI call)

state/aiVersusRounds.ts (localStorage: aiVersusRounds)
  → buildAiVersusRoundsPanelView()   — sorts every persisted
                                        AiVersusRoundRecord by roundId
  → panels/AiVersusRoundsPanel.tsx   — renders the setup/submission flow and
                                        every persisted round
  → apps/debate-ai.com/app/versus-ai/page.tsx  — mounts the panel as a route

Submitting a speech (user or AI-manual):
panels/AiVersusRoundsPanel.tsx
  → validateSpeechSubmission(order, submittedSpeeches.length, name)
  → saveAiVersusRound({ ...round, submittedSpeeches: [...prev, entry] })
  → panel re-reads buildAiVersusRoundsPanelView() to refresh

Clearing a round:
panels/AiVersusRoundsPanel.tsx
  → deleteAiVersusRound(roundId)
  → panel re-reads buildAiVersusRoundsPanelView() to refresh
```

Every turn-order and persistence rule already existed and was Vitest-covered;
this feature closes follow-up (b) on the "Online Debate Versus AI" bullet,
adding one small helper to `state/aiVersusRounds.ts` —
`buildAiVersusRoundsPanelView`, which sorts `listAiVersusRounds`'s output for
a stable panel display order — rather than introducing new turn-order or
persistence logic. Vitest-covered in
`packages/debate-round/test/aiVersusRounds.test.ts`.

## Known gaps

- Follow-up (a), an actual AI speech-generation call that consumes
  `buildAiResponseRequest`'s output (prior speeches + slot + cross-ex flag)
  to produce the AI's next speech text, remains open — not started. This
  panel only lets a user enter the AI's response manually so a round can be
  completed end-to-end today.
