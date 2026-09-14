import { describe, expect, it } from "vitest";
import { gridCol, modelCol, toGridCol, toModelCol } from "../src/lib/grid/colSpace";

describe("toModelCol", () => {
    it("subtracts the pad, so a grid column names the cell under it", () => {
        expect(toModelCol(gridCol(3), 2)).toBe(1);
        expect(toModelCol(gridCol(2), 2)).toBe(0);
    });

    it("is the identity on an unpadded pane", () => {
        for (let i = 0; i < 5; i++) expect(toModelCol(gridCol(i), 0)).toBe(i);
    });

    it("returns null inside the pad rather than clamping onto a real cell", () => {
        expect(toModelCol(gridCol(0), 2)).toBeNull();
        expect(toModelCol(gridCol(1), 2)).toBeNull();
    });
});

describe("toGridCol", () => {
    it("adds the pad, so a cell lands where the pane draws it", () => {
        expect(toGridCol(modelCol(0), 2)).toBe(2);
        expect(toGridCol(modelCol(4), 3)).toBe(7);
    });

    it("is the identity on an unpadded pane", () => {
        expect(toGridCol(modelCol(4), 0)).toBe(4);
    });
});

describe("the two column spaces", () => {
    it("round-trip through each other for every cell of a padded pane", () => {
        for (const spacers of [0, 1, 5]) {
            for (let col = 0; col < 8; col++) {
                expect(toModelCol(toGridCol(modelCol(col), spacers), spacers)).toBe(col);
            }
        }
    });

    it("name bare numbers without changing them", () => {
        expect(modelCol(7)).toBe(7);
        expect(gridCol(7)).toBe(7);
    });
});
