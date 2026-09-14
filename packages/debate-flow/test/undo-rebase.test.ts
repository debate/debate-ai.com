import { describe, expect, it } from "vitest";
import {
    rebaseActions,
    type StructuralChange,
    type UndoAction,
} from "../src/lib/collab/undoRebase";

const change = (rows: number[]): UndoAction => ({
    actionType: "change",
    changes: rows.map((r) => [r, 0, "old", "new"] as UndoAction["changes"][number]),
});

const insert = (at: number, amount = 1): StructuralChange => ({ kind: "insertRow", at, amount });
const remove = (at: number, amount = 1): StructuralChange => ({ kind: "removeRow", at, amount });

describe("rebaseActions", () => {
    it("leaves an empty stack empty", () => {
        expect(rebaseActions([], insert(0))).toEqual([]);
    });

    it("pushes rows at or below a partner's insert down", () => {
        const [action] = rebaseActions([change([0, 2, 5])], insert(2))!;
        expect(action.changes!.map((c) => c[0])).toEqual([0, 3, 6]);
    });

    it("pushes rows down by the whole amount inserted", () => {
        const [action] = rebaseActions([change([4])], insert(2, 3))!;
        expect(action.changes![0][0]).toBe(7);
    });

    it("pulls rows below a partner's remove up", () => {
        const [action] = rebaseActions([change([0, 5])], remove(2))!;
        expect(action.changes!.map((c) => c[0])).toEqual([0, 4]);
    });

    it("clears the stack when an action names a row the remove took", () => {
        expect(rebaseActions([change([2])], remove(2))).toBeNull();
        expect(rebaseActions([change([3])], remove(2, 3))).toBeNull();
    });

    it("keeps a row just past a multi-row remove", () => {
        const [action] = rebaseActions([change([5])], remove(2, 3))!;
        expect(action.changes![0][0]).toBe(2);
    });

    it("corrects a row-insert action's own index", () => {
        const [action] = rebaseActions([{ actionType: "insert_row", index: 4 }], insert(1, 2))!;
        expect(action.index).toBe(6);
    });

    it("corrects a row-remove action's own index", () => {
        const [action] = rebaseActions([{ actionType: "remove_row", index: 6 }], remove(1, 2))!;
        expect(action.index).toBe(4);
    });

    it("clears the stack for a shape this build cannot correct", () => {
        expect(rebaseActions([{ actionType: "filter" }], insert(0))).toBeNull();
        expect(rebaseActions([change([0]), { actionType: "merge_cells" }], insert(0))).toBeNull();
    });

    it("passes through a rebaseable action carrying no rows at all", () => {
        const out = rebaseActions([{ actionType: "change" }], insert(0))!;
        expect(out).toEqual([{ actionType: "change" }]);
    });

    it("never mutates the actions it is given", () => {
        const original = change([5]);
        const snapshot = JSON.parse(JSON.stringify(original));
        const [rebased] = rebaseActions([original], insert(0))!;
        expect(original).toEqual(snapshot);
        expect(rebased).not.toBe(original);
        expect(rebased.changes).not.toBe(original.changes);
    });

    it("carries each change's old and new value through untouched", () => {
        const [action] = rebaseActions([change([3])], insert(0))!;
        expect(action.changes![0].slice(1)).toEqual([0, "old", "new"]);
    });

    it("corrects a whole stack in one pass", () => {
        const out = rebaseActions([change([0]), change([4]), change([9])], insert(3, 2))!;
        expect(out.map((a) => a.changes![0][0])).toEqual([0, 6, 11]);
    });

    it("undoes an insert with the matching remove", () => {
        const rows = [0, 3, 7];
        const up = rebaseActions([change(rows)], insert(2, 2))!;
        const back = rebaseActions(up, remove(2, 2))!;
        expect(back[0].changes!.map((c) => c[0])).toEqual(rows);
    });
});
