/**
 * Keeping undo honest across a partner's structural change.
 *
 * Handsontable's undo stack stores row indices. A remote row insert makes
 * every pending index stale, and an undo would then write into a row the
 * debater never touched. Rebasing the shapes this build understands keeps the
 * history; anything else clears it, because losing history beats writing to
 * the wrong cell.
 */

/** What a partner did, in the terms the stack has to be corrected for. */
export type StructuralChange =
    | { kind: "insertRow"; at: number; amount: number }
    | { kind: "removeRow"; at: number; amount: number };

/** One entry of Handsontable's own undo stack, in the parts that carry rows. */
export interface UndoAction {
    actionType: string;
    index?: number;
    amount?: number;
    changes?: [row: number, prop: number | string, oldValue: unknown, newValue: unknown][];
}

/** The shapes whose row indices this build knows how to correct. */
const REBASEABLE: Record<string, true> = {
    change: true,
    insert_row: true,
    remove_row: true,
};

function shiftRow(row: number, change: StructuralChange): number | null {
    if (change.kind === "insertRow") {
        return row >= change.at ? row + change.amount : row;
    }
    if (row < change.at) return row;
    // The row this action names no longer exists.
    if (row < change.at + change.amount) return null;
    return row - change.amount;
}

/**
 * The stack corrected for `change`, or null meaning clear it.
 *
 * Never mutates the actions it is given: Handsontable owns those objects, and
 * `metaUndo` keys its parallel snapshots on their identity.
 */
export function rebaseActions(
    actions: readonly UndoAction[],
    change: StructuralChange,
): UndoAction[] | null {
    if (actions.length === 0) return [];

    const out: UndoAction[] = [];
    for (const action of actions) {
        if (!REBASEABLE[action.actionType]) return null;

        if (action.changes) {
            const changes: NonNullable<UndoAction["changes"]> = [];
            for (const [row, prop, oldValue, newValue] of action.changes) {
                const moved = shiftRow(row, change);
                if (moved === null) return null;
                changes.push([moved, prop, oldValue, newValue]);
            }
            out.push({ ...action, changes });
            continue;
        }

        if (typeof action.index === "number") {
            const moved = shiftRow(action.index, change);
            if (moved === null) return null;
            out.push({ ...action, index: moved });
            continue;
        }

        out.push({ ...action });
    }
    return out;
}
