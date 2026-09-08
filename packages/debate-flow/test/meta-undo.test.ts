import { beforeEach, describe, expect, it } from "vitest";
import type { CellGrid } from "../src/lib/grid/cellShift";
import {
    attachMetaUndo,
    onRedoStackChange,
    onUndoStackChange,
    rebaseUndoStacks,
    resetMetaUndo,
    restoreMetaRedo,
    restoreMetaUndo,
    snapshotClasses,
    type ClassEntry,
} from "../src/lib/grid/metaUndo";
import type { CellSource } from "../src/lib/model/flow";
import type { UndoAction } from "../src/lib/collab/undoRebase";

function makeGrid(rows = 4, cols = 2): CellGrid & { classes: string[][] } {
    const classes = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));
    const sources = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => undefined as CellSource | undefined),
    );
    return {
        classes,
        countRows: () => rows,
        countCols: () => cols,
        getDataAtCell: () => null,
        getCellMeta: (r, c) => ({ className: classes[r][c], source: sources[r][c] }),
        setCellMeta(r, c, key, value) {
            if (key === "className") classes[r][c] = (value as string) ?? "";
            else sources[r][c] = value as CellSource | undefined;
        },
    };
}

const src: CellSource = { app: "cardmirror", token: "t1", key: "k1" };

beforeEach(resetMetaUndo);

describe("snapshotClasses", () => {
    it("records only the decorated cells, top to bottom", () => {
        const grid = makeGrid();
        grid.classes[2][0] = "flow-bold";
        grid.classes[0][1] = "flow-card";
        expect(snapshotClasses(grid, [0, 1])).toEqual([
            [0, 1, "flow-card"],
            [2, 0, "flow-bold"],
        ]);
    });

    it("keeps a plain decoration as a three-slot entry", () => {
        const grid = makeGrid();
        grid.classes[0][0] = "flow-bold";
        expect(snapshotClasses(grid, [0])[0]).toHaveLength(3);
    });

    it("carries provenance as a fourth slot", () => {
        const grid = makeGrid();
        grid.setCellMeta(1, 0, "source", src);
        expect(snapshotClasses(grid, [0])).toEqual([[1, 0, "", src]]);
    });

    it("records a sourced cell even when it carries no class", () => {
        const grid = makeGrid();
        grid.setCellMeta(3, 1, "source", src);
        expect(snapshotClasses(grid, [0, 1])).toHaveLength(1);
    });

    it("only walks the columns it is given", () => {
        const grid = makeGrid();
        grid.classes[0][1] = "flow-bold";
        expect(snapshotClasses(grid, [0])).toEqual([]);
    });

    it("is empty for an undecorated grid", () => {
        expect(snapshotClasses(makeGrid(), [0, 1])).toEqual([]);
    });
});

describe("attach / restore", () => {
    /** Stands in for Handsontable pushing an action onto the undo stack. */
    function push(stack: object[], action: object) {
        const before = [...stack];
        stack.push(action);
        onUndoStackChange(before, stack);
    }

    /** Stands in for an undo moving that action to the redo stack. */
    function undo(undoStack: object[], redoStack: object[]) {
        const action = undoStack.pop()!;
        const before = [...redoStack];
        redoStack.push(action);
        onRedoStackChange(before, redoStack);
    }

    it("restores the before snapshot on undo", () => {
        const grid = makeGrid();
        const undoStack: object[] = [];
        const redoStack: object[] = [];
        const action = { actionType: "change" };
        push(undoStack, action);
        attachMetaUndo({ cols: [0], before: [[1, 0, "flow-bold"]], after: [[2, 0, "flow-bold"]] });
        grid.classes[2][0] = "flow-bold";

        undo(undoStack, redoStack);
        expect(restoreMetaUndo(grid)).toBe(true);
        expect(grid.classes[1][0]).toBe("flow-bold");
        expect(grid.classes[2][0]).toBe("");
    });

    it("restores the after snapshot on redo", () => {
        const grid = makeGrid();
        const undoStack: object[] = [];
        const redoStack: object[] = [];
        const action = { actionType: "change" };
        push(undoStack, action);
        attachMetaUndo({ cols: [0], before: [[1, 0, "flow-bold"]], after: [[2, 0, "flow-bold"]] });
        undo(undoStack, redoStack);
        restoreMetaUndo(grid);

        // Redo pushes the action back onto the undo stack.
        push(undoStack, action);
        expect(restoreMetaRedo(grid)).toBe(true);
        expect(grid.classes[2][0]).toBe("flow-bold");
        expect(grid.classes[1][0]).toBe("");
    });

    it("clears every cell of the snapshot's columns before restoring", () => {
        const grid = makeGrid();
        grid.classes[3][0] = "stale";
        const undoStack: object[] = [];
        const redoStack: object[] = [];
        push(undoStack, { actionType: "change" });
        attachMetaUndo({ cols: [0], before: [], after: [] });
        undo(undoStack, redoStack);
        restoreMetaUndo(grid);
        expect(grid.classes[3][0]).toBe("");
    });

    it("restores provenance along with the class", () => {
        const grid = makeGrid();
        const undoStack: object[] = [];
        const redoStack: object[] = [];
        push(undoStack, { actionType: "change" });
        attachMetaUndo({ cols: [0], before: [[0, 0, "flow-card", src]], after: [] });
        undo(undoStack, redoStack);
        restoreMetaUndo(grid);
        expect(grid.getCellMeta(0, 0).source).toEqual(src);
    });

    it("reports no snapshot when the action carried none", () => {
        const grid = makeGrid();
        const undoStack: object[] = [];
        const redoStack: object[] = [];
        push(undoStack, { actionType: "change" });
        undo(undoStack, redoStack);
        expect(restoreMetaUndo(grid)).toBe(false);
    });

    it("keeps a write that pushed nothing from stealing the previous snapshot", () => {
        const grid = makeGrid();
        const undoStack: object[] = [];
        const redoStack: object[] = [];
        push(undoStack, { actionType: "change" });
        attachMetaUndo({ cols: [0], before: [[0, 0, "flow-bold"]], after: [] });
        // A second attach with nothing newly pushed must bind to nothing.
        attachMetaUndo({ cols: [0], before: [[1, 0, "stolen"]], after: [] });
        undo(undoStack, redoStack);
        restoreMetaUndo(grid);
        expect(grid.classes[0][0]).toBe("flow-bold");
        expect(grid.classes[1][0]).toBe("");
    });

    it("remembers nothing when the undo stack only shrank", () => {
        const grid = makeGrid();
        onUndoStackChange([{}, {}], [{}]);
        attachMetaUndo({ cols: [0], before: [[0, 0, "x"]], after: [] });
        expect(restoreMetaRedo(grid)).toBe(false);
    });

    it("remembers nothing when the redo stack only shrank", () => {
        const grid = makeGrid();
        onRedoStackChange([{}, {}], [{}]);
        expect(restoreMetaUndo(grid)).toBe(false);
    });

    it("drops the pending references on reset", () => {
        const grid = makeGrid();
        const undoStack: object[] = [];
        push(undoStack, { actionType: "change" });
        resetMetaUndo();
        attachMetaUndo({ cols: [0], before: [[0, 0, "x"]], after: [] });
        expect(restoreMetaRedo(grid)).toBe(false);
    });
});

describe("rebaseUndoStacks", () => {
    const action = (row: number): UndoAction => ({
        actionType: "change",
        changes: [[row, 0, null, null]],
    });

    it("survives a grid with no undo plugin", () => {
        expect(() =>
            rebaseUndoStacks(undefined, { kind: "insertRow", at: 0, amount: 1 }),
        ).not.toThrow();
    });

    it("shifts a done action's rows for a partner's insert", () => {
        const plugin = { doneActions: [action(2)], undoneActions: [] };
        rebaseUndoStacks(plugin, { kind: "insertRow", at: 1, amount: 2 });
        expect(plugin.doneActions[0].changes![0][0]).toBe(4);
    });

    it("shifts the redo stack too, since the two are halves of one history", () => {
        const plugin = { doneActions: [], undoneActions: [action(5)] };
        rebaseUndoStacks(plugin, { kind: "removeRow", at: 0, amount: 2 });
        expect(plugin.undoneActions[0].changes![0][0]).toBe(3);
    });

    it("corrects the action objects in place, keeping their identity", () => {
        const held = action(2);
        const plugin = { doneActions: [held], undoneActions: [] };
        rebaseUndoStacks(plugin, { kind: "insertRow", at: 0, amount: 1 });
        expect(plugin.doneActions[0]).toBe(held);
    });

    it("clears a stack it cannot correct rather than writing to the wrong cell", () => {
        const plugin = { doneActions: [{ actionType: "filter" } as UndoAction], undoneActions: [] };
        rebaseUndoStacks(plugin, { kind: "insertRow", at: 0, amount: 1 });
        expect(plugin.doneActions).toHaveLength(0);
    });

    it("clears a stack whose action names a row the partner removed", () => {
        const plugin = { doneActions: [action(3)], undoneActions: [] };
        rebaseUndoStacks(plugin, { kind: "removeRow", at: 3, amount: 1 });
        expect(plugin.doneActions).toHaveLength(0);
    });

    it("leaves an empty stack alone", () => {
        const plugin = { doneActions: [], undoneActions: [] };
        expect(() =>
            rebaseUndoStacks(plugin, { kind: "insertRow", at: 0, amount: 1 }),
        ).not.toThrow();
    });

    it("moves a decoration snapshot the same way it moves the text", () => {
        const grid = makeGrid(6);
        const held = action(1);
        const undoStack: object[] = [];
        const before = [...undoStack];
        undoStack.push(held);
        onUndoStackChange(before, undoStack);
        const snap = {
            cols: [0],
            before: [[1, 0, "flow-bold"]] as ClassEntry[],
            after: [] as ClassEntry[],
        };
        attachMetaUndo(snap);

        rebaseUndoStacks({ doneActions: [held], undoneActions: [] }, {
            kind: "insertRow",
            at: 0,
            amount: 2,
        });
        expect(snap.before).toEqual([[3, 0, "flow-bold"]]);
        expect(held.changes![0][0]).toBe(3);
    });

    it("carries provenance through a rebase", () => {
        const held = action(0);
        const undoStack: object[] = [];
        onUndoStackChange([], [held]);
        undoStack.push(held);
        const snap = {
            cols: [0],
            before: [[0, 0, "flow-card", src]] as ClassEntry[],
            after: [] as ClassEntry[],
        };
        attachMetaUndo(snap);
        rebaseUndoStacks({ doneActions: [held], undoneActions: [] }, {
            kind: "insertRow",
            at: 0,
            amount: 1,
        });
        expect(snap.before).toEqual([[1, 0, "flow-card", src]]);
    });

    it("clears the stack when a snapshot names a row the partner removed", () => {
        const held = action(9);
        onUndoStackChange([], [held]);
        attachMetaUndo({ cols: [0], before: [[2, 0, "flow-bold"]], after: [] });
        const plugin = { doneActions: [held], undoneActions: [] };
        rebaseUndoStacks(plugin, { kind: "removeRow", at: 2, amount: 1 });
        expect(plugin.doneActions).toHaveLength(0);
    });
});
