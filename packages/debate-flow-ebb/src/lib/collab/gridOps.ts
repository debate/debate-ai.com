/**
 * Turning a grid hook payload into ops.
 *
 * Handsontable reports which cells changed, never why, and every structured
 * write in this app collapses into one large diff under a single source
 * string. So the source is the only thing that separates a write this module
 * may replay cell by cell from one that has to describe itself precisely at
 * its own call site.
 */

import type { ModelCol } from "../grid/colSpace";
import { STRUCTURED_WRITE } from "../grid/staleSource";

import type { CollabOp } from "./ops";

/**
 * Writes that change text and move no cell, so a per-cell replay is exact.
 *
 * `populateFromArray` is an insert-mode paste: the copy-paste plugin drops its
 * own source when it recurses to perform the shifted write, so the paste
 * arrives under Handsontable's default label rather than `CopyPaste.paste`.
 *
 * `STRUCTURED_WRITE` is absent on purpose. A single-column insert rewrites the
 * whole column below the insertion point, and replaying that as text writes
 * would reassign text across ranks instead of opening one new rank, which
 * reads as a partner's work being overwritten from rows they never touched.
 */
const REPLAYED_SOURCES: Record<string, true> = {
    edit: true,
    "CopyPaste.paste": true,
    "CopyPaste.cut": true,
    "UndoRedo.undo": true,
    "UndoRedo.redo": true,
    populateFromArray: true,
};

export function isReplicatedSource(source: unknown): boolean {
    if (typeof source !== "string" || source === STRUCTURED_WRITE) return false;
    return REPLAYED_SOURCES[source] === true;
}

/**
 * One `afterChange` entry, its column already named in the model's space.
 * Handsontable reports a grid column, so a padded pane owes this seam a shift
 * before the change reaches it; the brand is what makes that shift a compiler
 * demand rather than a habit.
 */
export type ModelChange = [
    row: number,
    prop: string | ModelCol,
    oldValue: unknown,
    newValue: unknown,
];

export function textOpsFromChanges(sheetId: string, changes: readonly ModelChange[]): CollabOp[] {
    const ops: CollabOp[] = [];
    for (const [row, prop, oldValue, newValue] of changes) {
        // A flow sheet holds array rows, so Handsontable's prop is the column.
        if (typeof prop !== "number") continue;
        if (oldValue === newValue) continue;
        ops.push({
            kind: "cellText",
            sheetId,
            col: prop,
            row,
            text: typeof newValue === "string" ? newValue : null,
        });
    }
    return ops;
}

/**
 * Row inserts and removals, one op per row.
 *
 * `auto` is Handsontable growing its own spare row when the debater types near
 * the bottom of the sheet. It looks exactly like a row insert and fires before
 * the keystroke's own change, so replaying it would splice a blank rank into
 * every column of the sheet for no user action at all.
 *
 * A paste is skipped for the opposite reason: an insert-mode paste opens rows
 * in the columns it lands in and nowhere else, and says so itself before
 * Handsontable touches the grid. Taking the row growth as well would open the
 * same rows twice, once across every column of the sheet.
 */
const SELF_DESCRIBING: Record<string, true> = {
    auto: true,
    populateFromArray: true,
    "CopyPaste.paste": true,
};

export function rowOpFromHook(
    kind: "insert" | "remove",
    sheetId: string,
    index: number,
    amount: number,
    source: unknown,
): CollabOp[] {
    if (typeof source === "string" && SELF_DESCRIBING[source]) return [];
    const ops: CollabOp[] = [];
    for (let i = 0; i < amount; i++) {
        // Each removal closes the gap, so the index does not advance.
        ops.push(
            kind === "insert"
                ? { kind: "insertRow", sheetId, row: index + i }
                : { kind: "removeRow", sheetId, row: index },
        );
    }
    return ops;
}
