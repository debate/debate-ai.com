# Coach Materials

Lets a coach upload grounding materials — lecture transcripts, camp
materials, instructional documents, and practice-round recordings — for a
private team coach AI, preview which materials a question would draw on,
and ask the coach AI a real question grounded strictly in those materials.

- **Route:** `/coach-materials`
- **Nav:** the Tools page's Coaching & Analytics group; the Reason Editor's
  Workspace menu (`t materials` in Ctrl/Cmd-Shift-Space's command palette)
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
- A search/filter bar above the material list, once at least one material is
  saved: a keyword search box (matching a material's title, topic, tags, or
  body text) plus a "Tag" dropdown scoped to every distinct tag across the
  whole library, and a "Clear filters" action once either is set. The list
  below reflects both narrowed together.
- Every persisted material matching the current search/filter, grouped by
  kind (Lecture Transcript, Camp Material, Instructional Document,
  Practice-Round Recording), each with a "Delete" action. Distinguishes "no
  materials uploaded yet" from "no materials match this search/tag filter".
- An "Ask the coach" section: typing a question and clicking "Preview
  grounded prompt" shows the top relevant materials and the composed
  grounded prompt text, while "Ask the coach" sends that same prompt to a
  real AI call and renders the model's grounded answer (or a plain error
  message if the request fails).
- A persisted **Conversation** history above the question field: every
  question/answer pair asked so far, most recent last, each rendered as a
  small card. A follow-up question ("what about a counter-interp?") is sent
  with the prior turns as real conversation context, so the model can build
  on an earlier answer instead of treating every question as the first one.
  A "Clear conversation" action (shown once any history exists) wipes it.

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
  → coach/team-coach-client.ts's requestTeamCoachAnswer(question, matches, { history })
      → coach/team-coach-materials.ts's buildCoachConversationMessages(question, matches, history)
          → prior turns (most recent `maxHistoryTurns`, default 6) as
            alternating { role: "user" } / { role: "assistant" } messages
          → buildGroundedCoachPrompt(question, matches)  — the final
                                                            user-turn message,
                                                            unchanged from
                                                            before
      → coach/team-coach-ai.ts's TEAM_COACH_AI_SYSTEM_PROMPT
                                                    — frames the model as the
                                                      team's private coach
      → POST /api/reason-ai                          — the shared
                                                        Anthropic proxy,
                                                        whose `messages` array
                                                        already accepted
                                                        multiple turns
      → parseTeamCoachAiResponse(text)                — strips a wrapping
                                                          code fence
  → state/coachConversation.ts's appendCoachConversationTurn({ question, answer })
                                                    — persists the new turn
                                                      and folds it into the
                                                      panel's own `history`
                                                      state for the next
                                                      question
  → renders the answer, or the thrown error message on failure

Conversation history (closes the "No conversation history" Known gap):
state/coachConversation.ts (localStorage, key "coachConversation")
  → listCoachConversationTurns()      — read on mount, rendered above the
                                         question field
  → appendCoachConversationTurn()     — called once a real answer comes back
                                         (capped at the 50 most recently
                                         stored turns)
  → clearCoachConversationHistory()   — wired to the panel's
                                         "Clear conversation" action
  → fed into requestTeamCoachAnswer's `history` option on every question, so
    a follow-up builds on the conversation instead of starting fresh

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

## Search/filter bar

Closes the "material tagging and a search/filter bar once a library grows
past a handful of uploads" follow-up named under idea #8 in `TODO.md`.
Materials already carried a `tags: string[]` field (comma-separated on the
upload form, rendered as badges); this only adds the search/filter layer on
top:

- `coach/team-coach-materials.ts#listCoachMaterialTags(materials)` — every
  distinct tag across a material list, alphabetically sorted and
  de-duplicated, for the tag dropdown's options.
- `coach/team-coach-materials.ts#filterCoachMaterials(materials, { query?, tag? })`
  — a pure filter: `tag` restricts to an exact tag match, `query` is a
  case-insensitive substring match against a material's title, topic, tags,
  and body text (blank/whitespace-only treated as no filter), and the two
  compose (both must match). Returns the input unchanged when neither option
  is given.
- `state/coachMaterials.ts#buildCoachMaterialLibraryFromStore(filter?)` now
  accepts the same `{ query?, tag? }` options, composing
  `filterCoachMaterials` ahead of the existing `buildCoachMaterialLibrary`
  grouping — existing no-argument callers are unaffected (an empty filter
  matches everything). A new `listCoachMaterialTagsFromStore()` composes
  `listCoachMaterialTags` against every persisted material, independent of
  whatever filter the panel currently has applied, so a tag doesn't
  disappear from the dropdown just because it's the active filter.
- `CoachMaterialsPanel.tsx` renders the search box and tag `Select` above
  the material list once any material exists, re-running
  `buildCoachMaterialLibraryFromStore` with the current filter whenever
  either changes (and after every save/delete), and separately tracks the
  library's true unfiltered material count so the empty state can
  distinguish "no materials uploaded yet" from "no materials match this
  search/tag filter".

Vitest-covered in `packages/debate-speech-writer/test/team-coach-materials.test.ts`
(`listCoachMaterialTags`, `filterCoachMaterials` — title/topic/tag/body
matches, case-insensitivity, blank-query passthrough, tag+query
combination) and `packages/debate-speech-writer/test/coachMaterials.test.ts`
(`buildCoachMaterialLibraryFromStore` with a filter, `listCoachMaterialTagsFromStore`).

## Edit-in-place and version history

Closes the "No version history for a material that gets re-uploaded/edited"
Known gap below. Previously the upload form only ever created a brand-new
record (`saveCoachMaterial({ id: \`${kind}-${Date.now()}\`, ... })`), and
there was no way to revise a material without deleting and re-adding it,
which lost the old text outright.

- `state/coachMaterialVersions.ts` — a new local-only store (mirroring
  `state/coachMaterials.ts`'s own persistence convention; coach materials
  aren't account-synced yet, so this stays local-only too). Each entry is a
  full snapshot of a material's fields (`materialId`, `kind`, `title`,
  `topic`, `tags`, `text`, `replacedAt`). `appendMaterialVersion(previous)`
  snapshots a material right before it gets overwritten, capping at
  `MAX_VERSIONS_PER_MATERIAL` (10) per material by dropping the oldest.
  `listVersionsForMaterial(materialId)` returns a material's versions
  newest first; `deleteVersionsForMaterial(materialId)` clears them (called
  when the material itself is deleted); `materialFromVersion(version)`
  rebuilds a `CoachMaterial` from a snapshot so it can be handed straight
  back to `saveCoachMaterial` to restore it.
- `state/coachMaterials.ts#saveCoachMaterial` now calls
  `appendMaterialVersion` on the record it's about to replace whenever the
  save overwrites an existing id (a brand-new id records no version, since
  there's nothing prior to snapshot).
- `CoachMaterialsPanel.tsx` — each material now has an "Edit" action that
  loads it back into the upload form (Save becomes "Save changes", with a
  "Cancel edit" action next to it) instead of the form only ever creating a
  new record, and a "History" toggle listing that material's past versions
  with a "Restore this version" action on each, which just calls
  `saveCoachMaterial` with the version's fields under the same material id
  — restoring is itself a normal overwrite, so the version it replaces gets
  snapshotted too, preserving full lineage.

Vitest-covered in `packages/debate-speech-writer/test/coachMaterialVersions.test.ts`
(snapshot shape, id uniqueness within the same millisecond, per-material
cap/eviction, newest-first ordering, per-material isolation, deletion) and
new cases in `packages/debate-speech-writer/test/coachMaterials.test.ts`
(`saveCoachMaterial` records no version on create, snapshots on overwrite,
accumulates versions across repeated overwrites; `deleteCoachMaterial` also
clears that material's version history).

## Known gaps

- No transcription of an *uploaded* audio/video recording file — follow-up
  (a) under idea #8 in `TODO.md` is now fully closed for text sources
  (`.docx`/`.txt`/`.md` upload, plus live microphone dictation), but turning
  an already-recorded practice-round audio/video *file* into text still has
  no path in this repo; no server-side/paid transcription service exists
  here, only the browser's live `SpeechRecognition` API used for dictation
  above.
- ~~No version history for a material that gets re-uploaded/edited — saving
  over an existing id (there's no edit form today; a re-upload is a brand
  new record) or editing one directly overwrites it in place, with no way to
  see or restore a prior version.~~ Closed: `state/coachMaterialVersions.ts`
  now snapshots a material every time `saveCoachMaterial` overwrites it, and
  `CoachMaterialsPanel` has an "Edit" action (revise in place) plus a
  "History" toggle with a "Restore this version" action per snapshot (see
  "Edit-in-place and version history" above). Version history is local-only
  (localStorage), the same gap every other localStorage-backed piece of
  this panel already has — it doesn't follow a signed-in user across
  devices, since coach materials themselves aren't account-synced yet
  either (see the next gap).
- No account sync for coach materials at all — unlike most other panels in
  this repo (word-count rounds, judge decisions, prep notes, etc.), the
  material library and its version history are both purely per-browser
  localStorage, with no D1 table or `/api/coach-materials` route. A future
  run should add that sync layer, mirroring the `saved_judge_decisions`
  D1-table-plus-`/api/judge-decisions`-routes pattern, if this becomes a
  priority.
- `convertDocxToHTML`'s default renderer needs a browser `DOMParser` (via
  `docx-preview`), so `.docx` upload only works from this `"use client"`
  panel in the browser — not from a server-rendered or Node context.
- No reviewer/approval workflow before a material is available to the
  team coach — any saved material is immediately included.
- ~~No conversation history — each question is answered independently; a
  prior question/answer isn't persisted or fed back into a later one.~~
  Closed: `state/coachConversation.ts` now persists every question/answer
  turn, `CoachMaterialsPanel` renders it above the question field, and
  `requestTeamCoachAnswer` sends the most recent turns (capped at
  `maxHistoryTurns`, default 6) as real conversation context ahead of the
  current question's grounded prompt (see "Conversation history" above).
  History is per-browser localStorage, not a shared team resource, the same
  gap every other localStorage-backed panel in this repo has.
