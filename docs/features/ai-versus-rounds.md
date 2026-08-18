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
Submission calls `validateSpeechSubmission` before saving. On the AI's
turn, a "Generate AI speech" button calls the real AI speech-generation
request (below) and saves the returned text as that slot's speech.

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

Generating the AI's next speech (follow-up (a)):
panels/AiVersusRoundPanel.tsx
  → buildAiResponseRequest(order, submittedCount, submittedSpeeches)
                                                    — the structured request
                                                      (slot + prior speeches
                                                      + cross-ex flag)
  → round/ai-versus-speech-client.ts's requestAiVersusSpeech(request)
      → round/ai-versus-speech-ai.ts's AI_VERSUS_SPEECH_SYSTEM_PROMPT +
        buildAiVersusSpeechUserPrompt(request)      — builds the prompt
      → POST /api/reason-ai                          — the shared
                                                        Anthropic proxy
      → parseAiVersusSpeechResponse(text)             — strips a wrapping
                                                          code fence/quotes
  → saveAiVersusRound({ ...record, submittedSpeeches: [...,
      { name: slot.name, speaker: "ai", text } ] })
  → panel re-reads buildAiVersusRoundsPanelView() to refresh
```

Every turn-order and persistence rule already existed and was
Vitest-covered; the round-setup/submission UI closed follow-up (b) on idea
#3, adding two small helpers to `state/aiVersusRounds.ts` —
`buildAiVersusRoundsPanelView` (sorts `listAiVersusRounds`'s output for a
stable panel display order) and `getAiVersusRoundStatus` (derives a
round's order/next-slot status on read rather than storing it) — rather
than introducing new turn-order or validation logic. Vitest-covered in
`packages/debate-round/test/aiVersusRounds.test.ts`.

Follow-up (a) — the AI speech-generation call — adds
`round/ai-versus-speech-ai.ts` (pure prompt-building + tolerant response
parsing, `fetch`-free and directly Vitest-testable) and
`round/ai-versus-speech-client.ts` (the thin `fetch` client posting to
`/api/reason-ai`), mirroring `debate-card-search`'s "LLM Card Scoring —
real AI-scoring call" slice's `lib/llm-card-scoring-ai.ts` /
`lib/llm-card-scoring-client.ts` split. No existing turn-order or
persistence logic changed. Vitest-covered in
`packages/debate-round/test/ai-versus-speech-ai.test.ts` (prompt building
+ response parsing) and
`packages/debate-round/test/ai-versus-speech-client.test.ts` (the `fetch`
client, with `fetch` mocked via `vi.stubGlobal`).

## Known gaps

- Speech submission is text-only. `PriorSpeechRecord` (what
  `submittedSpeeches` stores) has no audio field, and no
  transcription pipeline exists in this repo, so "or record a speech" from
  the original follow-up wording isn't implemented — recording would need
  either a new audio field on the persisted record or a transcription step
  ahead of the existing text-only save.
- The AI speech-generation call has no retry/regenerate action if the
  generated speech is unsatisfactory — a user must clear the whole round
  and start over. A "regenerate" affordance (replacing the just-saved AI
  speech rather than restarting) is a natural follow-up, not yet tracked
  as its own TODO item.
