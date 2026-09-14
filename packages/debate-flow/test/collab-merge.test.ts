import { describe, expect, it } from "vitest";
import { merge } from "../src/lib/collab/merge";
import { seedRank } from "../src/lib/collab/rank";
import { ORIGIN_STAMP, type Stamp } from "../src/lib/collab/stamp";
import { cellKey, type CollabCell, type CollabDoc, type CollabSheet } from "../src/lib/collab/types";

const at = (ms: number, actor = "a"): Stamp => ({ ms, counter: 0, actor });

const cell = (over: Partial<CollabCell> = {}): CollabCell => ({
    col: 0,
    rank: seedRank(0),
    actor: "",
    text: null,
    textStamp: ORIGIN_STAMP,
    meta: {},
    metaStamp: ORIGIN_STAMP,
    deleted: null,
    ...over,
});

const sheet = (cells: Record<string, CollabCell> = {}, over: Partial<CollabSheet> = {}) =>
    ({ id: "s1", fields: {}, deleted: null, cells, ...over }) as CollabSheet;

const doc = (sheets: Record<string, CollabSheet> = {}, round = {}): CollabDoc => ({
    roundId: "r1",
    round,
    sheets,
});

const key0 = cellKey(0, seedRank(0), "");

describe("merge of registers", () => {
    it("keeps the later write", () => {
        const local = doc({}, { event: { value: "policy", stamp: at(1) } });
        const incoming = doc({}, { event: { value: "pf", stamp: at(2) } });
        expect(merge(local, incoming).doc.round.event.value).toBe("pf");
    });

    it("keeps the local write when it is the later one", () => {
        const local = doc({}, { event: { value: "policy", stamp: at(5) } });
        const incoming = doc({}, { event: { value: "pf", stamp: at(2) } });
        expect(merge(local, incoming).doc.round.event.value).toBe("policy");
    });

    it("breaks a simultaneous tie the same way on both peers", () => {
        const local = doc({}, { event: { value: "policy", stamp: at(5, "a") } });
        const incoming = doc({}, { event: { value: "pf", stamp: at(5, "b") } });
        expect(merge(local, incoming).doc.round.event.value).toBe("pf");
        expect(merge(incoming, local).doc.round.event.value).toBe("pf");
    });

    it("takes a path the far side has and this one does not", () => {
        const local = doc({}, { event: { value: "policy", stamp: at(1) } });
        const incoming = doc({}, { firstSide: { value: "neg", stamp: at(1) } });
        expect(Object.keys(merge(local, incoming).doc.round).sort()).toEqual([
            "event",
            "firstSide",
        ]);
    });

    it("forwards a path this build does not know, so a newer build still reads it", () => {
        const incoming = doc({}, { theme: { value: "dark", stamp: at(1) } });
        expect(merge(doc(), incoming).doc.round.theme.value).toBe("dark");
    });

    it("keeps the round id of the local replica", () => {
        const incoming = { ...doc(), roundId: "other" };
        expect(merge(doc(), incoming).doc.roundId).toBe("r1");
    });

    it("stops taking new paths past the register ceiling", () => {
        const many: Record<string, { value: string; stamp: Stamp }> = {};
        for (let i = 0; i < 5000; i++) many[`p${i}`] = { value: "x", stamp: at(1) };
        const merged = merge(doc(), doc({}, many)).doc;
        expect(Object.keys(merged.round)).toHaveLength(4096);
    });

    it("still merges a path this replica already holds once it has stopped growing", () => {
        const many: Record<string, { value: string; stamp: Stamp }> = {};
        for (let i = 0; i < 4096; i++) many[`p${i}`] = { value: "old", stamp: at(1) };
        const local = doc({}, { ...many });
        const incoming = doc({}, { p0: { value: "new", stamp: at(9) } });
        expect(merge(local, incoming).doc.round.p0.value).toBe("new");
    });
});

describe("merge of cells", () => {
    it("keeps the later text", () => {
        const local = doc({ s1: sheet({ [key0]: cell({ text: "old", textStamp: at(1) }) }) });
        const incoming = doc({ s1: sheet({ [key0]: cell({ text: "new", textStamp: at(2) }) }) });
        expect(merge(local, incoming).doc.sheets.s1.cells[key0].text).toBe("new");
    });

    it("stamps text and decoration apart, so a bold toggle never reverts typing", () => {
        const local = doc({
            s1: sheet({ [key0]: cell({ text: "typed", textStamp: at(5), metaStamp: at(1) }) }),
        });
        const incoming = doc({
            s1: sheet({
                [key0]: cell({ text: "stale", textStamp: at(2), meta: { bold: true }, metaStamp: at(9) }),
            }),
        });
        const merged = merge(local, incoming).doc.sheets.s1.cells[key0];
        expect(merged.text).toBe("typed");
        expect(merged.meta).toEqual({ bold: true });
    });

    it("lets a delete win over a later write", () => {
        const local = doc({ s1: sheet({ [key0]: cell({ text: "typed", textStamp: at(9) }) }) });
        const incoming = doc({ s1: sheet({ [key0]: cell({ deleted: at(1) }) }) });
        expect(merge(local, incoming).doc.sheets.s1.cells[key0].deleted).toEqual(at(1));
    });

    it("settles two concurrent deletes on the first of them, on both peers", () => {
        const local = doc({ s1: sheet({ [key0]: cell({ deleted: at(5, "a") }) }) });
        const incoming = doc({ s1: sheet({ [key0]: cell({ deleted: at(2, "b") }) }) });
        expect(merge(local, incoming).doc.sheets.s1.cells[key0].deleted).toEqual(at(2, "b"));
        expect(merge(incoming, local).doc.sheets.s1.cells[key0].deleted).toEqual(at(2, "b"));
    });

    it("takes a cell the far side has and this one does not", () => {
        const remote = cellKey(1, seedRank(3), "b");
        const incoming = doc({ s1: sheet({ [remote]: cell({ col: 1, rank: seedRank(3), actor: "b" }) }) });
        expect(merge(doc({ s1: sheet() }), incoming).doc.sheets.s1.cells[remote]).toBeDefined();
    });

    it("refuses a cell whose rank this build cannot order", () => {
        const bad = cellKey(0, "100010", "b");
        const incoming = doc({ s1: sheet({ [bad]: cell({ rank: "100010", actor: "b" }) }) });
        expect(merge(doc({ s1: sheet() }), incoming).doc.sheets.s1.cells[bad]).toBeUndefined();
    });

    it("is order-independent, so a replay or a restart is harmless", () => {
        const local = doc({ s1: sheet({ [key0]: cell({ text: "a", textStamp: at(3) }) }) });
        const incoming = doc({ s1: sheet({ [key0]: cell({ text: "b", textStamp: at(7) }) }) });
        expect(merge(local, incoming).doc).toEqual(merge(incoming, local).doc);
    });

    it("is idempotent, so a replayed message changes nothing", () => {
        const local = doc({ s1: sheet({ [key0]: cell({ text: "a", textStamp: at(3) }) }) });
        const incoming = doc({ s1: sheet({ [key0]: cell({ text: "b", textStamp: at(7) }) }) });
        const once = merge(local, incoming).doc;
        expect(merge(once, incoming).doc).toEqual(once);
    });
});

describe("merge of sheets", () => {
    it("takes a sheet the far side has and this one does not", () => {
        const incoming = doc({ s2: sheet({}, { id: "s2" }) });
        expect(Object.keys(merge(doc({ s1: sheet() }), incoming).doc.sheets).sort()).toEqual([
            "s1",
            "s2",
        ]);
    });

    it("names a sheet by the key it arrived under, not by the id inside it", () => {
        const incoming = doc({ s2: sheet({}, { id: "lying" }) });
        expect(merge(doc(), incoming).doc.sheets.s2.id).toBe("s2");
    });

    it("lets a sheet delete win, settled on the first of two", () => {
        const local = doc({ s1: sheet({}, { deleted: at(8) }) });
        const incoming = doc({ s1: sheet({}, { deleted: at(3) }) });
        expect(merge(local, incoming).doc.sheets.s1.deleted).toEqual(at(3));
    });

    it("merges a sheet's registers", () => {
        const local = doc({ s1: sheet({}, { fields: { title: { value: "1.", stamp: at(1) } } }) });
        const incoming = doc({
            s1: sheet({}, { fields: { title: { value: "2.", stamp: at(4) } } }),
        });
        expect(merge(local, incoming).doc.sheets.s1.fields.title.value).toBe("2.");
    });

    it("stops taking new sheets past the sheet ceiling", () => {
        const many: Record<string, CollabSheet> = {};
        for (let i = 0; i < 600; i++) many[`s${i}`] = sheet({}, { id: `s${i}` });
        expect(Object.keys(merge(doc(), doc(many)).doc.sheets)).toHaveLength(512);
    });

    it("stops taking new cells past the cell ceiling", () => {
        const cells: Record<string, CollabCell> = {};
        for (let i = 0; i < 200_050; i++) {
            const rank = seedRank(i);
            cells[cellKey(0, rank, "b")] = cell({ rank, actor: "b" });
        }
        const merged = merge(doc({ s1: sheet() }), doc({ s1: sheet(cells) })).doc;
        expect(Object.keys(merged.sheets.s1.cells)).toHaveLength(200_000);
    });
});

describe("the cells a delete discards", () => {
    it("reports text this replica held alive that the merge buried", () => {
        const local = doc({ s1: sheet({ [key0]: cell({ text: "extend warming", textStamp: at(1, "a") }) }) });
        const incoming = doc({ s1: sheet({ [key0]: cell({ deleted: at(2, "b") }) }) });
        expect(merge(local, incoming).dropped).toEqual([
            {
                sheetId: "s1",
                col: 0,
                rank: seedRank(0),
                text: "extend warming",
                writtenBy: "a",
                deletedBy: "b",
            },
        ]);
    });

    it("reports nothing for a cell that was already dead here", () => {
        const local = doc({ s1: sheet({ [key0]: cell({ text: "gone", deleted: at(1) }) }) });
        const incoming = doc({ s1: sheet({ [key0]: cell({ deleted: at(2) }) }) });
        expect(merge(local, incoming).dropped).toEqual([]);
    });

    it("reports nothing for an empty cell, which is no loss to see", () => {
        const local = doc({ s1: sheet({ [key0]: cell({ text: "   " }) }) });
        const incoming = doc({ s1: sheet({ [key0]: cell({ deleted: at(2) }) }) });
        expect(merge(local, incoming).dropped).toEqual([]);
    });

    it("reports nothing for a cell that arrives already dead", () => {
        const incoming = doc({ s1: sheet({ [key0]: cell({ text: "x", deleted: at(2) }) }) });
        expect(merge(doc({ s1: sheet() }), incoming).dropped).toEqual([]);
    });

    it("reads in grid order rather than in the order keys arrived", () => {
        const keys = [
            [2, seedRank(0)],
            [0, seedRank(5)],
            [0, seedRank(1)],
        ] as const;
        const localCells: Record<string, CollabCell> = {};
        const remoteCells: Record<string, CollabCell> = {};
        for (const [col, rank] of keys) {
            const k = cellKey(col, rank, "");
            localCells[k] = cell({ col, rank, text: `${col}` });
            remoteCells[k] = cell({ col, rank, deleted: at(9) });
        }
        const { dropped } = merge(doc({ s1: sheet(localCells) }), doc({ s1: sheet(remoteCells) }));
        expect(dropped.map((d) => [d.col, d.rank])).toEqual([
            [0, seedRank(1)],
            [0, seedRank(5)],
            [2, seedRank(0)],
        ]);
    });

    it("collects the losses across every sheet", () => {
        const build = (deleted: Stamp | null) => ({
            s1: sheet({ [key0]: cell({ text: "a", deleted }) }),
            s2: sheet({ [key0]: cell({ text: "b", deleted }) }, { id: "s2" }),
        });
        const { dropped } = merge(doc(build(null)), doc(build(at(9))));
        expect(dropped.map((d) => d.sheetId).sort()).toEqual(["s1", "s2"]);
    });
});
