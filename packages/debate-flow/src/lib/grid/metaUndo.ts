/**
 * Decoration and provenance undo. Handsontable's undo stack records
 * `setDataAtCell` and ignores `setCellMeta`, so a shift that moves text and
 * meta together comes apart on undo: the text returns and the meta stays where
 * the shift put it.
 *
 * The fix pairs each pushed undo action with a `{before, after}` snapshot of
 * the touched columns' cell meta. It uses documented hooks only, so if a future
 * Handsontable stops firing the stack-change hooks the meta undo silently
 * no-ops and text undo keeps working.
 */

import { rebaseActions, type StructuralChange, type UndoAction } from "../collab/undoRebase";
import type { CellSource } from "../model/flow";

import type { CellGrid } from "./cellShift";

/**
 * One cell worth of carried meta: row, column, its full className string, and
 * its provenance when it has any. The fourth slot is left off rather than set
 * undefined, so a plain decoration snapshot stays a 3-tuple.
 */
export type ClassEntry = [row: number, col: number, className: string, source?: CellSource];

export interface MetaSnapshot {
    /** The columns the snapshots cover; restoring clears these in full first. */
    cols: number[];
    before: ClassEntry[];
    after: ClassEntry[];
}

// The stack-change hooks hand out the live action objects, so a WeakMap keyed on
// them collects its records for free when the redo stack is cleared. The action
// afterUndo and afterRedo receive is a deepClone, useless as a key, so the
// action under an undo or redo is captured from the stack move that precedes it:
// undoing pushes onto the redo stack, redoing pushes back onto the undo stack.
const snapshots = new WeakMap<object, MetaSnapshot>();
let lastPushed: object | null = null;
let lastUndone: object | null = null;

/** Records the decorated or sourced cells of `cols`, top to bottom. */
export function snapshotClasses(grid: CellGrid, cols: number[]): ClassEntry[] {
    const entries: ClassEntry[] = [];
    for (let r = 0; r < grid.countRows(); r++) {
        for (const c of cols) {
            const meta = grid.getCellMeta(r, c);
            const cls = (meta.className ?? "") as string;
            const source = meta.source as CellSource | undefined;
            if (source) entries.push([r, c, cls, source]);
            else if (cls) entries.push([r, c, cls]);
        }
    }
    return entries;
}

function applyClasses(grid: CellGrid, cols: number[], entries: ClassEntry[]): void {
    for (let r = 0; r < grid.countRows(); r++) {
        for (const c of cols) {
            grid.setCellMeta(r, c, "className", "");
            grid.setCellMeta(r, c, "source", undefined);
        }
    }
    for (const [r, c, cls, source] of entries) {
        grid.setCellMeta(r, c, "className", cls);
        if (source) grid.setCellMeta(r, c, "source", source);
    }
}

/**
 * `afterUndoStackChange`: remembers the action just pushed onto the undo stack,
 * whether by a fresh write or by a redo putting one back.
 */
export function onUndoStackChange(before: readonly object[], after: readonly object[]): void {
    lastPushed = after.length > before.length ? (after[after.length - 1] ?? null) : null;
}

/** `afterRedoStackChange`: remembers the action an undo just took off. */
export function onRedoStackChange(before: readonly object[], after: readonly object[]): void {
    lastUndone = after.length > before.length ? (after[after.length - 1] ?? null) : null;
}

/**
 * Binds a meta snapshot to the action the preceding `setDataAtCell`
 * pushed. Call it after that write, never before: until the write lands there is
 * no action to key on. Clearing the reference keeps a write that pushed nothing
 * from stealing the previous action's snapshot.
 */
export function attachMetaUndo(snap: MetaSnapshot): void {
    if (!lastPushed) return;
    snapshots.set(lastPushed, snap);
    lastPushed = null;
}

/** `afterUndo`. Returns whether a snapshot was found and restored. */
export function restoreMetaUndo(grid: CellGrid): boolean {
    const snap = lastUndone && snapshots.get(lastUndone);
    if (!snap) return false;
    applyClasses(grid, snap.cols, snap.before);
    return true;
}

/** `afterRedo`. Returns whether a snapshot was found and restored. */
export function restoreMetaRedo(grid: CellGrid): boolean {
    const snap = lastPushed && snapshots.get(lastPushed);
    if (!snap) return false;
    applyClasses(grid, snap.cols, snap.after);
    return true;
}

/** Drops the pending action references. Tests call this between grids. */
export function resetMetaUndo(): void {
    lastPushed = null;
    lastUndone = null;
}

/** The parts of Handsontable's undo plugin this has to correct. */
interface UndoPluginLike {
    doneActions?: UndoAction[];
    undoneActions?: UndoAction[];
}

/** Shifts a decoration snapshot's rows the same way the text stack moved. */
function rebaseEntries(entries: ClassEntry[], change: StructuralChange): ClassEntry[] | null {
    const out: ClassEntry[] = [];
    for (const entry of entries) {
        const [row, col, className, source] = entry;
        const asAction: UndoAction = { actionType: "change", changes: [[row, col, null, null]] };
        const moved = rebaseActions([asAction], change);
        if (moved === null) return null;
        const newRow = moved[0].changes![0][0];
        out.push(source ? [newRow, col, className, source] : [newRow, col, className]);
    }
    return out;
}

/**
 * Corrects both undo histories for a partner's structural change, or drops
 * both when it cannot.
 *
 * The two stacks are halves of one history: rebasing text and not decorations
 * would leave a bold toggle undoing onto a row its text no longer sits on.
 * The action objects are corrected in place rather than replaced, because the
 * decoration snapshots are keyed on their identity.
 */
export function rebaseUndoStacks(
    plugin: UndoPluginLike | undefined,
    change: StructuralChange,
): void {
    if (!plugin) return;

    for (const key of ["doneActions", "undoneActions"] as const) {
        const stack = plugin[key];
        if (!stack || stack.length === 0) continue;

        const rebased = rebaseActions(stack, change);
        const metas = stack.map((a) => snapshots.get(a));
        const rebasedMetas = metas.map((m) =>
            m
                ? {
                      cols: m.cols,
                      before: rebaseEntries(m.before, change),
                      after: rebaseEntries(m.after, change),
                  }
                : null,
        );
        const metaFailed = rebasedMetas.some((m) => m && (!m.before || !m.after));

        if (rebased === null || metaFailed) {
            // Losing history beats writing to the wrong cell.
            stack.length = 0;
            resetMetaUndo();
            continue;
        }

        stack.forEach((action, i) => {
            const next = rebased[i];
            if (next.changes) action.changes = next.changes;
            if (typeof next.index === "number") action.index = next.index;
            const meta = rebasedMetas[i];
            const held = snapshots.get(action);
            if (meta && held) {
                held.before = meta.before as ClassEntry[];
                held.after = meta.after as ClassEntry[];
            }
        });
    }
}
