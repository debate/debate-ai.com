/**
 * @fileoverview Pure helpers for surfacing `FlowEdit`s on their
 * `FlowSpreadsheet` cell — the remaining half of follow-up (b) under idea
 * #16 ("Shared, Ai-Generated Debate Flow") in TODO.md: "a `FlowSpreadsheet`
 * grid affordance for logging or reviewing an edit."
 *
 * Box-path derivation (`boxPathForCell`/`columnIndexFromField`) is generic
 * to any per-cell, box-addressed feature, not specific to annotations, so
 * this reuses `annotation-cells.ts`'s helpers directly rather than
 * duplicating them.
 */

import type { FlowEdit } from "./shared-flow-sync";

/**
 * Orders a box's edits newest first — the order a reviewer opening the
 * popover would want to see them in, most-recent proposal on top.
 */
export function sortEditsNewestFirst(edits: FlowEdit[]): FlowEdit[] {
  return [...edits].sort((a, b) => b.timestampMs - a.timestampMs);
}

/**
 * The AG Grid row id + column field a `boxPath` cell occupies, mirroring
 * `dataTransform.ts#buildRowData`'s `row-${index}` id convention and
 * `useFlowGridConfig.ts`'s `col_${j}` column-field convention (the same pair
 * `boxPathForCell` in `annotation-cells.ts` derives a `boxPath` from).
 * `FlowSpreadsheet` uses this after logging a new edit through
 * `EditReviewPopover` to force AG Grid to refresh just that cell's
 * `EditBadge`, instead of leaving it stale until the grid re-renders the
 * cell on its own for an unrelated reason.
 */
export function gridCellForBoxPath(boxPath: number[]): { rowId: string; field: string } {
  return { rowId: `row-${boxPath[0]}`, field: `col_${boxPath.length - 1}` };
}

/** The subset of AG Grid's `GridApi` `jumpToBoxInGrid` needs, for testing against a fake. */
export type GridJumpApi = {
  getRowNode: (id: string) => unknown | null | undefined;
  ensureNodeVisible: (rowNode: unknown) => void;
  flashCells: (params: { rowNodes: unknown[]; columns: string[] }) => void;
};

/**
 * Scrolls `api`'s grid to the row for `boxPath` (via `gridCellForBoxPath`)
 * and flashes its cell — the Prep Notes "jump to argument" deep link's grid
 * side (see `hooks/useJumpToPrepNoteBox.ts`). Returns `false` without
 * calling `ensureNodeVisible`/`flashCells` if the row isn't in the grid's
 * current row model yet (e.g. the target flow's rows haven't rendered), so
 * a caller can retry once they have.
 */
export function jumpToBoxInGrid(api: GridJumpApi, boxPath: number[]): boolean {
  const { rowId, field } = gridCellForBoxPath(boxPath);
  const rowNode = api.getRowNode(rowId);
  if (!rowNode) return false;

  api.ensureNodeVisible(rowNode);
  api.flashCells({ rowNodes: [rowNode], columns: [field] });
  return true;
}

/**
 * Number of spaced-out retries `useJumpToPrepNoteBox` makes before giving up
 * on a jump target that never resolves — e.g. a Prep Note's `boxPath` no
 * longer matches a real grid row because the flow was edited (or the row
 * removed) since the note was made. Closes the "jumpToBoxInGrid silently
 * returns false... no error is shown" Known gap recorded in
 * `docs/features/prep-notes.md`.
 */
export const MAX_BOX_JUMP_ATTEMPTS = 5;

/** Whether `useJumpToPrepNoteBox` should stop retrying a jump and report failure instead. */
export function hasExhaustedBoxJumpAttempts(attempts: number): boolean {
  return attempts >= MAX_BOX_JUMP_ATTEMPTS;
}

/**
 * User-facing message `useJumpToPrepNoteBox` surfaces once
 * `hasExhaustedBoxJumpAttempts` is true — the note's target argument no
 * longer resolves to a real row in the flow it was made against.
 */
export function buildBoxJumpFailedMessage(): string {
  return "Couldn't find that argument in the flow — it may have been edited or removed since this note was made.";
}
