# AI Coach Mode

Shows every persisted "AI Coach Mode" coaching session, grouped by round +
side — extension, refutation, collapse, and weighing prompts derived from
that round's flow — with a "Clear" action per session.

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

## Data flow

```
state/coachingSessions.ts (localStorage: coachingSessions)
  → buildCoachingSessionsPanelView()   — sorts every persisted
                                          CoachingSessionRecord by roundId
                                          then sideKey
  → panels/CoachingSessionsPanel.tsx   — renders it, grouped by round + side
  → apps/debate-ai.com/app/coaching/page.tsx  — mounts the panel as a route

Clearing a round+side's coaching session:
panels/CoachingSessionsPanel.tsx
  → deleteCoachingSession(roundId, sideKey)  — state/coachingSessions.ts
  → panel re-reads buildCoachingSessionsPanelView() to refresh
```

Every coaching-prompt generation and persistence rule already existed and
was Vitest-covered; this feature closes follow-up (b), "a coaching-panel UI
that reads/writes through the persistence store," named under the "🎙️ AI
Coach Mode" bullet in `TODO.md`, adding one small helper to
`state/coachingSessions.ts` — `buildCoachingSessionsPanelView`, which sorts
`listCoachingSessions`'s output for a stable panel display order — rather
than introducing new coaching-prompt logic. Vitest-covered in
`packages/debate-round/test/coachingSessions.test.ts`.

## Known gaps

- No actual AI coaching call for open-ended feedback beyond this
  deterministic template layer — follow-up (a) on the same bullet, not
  started.
- No affordance in this panel to generate a new coaching session for a
  round — a session only appears here once something elsewhere calls
  `buildCoachingSession` and `saveCoachingSession` for that round + side.
