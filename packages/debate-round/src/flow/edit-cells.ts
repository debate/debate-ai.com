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
