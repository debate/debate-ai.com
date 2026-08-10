# debate-round

FIAT — the live round workspace: the ag-Grid flow spreadsheet, column navigation and
split view, the round setup dialog (tournament, teams, judges, spectators, winner), speech
doc panels, export and history dialogs, and the flow/settings stores behind them.

```tsx
import { DebateFlowPage, useFlowStore } from "debate-round"
```

Composes `debate-timer` for speech timing and recording and `debate-editor` for speech
docs; the flow types themselves live in `debate-core` so both sides can share them.
