import { describe, expect, it } from "vitest";
import {
    BOLD_CLASS,
    CARD_CLASS,
    GROUP_CLASS,
    HIGHLIGHT_CLASS,
    KICKED_CLASS,
    MAX_GRID_WIDTH,
    classNameToMeta,
    gridWidth,
    metaToClassName,
    padGrid,
    toggleClassToken,
    trimGrid,
    widestRow,
} from "../src/lib/grid/codec";

describe("class name codec", () => {
    it("round-trips every decoration", () => {
        const meta = { bold: true, highlight: true, card: true, group: true, kicked: true };
        const cls = metaToClassName(meta);
        expect(cls).toBe(
            [BOLD_CLASS, HIGHLIGHT_CLASS, CARD_CLASS, GROUP_CLASS, KICKED_CLASS].join(" "),
        );
        expect(classNameToMeta(cls)).toEqual(meta);
    });

    it("writes nothing for missing or false flags", () => {
        expect(metaToClassName(undefined)).toBe("");
        expect(metaToClassName({ bold: false })).toBe("");
    });

    it("reads no meta from unrelated classes", () => {
        expect(classNameToMeta("")).toBeUndefined();
        expect(classNameToMeta("htCenter other")).toBeUndefined();
        expect(classNameToMeta(`htCenter  ${BOLD_CLASS}`)).toEqual({ bold: true });
    });

    it("toggles a token on and off", () => {
        expect(toggleClassToken("", BOLD_CLASS)).toBe(BOLD_CLASS);
        expect(toggleClassToken(`a ${BOLD_CLASS} b`, BOLD_CLASS)).toBe("a b");
        expect(toggleClassToken("  a  ", "b")).toBe("a b");
    });
});

describe("grid shape helpers", () => {
    it("trims trailing empty rows only", () => {
        expect(trimGrid([["a"], [null, ""], ["b"], [""], [null]])).toEqual([
            ["a"],
            [null, ""],
            ["b"],
        ]);
        expect(trimGrid([[null], [""]])).toEqual([]);
    });

    it("measures the widest row", () => {
        expect(widestRow([])).toBe(0);
        expect(widestRow([["a"], ["a", "b", "c"], []])).toBe(3);
    });

    it("sizes the grid to the wider of columns and data, capped", () => {
        expect(gridWidth([1, 2, 3], [["a"]])).toBe(3);
        expect(gridWidth([1], [["a", "b", "c", "d"]])).toBe(4);
        const huge = [new Array(MAX_GRID_WIDTH + 50).fill("x")];
        expect(gridWidth([], huge)).toBe(MAX_GRID_WIDTH);
    });

    it("pads to rows x cols with leading inert columns", () => {
        expect(padGrid([["a", "b"], ["c"]], 3, 3, 1)).toEqual([
            [null, "a", "b", null],
            [null, "c", null, null],
            [null, null, null, null],
        ]);
        expect(padGrid([["a"], ["b"]], 1, 0)).toEqual([["a"], ["b"]]);
    });
});
