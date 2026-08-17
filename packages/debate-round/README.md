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
│   ├── panels/       # DebateRoundPanel shell, PrepNotesPanel
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
