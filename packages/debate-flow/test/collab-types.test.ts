import { describe, expect, it } from "vitest";
import {
    cellKey,
    compareCells,
    flattenLeaves,
    isRole,
    setPath,
    type CollabCell,
    type Json,
} from "../src/lib/collab/types";
import { ORIGIN_STAMP } from "../src/lib/collab/stamp";

const cell = (over: Partial<CollabCell> = {}): CollabCell => ({
    col: 0,
    rank: "100001",
    actor: "",
    text: null,
    textStamp: ORIGIN_STAMP,
    meta: {},
    metaStamp: ORIGIN_STAMP,
    deleted: null,
    ...over,
});

describe("isRole", () => {
    it("accepts the two roles a round grants", () => {
        expect(isRole("editor")).toBe(true);
        expect(isRole("viewer")).toBe(true);
    });

    it("rejects anything else off the wire", () => {
        expect(isRole("owner")).toBe(false);
        expect(isRole("")).toBe(false);
        expect(isRole(null)).toBe(false);
        expect(isRole(undefined)).toBe(false);
        expect(isRole({ role: "editor" })).toBe(false);
    });
});

describe("cellKey", () => {
    it("identifies a cell by its column, rank and creator", () => {
        expect(cellKey(2, "100001", "peer-a")).toBe("2|100001|peer-a");
    });

    it("distinguishes two peers inserting at the same rank", () => {
        expect(cellKey(0, "1", "a")).not.toBe(cellKey(0, "1", "b"));
    });

    it("marks a cell seeded from the file with no actor", () => {
        expect(cellKey(0, "100001", "")).toBe("0|100001|");
    });
});

describe("compareCells", () => {
    it("orders by rank inside a column", () => {
        expect(compareCells(cell({ rank: "1" }), cell({ rank: "2" }))).toBe(-1);
        expect(compareCells(cell({ rank: "2" }), cell({ rank: "1" }))).toBe(1);
    });

    it("breaks a rank tie by creator, so two peers agree on the order", () => {
        expect(compareCells(cell({ rank: "1", actor: "a" }), cell({ rank: "1", actor: "b" }))).toBe(
            -1,
        );
        expect(compareCells(cell({ rank: "1", actor: "b" }), cell({ rank: "1", actor: "a" }))).toBe(
            1,
        );
        expect(compareCells(cell({ rank: "1", actor: "a" }), cell({ rank: "1", actor: "a" }))).toBe(
            0,
        );
    });

    it("sorts a column deterministically whatever order it is walked in", () => {
        const cells = [
            cell({ rank: "3", actor: "b" }),
            cell({ rank: "1", actor: "b" }),
            cell({ rank: "1", actor: "a" }),
        ];
        const forward = [...cells].sort(compareCells);
        const backward = [...cells].reverse().sort(compareCells);
        expect(forward).toEqual(backward);
        expect(forward.map((c) => `${c.rank}${c.actor}`)).toEqual(["1a", "1b", "3b"]);
    });
});

describe("flattenLeaves", () => {
    const flatten = (value: unknown, prefix = "") => {
        const out: Record<string, Json> = {};
        flattenLeaves(value, prefix, out);
        return out;
    };

    it("walks a nested object into dotted paths", () => {
        expect(flatten({ aff: { first: { first: "Ada" } } })).toEqual({
            "aff.first.first": "Ada",
        });
    });

    it("treats a scalar as a leaf", () => {
        expect(flatten("policy", "event")).toEqual({ event: "policy" });
        expect(flatten(3, "order")).toEqual({ order: 3 });
        expect(flatten(true, "bold")).toEqual({ bold: true });
    });

    it("treats null as a leaf rather than descending into it", () => {
        expect(flatten({ decision: null })).toEqual({ decision: null });
    });

    it("treats an array as a leaf, not as an object to walk", () => {
        expect(flatten({ tags: ["a", "b"] })).toEqual({ tags: ["a", "b"] });
    });

    it("skips an undefined leaf, so an absent optional field stays absent", () => {
        expect(flatten({ startSpeechId: undefined, title: "1." })).toEqual({ title: "1." });
    });

    it("writes an empty object as no leaves at all", () => {
        expect(flatten({ scouting: {} })).toEqual({});
    });

    it("prefixes nothing at the root", () => {
        expect(flatten({ a: 1 })).toEqual({ a: 1 });
    });
});

describe("setPath", () => {
    it("writes a leaf at a single-segment path", () => {
        const out: Record<string, unknown> = {};
        setPath(out, "event", "pf");
        expect(out).toEqual({ event: "pf" });
    });

    it("creates the objects along a nested path", () => {
        const out: Record<string, unknown> = {};
        setPath(out, "aff.first.last", "Lovelace");
        expect(out).toEqual({ aff: { first: { last: "Lovelace" } } });
    });

    it("merges into an object already on the path", () => {
        const out: Record<string, unknown> = { aff: { first: { first: "Ada" } } };
        setPath(out, "aff.first.last", "Lovelace");
        expect(out).toEqual({ aff: { first: { first: "Ada", last: "Lovelace" } } });
    });

    it("replaces a scalar standing where a path has to descend", () => {
        const out: Record<string, unknown> = { aff: "team" };
        setPath(out, "aff.first", 1);
        expect(out).toEqual({ aff: { first: 1 } });
    });

    it("replaces an array standing where a path has to descend", () => {
        const out: Record<string, unknown> = { aff: [1, 2] };
        setPath(out, "aff.first", 1);
        expect(out).toEqual({ aff: { first: 1 } });
    });

    it("is inverse to flattenLeaves for a whole round's scouting", () => {
        const scouting = { aff: { first: { first: "Ada", last: "L" } }, tournament: "Berkeley" };
        const leaves: Record<string, Json> = {};
        flattenLeaves(scouting, "", leaves);
        const back: Record<string, unknown> = {};
        for (const [path, value] of Object.entries(leaves)) setPath(back, path, value);
        expect(back).toEqual(scouting);
    });

    it("writes nothing for a path reaching the prototype chain", () => {
        const out: Record<string, unknown> = {};
        setPath(out, "__proto__.polluted", true);
        setPath(out, "a.constructor.x", true);
        setPath(out, "prototype", true);
        expect(out).toEqual({});
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it("leaves Object.prototype clean after a hostile path", () => {
        const out: Record<string, unknown> = {};
        setPath(out, "constructor.prototype.pwned", 1);
        expect((Object.prototype as unknown as Record<string, unknown>).pwned).toBeUndefined();
    });
});
