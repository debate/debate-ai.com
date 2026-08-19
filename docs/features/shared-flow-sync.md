# Shared, Ai-Generated Debate Flow — Flow Edit Log + Sync

Lets a contributor log a proposed edit to a specific flow argument (their
own, or one they're relaying from a teammate) and previews how every
logged edit merges into the round's flow, flagging genuinely concurrent,
diverging edits for a human to resolve instead of silently overwriting
them.

- **Where:** the Coach hub's Flow section (`/coach`), and directly from the
  live flow grid (`/debate`, `/debate/[tournament]/[teams]`)
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

**Flow Edit Log** — a form to log a `FlowEdit`:

- **Flow ID**, **Author ID**, and **Box path** (a comma-separated path,
  e.g. `0, 1`) address exactly which flowed argument the edit targets, the
  same way `boxFromPath` already addresses a box elsewhere in the flow
  spreadsheet.
- **Content** is the box's proposed new text (empty models clearing it).

Below the form, every persisted edit is grouped by flow, newest first,
with a **Clear** action per group that deletes every edit logged for that
flow.

**Flow-grid edit affordance** — `FlowSpreadsheet` (`/debate`) shows a small
badge on any cell whose box already has one or more logged `FlowEdit`s, and
a faint "+" affordance on a cell with none, mirroring the existing
`AnnotationBadge` cell affordance (see
[`flow-annotations.md`](flow-annotations.md)).
Clicking either opens a popover, prefilled with that cell's flow ID and box
path, that lists the box's existing edits (newest first) and a small form
to log another — the same `createFlowEdit`/`saveFlowEdit` calls
`FlowEditLogPanel` makes, just scoped to one box and without needing to
type the flow ID or box path by hand.

**Shared Flow Sync** — the merge preview immediately above it, reused
unmodified from the earlier first slice: given the edits logged for the
round workspace's currently selected flow, it shows how many boxes would
update, flags any conflicting boxes (edits from different authors with
different content landing within a configurable window of each other —
5 seconds by default), and an **Apply** action.

## Data flow

```
flow/shared-flow-sync.ts               — createFlowEdit (validates + builds one FlowEdit),
                                           mergeFlowEdits, applyMergedEditsToFlow,
                                           buildSharedFlowSyncSummaryText
state/flowEdits.ts (localStorage: flowEdits)
  → listFlowEdits() / listFlowEditsForFlow(flowId)
  → panels/FlowEditLogPanel.tsx        — renders the log-an-edit form + logged-edit list
  → apps/debate-ai.com/components/coach/CoachHub.tsx
      → reads listFlowEdits() via debate-ui's useStoreSnapshot, filters to the
        round workspace's currently selected flow, and hands the result to
        panels/SharedFlowSyncPanel.tsx as its `edits` prop

Logging an edit (from the /coach form):
panels/FlowEditLogPanel.tsx
  → createFlowEdit({ ... })            — flow/shared-flow-sync.ts (throws on an empty
                                           boxPath or blank authorId)
  → saveFlowEdit(edit)                 — state/flowEdits.ts
  → panel re-reads listFlowEdits() to refresh, and calls the optional
    onChange prop so a composing screen's own snapshot (CoachHub's) refreshes too

Logging or reviewing an edit (from the /debate flow grid):
flow/AnnotationCellRenderer.tsx / flow/FirstColumnCellRenderer.tsx
  → listFlowEditsForFlow(flowId) + edit-cells.ts#filterEditsForBox(boxPath)
  → flow/EditBadge.tsx                 — badge (has edits) or "+" (none), onClick
                                           calls onOpenEditLog(boxPath)
  → flow/FlowSpreadsheet.tsx           — opens flow/EditLogPopover.tsx for that box
  → flow/EditLogPopover.tsx "Log edit" → createFlowEdit({ ... }) (validates), then
                                           the built FlowEdit is handed back up via onLog
  → FlowSpreadsheet's handleLogFlowEdit → saveFlowEdit(edit), then
      gridRef.current.api.refreshCells({ force: true }) so the new badge
      appears immediately (a cell renderer's localStorage read isn't
      reactive on its own)

Applying a merge:
panels/SharedFlowSyncPanel.tsx "Apply" button
  → applyMergedEditsToFlow(flow, result.merged)  — flow/shared-flow-sync.ts
  → CoachHub's onApply writes the updated flow back into the round
    workspace's useFlowStore (setFlows) and clears the flow's logged
    edits via clearFlowEditsForFlow, so an applied edit doesn't linger
    and get re-offered for merging next time
```

This closes the data-source gap left open by the "Feature panels" PR that
first mounted `SharedFlowSyncPanel` in the app: nothing recorded a
`FlowEdit`, so `CoachHub` always passed an empty array and the panel only
ever rendered its own-edits empty state. It adds:

- `flow/shared-flow-sync.ts`: `createFlowEdit`/`CreateFlowEditInput`,
  mirroring `flow-annotations.ts#createFlowAnnotation`'s validation style
  (a non-empty `boxPath`, a non-blank `authorId`, `content` trimmed and
  length-clamped).
- `state/flowEdits.ts`: `listFlowEdits`, `listFlowEditsForFlow`,
  `saveFlowEdit`, `deleteFlowEdit`, `clearFlowEditsForFlow`, mirroring the
  existing `flowAnnotations.ts`/`prepNotes.ts` persistence convention.
- `panels/FlowEditLogPanel.tsx`: the log-an-edit form + logged-edit list,
  with an optional `onChange` callback for a composing screen.
- `CoachHub.tsx`: wires real, persisted edits into `SharedFlowSyncPanel`
  and applies an accepted merge back into the round workspace.
- `flow/edit-cells.ts`: `filterEditsForBox`/`sortEditsByTimestampDesc`,
  reusing `annotation-cells.ts#boxPathForCell`/`columnIndexFromField`
  directly since a cell's box path is addressed identically for both.
- `flow/EditBadge.tsx`: the cell-level badge/`+` affordance.
- `flow/EditLogPopover.tsx`: the box-scoped review/log popover opened from
  a badge, validating with `createFlowEdit` and handing the built edit
  back to the caller to persist.
- `flow/AnnotationCellRenderer.tsx` / `flow/FirstColumnCellRenderer.tsx` /
  `flow/useFlowGridConfig.ts` / `flow/FlowSpreadsheet.tsx`: thread an
  `onOpenEditLog` callback through, alongside the existing
  `onJumpToAnnotation` one, so every grid cell can show both an
  `AnnotationBadge` and an `EditBadge`.

Vitest-covered in `packages/debate-round/test/shared-flow-sync.test.ts`
(`createFlowEdit`: valid input, trimming, empty-content clearing,
length-clamping, empty-`boxPath`/blank-`authorId` validation errors),
`packages/debate-round/test/flowEdits.test.ts` (empty/corrupt/non-array
storage, cross-flow listing and ordering, upsert-by-id, delete,
clear-by-flow), `packages/debate-round/test/edit-cells.test.ts`
(box-path filtering, newest-first sorting), `EditBadge.test.tsx`, and
`EditLogPopover.test.tsx` (both rendered via `react-dom/server`, matching
`AnnotationBadge.test.tsx`'s convention).

## Known gaps

- Still no live transport (e.g. WebSocket) pushing a teammate's edits here
  automatically — a contributor types theirs in, the same way
  `FlowAnnotationsPanel`'s drop-annotation form works for annotations.
  This is follow-up (a) under idea #16 ("Shared, Ai-Generated Debate
  Flow") in `TODO.md`.
- No collaborative/live sync — edits are local `localStorage` only, same
  as every other persisted record in this repo today.
- Follow-up (c) — composing the Common Argument Library's tagged card
  corpus to suggest a pre-filled flow note from matching evidence — is not
  started.
- No follow-ups remain open for follow-up (b) — the grid now has its own
  affordance for logging and reviewing a box's `FlowEdit`s, in addition to
  the separate `FlowEditLogPanel` form on `/coach`.
