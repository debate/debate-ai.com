# Opponent Persona Picker

Lets a user pick the AI practice-opponent style for a session — one of four
built-in personas (Policy Heavy, Kritik, Lay, Fast Flow) or a custom persona
built from the user's own described debating style — plus a difficulty
level (Beginner, Intermediate, Advanced, Elite) independent of persona
choice, and lists every session with a saved selection, with a "Clear"
action per session.

- **Route:** `/practice-opponent`
- **Nav:** the Tools page's Prep & Practice group; the Reason Editor's
  Workspace menu (`t persona` in Ctrl/Cmd-Shift-Space's command palette)
- **Package:** [`debate-speech-writer`](../../packages/debate-speech-writer/README.md)

## What it shows

A form to save a session's opponent persona: a session ID, a radio choice
among the four built-in personas (each showing its name and description) or
"Custom opponent persona," which reveals a persona-name and debating-style
notes field. Below the form, every session with a saved
`OpponentPersonaSelection` is listed — session ID and the persona's name —
sorted by `sessionId`.

## The four built-in personas

Defined in `opponent/opponent-personas.ts`, each pairs a pace, a
priority-ordered list of preferred arguments, and imperative instructions
meant to be injected into an AI speech-generation prompt:

- **Policy Heavy** — counterplans and disadvantages with a specific link
  chain, impact calculus, competitive speed.
- **Kritik** — framework and representational links before engaging the
  literal case, an alternative/praxis rather than a counterplan.
- **Lay** — plain, jargon-free, conversational-pace argument.
- **Fast Flow** — maximum speed, high argument volume, extends anything
  under-covered or dropped.

## Difficulty levels

Defined alongside the personas in `opponent/opponent-personas.ts`
(`opponentDifficulties`), a difficulty is a second, independent axis from
persona choice — how strong the AI opponent argues within whichever persona
is selected. Each level's own instructions are composed into the same
`buildOpponentPersonaPrompt` prompt section as the persona's, after the
persona's own instructions:

- **Beginner** — occasionally drops or under-explains a weaker argument,
  argues below the persona's usual pace, prefers simpler extensions.
- **Intermediate** (default) — argues exactly as the persona describes, no
  adjustment.
- **Advanced** — catches drops, extends efficiently, adds strategic depth
  beyond the persona's baseline.
- **Elite** — plays maximally strategically within the persona, exploits
  every opening, tournament-elite quality.

A selection saved before this field existed has no `difficulty` — every
reader (`buildOpponentPersonaPrompt`, `getOpponentDifficultyForRound`, the
picker panel's list) treats a missing value as `intermediate`
(`DEFAULT_OPPONENT_DIFFICULTY`) rather than requiring a backfill.

## Data flow

```
state/opponentPersonaSelections.ts (localStorage: opponentPersonaSelections)
  → buildOpponentPersonaSelectionsPanelView() — sorts every persisted
                                                  OpponentPersonaSelection by sessionId
  → panels/OpponentPersonaPickerPanel.tsx     — renders the picker form + list
  → apps/debate-ai.com/app/practice-opponent/page.tsx — mounts the panel as a route

Saving a session's persona and difficulty:
panels/OpponentPersonaPickerPanel.tsx
  → opponent/opponent-personas.ts's buildCustomOpponentPersona() for a custom
    persona, or a lookup into listOpponentPersonas() for a built-in one;
    the difficulty radio picks one of listOpponentDifficulties() directly
  → saveOpponentPersonaSelection({ sessionId, persona, difficulty }) — state/opponentPersonaSelections.ts
  → panel re-reads buildOpponentPersonaSelectionsPanelView() to refresh

Clearing a session's persona:
panels/OpponentPersonaPickerPanel.tsx
  → deleteOpponentPersonaSelection(sessionId) — state/opponentPersonaSelections.ts
  → panel re-reads buildOpponentPersonaSelectionsPanelView() to refresh

Using the saved persona + difficulty in a real AI speech (Online Debate
Versus AI, idea #3):
round/opponent-persona-speech-wiring.ts's getOpponentPersonaForRound(roundId)
  and getOpponentDifficultyForRound(roundId)
  → getOpponentPersonaSelection(roundId) — treats aiVersusRounds.ts's roundId
    and this store's sessionId as the same caller-typed identifier;
    getOpponentDifficultyForRound falls back to DEFAULT_OPPONENT_DIFFICULTY
    when no selection, or a pre-difficulty selection, is saved
  → round/opponent-persona-speech-ai.ts / opponent-persona-speech-client.ts
    condition the /api/reason-ai speech-generation call on
    buildOpponentPersonaPrompt(persona, difficulty) instead of arguing
    style-free or at an unadjusted default strength
```

This panel closes follow-up (b), "a persona-picker UI ... that reads/writes
through the persistence store," named under the "AI Practice Opponent" idea
in `TODO.md`'s Research Crowdsourcing Organizer Features list, adding one
small ordering helper (`buildOpponentPersonaSelectionsPanelView`) to
`state/opponentPersonaSelections.ts` rather than introducing new
persona-resolution logic. Follow-up (a), a persona-conditioned AI
speech-generation call, is closed separately by
`round/opponent-persona-speech-ai.ts` (see the data flow above) — it argues
in a round's saved persona by treating `roundId` as this store's `sessionId`
key. Vitest-covered in
`packages/debate-speech-writer/test/opponentPersonaSelections.test.ts` and
`packages/debate-round/test/opponent-persona-speech-wiring.test.ts`,
`opponent-persona-speech-ai.test.ts`, `opponent-persona-speech-client.test.ts`.
A later slice closed the "custom opponent-persona authoring flow" Known gap
below: `opponent/opponent-personas.ts`'s `buildCustomOpponentPersona`
mirrors `judge/judge-paradigms.ts`'s `buildCustomJudgeParadigm` (sanitizes
and clamps a user-supplied name and free-text style description, throwing
if either is empty), and the panel's "Custom opponent persona" radio option
mirrors the Judge Paradigm Picker's custom-paradigm form. Vitest-covered in
`packages/debate-speech-writer/test/opponent-personas.test.ts`.
A later slice closed the "a difficulty slider layered on top of persona
choice" Next item: `opponent/opponent-personas.ts` gains an
`opponentDifficulties` registry (Beginner/Intermediate/Advanced/Elite),
each level's `instructions` composed into `buildOpponentPersonaPrompt`'s
existing output alongside the persona's own; `OpponentPersonaSelection`
gains an optional `difficulty` field, set by a second radio group on the
picker panel and shown as a second badge per session in the saved-selection
list; `getOpponentDifficultyForRound` (new, alongside the existing
`getOpponentPersonaForRound`) resolves it for a round, defaulting to
`DEFAULT_OPPONENT_DIFFICULTY` ("intermediate") when unset; both
`buildPersonaAiVersusSystemPrompt` and `requestAiVersusSpeechWithPersona`
take an optional `difficulty` parameter (also defaulting to intermediate)
so every existing caller keeps behaving exactly as it did, and
`AiVersusRoundPanel.tsx`'s two AI-speech-generation call sites now pass
`getOpponentDifficultyForRound(activeRoundId)` through, showing a
"Difficulty" badge alongside the persona badge on the AI's turn. Vitest-
covered: new cases in `packages/debate-speech-writer/test/opponent-personas.test.ts`
(the registry, `isOpponentDifficulty`/`getOpponentDifficulty`, and
`buildOpponentPersonaPrompt`'s difficulty layering) and
`opponentPersonaSelections.test.ts` (persisting/omitting `difficulty`), plus
`packages/debate-round/test/opponent-persona-speech-ai.test.ts`,
`opponent-persona-speech-wiring.test.ts`, and
`opponent-persona-speech-client.test.ts`.

## Custom persona library and team sharing

Closes the "share a custom-authored persona across a team instead of
per-user only" Next item named under the "🤖 AI Practice Opponent" idea in
TODO.md's Research Crowdsourcing Organizer Features. Before this, a custom
persona only ever existed inline, baked into one session's saved selection
— there was no way to save a named custom persona once and reuse it across
sessions, let alone share it with anyone else.

- **`opponent/opponent-persona-library.ts`** (`debate-speech-writer`) adds
  `SavedCustomOpponentPersona` — an `{ id, name, notes, shared, createdAt,
  updatedAt }` record — plus `buildSavedCustomOpponentPersona` (sanitizes
  `name`/`notes` the same way `buildCustomOpponentPersona` does),
  `resolveOpponentPersonaFromLibraryEntry` (turns a saved entry back into a
  usable `OpponentPersona`, identical to typing its notes in fresh), and
  `isValidSavedCustomOpponentPersona` for the D1-backed API routes.
- **`state/customOpponentPersonaLibrary.ts`** (`debate-practice-drills`)
  persists the library to `localStorage`, mirroring
  `opponentPersonaSelections.ts`'s convention, plus
  `resolveCustomOpponentPersonaLibraryConflict`/
  `planCustomOpponentPersonaLibraryMerge` for account-merge conflict
  resolution (the newer `updatedAt` wins) — mirroring
  `state/drillSets.ts`'s merge helpers exactly.
- **Account sync**: a new `saved_custom_opponent_personas` D1 table plus
  `/api/custom-opponent-personas` routes (GET/PUT/DELETE, account-only —
  401 without a session, mirroring `/api/drill-sets`) sync a signed-in
  user's own library across devices via `hooks/useCustomOpponentPersonaLibrary.ts`
  (local-first, same merge-on-mount pattern as `useDrillSets`).
- **Team sharing**: an entry saved with "Share with my team" checked sets
  `shared: true`, stored in its own indexed column (not just inside the
  JSON blob) so `GET /api/custom-opponent-personas/shared` can filter
  across every user's rows without deserializing each one. That route
  needs no session — like `GET /api/evidence-reuse-check/dashboard`'s
  no-auth team dashboard, it's a team-wide, read-only view (this repo has
  no real team/organization model for crowdsourced content elsewhere
  either) of every other user's shared entries, excluding the viewer's own
  (already returned in full by the account-only `GET
  /api/custom-opponent-personas`).
- **UI**: `OpponentPersonaPickerPanel` gains a "My persona library" section
  (name, notes preview, "Use for this session"/"Share with team"/"Unshare"/
  "Delete" actions) below the existing session list, and a read-only
  "Shared by your team" section (hidden once empty) with a "Use this
  persona" action that prefills the custom-persona form. The custom-persona
  form itself gains "Save to my persona library" and, once checked, "Share
  with my team" checkboxes.

Vitest-covered: `packages/debate-speech-writer/test/opponent-persona-library.test.ts`
(building/validating/sorting library entries, resolving one back into a
usable `OpponentPersona`) and
`packages/debate-practice-drills/test/customOpponentPersonaLibrary.test.ts`
(local CRUD, conflict resolution, merge planning) and
`custom-opponent-persona-library-client.test.ts` (the account/shared HTTP
calls, mocked).

## Known gaps

- The Practice Round Simulator panel (`/practice-round`,
  `PracticeRoundSimulatorPanel.tsx`) has its own, separate opponent-persona
  selection embedded in `state/practiceRounds.ts`'s `PracticeRoundSetup`
  (a builtin persona id only, no custom persona) rather than reading through
  this store — unifying it with this store, and with the new custom-persona
  library, remains a follow-up of its own. Its setup form does now also
  carry a difficulty (`opponentDifficulty` on `PracticeRoundSetup`,
  defaulting to `DEFAULT_OPPONENT_DIFFICULTY`), saved alongside its own
  persona choice — see `docs/features/practice-round-simulator.md`'s
  "Opponent difficulty" section. That panel's post-round feedback also now
  carries persona-specific tips (`opponent-personas.ts`'s new
  `opponentPersonaFeedbackTips` registry) once a round played against a
  persona is complete — see that doc's "Post-round feedback tips for the
  persona faced" section.
- This panel only saves/clears a selection; it doesn't itself invoke a
  speech-generation call — that lives in the Online Debate Versus AI panel
  (`AiVersusRoundPanel`, `/versus-ai`) once a round's persona is saved here.
- "Shared with your team" is every other signed-in user, not a real
  team/organization membership — this repo doesn't model one for
  crowdsourced content elsewhere either (see e.g. the Evidence Reuse Check
  dashboard). A real team boundary would need that modeling to land first.
