# Opponent Persona Picker

Lets a user pick the AI practice-opponent style for a session — one of four
built-in personas (Policy Heavy, Kritik, Lay, Fast Flow) or a custom persona
built from the user's own described debating style — and lists every
session with a saved selection, with a "Clear" action per session.

- **Route:** `/practice-opponent`
- **Nav:** the global dock's Settings menu → **Opponent Persona Picker**
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

## Data flow

```
state/opponentPersonaSelections.ts (localStorage: opponentPersonaSelections)
  → buildOpponentPersonaSelectionsPanelView() — sorts every persisted
                                                  OpponentPersonaSelection by sessionId
  → panels/OpponentPersonaPickerPanel.tsx     — renders the picker form + list
  → apps/debate-ai.com/app/practice-opponent/page.tsx — mounts the panel as a route

Saving a session's persona:
panels/OpponentPersonaPickerPanel.tsx
  → opponent/opponent-personas.ts's buildCustomOpponentPersona() for a custom
    persona, or a lookup into listOpponentPersonas() for a built-in one
  → saveOpponentPersonaSelection({ sessionId, persona }) — state/opponentPersonaSelections.ts
  → panel re-reads buildOpponentPersonaSelectionsPanelView() to refresh

Clearing a session's persona:
panels/OpponentPersonaPickerPanel.tsx
  → deleteOpponentPersonaSelection(sessionId) — state/opponentPersonaSelections.ts
  → panel re-reads buildOpponentPersonaSelectionsPanelView() to refresh

Using the saved persona in a real AI speech (Online Debate Versus AI, idea #3):
round/opponent-persona-speech-wiring.ts's getOpponentPersonaForRound(roundId)
  → getOpponentPersonaSelection(roundId) — treats aiVersusRounds.ts's roundId
    and this store's sessionId as the same caller-typed identifier
  → round/opponent-persona-speech-ai.ts / opponent-persona-speech-client.ts
    condition the /api/reason-ai speech-generation call on
    buildOpponentPersonaPrompt(persona) instead of arguing style-free
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

## Known gaps

- No follow-ups remain open on this idea.
- This panel only saves/clears a selection; it doesn't itself invoke a
  speech-generation call — that lives in the Online Debate Versus AI panel
  (`AiVersusRoundPanel`, `/versus-ai`) once a round's persona is saved here.
