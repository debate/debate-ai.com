/**
 * Keeping the cursor on the cell it was on.
 *
 * This is the highest-risk rule in the whole feature. A partner inserting a
 * row above you shifts every row below it down by one; if the selection stays
 * on its old index, the next thing typed lands one row off, silently, mid
 * speech. Nothing warns anybody, and the flow is wrong in a way that is only
 * discovered later.
 *
 * Arithmetic on the insertion point would get compounding changes wrong. The
 * replica already gives every cell an identity that no insert or delete
 * touches, so the selection is recorded as that identity before a remote
 * change lands and resolved back to an index afterwards.
 */

import type { ModelCol } from "../grid/colSpace";

import { liveCells } from "./doc";
import type { CollabSheet } from "./types";

export interface CellRef {
    col: ModelCol;
    rank: string;
    actor: string;
}

/** What the cursor is on, named so a structural change cannot rename it. */
export function selectionIdentity(sheet: CollabSheet, row: number, col: ModelCol): CellRef | null {
    const cell = liveCells(sheet, col)[row];
    return cell ? { col, rank: cell.rank, actor: cell.actor } : null;
}

/** Where that cell sits now, or null when it is gone. */
export function rowOfIdentity(sheet: CollabSheet, ref: CellRef): number | null {
    const index = liveCells(sheet, ref.col).findIndex(
        (c) => c.rank === ref.rank && c.actor === ref.actor,
    );
    return index === -1 ? null : index;
}

/**
 * The row the selection belongs on after a remote change.
 *
 * A cell that is gone leaves the cursor where it is: a deleted row must not
 * throw the cursor somewhere else, because a debater who is mid-thought would
 * keep typing into wherever it landed.
 */
export function followSelection(
    before: CollabSheet,
    after: CollabSheet,
    row: number,
    col: ModelCol,
): number {
    const ref = selectionIdentity(before, row, col);
    if (!ref) return row;
    return rowOfIdentity(after, ref) ?? row;
}
