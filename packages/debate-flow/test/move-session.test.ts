/**
 * @fileoverview Moving a block of cells with the keyboard.
 *
 * The session previews the move live and then replays the net result as one
 * write. That shape exists for the undo stack: every preview step has to stay
 * off it and the single replay has to land on it, so a debater who moved a
 * block six rows undoes it once rather than six times. Both halves of that are
 * checked here, along with the revert that has to restore text and decoration
 * together.
 */

import { afterEach, describe, expect, it } from "vitest";
import { gridCol } from "../src/lib/grid/colSpace";
import type { CellChange } from "../src/lib/grid/cellShift";
import { resetMetaUndo } from "../src/lib/grid/metaUndo";
import {
    beginMove,
    cellIsMoving,
    commitMove,
    isMovingIn,
    movingBlock,
    nudge,
    revertMove,
    type MoveGrid,
} from "../src/lib/grid/moveSession";

/** A grid that applies the writes it is handed and records their source. */
function makeGrid(rows = 6, cols = 2) {
    const text = Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => `${r}:${c}`),
    );
    const classes = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));
    const sources: (string | undefined)[] = [];
    const grid: MoveGrid = {
        countRows: () => rows,
        countCols: () => cols,
        getDataAtCell: (r, c) => text[r]?.[c] ?? null,
        getCellMeta: (r, c) => ({ className: classes[r][c] }),
        setCellMeta(r, c, key, value) {
            if (key === "className") classes[r][c] = (value as string) ?? "";
        },
        setDataAtCell(changes: CellChange[], source?: string) {
            sources.push(source);
            for (const [r, c, v] of changes) text[r][c] = v;
        },
    };
    return {
        grid,
        text,
        classes,
        sources,
        column: (c: number) => text.map((row) => row[c]),
        classColumn: (c: number) => classes.map((row) => row[c]),
    };
}

const range = (startRow: number, endRow: number, startCol = 0, endCol = 0) => ({
    startRow,
    endRow,
    startCol,
    endCol,
});

afterEach(() => {
    revertMove();
    resetMetaUndo();
});

describe("beginMove", () => {
    it("opens a session on the grid it was given", () => {
        const g = makeGrid();
        expect(isMovingIn(g.grid)).toBe(false);
        beginMove(g.grid, range(1, 2));
        expect(isMovingIn(g.grid)).toBe(true);
    });

    it("reports no session on a different grid", () => {
        const g = makeGrid();
        const other = makeGrid();
        beginMove(g.grid, range(1, 2));
        expect(isMovingIn(other.grid)).toBe(false);
        expect(isMovingIn(null)).toBe(false);
    });

    it("describes the block it opened on", () => {
        const g = makeGrid();
        beginMove(g.grid, range(1, 3, 0, 1));
        expect(movingBlock()).toEqual({ cols: [0, 1], blockStart: 1, height: 3 });
    });

    it("writes nothing on its own", () => {
        const g = makeGrid();
        beginMove(g.grid, range(1, 2));
        expect(g.sources).toHaveLength(0);
        expect(g.column(0)[1]).toBe("1:0");
    });

    it("describes no block when no session is open", () => {
        expect(movingBlock()).toBeNull();
    });
});

describe("cellIsMoving", () => {
    it("names every cell of the travelling block", () => {
        const g = makeGrid();
        beginMove(g.grid, range(1, 2, 0, 1));
        expect(cellIsMoving(g.grid, 1, gridCol(0))).toBe(true);
        expect(cellIsMoving(g.grid, 2, gridCol(1))).toBe(true);
    });

    it("names no cell outside it", () => {
        const g = makeGrid();
        beginMove(g.grid, range(1, 2, 0, 0));
        expect(cellIsMoving(g.grid, 0, gridCol(0))).toBe(false);
        expect(cellIsMoving(g.grid, 3, gridCol(0))).toBe(false);
        expect(cellIsMoving(g.grid, 1, gridCol(1))).toBe(false);
    });

    it("follows the block as it moves", () => {
        const g = makeGrid();
        beginMove(g.grid, range(0, 1));
        nudge(2);
        expect(cellIsMoving(g.grid, 0, gridCol(0))).toBe(false);
        expect(cellIsMoving(g.grid, 2, gridCol(0))).toBe(true);
    });

    it("names nothing without a session, or on another grid", () => {
        const g = makeGrid();
        expect(cellIsMoving(g.grid, 0, gridCol(0))).toBe(false);
        beginMove(g.grid, range(0, 1));
        expect(cellIsMoving(makeGrid().grid, 0, gridCol(0))).toBe(false);
        expect(cellIsMoving(null, 0, gridCol(0))).toBe(false);
    });
});

describe("nudge", () => {
    it("moves the block down through the rows it passes", () => {
        const g = makeGrid();
        beginMove(g.grid, range(0, 1));
        nudge(1);
        expect(g.column(0)).toEqual(["2:0", "0:0", "1:0", "3:0", "4:0", "5:0"]);
        expect(movingBlock()!.blockStart).toBe(1);
    });

    it("moves the block up", () => {
        const g = makeGrid();
        beginMove(g.grid, range(2, 3));
        nudge(-1);
        expect(g.column(0)).toEqual(["0:0", "2:0", "3:0", "1:0", "4:0", "5:0"]);
    });

    it("moves every selected column together", () => {
        const g = makeGrid();
        beginMove(g.grid, range(0, 0, 0, 1));
        nudge(1);
        expect(g.column(0)[1]).toBe("0:0");
        expect(g.column(1)[1]).toBe("0:1");
    });

    it("clamps at the top of the sheet", () => {
        const g = makeGrid();
        beginMove(g.grid, range(0, 1));
        nudge(-5);
        expect(movingBlock()!.blockStart).toBe(0);
        expect(g.sources).toHaveLength(0);
    });

    it("clamps at the bottom of the sheet", () => {
        const g = makeGrid();
        beginMove(g.grid, range(4, 5));
        nudge(5);
        expect(movingBlock()!.blockStart).toBe(4);
    });

    it("clamps to the last row a block of that height fits at", () => {
        const g = makeGrid();
        beginMove(g.grid, range(0, 1));
        nudge(99);
        expect(movingBlock()!.blockStart).toBe(4);
    });

    it("writes under the structured source, so the preview stays off the undo stack", () => {
        const g = makeGrid();
        beginMove(g.grid, range(0, 1));
        nudge(1);
        expect(g.sources.every((s) => typeof s === "string" && s.length > 0)).toBe(true);
    });

    it("does nothing without a session", () => {
        const g = makeGrid();
        expect(() => nudge(1)).not.toThrow();
        expect(g.sources).toHaveLength(0);
    });

    it("loses nothing: the column stays a permutation of itself", () => {
        const g = makeGrid();
        const before = [...g.column(0)].sort();
        beginMove(g.grid, range(1, 2));
        nudge(2);
        nudge(-1);
        expect([...g.column(0)].sort()).toEqual(before);
    });
});

describe("revertMove", () => {
    it("puts the text back as it was at entry", () => {
        const g = makeGrid();
        const before = [...g.column(0)];
        beginMove(g.grid, range(0, 1));
        nudge(3);
        revertMove();
        expect(g.column(0)).toEqual(before);
    });

    it("puts the decorations back with it", () => {
        const g = makeGrid();
        g.classes[0][0] = "flow-bold";
        beginMove(g.grid, range(0, 1));
        nudge(2);
        revertMove();
        expect(g.classColumn(0)).toEqual(["flow-bold", "", "", "", "", ""]);
    });

    it("closes the session", () => {
        const g = makeGrid();
        beginMove(g.grid, range(0, 1));
        revertMove();
        expect(isMovingIn(g.grid)).toBe(false);
        expect(movingBlock()).toBeNull();
    });

    it("is a no-op without a session", () => {
        expect(() => revertMove()).not.toThrow();
    });
});

describe("commitMove", () => {
    it("leaves the block where the preview put it", () => {
        const g = makeGrid();
        beginMove(g.grid, range(0, 1));
        nudge(2);
        commitMove();
        expect(g.column(0)).toEqual(["2:0", "3:0", "0:0", "1:0", "4:0", "5:0"]);
    });

    it("reaches the same result whether the move was one step or several", () => {
        const stepped = makeGrid();
        beginMove(stepped.grid, range(0, 1));
        nudge(1);
        nudge(1);
        commitMove();

        const direct = makeGrid();
        beginMove(direct.grid, range(0, 1));
        nudge(2);
        commitMove();

        expect(stepped.column(0)).toEqual(direct.column(0));
    });

    it("carries the block's decorations to where it landed", () => {
        const g = makeGrid();
        g.classes[0][0] = "flow-bold";
        beginMove(g.grid, range(0, 1));
        nudge(2);
        commitMove();
        expect(g.classColumn(0)).toEqual(["", "", "flow-bold", "", "", ""]);
    });

    it("rewinds the preview before replaying, so the net move is one write", () => {
        const g = makeGrid();
        beginMove(g.grid, range(0, 1));
        nudge(1);
        const before = g.sources.length;
        commitMove();
        // One rewind write, then one replay write.
        expect(g.sources.length - before).toBe(2);
    });

    it("closes the session before the replay, so that write reaches the undo stack", () => {
        const g = makeGrid();
        beginMove(g.grid, range(0, 1));
        nudge(1);
        commitMove();
        expect(isMovingIn(g.grid)).toBe(false);
    });

    it("writes nothing beyond the rewind when the block did not move", () => {
        const g = makeGrid();
        const before = [...g.column(0)];
        beginMove(g.grid, range(0, 1));
        commitMove();
        expect(g.column(0)).toEqual(before);
        expect(g.sources).toHaveLength(1);
    });

    it("writes nothing when the block was nudged back to where it started", () => {
        const g = makeGrid();
        const before = [...g.column(0)];
        beginMove(g.grid, range(1, 2));
        nudge(2);
        nudge(-2);
        commitMove();
        expect(g.column(0)).toEqual(before);
    });

    it("is a no-op without a session", () => {
        expect(() => commitMove()).not.toThrow();
    });

    it("loses nothing across the whole session", () => {
        const g = makeGrid();
        const before = [...g.column(0)].sort();
        beginMove(g.grid, range(1, 3));
        nudge(2);
        commitMove();
        expect([...g.column(0)].sort()).toEqual(before);
    });
});
