import { describe, expect, it } from "vitest";
import { hashText, sheetDigest } from "../src/lib/collab/hash";
import type { CellMeta } from "../src/lib/model/flow";

const digest = (data: (string | null)[][], meta: Record<string, CellMeta> = {}) =>
    sheetDigest(data, meta);

describe("hashText", () => {
    it("is stable for the same text", () => {
        expect(hashText("extend warming")).toBe(hashText("extend warming"));
    });

    it("differs for different text", () => {
        expect(hashText("a")).not.toBe(hashText("b"));
    });

    it("is always eight hex characters", () => {
        for (const text of ["", "a", "x".repeat(1000), "中文"]) {
            expect(hashText(text)).toMatch(/^[0-9a-f]{8}$/);
        }
    });
});

describe("sheetDigest", () => {
    it("is stable for the same sheet", () => {
        expect(digest([["a", "b"], ["c", null]])).toBe(digest([["a", "b"], ["c", null]]));
    });

    it("reads a ragged sheet and its padded rectangle as the same content", () => {
        expect(digest([["a", "b"], ["c"]])).toBe(digest([["a", "b"], ["c", null]]));
    });

    it("reads a null cell and an empty one as the same", () => {
        expect(digest([["a", null]])).toBe(digest([["a", ""]]));
    });

    it("ignores trailing empty rows, which are padding", () => {
        expect(digest([["a"]])).toBe(digest([["a"], [null], [""]]));
    });

    it("ignores trailing empty columns, which are padding too", () => {
        expect(digest([["a"]])).toBe(digest([["a", null, ""]]));
    });

    it("does not ignore an empty cell between two filled ones", () => {
        expect(digest([["a", null, "b"]])).not.toBe(digest([["a", "b"]]));
    });

    it("changes when a cell's text changes", () => {
        expect(digest([["a"]])).not.toBe(digest([["b"]]));
    });

    it("cannot be forged by text that runs two cells together", () => {
        // Length-prefixed cells: "ab" in one cell is not "a" and "b" in two.
        expect(digest([["ab"]])).not.toBe(digest([["a", "b"]]));
        expect(digest([["ab", ""]])).not.toBe(digest([["a", "b"]]));
    });

    it("is independent of the decoration map's key order", () => {
        const a = digest([["x", "y"]], { "0,0": { bold: true }, "0,1": { card: true } });
        const b = digest([["x", "y"]], { "0,1": { card: true }, "0,0": { bold: true } });
        expect(a).toBe(b);
    });

    it("is independent of the key order inside one decoration", () => {
        const a = digest([["x"]], { "0,0": { bold: true, card: true } });
        const b = digest([["x"]], { "0,0": { card: true, bold: true } as CellMeta });
        expect(a).toBe(b);
    });

    it("changes when a decoration changes", () => {
        expect(digest([["x"]], { "0,0": { bold: true } })).not.toBe(
            digest([["x"]], { "0,0": { bold: false } }),
        );
        expect(digest([["x"]])).not.toBe(digest([["x"]], { "0,0": { bold: true } }));
    });

    it("ignores an empty decoration entry, which is not an entry", () => {
        expect(digest([["x"]])).toBe(digest([["x"]], { "0,0": {} }));
    });

    it("ignores a decoration outside the sheet's content", () => {
        expect(digest([["x"]])).toBe(digest([["x"]], { "9,9": { bold: true } }));
    });

    it("reads two empty sheets alike however they are padded", () => {
        expect(digest([])).toBe(digest([[null, null], [null]]));
    });
});
