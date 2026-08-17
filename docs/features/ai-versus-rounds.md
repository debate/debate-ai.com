# Online Debate Versus AI

Lets a debater start a full practice round against an AI opponent — pick a
`debate-timer` format and side, then submit their own speeches one at a
time, in turn order — the "(b) a round-setup + submission UI in
`debate-round` that lets a user pick a format/side, type or record a
speech, calls `validateSpeechSubmission`, and reads/writes through the
persistence store" follow-up named under idea #3 ("Online Debate Versus
AI") in `TODO.md`'s Product Feature Ideas list.

- **Route:** `/versus-ai`
- **Nav:** the global dock's Settings menu → **Online Debate Versus AI**
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

A form to start a round: a round ID, a `debate-timer` format, and which
side the user is speaking (formats with no `secondary` side, like
Congress, only offer the primary side). Starting a round derives its full
speech order via `buildAiVersusSpeechOrder` and persists an empty round
through `saveAiVersusRound`.

Once a round is active, the panel renders its full turn order — each slot
tagged "You" or "AI" and marked Delivered/Next/Pending — and, when it's the
user's turn, a text area to type and submit the next expected speech.
Submission calls `validateSpeechSubmission` before saving, and AI turns are
shown as pending rather than fillable, since no AI speech-generation call
exists yet.

Below that, every persisted round renders as its own card (sorted by
`roundId`) with a live progress line and a "Continue"/"Clear" action.

## Data flow

```
round/ai-versus-speech-order.ts
  → buildAiVersusSpeechOrder(styleKey, userSide)   — derives the turn order
  → validateSpeechSubmission(order, submittedCount, speechName)
                                                    — checked before a save

state/aiVersusRounds.ts (localStorage: aiVersusRounds)
  → buildAiVersusRoundsPanelView()   — sorts every persisted
                                        AiVersusRoundRecord by roundId
  → getAiVersusRoundStatus(roundId)  — rebuilds a round's order/next-slot
                                        status on read
  → panels/AiVersusRoundPanel.tsx    — renders the round-setup form, the
                                        active round's turn order, and
                                        every persisted round
  → apps/debate-ai.com/app/versus-ai/page.tsx  — mounts the panel as a route

Starting a round:
panels/AiVersusRoundPanel.tsx
  → saveAiVersusRound({ roundId, styleKey, userSide, submittedSpeeches: [] })
  → panel re-reads buildAiVersusRoundsPanelView() to refresh

Submitting a speech:
panels/AiVersusRoundPanel.tsx
  → validateSpeechSubmission(order, submittedCount, nextSlot.name)
  → saveAiVersusRound({ ...record, submittedSpeeches: [...] })
  → panel re-reads buildAiVersusRoundsPanelView() to refresh

Clearing a round:
panels/AiVersusRoundPanel.tsx
  → deleteAiVersusRound(roundId)
  → panel re-reads buildAiVersusRoundsPanelView() to refresh
```

Every turn-order and persistence rule already existed and was
Vitest-covered; this feature closes follow-up (b) on idea #3, adding two
small helpers to `state/aiVersusRounds.ts` — `buildAiVersusRoundsPanelView`
(sorts `listAiVersusRounds`'s output for a stable panel display order) and
`getAiVersusRoundStatus` (derives a round's order/next-slot status on read
rather than storing it) — rather than introducing new turn-order or
validation logic. Vitest-covered in
`packages/debate-round/test/aiVersusRounds.test.ts`.

## Known gaps

- Follow-up (a), an actual AI speech-generation call that consumes
  `buildAiResponseRequest`'s output to produce the AI's next speech text,
  remains open — not started. Until it exists, a round can only ever
  progress as far as the user's own turns; AI turns block further
  submission.
- Speech submission is text-only. `PriorSpeechRecord` (what
  `submittedSpeeches` stores) has no audio field, and no
  transcription pipeline exists in this repo, so "or record a speech" from
  the original follow-up wording isn't implemented — recording would need
  either a new audio field on the persisted record or a transcription step
  ahead of the existing text-only save.
