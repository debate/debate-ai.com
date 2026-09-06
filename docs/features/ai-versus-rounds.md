# Online Debate Versus AI

Lets a debater start a full practice round against an AI opponent — pick a
`debate-timer` format and side, then submit their own speeches one at a
time, in turn order — the "(b) a round-setup + submission UI in
`debate-round` that lets a user pick a format/side, type or record a
speech, calls `validateSpeechSubmission`, and reads/writes through the
persistence store" follow-up named under idea #3 ("Online Debate Versus
AI") in `TODO.md`'s Product Feature Ideas list.

- **Route:** none of its own — the panel renders inside `/coach`. `/versus-ai`
  now serves [Practice vs AI](./practice-vs-ai.md), the ported full-round
  feature.
- **Nav:** the Coach hub
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

Every delivered AI speech in the turn-order list — not just the most
recently submitted one — gets its own "Regenerate" button (works regardless
of whose turn is next, including after the round is complete, and
regardless of how many speeches, from either side, came after it).
Clicking it re-requests that slot, from the same prior-speeches context
originally used to generate it, and replaces it in place — every other
speech, earlier or later, including any of the user's own, is untouched.
This is a full do-over of that one speech, not a "make it different from
before" hint: the regeneration request carries no memory of the text being
replaced.

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

Downloading a completed round's transcript:
panels/AiVersusRoundPanel.tsx
  → round/ai-versus-transcript.ts's buildAiVersusTranscriptText(record)
                                                    — pure plain-text render
  → aiVersusTranscriptFilename(record.roundId)      — a safe download filename
  → new Blob([text]) + anchor download              — same pattern as
                                                        dialogs/FileExportDialog.tsx

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

Regenerating a delivered AI speech at any position `index`:
panels/AiVersusRoundPanel.tsx
  → state/aiVersusRounds.ts's canRegenerateAiSpeechAt(record, index)
                                                    — gates that speech's
                                                      button on the
                                                      submitted speech at
                                                      `index` being the AI's
  → buildAiResponseRequest(order, index,
      submittedSpeeches.slice(0, index))             — rebuilds the same
                                                          slot + prior-
                                                          speeches request
                                                          originally used
  → requestAiVersusSpeech(request) (or the persona-aware variant)
  → state/aiVersusRounds.ts's replaceAiSpeechAt(record, index, text)
                                                    — swaps that speech's
                                                      text only, leaving
                                                      every other speech
                                                      (earlier or later)
                                                      untouched
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
`/api/reason-ai`), mirroring `debate-research-evidence`'s "LLM Card Scoring —
real AI-scoring call" slice's `lib/llm-card-scoring-ai.ts` /
`lib/llm-card-scoring-client.ts` split. No existing turn-order or
persistence logic changed. Vitest-covered in
`packages/debate-round/test/ai-versus-speech-ai.test.ts` (prompt building
+ response parsing) and
`packages/debate-round/test/ai-versus-speech-client.test.ts` (the `fetch`
client, with `fetch` mocked via `vi.stubGlobal`).

The "regenerate any delivered AI speech" affordance — found via this run's
`docs/features/*.md` Known gaps audit, not tracked as its own numbered
`TODO.md` idea — adds two small, pure `state/aiVersusRounds.ts` helpers,
`canRegenerateAiSpeechAt` (whether the submitted speech at a given index
exists and is the AI's) and `replaceAiSpeechAt` (returns a copy of a round
record with the speech at that index's text swapped, throwing if there's
no speech there or it wasn't the AI's). Neither calls the AI or introduces
a new request/response shape — the panel rebuilds the exact same
`AiSpeechRequest` `buildAiResponseRequest` would have built when the
speech being replaced was first generated (by passing that index and the
speeches before it), so the regenerated speech responds to the same
context the original one did. This generalizes an earlier, narrower
version of this affordance that could only ever redo the single most
recently submitted AI speech — regenerating an earlier one required
clearing every speech (including the user's own) submitted after it and
starting over; now every delivered AI speech gets its own independent
"Regenerate" button, and using it never discards any other speech.
Vitest-covered in `packages/debate-round/test/aiVersusRounds.test.ts`
(9 cases: `canRegenerateAiSpeechAt` for no speeches / a user's speech at
that index / an AI speech at that index / an out-of-range index / an
earlier AI speech with later speeches also present, and `replaceAiSpeechAt`
for the swap itself, an earlier-speech swap leaving later speeches
untouched, non-mutation of the input record, and the three throwing
cases).

A "Download transcript" button (`round/ai-versus-transcript.ts`'s
`buildAiVersusTranscriptText`/`aiVersusTranscriptFilename`) appears once a
round's `nextSlot` is `null` — every speech delivered — both on the active
round view and on any already-complete round in the persisted-round list,
closing the "transcript export/download action for a completed round"
follow-up named under idea #3. It renders a plain-text
transcript (round id, format, the user's side, then every delivered speech
labeled "You"/"AI" with its slot name) and saves it via the same
anchor+Blob download pattern `dialogs/FileExportDialog.tsx` already uses
for flow exports — no new download mechanism was introduced. The builder is
pure and works for a round in any state of completion (an empty round
renders a placeholder line) even though the panel only offers the button
once a round is complete. Vitest-covered in
`packages/debate-round/test/ai-versus-transcript.test.ts`.

While building this, `debate-timer`'s `debateStyleNames` array (consumed by
this transcript builder and, pre-existing, by `AiVersusRoundPanel.tsx`'s and
`PracticeRoundSimulatorPanel.tsx`'s own `STYLE_LABELS` lookups) was found to
have "Policy" and "Lincoln Douglas" transposed relative to `debateStyleMap`'s
order — every format-name label built from it (including the round-setup
dropdown and every persisted-round card's heading) showed the wrong name
for those two formats. Fixed by reordering the array to match
`debateStyleMap`, with a new index-alignment regression test in
`packages/debate-timer/test/debate-format-times.test.ts` pairing every style
key to its expected display name.

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

None open. Every delivered AI speech can now be regenerated independently
in place (see "Regenerating a delivered AI speech at any position" above)
without discarding any other speech; a completed round's transcript can now
be downloaded as plain text (see "Download transcript" above); speech
submission stays text-only beyond microphone dictation, and there is no
transcription path for an already-recorded audio/video file, matching every
other panel in this repo that shares that same gap.
