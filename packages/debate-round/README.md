# debate-round

FIAT — the live round workspace: the ag-Grid flow spreadsheet, column navigation and
split view, the round setup dialog (tournament, teams, judges, spectators, winner), speech
doc panels, export and history dialogs, and the flow/settings stores behind them.

```tsx
import { DebateFlowPage, useFlowStore } from "debate-round"
```

`PrepNotesPanel` (also exported from the package root) renders every
persisted "Strategy Sync Notes" `PrepNote` grouped by status — see
[`docs/features/prep-notes.md`](../../docs/features/prep-notes.md).

`OpponentTeamProfilesPanel` (also exported from the package root) renders
every persisted `debate-data-sync` `OpponentTeamProfile` as a scouting
roster — see
[`docs/features/opponent-team-profiles.md`](../../docs/features/opponent-team-profiles.md).

`DrillSetsPanel` (also exported from the package root) renders every
persisted "AI Drill Generator" `Drill` set, grouped by round — see
[`docs/features/drill-sets.md`](../../docs/features/drill-sets.md).

`PreRoundBriefingsPanel` (also exported from the package root) renders
every persisted "Pre-Round Intelligence Panel" `PreRoundBriefingRecord`,
sorted by round — see
[`docs/features/pre-round-briefings.md`](../../docs/features/pre-round-briefings.md).

`CoachingSessionsPanel` (also exported from the package root) renders
every persisted "AI Coach Mode" `CoachingSessionRecord`, grouped by round +
side — see
[`docs/features/coaching-sessions.md`](../../docs/features/coaching-sessions.md).

Composes `debate-timer` for speech timing and recording and `debate-editor` for speech
docs; the flow types themselves live in `debate-core` so both sides can share them.

## Package layout

Logic lives under `src/`, grouped by role; tests live under `test/`.

```
debate-round/
├── src/
│   ├── controls/     # column navigator, quick actions, split-mode toolbar
│   ├── dialogs/      # round editor, file export, flow history
│   ├── flow/         # ag-Grid flow spreadsheet and its renderers
│   ├── hooks/        # flow, speech, timer and URL-sync hooks
│   ├── layout/       # page header, sidebar, main content, speech doc panel
│   ├── navigation/   # flow tabs
│   ├── panels/       # DebateRoundPanel shell, PrepNotesPanel, OpponentTeamProfilesPanel, DrillSetsPanel, PreRoundBriefingsPanel, CoachingSessionsPanel
│   ├── state/        # zustand stores (flow, settings, history, profile)
│   ├── types/        # flow and settings types
│   ├── utils/        # flow + localStorage helpers
│   └── index.ts      # public entry point
└── test/             # Vitest suites for the flow and storage helpers
```

## Tests

```bash
bun run test        # or: npx vitest run
bun run coverage    # writes ./coverage for this package alone
```

Suites live in `test/` and mirror the `src/` layout. Coverage for every package is
merged at the repo root by `bun run coverage` and uploaded to
[Codecov](https://app.codecov.io/gh/debate/debate-ai.com) by CI.
