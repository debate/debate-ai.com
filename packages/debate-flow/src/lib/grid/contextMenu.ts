/**
 * The flow grid's right-click menu.
 *
 * Row insert and remove are Handsontable's own items. "Jump to source" is
 * ebb's, and it exists only on a cell a document sent in: a cell typed here
 * has nowhere to jump, so the item stays out of the menu rather than sitting
 * in it inert. Right-click moves the selection to the cell under the cursor
 * before the menu opens, so both the visibility test and the jump read that
 * cell off the grid the menu belongs to - not the focused pane, which in
 * split view can be the other one.
 */

import { jumpToSource } from "../bridge/commands";
import { cardmirrorLive } from "../bridge/enabled";
import type { CellSource } from "../model/flow";

/** The slice of Handsontable a menu item reads. Bound as `this` on both hooks. */
export interface MenuGrid {
    getSelectedLast(): [number, number, number, number] | undefined;
    getCellMeta(row: number, col: number): { source?: unknown };
}

/** The provenance on the cell the menu was opened over, or null when typed here. */
function menuSource(grid: MenuGrid): CellSource | null {
    const selection = grid.getSelectedLast();
    if (!selection) return null;
    // Handsontable types cell meta as an open bag, so the read is asserted the
    // same way the rest of the grid layer asserts className.
    return (grid.getCellMeta(selection[0], selection[1]).source as CellSource | undefined) ?? null;
}

/**
 * A boolean `hidden` is ignored by Handsontable's item filter; only a function
 * is consulted, and a hidden item's separator is swept up with it.
 */
export const JUMP_TO_SOURCE_ITEM = {
    key: "jump_to_source",
    name: "Jump to source",
    hidden(this: MenuGrid): boolean {
        return !cardmirrorLive() || !menuSource(this);
    },
    callback(this: MenuGrid): void {
        void jumpToSource(menuSource(this));
    },
};

export const FLOW_CONTEXT_MENU = [
    "row_above",
    "row_below",
    "remove_row",
    "---------",
    JUMP_TO_SOURCE_ITEM,
];
