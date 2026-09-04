/**
 * Rewriting a run of one column as ops a peer can apply.
 *
 * A block move reorders cells inside a column, which the op union has no
 * single member for. Re-deriving the sheet instead would re-key every cell
 * from its row position, and a peer holding the old keys would not agree with
 * any of it. So the moved run is expressed the long way: take the old cells
 * out, put fresh ones in, and write the text. Every step is an op that
 * travels, which is the whole difference.
 */

import type { ModelCol } from "../grid/colSpace";

import type { CollabOp } from "./ops";

/**
 * Ops that leave rows `[at, at + texts.length)` of `col` holding `texts`.
 *
 * The removes all name the same index because each one closes the gap behind
 * it, and the inserts all name the same index because each one pushes the
 * previous down.
 */
export function replaceSpanOps(
    sheetId: string,
    col: ModelCol,
    at: number,
    texts: readonly (string | null)[],
): CollabOp[] {
    if (texts.length === 0) return [];

    const ops: CollabOp[] = [];
    for (let i = 0; i < texts.length; i++) {
        ops.push({ kind: "removeCell", sheetId, col, row: at });
    }
    for (let i = 0; i < texts.length; i++) {
        ops.push({ kind: "insertCell", sheetId, col, row: at });
    }
    texts.forEach((text, i) => {
        ops.push({ kind: "cellText", sheetId, col, row: at + i, text });
    });
    return ops;
}

/**
 * Ops that open `count` blank rows at `at` in one column, pushing whatever was
 * there down and carrying each cell's decoration with it.
 *
 * Every insert names the same index, because each one pushes the previous
 * down, so the run opens from the top.
 *
 * This is what an insert-mode paste and a CardMirror send are: both used to
 * re-derive the sheet afterwards instead, which re-keys every cell from its
 * row position and leaves a peer holding keys that no longer name anything.
 */
export function openSpanOps(sheetId: string, col: ModelCol, at: number, count: number): CollabOp[] {
    return Array.from(
        { length: Math.max(count, 0) },
        (): CollabOp => ({ kind: "insertCell", sheetId, col, row: at }),
    );
}
