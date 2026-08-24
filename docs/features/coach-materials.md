# Coach Materials

Lets a coach upload grounding materials — lecture transcripts, camp
materials, instructional documents, and practice-round recordings — for a
private team coach AI, preview which materials a question would draw on,
and ask the coach AI a real question grounded strictly in those materials.

- **Route:** `/coach-materials`
- **Nav:** the global dock's Settings menu → **Coach Materials**
- **Package:** [`debate-speech-writer`](../../packages/debate-speech-writer/README.md)

## What it shows

- An upload form (kind, title, optional topic, comma-separated tags,
  material text) that saves a `CoachMaterial` through the already-persisted
  `state/coachMaterials.ts`.
- An "Upload a document" button next to the Material text field that reads
  an uploaded `.docx`, `.txt`, or `.md` file and fills the text field from
  it, instead of requiring the text to be pasted in by hand.
- A "🎤 Record"/"Stop recording" button next to the same field that dictates
  directly into it via the browser's own Web Speech API, with a disabled
  "Microphone dictation isn't supported in this browser" fallback and an
  inline error message on recognition failure (e.g. mic permission denied).
- Every persisted material, grouped by kind (Lecture Transcript, Camp
  Material, Instructional Document, Practice-Round Recording), each with a
  "Delete" action.
- An "Ask the coach" section: typing a question and clicking "Preview
  grounded prompt" shows the top relevant materials and the composed
  grounded prompt text, while "Ask the coach" sends that same prompt to a
  real AI call and renders the model's grounded answer (or a plain error
  message if the request fails).

## Data flow

```
state/coachMaterials.ts (localStorage)
  → buildCoachMaterialLibraryFromStore()   — composes coach/team-coach-materials.ts
      → buildCoachMaterialLibrary()        — groups materials by kind
  → findRelevantMaterialsFromStore()       — composes coach/team-coach-materials.ts
      → findRelevantMaterials()            — keyword-overlap relevance ranking
      → buildGroundedCoachPrompt()         — composes the ranked matches into a prompt
  → panels/CoachMaterialsPanel.tsx (upload form, kind-grouped list, ask-the-coach UI)
  → apps/debate-ai.com/app/coach-materials/page.tsx (mounts the panel as a route)

Asking the coach a question (follow-up (b)):
panels/CoachMaterialsPanel.tsx
  → findRelevantMaterialsFromStore(question, { limit: 5 })   — the same
                                                                 matches the
                                                                 preview uses
  → coach/team-coach-client.ts's requestTeamCoachAnswer(question, matches)
      → coach/team-coach-materials.ts's buildGroundedCoachPrompt(question, matches)
                                                    — the exact user-turn
                                                      message sent to the model
      → coach/team-coach-ai.ts's TEAM_COACH_AI_SYSTEM_PROMPT
                                                    — frames the model as the
                                                      team's private coach
      → POST /api/reason-ai                          — the shared
                                                        Anthropic proxy
      → parseTeamCoachAiResponse(text)                — strips a wrapping
                                                          code fence
  → renders the answer, or the thrown error message on failure

Uploading a document to fill the text field (the "document" half of
follow-up (a)):
panels/CoachMaterialsPanel.tsx
  → coach/document-material-extraction.ts's
      extractMaterialTextFromDocument({ fileName, content: file })
      → detectDocumentKind(fileName)                  — .txt/.md/.markdown vs .docx
      → (.txt/.md) file.text()                        — read directly
      → (.docx) debate-card-parser's convertDocxToHTML(file, { plainTextOnly: true })
                                                        — the existing Verbatim
                                                          .docx → text pipeline
  → fills form.text (and form.title, if it was still empty) from the result

Dictating into the Material text field (the "recording" half of
follow-up (a)):
panels/CoachMaterialsPanel.tsx
  → hooks/useMicrophoneTranscription.ts                — wraps the browser's
                                                           SpeechRecognition/
                                                           webkitSpeechRecognition
      → coach/microphone-transcription.ts's
          getSpeechRecognitionConstructor/isMicrophoneTranscriptionSupported
                                                        — feature detection
          appendDictatedSegment                        — joins each finalized
                                                          segment onto form.text
          describeMicrophoneTranscriptionError         — readable recognition-
                                                          error messages
  → fills form.text as the user speaks
```

This feature is a read/write UI layer over the existing pure logic: it
introduces two store-composition functions, `buildCoachMaterialLibraryFromStore`
and `findRelevantMaterialsFromStore` in `state/coachMaterials.ts`, which
compose the existing pure `buildCoachMaterialLibrary`/`findRelevantMaterials`
directly against the persisted materials store — no new scoring or grouping
logic (see `packages/debate-speech-writer/test/coachMaterials.test.ts`).

Follow-up (b) — the real AI Q&A call — adds `coach/team-coach-ai.ts` (the
system prompt plus a tolerant response parser, `fetch`-free and directly
Vitest-testable) and `coach/team-coach-client.ts` (the thin `fetch` client
posting to `/api/reason-ai`), mirroring `debate-round`'s
`round/ai-versus-speech-ai.ts` / `round/ai-versus-speech-client.ts` split.
The user-turn message sent to the model is exactly
`buildGroundedCoachPrompt`'s existing output — no new prompt-composition
logic was introduced, only the system prompt and response parsing. Vitest-
covered in `packages/debate-speech-writer/test/team-coach-ai.test.ts`
(system prompt content + response parsing) and
`packages/debate-speech-writer/test/team-coach-client.test.ts` (the `fetch`
client, with `fetch` mocked via `vi.stubGlobal`, covering the success path,
an endpoint override, a server error message, a non-JSON error body, and
an empty/unusable AI reply).

## Known gaps

- No transcription of an *uploaded* audio/video recording file — follow-up
  (a) under idea #8 in `TODO.md` is now fully closed for text sources
  (`.docx`/`.txt`/`.md` upload, plus live microphone dictation), but turning
  an already-recorded practice-round audio/video *file* into text still has
  no path in this repo; no server-side/paid transcription service exists
  here, only the browser's live `SpeechRecognition` API used for dictation
  above.
- `convertDocxToHTML`'s default renderer needs a browser `DOMParser` (via
  `docx-preview`), so `.docx` upload only works from this `"use client"`
  panel in the browser — not from a server-rendered or Node context.
- No reviewer/approval workflow before a material is available to the
  team coach — any saved material is immediately included.
- No conversation history — each question is answered independently; a
  prior question/answer isn't persisted or fed back into a later one.
