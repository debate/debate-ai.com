# Coach Materials

Lets a coach upload grounding materials — lecture transcripts, camp
materials, instructional documents, and practice-round recordings — for a
private team coach AI, and preview which materials a question would be
answered from before any AI call exists.

- **Route:** `/coach-materials`
- **Nav:** the global dock's Settings menu → **Coach Materials**
- **Package:** [`debate-speech-writer`](../../packages/debate-speech-writer/README.md)

## What it shows

- An upload form (kind, title, optional topic, comma-separated tags,
  material text) that saves a `CoachMaterial` through the already-persisted
  `state/coachMaterials.ts`.
- Every persisted material, grouped by kind (Lecture Transcript, Camp
  Material, Instructional Document, Practice-Round Recording), each with a
  "Delete" action.
- An "Ask the coach" preview: typing a question and clicking "Preview
  grounded prompt" shows the top relevant materials and the composed
  grounded prompt text — a preview of what a future AI call would receive,
  with no AI call actually made.

## Data flow

```
state/coachMaterials.ts (localStorage)
  → buildCoachMaterialLibraryFromStore()   — new, composes coach/team-coach-materials.ts
      → buildCoachMaterialLibrary()        — groups materials by kind
  → findRelevantMaterialsFromStore()       — new, composes coach/team-coach-materials.ts
      → findRelevantMaterials()            — keyword-overlap relevance ranking
      → buildGroundedCoachPrompt()         — composes the ranked matches into a prompt preview
  → panels/CoachMaterialsPanel.tsx (upload form, kind-grouped list, ask-the-coach preview)
  → apps/debate-ai.com/app/coach-materials/page.tsx (mounts the panel as a route)
```

This feature is a read/write UI layer over the existing pure logic: it
introduces two new store-composition functions,
`buildCoachMaterialLibraryFromStore` and `findRelevantMaterialsFromStore` in
`state/coachMaterials.ts`, which compose the existing pure
`buildCoachMaterialLibrary`/`findRelevantMaterials` directly against the
persisted materials store — no new scoring or grouping logic (see
`packages/debate-speech-writer/test/coachMaterials.test.ts`).

## Known gaps

- No transcription/parsing of an uploaded recording or document — a
  material's `text` field must be typed or pasted in directly (follow-up
  (a) under idea #8 in `TODO.md`).
- No actual AI Q&A call — the "Ask the coach" section only previews the
  matched materials and composed prompt; it never calls a model
  (follow-up (b)).
- No reviewer/approval workflow before a material is available to the
  team coach — any saved material is immediately included.
