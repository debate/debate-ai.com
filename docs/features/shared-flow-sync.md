# Shared, Ai-Generated Debate Flow — Flow Edit Log + Sync

Lets a contributor log a proposed edit to a specific flow argument (their
own, or one they're relaying from a teammate) and previews how every
logged edit merges into the round's flow, flagging genuinely concurrent,
diverging edits for a human to resolve instead of silently overwriting
them.

- **Where:** the Coach hub's Flow section (`/coach`)
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

Logging an edit:
panels/FlowEditLogPanel.tsx
  → createFlowEdit({ ... })            — flow/shared-flow-sync.ts (throws on an empty
                                           boxPath or blank authorId)
  → saveFlowEdit(edit)                 — state/flowEdits.ts
  → panel re-reads listFlowEdits() to refresh, and calls the optional
    onChange prop so a composing screen's own snapshot (CoachHub's) refreshes too

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

Vitest-covered in `packages/debate-round/test/shared-flow-sync.test.ts`
(`createFlowEdit`: valid input, trimming, empty-content clearing,
length-clamping, empty-`boxPath`/blank-`authorId` validation errors) and
`packages/debate-round/test/flowEdits.test.ts` (empty/corrupt/non-array
storage, cross-flow listing and ordering, upsert-by-id, delete,
clear-by-flow).

## FlowSpreadsheet affordance

Every cell in the live `FlowSpreadsheet` grid now shows a small commit-icon
badge next to its text for logging or reviewing that box's `FlowEdit`s,
without leaving the grid for the separate `FlowEditLogPanel` form:

- A box with one or more logged edits shows a filled badge with the pending
  count; hovering lists each edit's author and content, newest first.
- A box with none shows a faint, still-clickable affordance — this is the
  entry point for logging a new edit, since a box with zero prior edits is
  exactly when a contributor wants to add one.
- Clicking either state opens an `EditReviewPopover` at the click position
  (mirroring `GridContextMenu`'s fixed-position overlay — an AG Grid cell
  clips normal in-flow content, so this renders as a sibling of the grid).
  It lists the box's already-logged edits and a small form (Author ID,
  Content, prefilled with the cell's current value) to log a new one
  directly against `state/flowEdits.ts`.

This closes the remaining half of follow-up (b), "a `FlowSpreadsheet`-grid
affordance for logging or reviewing an edit," named under idea #16
("Shared, Ai-Generated Debate Flow") in `TODO.md`. It adds:

- `flow/edit-cells.ts`: `sortEditsNewestFirst` — orders a box's edits
  newest first for the badge tooltip and popover list. Box-path derivation
  is reused directly from `annotation-cells.ts#boxPathForCell`/
  `columnIndexFromField` (generic to any per-cell, box-addressed feature,
  not specific to annotations).
- `state/flowEdits.ts`: `listFlowEditsForBox`, mirroring
  `flowAnnotations.ts#listFlowAnnotationsForBox`.
- `flow/EditBadge.tsx`: the commit-icon badge, shared by both cell
  renderers below. Unlike `AnnotationBadge` (which renders nothing for an
  empty box), this always renders — it's the log-a-new-edit entry point
  too.
- `flow/EditReviewPopover.tsx`: the fixed-position overlay, mirroring
  `GridContextMenu`'s click-outside/Escape-to-close pattern.
- `flow/AnnotationCellRenderer.tsx` / `flow/FirstColumnCellRenderer.tsx`:
  now also render `EditBadge` alongside the existing `AnnotationBadge`.
- `flow/useFlowGridConfig.ts` / `flow/FlowSpreadsheet.tsx`: wire an
  `onOpenEditReview` callback (which positions the popover from the
  clicked badge's event, the same way `onCellContextMenu` positions
  `GridContextMenu`) into both renderers' `cellRendererParams`.

Vitest-covered in `packages/debate-round/test/edit-cells.test.ts`
(newest-first ordering), `packages/debate-round/test/EditBadge.test.tsx`
(empty-box vs. populated render, singular/plural wording, tooltip
ordering, "(cleared)" fallback), and a new `listFlowEditsForBox` describe
block in `packages/debate-round/test/flowEdits.test.ts` (exact box-path
match, excluding prefix/extension paths and other flows).

## Known gaps

- Still no live transport (e.g. WebSocket) pushing a teammate's edits here
  automatically — a contributor types theirs in, the same way
  `FlowAnnotationsPanel`'s drop-annotation form works for annotations.
  This is follow-up (a) under idea #16 ("Shared, Ai-Generated Debate
  Flow") in `TODO.md`.
- The `EditBadge` reads a box's edits from `localStorage` at cell render
  time; it does not live-update if another tab logs a new edit while the
  grid is open, and the badge doesn't refresh in place after logging one
  through its own popover until the grid next re-renders that cell —
  mirroring the same known gap already documented for the `FlowSpreadsheet`
  annotation badge.
- No collaborative/live sync — edits are local `localStorage` only, same
  as every other persisted record in this repo today.
- Follow-up (c) — composing the Common Argument Library's tagged card
  corpus to suggest a pre-filled flow note from matching evidence — is not
  started.
