import { describe, expect, it } from "vitest";
import {
    liveCells,
    projectDoc,
    projectSheet,
    seedDoc,
    seedSheet,
    sheetWidth,
} from "../src/lib/collab/doc";
import { seedRank } from "../src/lib/collab/rank";
import { ORIGIN_STAMP, type Stamp } from "../src/lib/collab/stamp";
import { cellKey, type CollabSheet } from "../src/lib/collab/types";
import { emptyScouting, makeFlowRound, type FlowRound, type FlowSheet } from "../src/lib/model/flow";
import { serializeFlow } from "../src/lib/persistence/flowFile";

const sheet = (over: Partial<FlowSheet> = {}): FlowSheet => ({
    id: "s1",
    title: "1.",
    group: "aff",
    order: 0,
    kind: "flow",
    data: [],
    meta: {},
    ...over,
});

const round = (over: Partial<FlowRound> = {}): FlowRound =>
    ({
        id: "r1",
        createdAt: 100,
        updatedAt: 200,
        event: "policy",
        firstSide: "aff",
        scouting: emptyScouting(),
        sheets: [sheet()],
        ...over,
    }) as FlowRound;

const later: Stamp = { ms: 999, counter: 0, actor: "b" };

describe("seedSheet", () => {
    it("gives row i of every column the same rank, derived from i alone", () => {
        const s = seedSheet(sheet({ data: [["a", "b"], ["c", "d"]] }), ORIGIN_STAMP);
        expect(s.cells[cellKey(0, seedRank(0), "")].text).toBe("a");
        expect(s.cells[cellKey(1, seedRank(0), "")].text).toBe("b");
        expect(s.cells[cellKey(0, seedRank(1), "")].text).toBe("c");
    });

    it("credits every seeded cell to no actor", () => {
        const s = seedSheet(sheet({ data: [["a"]] }), ORIGIN_STAMP);
        expect(Object.values(s.cells).every((c) => c.actor === "")).toBe(true);
    });

    it("seeds the rectangle, so a short row gains empty cells", () => {
        const s = seedSheet(sheet({ data: [["a", "b"], ["c"]] }), ORIGIN_STAMP);
        expect(Object.keys(s.cells)).toHaveLength(4);
        expect(s.cells[cellKey(1, seedRank(1), "")].text).toBeNull();
    });

    it("stores every field but the grid as a register", () => {
        const s = seedSheet(sheet({ startSpeechId: "2ac" }), ORIGIN_STAMP);
        expect(Object.keys(s.fields).sort()).toEqual([
            "group",
            "kind",
            "order",
            "startSpeechId",
            "title",
        ]);
        expect(s.fields.title.value).toBe("1.");
    });

    it("keeps the sheet id out of the registers, since identity is not replicated", () => {
        const s = seedSheet(sheet(), ORIGIN_STAMP);
        expect(s.fields.id).toBeUndefined();
        expect(s.id).toBe("s1");
    });

    it("carries each cell's decoration into its meta bag", () => {
        const s = seedSheet(sheet({ data: [["a"]], meta: { "0,0": { bold: true } } }), ORIGIN_STAMP);
        expect(s.cells[cellKey(0, seedRank(0), "")].meta).toEqual({ bold: true });
    });

    it("copies the decoration rather than aliasing the sheet's own object", () => {
        const meta = { bold: true };
        const s = seedSheet(sheet({ data: [["a"]], meta: { "0,0": meta } }), ORIGIN_STAMP);
        meta.bold = false;
        expect(s.cells[cellKey(0, seedRank(0), "")].meta).toEqual({ bold: true });
    });

    it("is a pure function of the sheet, so two peers derive the same replica", () => {
        const s = sheet({ data: [["a", null], ["b", "c"]], meta: { "1,1": { card: true } } });
        expect(seedSheet(s, ORIGIN_STAMP)).toEqual(seedSheet(s, ORIGIN_STAMP));
    });

    it("seeds an empty sheet with no cells", () => {
        expect(seedSheet(sheet(), ORIGIN_STAMP).cells).toEqual({});
    });
});

describe("seedDoc", () => {
    it("keeps the round's own bookkeeping out of the replicated registers", () => {
        const doc = seedDoc(round());
        for (const local of ["id", "createdAt", "updatedAt", "sheets"]) {
            expect(doc.round[local]).toBeUndefined();
        }
        expect(doc.roundId).toBe("r1");
    });

    it("stores the event and the flip as registers", () => {
        const doc = seedDoc(round({ event: "pf", firstSide: "neg" }));
        expect(doc.round.event.value).toBe("pf");
        expect(doc.round.firstSide.value).toBe("neg");
    });

    it("flattens scouting into one register per leaf", () => {
        const doc = seedDoc(round());
        expect(doc.round["scouting.aff.first.first"].value).toBe("");
    });

    it("stamps every seeded register at the origin", () => {
        const doc = seedDoc(round());
        expect(Object.values(doc.round).every((r) => r.stamp === ORIGIN_STAMP)).toBe(true);
    });

    it("keys the sheets by id", () => {
        const doc = seedDoc(round({ sheets: [sheet({ id: "a" }), sheet({ id: "b" })] }));
        expect(Object.keys(doc.sheets).sort()).toEqual(["a", "b"]);
    });

    it("is a pure function, so two peers opening one file merge rather than duplicate", () => {
        const r = makeFlowRound({ event: "ld" });
        expect(seedDoc(r)).toEqual(seedDoc(r));
    });
});

describe("liveCells", () => {
    const withCells = (cells: CollabSheet["cells"]): CollabSheet => ({
        id: "s1",
        fields: {},
        deleted: null,
        cells,
    });

    it("returns one column's cells in row order", () => {
        const s = seedSheet(sheet({ data: [["a"], ["b"], ["c"]] }), ORIGIN_STAMP);
        expect(liveCells(s, 0).map((c) => c.text)).toEqual(["a", "b", "c"]);
    });

    it("keeps the columns apart", () => {
        const s = seedSheet(sheet({ data: [["a", "x"], ["b", "y"]] }), ORIGIN_STAMP);
        expect(liveCells(s, 1).map((c) => c.text)).toEqual(["x", "y"]);
    });

    it("leaves out tombstoned cells", () => {
        const s = seedSheet(sheet({ data: [["a"], ["b"]] }), ORIGIN_STAMP);
        s.cells[cellKey(0, seedRank(0), "")].deleted = later;
        expect(liveCells(s, 0).map((c) => c.text)).toEqual(["b"]);
    });

    it("is empty for a column the sheet does not hold", () => {
        expect(liveCells(seedSheet(sheet({ data: [["a"]] }), ORIGIN_STAMP), 4)).toEqual([]);
        expect(liveCells(withCells({}), 0)).toEqual([]);
    });

    it("orders two peers' concurrent inserts identically on both", () => {
        const s = seedSheet(sheet({ data: [["a"]] }), ORIGIN_STAMP);
        const base = s.cells[cellKey(0, seedRank(0), "")];
        for (const actor of ["b", "a"]) {
            s.cells[cellKey(0, "Z", actor)] = { ...base, rank: "Z", actor, text: actor };
        }
        expect(liveCells(s, 0).map((c) => c.actor)).toEqual(["", "a", "b"]);
    });
});

describe("sheetWidth", () => {
    it("is one past the highest column the sheet holds a cell in", () => {
        expect(sheetWidth(seedSheet(sheet({ data: [["a", "b", "c"]] }), ORIGIN_STAMP))).toBe(3);
    });

    it("is zero for a sheet with no cells", () => {
        expect(sheetWidth(seedSheet(sheet(), ORIGIN_STAMP))).toBe(0);
    });

    it("ignores a column index no flow sheet can hold", () => {
        const s = seedSheet(sheet({ data: [["a"]] }), ORIGIN_STAMP);
        const base = s.cells[cellKey(0, seedRank(0), "")];
        s.cells[cellKey(9999, "1", "b")] = { ...base, col: 9999 };
        s.cells[cellKey(-1, "1", "b")] = { ...base, col: -1 };
        s.cells[cellKey(1.5, "1", "b")] = { ...base, col: 1.5 };
        expect(sheetWidth(s)).toBe(1);
    });

    it("counts a tombstoned cell's column, since the grid still pads to it", () => {
        const s = seedSheet(sheet({ data: [["a", "b"]] }), ORIGIN_STAMP);
        s.cells[cellKey(1, seedRank(0), "")].deleted = later;
        expect(sheetWidth(s)).toBe(2);
    });
});

describe("projectSheet", () => {
    it("is inverse to seedSheet", () => {
        const s = sheet({ data: [["a", null], ["b", "c"]], meta: { "1,1": { card: true } } });
        expect(projectSheet(seedSheet(s, ORIGIN_STAMP))).toEqual(s);
    });

    it("closes the gap a tombstone leaves, so the rows below move up", () => {
        const s = seedSheet(sheet({ data: [["a"], ["b"], ["c"]] }), ORIGIN_STAMP);
        s.cells[cellKey(0, seedRank(1), "")].deleted = later;
        expect(projectSheet(s).data).toEqual([["a"], ["c"]]);
    });

    it("falls back to a blank title for a register the file cannot hold", () => {
        const s = seedSheet(sheet(), ORIGIN_STAMP);
        s.fields.title = { value: 7, stamp: later };
        expect(projectSheet(s).title).toBe("");
    });

    it("falls back to aff for a group a peer wrote that is not a side", () => {
        const s = seedSheet(sheet({ group: "neg" }), ORIGIN_STAMP);
        expect(projectSheet(s).group).toBe("neg");
        s.fields.group = { value: "middle", stamp: later };
        expect(projectSheet(s).group).toBe("aff");
    });

    it("falls back to order zero for an order that is not a finite number", () => {
        const s = seedSheet(sheet(), ORIGIN_STAMP);
        s.fields.order = { value: "third", stamp: later };
        expect(projectSheet(s).order).toBe(0);
    });

    it("falls back to a flow sheet for a kind this build does not know", () => {
        const s = seedSheet(sheet({ kind: "cx" }), ORIGIN_STAMP);
        expect(projectSheet(s).kind).toBe("cx");
        s.fields.kind = { value: "outline", stamp: later };
        expect(projectSheet(s).kind).toBe("flow");
    });

    it("drops a leftmost-speech register that is not text", () => {
        const s = seedSheet(sheet(), ORIGIN_STAMP);
        s.fields.startSpeechId = { value: 3, stamp: later };
        expect("startSpeechId" in projectSheet(s)).toBe(false);
    });

    it("drops a decoration the file cannot hold rather than writing it", () => {
        const s = seedSheet(sheet({ data: [["a"]] }), ORIGIN_STAMP);
        s.cells[cellKey(0, seedRank(0), "")].meta = { bold: "yes" };
        expect(projectSheet(s).meta).toEqual({});
    });

    it("keeps a text cell whose neighbours are empty", () => {
        const s = seedSheet(sheet({ data: [[null, "b"]] }), ORIGIN_STAMP);
        expect(projectSheet(s).data).toEqual([[null, "b"]]);
    });

    it("takes rows off the bottom when the cell budget cannot hold them all", () => {
        const s = seedSheet(
            sheet({ data: [["a", "x"], ["b", "y"], ["c", "z"]] }),
            ORIGIN_STAMP,
        );
        expect(projectSheet(s, 4).data).toEqual([["a", "x"], ["b", "y"]]);
    });

    it("takes rows off the bottom when the byte budget cannot hold them all", () => {
        const rows = Array.from({ length: 40 }, (_, i) => [`row ${i}`]);
        const s = seedSheet(sheet({ data: rows }), ORIGIN_STAMP);
        const projected = projectSheet(s, 1_000_000, 400);
        expect(projected.data.length).toBeGreaterThan(0);
        expect(projected.data.length).toBeLessThan(40);
        expect(projected.data[0]).toEqual(["row 0"]);
    });

    it("keeps whole rows, never half of one", () => {
        const rows = Array.from({ length: 20 }, (_, i) => [`a${i}`, `b${i}`]);
        const s = seedSheet(sheet({ data: rows }), ORIGIN_STAMP);
        const projected = projectSheet(s, 1_000_000, 500);
        expect(projected.data.every((row) => row.length === 2)).toBe(true);
    });

    it("spends the cheapest registers first when the shape does not fit", () => {
        const s = seedSheet(sheet({ title: "x".repeat(500) }), ORIGIN_STAMP);
        const projected = projectSheet(s, 1_000_000, 200);
        // The long title is dropped; the short registers survive.
        expect(projected.title).toBe("");
        expect(projected.group).toBe("aff");
    });
});

describe("projectDoc", () => {
    it("is inverse to seedDoc", () => {
        const r = round({
            sheets: [sheet({ data: [["a"]] }), sheet({ id: "s2", order: 1, title: "2." })],
        });
        expect(projectDoc(seedDoc(r), r)).toEqual(r);
    });

    it("takes the creation and update time from the base, never from a partner's clock", () => {
        const r = round();
        const projected = projectDoc(seedDoc(r), { ...r, createdAt: 5, updatedAt: 9 });
        expect(projected.createdAt).toBe(5);
        expect(projected.updatedAt).toBe(9);
    });

    it("takes the round id from the document", () => {
        expect(projectDoc(seedDoc(round()), round({ id: "other" })).id).toBe("r1");
    });

    it("falls back to policy for an event register this build does not know", () => {
        const doc = seedDoc(round());
        doc.round.event = { value: "wsdc", stamp: later };
        expect(projectDoc(doc, round()).event).toBe("policy");
    });

    it("falls back to aff for a first side that names no side", () => {
        const doc = seedDoc(round());
        doc.round.firstSide = { value: "both", stamp: later };
        expect(projectDoc(doc, round()).firstSide).toBe("aff");
    });

    it("falls back to empty scouting the file can hold", () => {
        const doc = seedDoc(round());
        doc.round["scouting.aff.first.first"] = { value: 7, stamp: later };
        expect(projectDoc(doc, round()).scouting).toEqual(emptyScouting());
    });

    it("leaves out a deleted sheet", () => {
        const r = round({ sheets: [sheet({ id: "a" }), sheet({ id: "b", order: 1 })] });
        const doc = seedDoc(r);
        doc.sheets.b.deleted = later;
        expect(projectDoc(doc, r).sheets.map((s) => s.id)).toEqual(["a"]);
    });

    it("returns the sheets in display order", () => {
        const r = round({
            sheets: [
                sheet({ id: "b", order: 2 }),
                sheet({ id: "cx", order: -1, kind: "cx" }),
                sheet({ id: "a", order: 1 }),
            ],
        });
        expect(projectDoc(seedDoc(r), r).sheets.map((s) => s.id)).toEqual(["cx", "a", "b"]);
    });

    it("reuses the copy already projected for a sheet the merge did not touch", () => {
        const r = round({ sheets: [sheet({ data: [["a"]] })] });
        const doc = seedDoc(r);
        const first = projectDoc(doc, r);
        const second = projectDoc(doc, first, doc);
        expect(second.sheets[0]).toBe(first.sheets[0]);
    });

    it("re-derives a sheet the merge replaced", () => {
        const r = round({ sheets: [sheet({ data: [["a"]] })] });
        const doc = seedDoc(r);
        const first = projectDoc(doc, r);
        const next = { ...doc, sheets: { s1: { ...doc.sheets.s1 } } };
        const second = projectDoc(next, first, doc);
        expect(second.sheets[0]).not.toBe(first.sheets[0]);
        expect(second.sheets[0]).toEqual(first.sheets[0]);
    });

    it("writes a round the file format can read back", () => {
        const r = makeFlowRound({ event: "pf", firstSide: "neg" });
        r.sheets[1].data = [["a", "b"]];
        expect(() => serializeFlow(projectDoc(seedDoc(r), r))).not.toThrow();
    });

    it("survives a round with no sheets at all", () => {
        const r = round({ sheets: [] });
        expect(projectDoc(seedDoc(r), r).sheets).toEqual([]);
    });
});
