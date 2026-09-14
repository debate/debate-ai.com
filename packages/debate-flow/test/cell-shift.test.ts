import { describe, expect, it } from "vitest";
import {
    insertCell,
    moveBlock,
    shiftMetaDown,
    shiftSpan,
    type CellGrid,
} from "../src/lib/grid/cellShift";
import { gridCol } from "../src/lib/grid/colSpace";
import type { CellSource } from "../src/lib/model/flow";

interface FakeGrid extends CellGrid {
    text: (string | null)[][];
    classes: string[][];
    sources: (CellSource | undefined)[][];
    apply(changes: [number, number, string | null][]): void;
    column(col: number): (string | null)[];
    classColumn(col: number): string[];
}

/** A grid of `rows` x `cols`, seeded from `fill(row, col)`. */
function makeGrid(
    rows: number,
    cols: number,
    fill: (row: number, col: number) => string | null = (r, c) => `${r}:${c}`,
): FakeGrid {
    const text = Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => fill(r, c)),
    );
    const classes = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));
    const sources = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => undefined as CellSource | undefined),
    );
    return {
        text,
        classes,
        sources,
        countRows: () => rows,
        countCols: () => cols,
        getDataAtCell: (r, c) => text[r]?.[c] ?? null,
        getCellMeta: (r, c) => ({ className: classes[r]?.[c], source: sources[r]?.[c] }),
        setCellMeta(r, c, key, value) {
            if (key === "className") classes[r][c] = (value as string) ?? "";
            else sources[r][c] = value as CellSource | undefined;
        },
        apply(changes) {
            for (const [r, c, v] of changes) text[r][c] = v;
        },
        column: (c) => text.map((row) => row[c]),
        classColumn: (c) => classes.map((row) => row[c]),
    };
}

const src = (key: string): CellSource => ({ app: "cardmirror", token: `t-${key}`, key });

describe("shiftSpan", () => {
    it("does nothing at all for a zero shift", () => {
        const grid = makeGrid(4, 1);
        expect(shiftSpan(grid, gridCol(0), 0, 4, 0)).toEqual([]);
    });

    it("slides a span down, carrying its text", () => {
        const grid = makeGrid(4, 1);
        grid.apply(shiftSpan(grid, gridCol(0), 0, 3, 1));
        expect(grid.column(0)).toEqual(["0:0", "0:0", "1:0", "2:0"]);
    });

    it("slides a span up", () => {
        const grid = makeGrid(4, 1);
        grid.apply(shiftSpan(grid, gridCol(0), 1, 4, -1));
        expect(grid.column(0)).toEqual(["1:0", "2:0", "3:0", "3:0"]);
    });

    it("reads pre-shift values even where source and target overlap", () => {
        const grid = makeGrid(6, 1);
        grid.apply(shiftSpan(grid, gridCol(0), 0, 4, 2));
        expect(grid.column(0)).toEqual(["0:0", "1:0", "0:0", "1:0", "2:0", "3:0"]);
    });

    it("drops content whose target falls off the bottom", () => {
        const grid = makeGrid(3, 1);
        grid.apply(shiftSpan(grid, gridCol(0), 0, 3, 1));
        expect(grid.column(0)).toEqual(["0:0", "0:0", "1:0"]);
    });

    it("drops content whose target falls off the top", () => {
        const grid = makeGrid(3, 1);
        grid.apply(shiftSpan(grid, gridCol(0), 0, 3, -1));
        expect(grid.column(0)).toEqual(["1:0", "2:0", "2:0"]);
    });

    it("clamps a span that starts above or ends below the grid", () => {
        const grid = makeGrid(3, 1);
        const changes = shiftSpan(grid, gridCol(0), -5, 99, 1);
        expect(changes.every(([r]) => r >= 0 && r < 3)).toBe(true);
    });

    it("carries the decoration class along with the text", () => {
        const grid = makeGrid(4, 1);
        grid.classes[1][0] = "flow-bold";
        grid.apply(shiftSpan(grid, gridCol(0), 0, 3, 1));
        expect(grid.classColumn(0)).toEqual(["", "", "flow-bold", ""]);
    });

    it("carries provenance along with the text", () => {
        const grid = makeGrid(4, 1);
        grid.sources[0][0] = src("a");
        grid.apply(shiftSpan(grid, gridCol(0), 0, 3, 1));
        expect(grid.sources[1][0]).toEqual(src("a"));
    });

    it("moves meta only when asked, leaving the text where the caller put it", () => {
        const grid = makeGrid(4, 1);
        grid.classes[0][0] = "flow-card";
        const changes = shiftSpan(grid, gridCol(0), 0, 3, 1, { metaOnly: true });
        expect(changes).toEqual([]);
        expect(grid.classColumn(0)[1]).toBe("flow-card");
        expect(grid.column(0)).toEqual(["0:0", "1:0", "2:0", "3:0"]);
    });

    it("leaves vacated cells stale, for the caller to blank", () => {
        const grid = makeGrid(4, 1);
        grid.apply(shiftSpan(grid, gridCol(0), 0, 4, 1));
        expect(grid.column(0)[0]).toBe("0:0");
    });
});

describe("insertCell", () => {
    it("opens a blank cell and pushes the column down", () => {
        const grid = makeGrid(4, 1);
        grid.apply(insertCell(grid, 1, gridCol(0)));
        expect(grid.column(0)).toEqual(["0:0", "", "1:0", "2:0"]);
    });

    it("drops the last row off the bottom", () => {
        const grid = makeGrid(3, 1);
        grid.apply(insertCell(grid, 0, gridCol(0)));
        expect(grid.column(0)).toEqual(["", "0:0", "1:0"]);
    });

    it("leaves the opened cell bare of the displaced decoration", () => {
        const grid = makeGrid(4, 1);
        grid.classes[1][0] = "flow-bold";
        grid.sources[1][0] = src("x");
        grid.apply(insertCell(grid, 1, gridCol(0)));
        expect(grid.classes[1][0]).toBe("");
        expect(grid.sources[1][0]).toBeUndefined();
        expect(grid.classes[2][0]).toBe("flow-bold");
        expect(grid.sources[2][0]).toEqual(src("x"));
    });

    it("touches no other column", () => {
        const grid = makeGrid(4, 2);
        grid.apply(insertCell(grid, 0, gridCol(0)));
        expect(grid.column(1)).toEqual(["0:1", "1:1", "2:1", "3:1"]);
    });
});

describe("shiftMetaDown", () => {
    it("moves the pasted columns' meta down by the pasted height", () => {
        const grid = makeGrid(6, 2);
        grid.classes[1][0] = "flow-bold";
        shiftMetaDown(grid, { row: 0, col: gridCol(0), width: 1, height: 2 });
        expect(grid.classColumn(0)).toEqual(["", "", "", "flow-bold", "", ""]);
    });

    it("leaves the pasted block itself bare", () => {
        const grid = makeGrid(6, 1);
        grid.classes[0][0] = "flow-card";
        grid.sources[0][0] = src("a");
        shiftMetaDown(grid, { row: 0, col: gridCol(0), width: 1, height: 2 });
        expect(grid.classes[0][0]).toBe("");
        expect(grid.sources[0][0]).toBeUndefined();
    });

    it("keeps the rows of columns outside the pasted block", () => {
        const grid = makeGrid(6, 2);
        grid.classes[1][1] = "flow-bold";
        shiftMetaDown(grid, { row: 0, col: gridCol(0), width: 1, height: 2 });
        expect(grid.classes[1][1]).toBe("flow-bold");
    });

    it("clamps a paste wider than the grid", () => {
        const grid = makeGrid(4, 2);
        grid.classes[0][1] = "flow-bold";
        expect(() =>
            shiftMetaDown(grid, { row: 0, col: gridCol(0), width: 9, height: 1 }),
        ).not.toThrow();
        expect(grid.classes[1][1]).toBe("flow-bold");
    });

    it("lets meta pushed past the last row fall off, as its text does", () => {
        const grid = makeGrid(3, 1);
        grid.classes[2][0] = "flow-bold";
        shiftMetaDown(grid, { row: 0, col: gridCol(0), width: 1, height: 2 });
        expect(grid.classColumn(0)).toEqual(["", "", ""]);
    });
});

describe("moveBlock", () => {
    it("does nothing at all for a zero move", () => {
        const grid = makeGrid(5, 1);
        expect(moveBlock(grid, gridCol(0), 1, 2, 0)).toEqual([]);
    });

    it("rotates a block down through the cells it passes", () => {
        const grid = makeGrid(5, 1);
        grid.apply(moveBlock(grid, gridCol(0), 0, 2, 1));
        expect(grid.column(0)).toEqual(["2:0", "0:0", "1:0", "3:0", "4:0"]);
    });

    it("rotates a block up through the cells it passes", () => {
        const grid = makeGrid(5, 1);
        grid.apply(moveBlock(grid, gridCol(0), 2, 2, -1));
        expect(grid.column(0)).toEqual(["0:0", "2:0", "3:0", "1:0", "4:0"]);
    });

    it("moves a block past several rows at once", () => {
        const grid = makeGrid(5, 1);
        grid.apply(moveBlock(grid, gridCol(0), 0, 1, 3));
        expect(grid.column(0)).toEqual(["1:0", "2:0", "3:0", "0:0", "4:0"]);
    });

    it("creates and loses nothing: the column is a permutation of itself", () => {
        const grid = makeGrid(6, 1);
        const before = [...grid.column(0)].sort();
        grid.apply(moveBlock(grid, gridCol(0), 1, 3, 2));
        expect([...grid.column(0)].sort()).toEqual(before);
    });

    it("carries the block's decorations and provenance with it", () => {
        const grid = makeGrid(5, 1);
        grid.classes[0][0] = "flow-bold";
        grid.sources[1][0] = src("b");
        grid.apply(moveBlock(grid, gridCol(0), 0, 2, 2));
        expect(grid.classes[2][0]).toBe("flow-bold");
        expect(grid.sources[3][0]).toEqual(src("b"));
    });

    it("carries the passed-over cells' decorations too", () => {
        const grid = makeGrid(5, 1);
        grid.classes[2][0] = "flow-card";
        grid.apply(moveBlock(grid, gridCol(0), 0, 2, 1));
        expect(grid.classColumn(0)).toEqual(["flow-card", "", "", "", ""]);
    });

    it("is its own inverse", () => {
        const grid = makeGrid(6, 1);
        const before = [...grid.column(0)];
        grid.apply(moveBlock(grid, gridCol(0), 1, 2, 2));
        grid.apply(moveBlock(grid, gridCol(0), 3, 2, -2));
        expect(grid.column(0)).toEqual(before);
    });
});
