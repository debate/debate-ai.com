/**
 * Provenance hygiene: a cell's source is a claim about where its text came
 * from, so a cell the user emptied has nothing left to claim.
 *
 * Without this the claim outlives the text. The blank cell keeps wearing the
 * linked rail, collectMeta writes the source back into the stored sheet so
 * CardMirror's "Reveal in Flow" selects a blank cell, and text typed into that
 * cell later inherits provenance it never had.
 *
 * Editing a sent cell is not emptying it. A debater shortens a tag constantly,
 * and the cell still came from that card, so only an empty cell breaks its
 * link. This matches CardMirror, where an edited linked copy stays linked.
 */

import type { CellGrid } from "./cellShift";
import { attachMetaUndo, snapshotClasses } from "./metaUndo";

/**
 * The `setDataAtCell` change source every structured write names itself with.
 *
 * A write that names nothing arrives as "edit", which is also what a typed cell
 * and the Delete key produce, so the two are indistinguishable without this.
 * The structured writes slide text between cells and then attach a meta undo
 * snapshot of their own. Breaking links under one of them would consume the
 * undo action it is about to claim and leave its decorations un-undoable, so
 * only a direct cell edit reaches this module.
 */
export const STRUCTURED_WRITE = "ebb.structured";

/**
 * The change source a partner's write carries onto the grid.
 *
 * It is already in the replica and already in the store, so every hook that
 * mirrors a local edit outward has to let it past: recording it as an op would
 * bounce a peer's own text back at them, and snapshotting it would push the
 * grid over the projection that just produced it.
 */
export const REMOTE_WRITE = "ebb.remote";

/** One entry of Handsontable's `afterChange` payload. */
export type GridChange = [row: number, prop: string | number, oldValue: unknown, newValue: unknown];

function isEmpty(value: unknown): boolean {
    return value === null || value === undefined || value === "";
}

/**
 * Clears the provenance of every cell `changes` emptied, and pairs the clear
 * with the undo action the write just pushed, so an undo brings the link back
 * with the text. Returns whether it cleared anything.
 *
 * Call it from `afterChange`: Handsontable records the undo action on
 * `beforeChange`, so the action this snapshot binds to is already on the stack.
 */
export function breakEmptiedLinks(grid: CellGrid, changes: readonly GridChange[]): boolean {
    const hits: [row: number, col: number][] = [];
    for (const [row, prop, , newValue] of changes) {
        // A flow sheet holds array rows, so Handsontable's prop is the column.
        const col = Number(prop);
        if (!Number.isInteger(col) || !isEmpty(newValue)) continue;
        if (grid.getCellMeta(row, col).source) hits.push([row, col]);
    }
    if (hits.length === 0) return false;

    const cols = [...new Set(hits.map(([, col]) => col))];
    const before = snapshotClasses(grid, cols);
    for (const [row, col] of hits) grid.setCellMeta(row, col, "source", undefined);
    attachMetaUndo({ cols, before, after: snapshotClasses(grid, cols) });
    return true;
}
