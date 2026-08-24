# AI Coach Mode

Shows every persisted "AI Coach Mode" coaching session, grouped by round +
side — extension, refutation, collapse, and weighing prompts derived from
that round's flow — with a "Clear" action per session and a "Get AI
feedback" action that requests open-ended AI coaching feedback expanding on
those template prompts.

- **Route:** `/coaching`
- **Nav:** the global dock's Settings menu → **AI Coach Mode**
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

Each persisted `CoachingSessionRecord` (keyed by `roundId` + the side the
session was generated for) renders as its own card, sorted by `roundId` then
`sideKey` for a stable order. Inside a card, every prompt shows a kind badge
and its text:

| Kind | Meaning |
| --- | --- |
| Extension | One of the side's own arguments currently stands unanswered — extend it as dropped/conceded |
| Refutation | An opposing argument currently stands unanswered — answer it before it's extended |
| Collapse | One of the most vulnerable opposing arguments to recommend collapsing the round onto |
| Weighing | A whole-round weighing angle based on which side currently looks more exposed |

Below the template prompts, an **AI feedback** section shows either the
side's already-generated open-ended feedback, or a "Get AI feedback" button
if none has been generated (or generation failed) yet. The button text
changes to "Regenerate AI feedback" once feedback exists.

A **Generate coaching session for current round** form at the top of the
panel lets a user derive and persist a new session for a side directly from
the round workspace's currently selected flow — the button is disabled with
an inline hint when no flow is currently selected.

## Data flow

```
state/coachingSessions.ts (localStorage: coachingSessions)
  → buildCoachingSessionsPanelView()   — sorts every persisted
                                          CoachingSessionRecord by roundId
                                          then sideKey
  → panels/CoachingSessionsPanel.tsx   — renders it, grouped by round + side
  → apps/debate-ai.com/app/coaching/page.tsx  — mounts the panel as a route

Generating a coaching session for the current round:
panels/CoachingSessionsPanel.tsx
  → reads the round workspace's currently selected flow (state/store.ts's
    useFlowStore)
  → buildAndSaveCoachingSession(flow, roundId, sideKey)  — state/coachingSessions.ts,
    composing flow/coach-mode.ts's buildCoachingSession + saveCoachingSession
  → panel re-reads buildCoachingSessionsPanelView() to refresh

Clearing a round+side's coaching session:
panels/CoachingSessionsPanel.tsx
  → deleteCoachingSession(roundId, sideKey)  — state/coachingSessions.ts
  → panel re-reads buildCoachingSessionsPanelView() to refresh

Getting AI coaching feedback for a session:
panels/CoachingSessionsPanel.tsx
  → requestCoachFeedback({ sideKey, prompts })  — round/coach-feedback-client.ts
    → buildCoachFeedbackAiUserPrompt(...)       — round/coach-feedback-ai.ts,
                                                   renders the session's own
                                                   prompts via
                                                   flow/coach-mode.ts's
                                                   buildCoachingSummaryText
    → POST /api/reason-ai                       — existing Anthropic proxy
    → parseCoachFeedbackAiResponse(...)          — strips a wrapping code fence
  → saveCoachingSessionAiFeedback(roundId, sideKey, feedback)  — state/coachingSessions.ts
  → panel re-reads buildCoachingSessionsPanelView() to refresh
```

Every coaching-prompt generation and persistence rule already existed and
was Vitest-covered; the panel itself closed follow-up (b), "a
coaching-panel UI that reads/writes through the persistence store," named
under the "🎙️ AI Coach Mode" bullet in `TODO.md`, adding one small helper
to `state/coachingSessions.ts` — `buildCoachingSessionsPanelView`, which
sorts `listCoachingSessions`'s output for a stable panel display order.
A later slice closed follow-up (a), "an actual AI coaching call for
open-ended feedback beyond this deterministic template layer": a new
`round/coach-feedback-ai.ts` (prompt-building + tolerant response parsing,
mirroring `debate-speech-writer`'s `coach/team-coach-ai.ts` free-form-text
split rather than `round/judge-decision-ai.ts`'s structured-JSON split,
since open-ended feedback is prose) and `round/coach-feedback-client.ts`
(the `/api/reason-ai` fetch client, mirroring `coach/team-coach-client.ts`)
compose the session's own already-generated template prompts — via the
existing `buildCoachingSummaryText` — into a coaching-feedback request; no
new coaching-prompt derivation logic was introduced. `CoachingSessionRecord`
gained an additive, optional `aiFeedback` field (existing records without
it stay valid), set through a new `saveCoachingSessionAiFeedback` helper
that leaves a session's `prompts` untouched. No follow-ups remain open on
this bullet. Vitest-covered in
`packages/debate-round/test/coach-feedback-ai.test.ts`,
`packages/debate-round/test/coach-feedback-client.test.ts` (`fetch` mocked
via `vi.stubGlobal`, covering the success path, an endpoint override, a
server error message, a non-JSON error body, and an empty/unusable AI
reply), and `packages/debate-round/test/coachingSessions.test.ts` (the new
`saveCoachingSessionAiFeedback` helper). A later slice added a "Generate
coaching session for current round" form to `CoachingSessionsPanel.tsx`,
reading the round workspace's currently selected flow
(`state/store.ts`'s `useFlowStore`, the same mechanism `DrillSetsPanel`'s
analogous form uses) and deriving/persisting that round+side's session via
a new `buildAndSaveCoachingSession` helper in `state/coachingSessions.ts`
(composing the existing `buildCoachingSession` + `saveCoachingSession`,
mirroring `drillSets.ts`'s `buildAndSaveDrillSet`), closing the "no
affordance in this panel to generate a new coaching session for a round"
gap below. No follow-ups remain open on this bullet. Vitest-covered in
`packages/debate-round/test/coachingSessions.test.ts` (deriving and
persisting a session from a flow, overwriting an existing record for the
same round+side pair, keeping sessions for different sides of the same
round distinct, and `collapseLimit` passing through to
`buildCoachingSession`).

## Known gaps

None open.
