import { describe, expect, it } from "vitest";
import { liveCells, projectSheet, seedDoc, sheetWidth } from "../src/lib/collab/doc";
import { applyOp, type OpContext } from "../src/lib/collab/ops";
import { isRank, seedRank } from "../src/lib/collab/rank";
import { createClock } from "../src/lib/collab/stamp";
import { cellKey, type CollabDoc } from "../src/lib/collab/types";
import { emptyScouting, makeFlowSheet, type FlowRound, type FlowSheet } from "../src/lib/model/flow";

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

const round = (sheets: FlowSheet[]): FlowRound =>
    ({
        id: "r1",
        createdAt: 0,
        updatedAt: 0,
        event: "policy",
        firstSide: "aff",
        scouting: emptyScouting(),
        sheets,
    }) as FlowRound;

function setup(data: (string | null)[][] = []) {
    let now = 1000;
    const ctx: OpContext = { actor: "me", clock: createClock("me", () => (now += 1)) };
    const doc = seedDoc(round([sheet({ data })]));
    return { doc, ctx };
}

/** The sheet's grid as `projectSheet` writes it. */
const grid = (doc: CollabDoc, id = "s1") => projectSheet(doc.sheets[id]).data;

describe("cellText", () => {
    it("writes text into an existing cell", () => {
        const { doc, ctx } = setup([["a"]]);
        const next = applyOp(doc, { kind: "cellText", sheetId: "s1", col: 0, row: 0, text: "b" }, ctx);
        expect(grid(next)).toEqual([["b"]]);
    });

    it("stamps the write with the local actor", () => {
        const { doc, ctx } = setup([["a"]]);
        const next = applyOp(doc, { kind: "cellText", sheetId: "s1", col: 0, row: 0, text: "b" }, ctx);
        expect(next.sheets.s1.cells[cellKey(0, seedRank(0), "")].textStamp.actor).toBe("me");
    });

    it("grows the column to reach a row below the last stored one", () => {
        const { doc, ctx } = setup([["a"]]);
        const next = applyOp(doc, { kind: "cellText", sheetId: "s1", col: 0, row: 3, text: "d" }, ctx);
        expect(grid(next)).toEqual([["a"], [null], [null], ["d"]]);
    });

    it("gives every grown cell an orderable rank", () => {
        const { doc, ctx } = setup();
        const next = applyOp(doc, { kind: "cellText", sheetId: "s1", col: 0, row: 5, text: "x" }, ctx);
        expect(Object.values(next.sheets.s1.cells).every((c) => isRank(c.rank))).toBe(true);
    });

    it("credits the grown cells to the writing peer", () => {
        const { doc, ctx } = setup();
        const next = applyOp(doc, { kind: "cellText", sheetId: "s1", col: 0, row: 1, text: "x" }, ctx);
        expect(Object.values(next.sheets.s1.cells).every((c) => c.actor === "me")).toBe(true);
    });

    it("clears a cell when the text is null", () => {
        const { doc, ctx } = setup([["a"]]);
        const next = applyOp(doc, { kind: "cellText", sheetId: "s1", col: 0, row: 0, text: null }, ctx);
        expect(grid(next)).toEqual([[null]]);
    });

    it("writes into a column the sheet did not hold", () => {
        const { doc, ctx } = setup([["a"]]);
        const next = applyOp(doc, { kind: "cellText", sheetId: "s1", col: 2, row: 0, text: "c" }, ctx);
        expect(sheetWidth(next.sheets.s1)).toBe(3);
        expect(grid(next)).toEqual([["a", null, "c"]]);
    });

    it("never mutates the document it is given", () => {
        const { doc, ctx } = setup([["a"]]);
        const before = JSON.stringify(doc);
        applyOp(doc, { kind: "cellText", sheetId: "s1", col: 0, row: 0, text: "b" }, ctx);
        expect(JSON.stringify(doc)).toBe(before);
    });

    it("ignores an op naming a sheet the round does not hold", () => {
        const { doc, ctx } = setup([["a"]]);
        expect(applyOp(doc, { kind: "cellText", sheetId: "gone", col: 0, row: 0, text: "b" }, ctx)).toBe(
            doc,
        );
    });
});

describe("cellMeta", () => {
    it("replaces a cell's decoration wholesale", () => {
        const { doc, ctx } = setup([["a"]]);
        const next = applyOp(
            doc,
            { kind: "cellMeta", sheetId: "s1", col: 0, row: 0, meta: { bold: true, card: true } },
            ctx,
        );
        expect(projectSheet(next.sheets.s1).meta).toEqual({ "0,0": { bold: true, card: true } });
    });

    it("clears a decoration with an empty bag", () => {
        const { doc, ctx } = setup([["a"]]);
        const bold = applyOp(
            doc,
            { kind: "cellMeta", sheetId: "s1", col: 0, row: 0, meta: { bold: true } },
            ctx,
        );
        const cleared = applyOp(bold, { kind: "cellMeta", sheetId: "s1", col: 0, row: 0, meta: {} }, ctx);
        expect(projectSheet(cleared.sheets.s1).meta).toEqual({});
    });

    it("copies the decoration rather than aliasing the caller's object", () => {
        const { doc, ctx } = setup([["a"]]);
        const meta = { bold: true };
        const next = applyOp(doc, { kind: "cellMeta", sheetId: "s1", col: 0, row: 0, meta }, ctx);
        meta.bold = false;
        expect(next.sheets.s1.cells[cellKey(0, seedRank(0), "")].meta).toEqual({ bold: true });
    });

    it("leaves the cell's text alone", () => {
        const { doc, ctx } = setup([["a"]]);
        const next = applyOp(
            doc,
            { kind: "cellMeta", sheetId: "s1", col: 0, row: 0, meta: { bold: true } },
            ctx,
        );
        expect(grid(next)).toEqual([["a"]]);
    });
});

describe("insertCell", () => {
    it("opens a blank cell, pushing the column down", () => {
        const { doc, ctx } = setup([["a"], ["b"]]);
        const next = applyOp(doc, { kind: "insertCell", sheetId: "s1", col: 0, row: 1 }, ctx);
        expect(grid(next)).toEqual([["a"], [null], ["b"]]);
    });

    it("opens a cell at the top", () => {
        const { doc, ctx } = setup([["a"]]);
        const next = applyOp(doc, { kind: "insertCell", sheetId: "s1", col: 0, row: 0 }, ctx);
        expect(grid(next)).toEqual([[null], ["a"]]);
    });

    it("appends past the last stored row", () => {
        const { doc, ctx } = setup([["a"]]);
        const next = applyOp(doc, { kind: "insertCell", sheetId: "s1", col: 0, row: 1 }, ctx);
        expect(grid(next)).toEqual([["a"], [null]]);
    });

    it("touches no other column", () => {
        const { doc, ctx } = setup([["a", "x"], ["b", "y"]]);
        const next = applyOp(doc, { kind: "insertCell", sheetId: "s1", col: 0, row: 0 }, ctx);
        expect(liveCells(next.sheets.s1, 1).map((c) => c.text)).toEqual(["x", "y"]);
    });

    it("never reuses a rank a tombstone still holds", () => {
        const { doc, ctx } = setup([["a"], ["b"]]);
        const removed = applyOp(doc, { kind: "removeCell", sheetId: "s1", col: 0, row: 0 }, ctx);
        const inserted = applyOp(removed, { kind: "insertCell", sheetId: "s1", col: 0, row: 0 }, ctx);
        // The tombstone survives, and the new cell has a key of its own.
        expect(Object.keys(inserted.sheets.s1.cells)).toHaveLength(3);
        expect(inserted.sheets.s1.cells[cellKey(0, seedRank(0), "")].deleted).not.toBeNull();
        expect(grid(inserted)).toEqual([[null], ["b"]]);
    });

    it("finds room between two cells that already share a rank", () => {
        const { doc, ctx } = setup([["a"], ["b"]]);
        const twin = { ...doc.sheets.s1.cells[cellKey(0, seedRank(0), "")], actor: "peer" };
        doc.sheets.s1.cells[cellKey(0, seedRank(0), "peer")] = twin;
        const next = applyOp(doc, { kind: "insertCell", sheetId: "s1", col: 0, row: 1 }, ctx);
        expect(liveCells(next.sheets.s1, 0)).toHaveLength(4);
        expect(Object.values(next.sheets.s1.cells).every((c) => isRank(c.rank))).toBe(true);
    });
});

describe("removeCell", () => {
    it("closes the gap, pulling the column up", () => {
        const { doc, ctx } = setup([["a"], ["b"], ["c"]]);
        const next = applyOp(doc, { kind: "removeCell", sheetId: "s1", col: 0, row: 1 }, ctx);
        expect(grid(next)).toEqual([["a"], ["c"]]);
    });

    it("keeps the tombstone rather than dropping the key", () => {
        const { doc, ctx } = setup([["a"]]);
        const next = applyOp(doc, { kind: "removeCell", sheetId: "s1", col: 0, row: 0 }, ctx);
        expect(next.sheets.s1.cells[cellKey(0, seedRank(0), "")].deleted).not.toBeNull();
    });

    it("does nothing at a row the column does not hold", () => {
        const { doc, ctx } = setup([["a"]]);
        const next = applyOp(doc, { kind: "removeCell", sheetId: "s1", col: 0, row: 9 }, ctx);
        expect(grid(next)).toEqual([["a"]]);
    });

    it("touches no other column", () => {
        const { doc, ctx } = setup([["a", "x"], ["b", "y"]]);
        const next = applyOp(doc, { kind: "removeCell", sheetId: "s1", col: 0, row: 0 }, ctx);
        expect(liveCells(next.sheets.s1, 1).map((c) => c.text)).toEqual(["x", "y"]);
    });
});

describe("insertRow and removeRow", () => {
    it("opens a blank row across every column", () => {
        const { doc, ctx } = setup([["a", "x"], ["b", "y"]]);
        const next = applyOp(doc, { kind: "insertRow", sheetId: "s1", row: 1 }, ctx);
        expect(grid(next)).toEqual([["a", "x"], [null, null], ["b", "y"]]);
    });

    it("removes a row across every column, under one stamp", () => {
        const { doc, ctx } = setup([["a", "x"], ["b", "y"], ["c", "z"]]);
        const next = applyOp(doc, { kind: "removeRow", sheetId: "s1", row: 1 }, ctx);
        expect(grid(next)).toEqual([["a", "x"], ["c", "z"]]);
        const stamps = Object.values(next.sheets.s1.cells)
            .filter((c) => c.deleted)
            .map((c) => JSON.stringify(c.deleted));
        expect(new Set(stamps).size).toBe(1);
    });

    it("does nothing to a sheet with no columns yet", () => {
        const { doc, ctx } = setup();
        expect(grid(applyOp(doc, { kind: "insertRow", sheetId: "s1", row: 0 }, ctx))).toEqual([]);
    });

    it("undoes an insert with the matching remove", () => {
        const { doc, ctx } = setup([["a", "x"], ["b", "y"]]);
        const inserted = applyOp(doc, { kind: "insertRow", sheetId: "s1", row: 1 }, ctx);
        const removed = applyOp(inserted, { kind: "removeRow", sheetId: "s1", row: 1 }, ctx);
        expect(grid(removed)).toEqual([["a", "x"], ["b", "y"]]);
    });
});

describe("sheet and round ops", () => {
    it("adds a sheet, seeded from its own grid", () => {
        const { doc, ctx } = setup();
        const added = makeFlowSheet({ title: "2.", group: "neg", order: 1 });
        added.data = [["hi"]];
        const next = applyOp(doc, { kind: "addSheet", sheet: added }, ctx);
        expect(next.sheets[added.id].fields.title.value).toBe("2.");
        expect(grid(next, added.id)).toEqual([["hi"]]);
    });

    it("tombstones a sheet rather than dropping it", () => {
        const { doc, ctx } = setup();
        const next = applyOp(doc, { kind: "removeSheet", sheetId: "s1" }, ctx);
        expect(next.sheets.s1.deleted).not.toBeNull();
        expect(next.sheets.s1).toBeDefined();
    });

    it("writes a sheet register", () => {
        const { doc, ctx } = setup();
        const next = applyOp(
            doc,
            { kind: "sheetField", sheetId: "s1", path: "title", value: "Topicality" },
            ctx,
        );
        expect(projectSheet(next.sheets.s1).title).toBe("Topicality");
    });

    it("writes a round register", () => {
        const { doc, ctx } = setup();
        const next = applyOp(doc, { kind: "roundField", path: "event", value: "ld" }, ctx);
        expect(next.round.event.value).toBe("ld");
    });

    it("writes a nested round register as one leaf path", () => {
        const { doc, ctx } = setup();
        const next = applyOp(
            doc,
            { kind: "roundField", path: "scouting.aff.first.first", value: "Ada" },
            ctx,
        );
        expect(next.round["scouting.aff.first.first"].value).toBe("Ada");
    });

    it("ignores a sheet op naming a sheet the round does not hold", () => {
        const { doc, ctx } = setup();
        for (const op of [
            { kind: "removeSheet", sheetId: "gone" },
            { kind: "sheetField", sheetId: "gone", path: "title", value: "x" },
            { kind: "insertRow", sheetId: "gone", row: 0 },
        ] as const) {
            expect(applyOp(doc, op, ctx)).toBe(doc);
        }
    });

    it("raises the clock on every write, so no two ops share a stamp", () => {
        const { doc, ctx } = setup([["a"]]);
        const one = applyOp(doc, { kind: "roundField", path: "event", value: "ld" }, ctx);
        const two = applyOp(one, { kind: "roundField", path: "event", value: "pf" }, ctx);
        expect(two.round.event.stamp.ms).toBeGreaterThan(one.round.event.stamp.ms);
    });
});
