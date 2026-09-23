import { describe, expect, it } from "vitest";
import { seedDoc } from "../src/lib/collab/doc";
import { rankBetween, seedRank } from "../src/lib/collab/rank";
import { planRemoteApply, type ApplyContext } from "../src/lib/collab/remoteApply";
import { cellKey, type CollabDoc } from "../src/lib/collab/types";
import { modelCol } from "../src/lib/grid/colSpace";
import { emptyScouting, type FlowRound } from "../src/lib/model/flow";

const round = (): FlowRound =>
    ({
        id: "r1",
        createdAt: 0,
        updatedAt: 0,
        event: "policy",
        firstSide: "aff",
        scouting: emptyScouting(),
        sheets: [
            {
                id: "s1",
                title: "1.",
                group: "aff",
                order: 0,
                kind: "flow",
                data: [["a"], ["b"], ["c"]],
                meta: {},
            },
        ],
    }) as FlowRound;

const clone = (d: CollabDoc): CollabDoc => structuredClone(d);
const stamp = { ms: 1, counter: 0, actor: "peer" };

const ctx = (over: Partial<ApplyContext> = {}): ApplyContext => ({
    editorOpen: false,
    editorCell: null,
    selection: null,
    activeSheetId: null,
    ...over,
});

const sel = (row: number) => ({ sheetId: "s1", col: modelCol(0), row });

describe("planRemoteApply", () => {
    it("never scrolls and writes cells by default", () => {
        const before = seedDoc(round());
        const plan = planRemoteApply(before, clone(before), ctx());
        expect(plan).toEqual({
            writeCells: true,
            deferredCells: [],
            selectRow: null,
            structural: null,
            scroll: false,
            leftSheet: null,
        });
    });

    it("notices the active sheet being deleted", () => {
        const before = seedDoc(round());
        const after = clone(before);
        after.sheets.s1.deleted = stamp;
        expect(planRemoteApply(before, after, ctx({ activeSheetId: "s1" })).leftSheet).toBe("s1");
        expect(planRemoteApply(before, clone(before), ctx({ activeSheetId: "s1" })).leftSheet).toBeNull();
    });

    it("defers the cell under an open editor", () => {
        const before = seedDoc(round());
        const plan = planRemoteApply(
            before,
            clone(before),
            ctx({ editorOpen: true, editorCell: sel(1) }),
        );
        expect(plan.deferredCells).toEqual([{ col: 0, rank: seedRank(1), actor: "" }]);

        const missing = planRemoteApply(
            before,
            clone(before),
            ctx({ editorOpen: true, editorCell: { ...sel(9), sheetId: "nope" } }),
        );
        expect(missing.deferredCells).toEqual([]);
    });

    it("follows the selected row down when a partner inserts above it", () => {
        const before = seedDoc(round());
        const after = clone(before);
        const rank = rankBetween(null, seedRank(0));
        after.sheets.s1.cells[cellKey(0, rank, "peer")] = {
            col: 0,
            rank,
            actor: "peer",
            text: "new",
            textStamp: stamp,
            meta: {},
            metaStamp: stamp,
            deleted: null,
        };
        const plan = planRemoteApply(before, after, ctx({ selection: sel(2) }));
        expect(plan.selectRow).toBe(3);
        expect(plan.structural).toEqual({ kind: "insertRow", at: 0, amount: 1 });
    });

    it("reports a removal and holds the cursor when its own row goes", () => {
        const before = seedDoc(round());
        const after = clone(before);
        after.sheets.s1.cells[cellKey(0, seedRank(1), "")]!.deleted = stamp;
        const plan = planRemoteApply(before, after, ctx({ selection: sel(1) }));
        expect(plan.structural).toEqual({ kind: "removeRow", at: 1, amount: 1 });
        expect(plan.selectRow).toBeNull();
    });

    it("leaves the plan alone when the selected sheet is unknown", () => {
        const before = seedDoc(round());
        const plan = planRemoteApply(before, clone(before), ctx({ selection: { ...sel(0), sheetId: "x" } }));
        expect(plan.structural).toBeNull();
        expect(plan.selectRow).toBeNull();
    });
});
