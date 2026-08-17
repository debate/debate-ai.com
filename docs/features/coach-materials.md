# Team Coach Materials

Lets a coach upload grounding materials — lecture transcripts, camp
materials, instructional documents, and practice-round recordings — and
preview the grounded prompt a future team coach AI Q&A call would receive
for a typed question. This is the "(c) a materials-upload/coach chat panel
UI" follow-up named in the `team-coach-materials.ts` slice for idea #8
("Video-Lecture-Training Coach AI") in `TODO.md`'s Product Feature Ideas
list.

- **Route:** `/coach-materials`
- **Nav:** the global dock's Settings menu → **Coach Materials**
- **Package:** [`debate-speech-writer`](../../packages/debate-speech-writer/README.md)

## What it shows

A form to upload a `CoachMaterial` — id, kind (lecture transcript, camp
material, instructional document, or practice-round recording), title,
optional topic, comma-separated tags, and body text — saved through
`saveCoachMaterial`. Below the form, every persisted material renders
grouped by kind via `buildPersistedCoachMaterialLibrary`, each with a
"Remove" action.

A "Coach Q&A preview" section lets a user type a question (optionally
scoped to a topic seen among the persisted materials) and see the exact
grounded prompt — built from the top-matching materials via
`findRelevantPersistedMaterials` and `buildGroundedCoachPrompt` — that a
future AI Q&A call would receive. No AI model is called; this only
previews the request.

## Data flow

```
state/coachMaterials.ts (localStorage: coachMaterials)
  → buildPersistedCoachMaterialLibrary()   — groups every persisted
                                              CoachMaterial by kind
  → findRelevantPersistedMaterials(query)  — ranks persisted materials
                                              against a typed question
  → panels/CoachMaterialsPanel.tsx         — renders the upload form,
                                              grouped library, and Q&A
                                              prompt preview

coach/team-coach-materials.ts
  → buildGroundedCoachPrompt(question, matches)  — composes the preview
                                                    text shown in the panel

apps/debate-ai.com/app/coach-materials/page.tsx  — mounts the panel as a route
```

Every grouping, relevance-scoring, and prompt-composition rule already
existed and was Vitest-covered before this panel. Two small composition
helpers were added to `state/coachMaterials.ts` —
`buildPersistedCoachMaterialLibrary` and `findRelevantPersistedMaterials`
— mirroring `debate-card-search`'s `evidenceLibraryEntries.ts`
`searchPersistedEvidenceLibrary` convention, rather than introducing new
grouping or scoring logic. Vitest-covered in
`packages/debate-speech-writer/test/coachMaterials.test.ts`.

## Known gaps

- Follow-up (a), transcription/parsing that turns an uploaded recording or
  document into a material's `text` (today the panel only accepts pasted
  text), remains open — not started.
- Follow-up (b), an actual AI Q&A call that consumes
  `buildGroundedCoachPrompt`'s output instead of only previewing it,
  remains open — not started.
