/**
 * Column-wise cell shifting: the one place that slides a run of cells up or
 * down a single column, carrying its text, its decoration class and its
 * provenance together.
 *
 * Three callers sit on `shiftSpan`: `insertCell` opens a hole, `shiftMetaDown`
 * chases a `shift_down` paste that Handsontable already applied to the text,
 * and `moveBlock` runs the insert backwards to rotate a block through its
 * neighbors.
 */

import type { CellSource } from "../model/flow";

import { gridCol, type GridCol } from "./colSpace";

/** A single `setDataAtCell` change tuple. */
export type CellChange = [row: number, col: number, value: string | null];

/** The block a `shift_down` paste displaces, in visual grid coordinates. */
export interface PasteShift {
    row: number;
    col: GridCol;
    width: number;
    height: number;
}

/**
 * The slice of Handsontable this module reads. Data writes are returned as
 * changes rather than applied, so a caller can fold several columns into one
 * `setDataAtCell` and record one undo action for the lot.
 */
export interface CellGrid {
    countRows(): number;
    countCols(): number;
    /** Handsontable types this `unknown`; a flow sheet only ever holds text. */
    getDataAtCell(row: number, col: number): unknown;
    getCellMeta(row: number, col: number): { className?: unknown; source?: unknown };
    setCellMeta(
        row: number,
        col: number,
        key: "className" | "source",
        value: string | CellSource | undefined,
    ): void;
}

const dataAt = (grid: CellGrid, row: number, col: number) =>
    grid.getDataAtCell(row, col) as string | null;

const classAt = (grid: CellGrid, row: number, col: number) =>
    (grid.getCellMeta(row, col).className ?? "") as string;

const sourceAt = (grid: CellGrid, row: number, col: number) =>
    grid.getCellMeta(row, col).source as CellSource | undefined;

/**
 * Slides rows `[start, end)` of `col` by `delta`, carrying decorations and
 * provenance with the text. Content whose target falls outside the grid is
 * dropped. Vacated cells keep their stale value; every caller either blanks
 * them or writes over them.
 *
 * The read order follows the shift (descending when moving down, ascending when
 * moving up) so each read sees the pre-shift value even when source and target
 * spans overlap.
 */
export function shiftSpan(
    grid: CellGrid,
    col: GridCol,
    start: number,
    end: number,
    delta: number,
    opts?: { metaOnly?: boolean },
): CellChange[] {
    if (delta === 0) return [];
    const rows = grid.countRows();
    const from = Math.max(start, 0);
    const to = Math.min(end, rows);
    const changes: CellChange[] = [];

    const step = delta > 0 ? -1 : 1;
    for (let r = delta > 0 ? to - 1 : from; r >= from && r < to; r += step) {
        const target = r + delta;
        if (target < 0 || target >= rows) continue;
        if (!opts?.metaOnly) changes.push([target, col, dataAt(grid, r, col)]);
        grid.setCellMeta(target, col, "className", classAt(grid, r, col));
        grid.setCellMeta(target, col, "source", sourceAt(grid, r, col));
    }
    return changes;
}

/**
 * Opens a blank cell at `row`, pushing the rest of `col` down by one. The last
 * row's content falls off the bottom. The opened cell is bare: it inherits
 * neither the decoration nor the provenance of the text it displaced.
 */
export function insertCell(grid: CellGrid, row: number, col: GridCol): CellChange[] {
    const changes = shiftSpan(grid, col, row, grid.countRows() - 1, 1);
    grid.setCellMeta(row, col, "className", "");
    grid.setCellMeta(row, col, "source", undefined);
    changes.push([row, col, ""]);
    return changes;
}

/**
 * Moves each decoration class and provenance record in the pasted columns down
 * by `height`, leaving the pasted block bare. Meta pushed past the last row
 * falls off, as its text does. Columns outside the pasted block keep their
 * rows.
 *
 * Call this after the paste, once the grid has grown to hold the displaced rows.
 */
export function shiftMetaDown(grid: CellGrid, { row, col, width, height }: PasteShift): void {
    const rows = grid.countRows();
    const span = Math.min(col + width, grid.countCols()) - col;
    for (let i = 0; i < span; i++) {
        const c = gridCol(col + i);
        shiftSpan(grid, c, row, rows, height, { metaOnly: true });
        for (let r = row; r < Math.min(row + height, rows); r++) {
            grid.setCellMeta(r, c, "className", "");
            grid.setCellMeta(r, c, "source", undefined);
        }
    }
}

/**
 * Rotates rows `[blockStart, blockStart + height)` of `col` by `delta`: the
 * cells the block travels over close the hole behind it and reopen it ahead.
 * The affected window is written in full, so nothing is created, overwritten,
 * or lost off the bottom. Callers clamp `blockStart + delta` into
 * `[0, countRows() - height]`.
 */
export function moveBlock(
    grid: CellGrid,
    col: GridCol,
    blockStart: number,
    height: number,
    delta: number,
): CellChange[] {
    if (delta === 0) return [];

    // Read the block before shiftSpan writes over any of it.
    const block: CellChange[] = [];
    const classes: string[] = [];
    const sources: (CellSource | undefined)[] = [];
    for (let i = 0; i < height; i++) {
        block.push([blockStart + delta + i, col, dataAt(grid, blockStart + i, col)]);
        classes.push(classAt(grid, blockStart + i, col));
        sources.push(sourceAt(grid, blockStart + i, col));
    }

    const passed =
        delta > 0
            ? shiftSpan(grid, col, blockStart + height, blockStart + height + delta, -height)
            : shiftSpan(grid, col, blockStart + delta, blockStart, height);

    for (let i = 0; i < height; i++) {
        grid.setCellMeta(blockStart + delta + i, col, "className", classes[i]);
        grid.setCellMeta(blockStart + delta + i, col, "source", sources[i]);
    }
    return [...passed, ...block];
}
