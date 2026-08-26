/**
 * The open cell-move session: a module-level singleton, following the
 * `hotInstance.ts` pattern, holding the block being moved and the grid state it
 * started from.
 *
 * Each nudge mutates the grid live so the move is visible as it happens. Esc
 * restores the entry snapshot and records nothing. Enter restores it too, then
 * replays the net move as a single write, so the whole session collapses into
 * one undo step. `HotGrid` blocks Handsontable's undo pushes for the duration
 * (see `beforeUndoStackChange`), which is what makes the live preview free.
 */

import { moveBlock, type CellChange, type CellGrid } from "./cellShift";
import { gridCol, type GridCol } from "./colSpace";
import { attachMetaUndo, snapshotClasses, type ClassEntry } from "./metaUndo";
import { STRUCTURED_WRITE } from "./staleSource";

/** `CellGrid` plus the write the session applies. The live grid satisfies it. */
export interface MoveGrid extends CellGrid {
    setDataAtCell(changes: CellChange[], source?: string): void;
}

/** The bounding rectangle of the selection the session moves. */
export interface MoveRange {
    startRow: number;
    endRow: number;
    startCol: number;
    endCol: number;
}

/** What the grid needs to draw and step the block. */
export interface MoveBlockView {
    cols: GridCol[];
    blockStart: number;
    height: number;
}

interface Session extends MoveBlockView {
    grid: MoveGrid;
    /** `blockStart` at entry, so commit can replay the net move in one write. */
    origin: number;
    /** Full columns, in `cols` order. Cheap, and immune to span off-by-ones. */
    data: (string | null)[][];
    classes: ClassEntry[];
}

let session: Session | null = null;

/** Snapshots every selected column's data and meta, then opens the session. */
export function beginMove(grid: MoveGrid, range: MoveRange): void {
    const cols: GridCol[] = [];
    for (let c = range.startCol; c <= range.endCol; c++) cols.push(gridCol(c));
    const rows = grid.countRows();

    session = {
        grid,
        cols,
        blockStart: range.startRow,
        height: range.endRow - range.startRow + 1,
        origin: range.startRow,
        data: cols.map((c) =>
            Array.from({ length: rows }, (_, r) => grid.getDataAtCell(r, c) as string | null),
        ),
        classes: snapshotClasses(grid, cols),
    };
}

export function isMovingIn(grid: MoveGrid | null): boolean {
    return session != null && grid != null && session.grid === grid;
}

export function movingBlock(): MoveBlockView | null {
    if (!session) return null;
    const { cols, blockStart, height } = session;
    return { cols, blockStart, height };
}

/** True for a cell inside the travelling block. Called once per rendered cell. */
export function cellIsMoving(grid: MoveGrid | null, row: number, col: GridCol): boolean {
    if (!session || session.grid !== grid) return false;
    return (
        row >= session.blockStart &&
        row < session.blockStart + session.height &&
        session.cols.includes(col)
    );
}

/** Moves the block by `delta`, clamped to the sheet, one rotation per column. */
export function nudge(delta: number): void {
    if (!session) return;
    const { grid, cols, blockStart, height } = session;
    const target = Math.max(0, Math.min(blockStart + delta, grid.countRows() - height));
    if (target === blockStart) return;

    const changes: CellChange[] = [];
    for (const col of cols) {
        changes.push(...moveBlock(grid, col, blockStart, height, target - blockStart));
    }
    grid.setDataAtCell(changes, STRUCTURED_WRITE);
    session.blockStart = target;
}

function restoreEntryState(s: Session): void {
    const changes: CellChange[] = [];
    s.cols.forEach((col, i) => {
        s.data[i].forEach((value, row) => {
            changes.push([row, col, value]);
            s.grid.setCellMeta(row, col, "className", "");
        });
    });
    for (const [row, col, cls] of s.classes) s.grid.setCellMeta(row, col, "className", cls);
    s.grid.setDataAtCell(changes, STRUCTURED_WRITE);
}

/** Puts the grid back as it was at entry and closes the session. */
export function revertMove(): void {
    if (!session) return;
    restoreEntryState(session);
    session = null;
}

/**
 * Rewinds the live preview, closes the session, then replays the net move as one
 * write. Closing first is what lets that write reach the undo stack while every
 * preview mutation stayed off it.
 */
export function commitMove(): void {
    if (!session) return;
    const s = session;
    restoreEntryState(s);

    const delta = s.blockStart - s.origin;
    session = null;
    if (delta === 0) return;

    const changes: CellChange[] = [];
    for (const col of s.cols) changes.push(...moveBlock(s.grid, col, s.origin, s.height, delta));
    s.grid.setDataAtCell(changes, STRUCTURED_WRITE);
    attachMetaUndo({ cols: s.cols, before: s.classes, after: snapshotClasses(s.grid, s.cols) });
}
