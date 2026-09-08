import { describe, expect, it } from "vitest";
import {
    compareSheets,
    dropSheetRange,
    emptyScouting,
    firstFlowSheetId,
    makeCxFlowSheet,
    makeFlowRound,
    makeFlowSheet,
    moveSheetRange,
    normalizeFlow,
    sheetRangeIds,
    sortedSheets,
    type FlowRound,
    type FlowSheet,
} from "../src/lib/model/flow";

const sheet = (id: string, order: number, over: Partial<FlowSheet> = {}): FlowSheet => ({
    id,
    title: id,
    group: "aff",
    order,
    kind: "flow",
    data: [],
    meta: {},
    ...over,
});

describe("emptyScouting", () => {
    it("gives both sides two blank debaters", () => {
        expect(emptyScouting()).toEqual({
            aff: { first: { first: "", last: "" }, second: { first: "", last: "" } },
            neg: { first: { first: "", last: "" }, second: { first: "", last: "" } },
        });
    });

    it("returns a fresh object each call, so editing one round leaves others alone", () => {
        const a = emptyScouting();
        const b = emptyScouting();
        a.aff.first.first = "Ada";
        expect(b.aff.first.first).toBe("");
    });
});

describe("makeFlowSheet", () => {
    it("builds an empty flow sheet with the requested title, group and order", () => {
        const s = makeFlowSheet({ title: "2.", group: "neg", order: 3 });
        expect(s).toMatchObject({ title: "2.", group: "neg", order: 3, kind: "flow" });
        expect(s.data).toEqual([]);
        expect(s.meta).toEqual({});
    });

    it("mints a distinct id per sheet", () => {
        const a = makeFlowSheet({ title: "1.", group: "aff", order: 0 });
        const b = makeFlowSheet({ title: "1.", group: "aff", order: 0 });
        expect(a.id).not.toBe(b.id);
        expect(a.id.startsWith("sheet")).toBe(true);
    });
});

describe("makeCxFlowSheet", () => {
    it("sorts above every flow sheet", () => {
        expect(makeCxFlowSheet().order).toBe(-1);
        expect(makeCxFlowSheet().kind).toBe("cx");
    });

    it("takes the event's own cross-ex title", () => {
        expect(makeCxFlowSheet("Cross-Examination").title).toBe("Cross-Examination");
        expect(makeCxFlowSheet().title).toBe("CX");
    });
});

describe("makeFlowRound", () => {
    it("defaults to a policy round that opens aff-first", () => {
        const round = makeFlowRound();
        expect(round.event).toBe("policy");
        expect(round.firstSide).toBe("aff");
    });

    it("opens with a cross-ex sheet and the first speech's sheet", () => {
        const round = makeFlowRound();
        expect(round.sheets.map((s) => s.kind)).toEqual(["cx", "flow"]);
        expect(round.sheets[0].title).toBe("CX");
        expect(round.sheets[1]).toMatchObject({ title: "1.", group: "aff", order: 0 });
    });

    it("opens a parliamentary round with no cross-ex sheet to leave empty", () => {
        const round = makeFlowRound({ event: "parli" });
        expect(round.sheets).toHaveLength(1);
        expect(round.sheets[0].kind).toBe("flow");
    });

    it("gives the opening sheet to whoever speaks first", () => {
        expect(makeFlowRound({ event: "pf", firstSide: "neg" }).sheets[1].group).toBe("neg");
        expect(makeFlowRound({ event: "pf", firstSide: "aff" }).sheets[1].group).toBe("aff");
    });

    it("stamps creation and update time together", () => {
        const round = makeFlowRound();
        expect(round.createdAt).toBe(round.updatedAt);
        expect(Number.isFinite(round.createdAt)).toBe(true);
    });
});

describe("normalizeFlow", () => {
    const legacy = (over: Partial<FlowRound> = {}) =>
        ({
            id: "r1",
            createdAt: 1,
            updatedAt: 2,
            sheets: [],
            ...over,
        }) as FlowRound;

    it("fills the event and first side a legacy round predates", () => {
        const round = normalizeFlow(legacy());
        expect(round.event).toBe("policy");
        expect(round.firstSide).toBe("aff");
    });

    it("fills empty scouting when the file carries none", () => {
        expect(normalizeFlow(legacy()).scouting).toEqual(emptyScouting());
    });

    it("never mutates its input", () => {
        const raw = legacy();
        const before = JSON.stringify(raw);
        normalizeFlow(raw);
        expect(JSON.stringify(raw)).toBe(before);
    });

    it("drops the legacy soft-delete field the filesystem now owns", () => {
        const raw = { ...legacy(), deletedAt: 12345 } as FlowRound;
        expect("deletedAt" in normalizeFlow(raw)).toBe(false);
    });

    it("defaults each sheet's kind, data and meta", () => {
        const raw = legacy({
            sheets: [{ id: "s1", title: "1.", group: "aff", order: 0 } as FlowSheet],
        });
        const [s] = normalizeFlow(raw).sheets.filter((x) => x.id === "s1");
        expect(s.kind).toBe("flow");
        expect(s.data).toEqual([]);
        expect(s.meta).toEqual({});
    });

    it("replaces a non-array data field with an empty grid", () => {
        const raw = legacy({
            sheets: [{ id: "s1", title: "1.", group: "aff", order: 0, data: null } as never],
        });
        expect(normalizeFlow(raw).sheets[0].data).toEqual([]);
    });

    it("prepends the cross-ex sheet the event wants when the file has none", () => {
        const round = normalizeFlow(legacy({ sheets: [sheet("s1", 0)] }));
        expect(round.sheets[0].kind).toBe("cx");
        expect(round.sheets).toHaveLength(2);
    });

    it("leaves an existing cross-ex sheet alone", () => {
        const cx = sheet("cx1", -1, { kind: "cx" });
        const round = normalizeFlow(legacy({ sheets: [cx, sheet("s1", 0)] }));
        expect(round.sheets.filter((s) => s.kind === "cx")).toHaveLength(1);
        expect(round.sheets[0].id).toBe("cx1");
    });

    it("adds no cross-ex sheet for an event that has no cross-examination", () => {
        const round = normalizeFlow(legacy({ event: "parli", sheets: [sheet("s1", 0)] }));
        expect(round.sheets.some((s) => s.kind === "cx")).toBe(false);
    });

    it("survives a round whose sheets array is missing", () => {
        const raw = { id: "r1", createdAt: 1, updatedAt: 2 } as FlowRound;
        expect(normalizeFlow(raw).sheets.every((s) => s.kind === "cx")).toBe(true);
    });
});

describe("compareSheets", () => {
    it("orders by the order field", () => {
        expect(compareSheets(sheet("a", 0), sheet("b", 1))).toBeLessThan(0);
        expect(compareSheets(sheet("a", 2), sheet("b", 1))).toBeGreaterThan(0);
    });

    it("breaks an order tie by id, so two peers agree", () => {
        expect(compareSheets(sheet("a", 1), sheet("b", 1))).toBe(-1);
        expect(compareSheets(sheet("b", 1), sheet("a", 1))).toBe(1);
        expect(compareSheets(sheet("a", 1), sheet("a", 1))).toBe(0);
    });
});

describe("sortedSheets", () => {
    const round = (sheets: FlowSheet[]): FlowRound =>
        ({ id: "r", createdAt: 0, updatedAt: 0, scouting: emptyScouting(), sheets }) as FlowRound;

    it("puts the cross-ex sheet first", () => {
        const out = sortedSheets(round([sheet("b", 1), sheet("cx", -1, { kind: "cx" })]));
        expect(out.map((s) => s.id)).toEqual(["cx", "b"]);
    });

    it("does not reorder the round's own array", () => {
        const sheets = [sheet("b", 1), sheet("a", 0)];
        sortedSheets(round(sheets));
        expect(sheets.map((s) => s.id)).toEqual(["b", "a"]);
    });
});

describe("firstFlowSheetId", () => {
    const round = (sheets: FlowSheet[]) => ({ sheets }) as FlowRound;

    it("skips the cross-ex sheet", () => {
        expect(firstFlowSheetId(round([sheet("cx", -1, { kind: "cx" }), sheet("a", 0)]))).toBe("a");
    });

    it("falls back to the first sheet when every sheet is cross-ex", () => {
        expect(firstFlowSheetId(round([sheet("cx", -1, { kind: "cx" })]))).toBe("cx");
    });

    it("is null for a round with no sheets", () => {
        expect(firstFlowSheetId(round([]))).toBeNull();
    });
});

describe("sheetRangeIds", () => {
    const sheets = [sheet("a", 0), sheet("b", 1), sheet("c", 2), sheet("d", 3)];

    it("returns the inclusive slice between two ids", () => {
        expect(sheetRangeIds(sheets, "b", "c")).toEqual(["b", "c"]);
    });

    it("reads the same range in either direction", () => {
        expect(sheetRangeIds(sheets, "c", "a")).toEqual(["a", "b", "c"]);
    });

    it("returns just the one sheet when anchor and head match", () => {
        expect(sheetRangeIds(sheets, "b", "b")).toEqual(["b"]);
    });

    it("resolves to no selection once a sheet is deleted out from under it", () => {
        expect(sheetRangeIds(sheets, "b", "gone")).toEqual([]);
        expect(sheetRangeIds(sheets, "gone", "b")).toEqual([]);
    });

    it("returns display order whatever order the caller holds", () => {
        const jumbled = [sheet("c", 2), sheet("a", 0), sheet("b", 1)];
        expect(sheetRangeIds(jumbled, "c", "a")).toEqual(["a", "b", "c"]);
    });
});

describe("moveSheetRange", () => {
    const ids = ["a", "b", "c", "d", "e"];

    it("slides a single sheet down one slot", () => {
        expect(moveSheetRange(ids, ["b"], 1)).toEqual(["a", "c", "b", "d", "e"]);
    });

    it("slides a single sheet up one slot", () => {
        expect(moveSheetRange(ids, ["c"], -1)).toEqual(["a", "c", "b", "d", "e"]);
    });

    it("keeps a multi-sheet block's internal order", () => {
        expect(moveSheetRange(ids, ["b", "c"], 2)).toEqual(["a", "d", "e", "b", "c"]);
    });

    it("clamps a block already at the top", () => {
        expect(moveSheetRange(ids, ["a"], -3)).toBe(ids);
    });

    it("clamps a block already at the bottom", () => {
        expect(moveSheetRange(ids, ["e"], 4)).toBe(ids);
    });

    it("returns the input by reference for a no-op, so a caller can tell", () => {
        expect(moveSheetRange(ids, ["b"], 0)).toBe(ids);
        expect(moveSheetRange(ids, [], 1)).toBe(ids);
    });

    it("moves a block gathered from non-adjacent positions", () => {
        expect(moveSheetRange(ids, ["a", "c"], 1)).toEqual(["b", "a", "c", "d", "e"]);
    });
});

describe("dropSheetRange", () => {
    const ids = ["a", "b", "c", "d", "e"];

    it("lands the whole block where the grabbed row went", () => {
        // Motion tore "b" out and dropped it after "d".
        const afterDrag = ["a", "c", "d", "b", "e"];
        expect(dropSheetRange(afterDrag, ["b", "c"], "b")).toEqual(["a", "d", "b", "c", "e"]);
    });

    it("takes the block's internal order from the selection, not the drag", () => {
        const afterDrag = ["c", "a", "b", "d", "e"];
        expect(dropSheetRange(afterDrag, ["b", "c"], "c")).toEqual(["b", "c", "a", "d", "e"]);
    });

    it("leaves the ordering alone when the block did not move", () => {
        expect(dropSheetRange(ids, ["b"], "b")).toEqual(ids);
    });

    it("ignores a selected id the ordering no longer holds", () => {
        expect(dropSheetRange(ids, ["b", "gone"], "b")).toEqual(ids);
    });

    it("drops a block onto the very top", () => {
        const afterDrag = ["d", "a", "b", "c", "e"];
        expect(dropSheetRange(afterDrag, ["c", "d"], "d")).toEqual(["c", "d", "a", "b", "e"]);
    });
});
