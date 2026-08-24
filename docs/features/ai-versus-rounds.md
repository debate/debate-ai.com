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

Whenever the round's most recently submitted speech was the AI's, a
"Regenerate last AI speech" button also appears (works regardless of whose
turn is next — including after the round is complete). Clicking it
re-requests that same slot, from the same prior-speeches context originally
used to generate it, and replaces it in place — every earlier speech,
including any of the user's own, is untouched. This is a full do-over of
that one speech, not a "make it different from before" hint: the
regeneration request carries no memory of the text being replaced.

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

Regenerating the last AI speech:
panels/AiVersusRoundPanel.tsx
  → state/aiVersusRounds.ts's canRegenerateLastAiSpeech(record)
                                                    — gates the button on
                                                      the last submitted
                                                      speech being the AI's
  → buildAiResponseRequest(order, submittedCount - 1,
      submittedSpeeches.slice(0, -1))                — rebuilds the same
                                                          slot + prior-
                                                          speeches request
                                                          originally used
  → requestAiVersusSpeech(request) (or the persona-aware variant)
  → state/aiVersusRounds.ts's replaceLastAiSpeech(record, text)
                                                    — swaps the last
                                                      speech's text only
  → saveAiVersusRound(...)
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

The "regenerate last AI speech" affordance — found via this run's
`docs/features/*.md` Known gaps audit, not tracked as its own numbered
`TODO.md` idea — adds two small, pure `state/aiVersusRounds.ts` helpers,
`canRegenerateLastAiSpeech` (whether the last submitted speech was the
AI's) and `replaceLastAiSpeech` (returns a copy of a round record with its
last speech's text swapped, throwing if that speech wasn't the AI's).
Neither calls the AI or introduces a new request/response shape — the
panel rebuilds the exact same `AiSpeechRequest` `buildAiResponseRequest`
would have built when the speech being replaced was first generated (by
passing `submittedCount - 1` and the speeches before it), so the
regenerated speech responds to the same context the original one did.
Vitest-covered in `packages/debate-round/test/aiVersusRounds.test.ts`
(6 new cases: `canRegenerateLastAiSpeech` for no speeches / last-speech-is-
user's / last-speech-is-AI's, and `replaceLastAiSpeech` for the swap
itself, non-mutation of the input record, and both throwing cases).

The speech-submission text field also has a "🎤 Record"/"Stop recording"
button (found via this run's `docs/features/*.md` Known gaps audit — the
former "Speech submission is text-only... no transcription pipeline
exists" gap was already solved elsewhere in this repo and just never wired
into this panel), dictating directly into the same `speechText` state the
"Submit speech" button already reads, via the existing
`hooks/useMicrophoneTranscription.ts` and `round/microphone-transcription.ts`
(`appendDictatedSegment`) — the same primitives idea #6's "Speech Transcript
Summaries" (PR #297) and idea #8's "Video-Lecture-Training Coach AI"
(PR #298) panels already use, duplicated nowhere new. A disabled
"Microphone dictation isn't supported in this browser" fallback shows when
neither `SpeechRecognition` constructor exists, and a recognition error
(e.g. mic permission denied) surfaces inline. No new pure logic was added —
`microphone-transcription.ts`'s existing Vitest coverage already applies.

## Known gaps

- "Regenerate last AI speech" only ever replaces the most recently
  submitted speech — there's no way to regenerate an earlier AI speech in
  the middle of a round without also discarding every speech (the user's
  included) submitted after it, since `submittedSpeeches` is a flat,
  append-only array with no per-slot identity beyond position.
