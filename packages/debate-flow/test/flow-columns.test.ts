import { describe, expect, it } from "vitest";
import { EVENTS } from "../src/lib/format/events";
import {
    MAX_FLOW_COLS,
    columnsForFlowSheet,
    crossExColumns,
    headerSettings,
    spacerColumns,
    spacerCount,
    speechOffset,
} from "../src/lib/grid/flowColumns";
import type { FlowRound, FlowSheet } from "../src/lib/model/flow";

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
        createdAt: 0,
        updatedAt: 0,
        event: "policy",
        firstSide: "aff",
        sheets: [],
        ...over,
    }) as FlowRound;

describe("crossExColumns", () => {
    it("pairs a Question and a Response column per period", () => {
        const cols = crossExColumns(EVENTS.policy, "aff");
        expect(cols).toHaveLength(8);
        expect(cols.slice(0, 2).map((c) => c.name)).toEqual(["Question", "Response"]);
        expect(cols[0].group).toBe("1AC CX");
        expect(cols[1].group).toBe("1AC CX");
    });

    it("gives the questioner column to the side the period names", () => {
        // "1AC CX": the second-speaking side questions, so the neg asks.
        const cols = crossExColumns(EVENTS.policy, "aff");
        expect(cols[0].side).toBe("neg");
        expect(cols[1].side).toBe("aff");
        // "1NC CX": the first-speaking side asks.
        expect(cols[2].side).toBe("aff");
        expect(cols[3].side).toBe("neg");
    });

    it("follows the flip, so a neg-first round swaps every questioner", () => {
        const aff = crossExColumns(EVENTS.policy, "aff");
        const neg = crossExColumns(EVENTS.policy, "neg");
        expect(neg.map((c) => c.side)).toEqual(aff.map((c) => (c.side === "aff" ? "neg" : "aff")));
    });

    it("labels shared crossfire by side rather than questioner and responder", () => {
        const cols = crossExColumns(EVENTS.pf, "aff");
        expect(cols.slice(0, 2).map((c) => c.name)).toEqual(["Aff", "Neg"]);
        expect(cols[0].group).toBe("First Cross");
    });

    it("gives an event with no cross-examination no columns", () => {
        expect(crossExColumns(EVENTS.parli, "aff")).toEqual([]);
    });

    it("mints a unique id per column", () => {
        const ids = crossExColumns(EVENTS.policy, "aff").map((c) => c.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe("columnsForFlowSheet", () => {
    it("shows the round's whole speaking order on the first sheet", () => {
        const cols = columnsForFlowSheet(round(), sheet());
        expect(cols.map((c) => c.id)).toEqual([
            "1ac",
            "1nc",
            "2ac",
            "block",
            "1ar",
            "2nr",
            "2ar",
        ]);
    });

    it("starts at the sheet's own leftmost speech", () => {
        const cols = columnsForFlowSheet(round(), sheet({ group: "neg", startSpeechId: "1nc" }));
        expect(cols.map((c) => c.id)).toEqual(["1nc", "2ac", "block", "1ar", "2nr", "2ar"]);
    });

    it("defaults a neg sheet to the neg's first speech", () => {
        const cols = columnsForFlowSheet(round(), sheet({ group: "neg" }));
        expect(cols[0].id).toBe("1nc");
    });

    it("returns cross-ex period columns on the cross-ex sheet", () => {
        const cols = columnsForFlowSheet(round(), sheet({ kind: "cx" }));
        expect(cols[0].name).toBe("Question");
        expect(cols).toHaveLength(8);
    });

    it("falls back to the whole order when the sheet names a speech the event lacks", () => {
        const cols = columnsForFlowSheet(round(), sheet({ startSpeechId: "wsdc-1" }));
        expect(cols).toHaveLength(7);
        expect(cols[0].id).toBe("1ac");
    });

    it("reads an unknown replicated group as aff", () => {
        const cols = columnsForFlowSheet(round(), sheet({ group: "middle" as never }));
        expect(cols[0].id).toBe("1ac");
    });

    it("reads an unknown replicated firstSide as aff", () => {
        const cols = columnsForFlowSheet(round({ firstSide: "both" as never }), sheet());
        expect(cols[0].id).toBe("1ac");
    });

    it("follows the flip on a public forum round", () => {
        const r = round({ event: "pf", firstSide: "neg" });
        // An aff sheet still opens on the aff's first speech; the flip only
        // moves where that speech falls in the round's order.
        expect(columnsForFlowSheet(r, sheet()).map((c) => c.id)).toEqual([
            "ac",
            "nr",
            "ar",
            "ns",
            "as",
            "nf",
            "af",
        ]);
        expect(columnsForFlowSheet(r, sheet({ group: "neg" }))[0].id).toBe("nc");
    });
});

describe("speechOffset", () => {
    it("counts the speeches left of the sheet's leftmost column", () => {
        expect(speechOffset(round(), sheet({ startSpeechId: "block" }))).toBe(3);
    });

    it("is zero for a sheet that starts the round", () => {
        expect(speechOffset(round(), sheet())).toBe(0);
    });

    it("is zero on the cross-ex sheet, whose columns are periods", () => {
        expect(speechOffset(round(), sheet({ kind: "cx", startSpeechId: "2nr" }))).toBe(0);
    });

    it("is zero for a leftmost speech the order does not hold", () => {
        expect(speechOffset(round(), sheet({ startSpeechId: "nope" }))).toBe(0);
    });

    it("partitions the order together with columnsForFlowSheet", () => {
        for (const startSpeechId of ["1ac", "2ac", "block", "2ar"]) {
            const s = sheet({ startSpeechId });
            const r = round();
            expect(speechOffset(r, s) + columnsForFlowSheet(r, s).length).toBe(7);
        }
    });
});

describe("spacerColumns", () => {
    it("returns exactly the speeches columnsForFlowSheet drops", () => {
        const s = sheet({ group: "neg", startSpeechId: "2nr" });
        const r = round();
        expect(spacerColumns(r, s).map((c) => c.id)).toEqual(["1ac", "1nc", "2ac", "block", "1ar"]);
    });

    it("carries each speech's own side rather than the sheet's", () => {
        const s = sheet({ group: "neg", startSpeechId: "2ac" });
        expect(spacerColumns(round(), s).map((c) => c.side)).toEqual(["aff", "neg"]);
    });

    it("is empty on a sheet that starts the round", () => {
        expect(spacerColumns(round(), sheet())).toEqual([]);
    });
});

describe("spacerCount", () => {
    const r = round({ sheets: [sheet({ id: "s2", startSpeechId: "2ac" })] });

    it("counts the sheet's spacers when alignment is on", () => {
        expect(spacerCount(r, "s2", true)).toBe(2);
    });

    it("is zero while alignment is off", () => {
        expect(spacerCount(r, "s2", false)).toBe(0);
    });

    it("is zero without a round or a sheet id", () => {
        expect(spacerCount(null, "s2", true)).toBe(0);
        expect(spacerCount(undefined, "s2", true)).toBe(0);
        expect(spacerCount(r, null, true)).toBe(0);
        expect(spacerCount(r, undefined, true)).toBe(0);
    });

    it("is zero when the round no longer holds that sheet", () => {
        expect(spacerCount(r, "gone", true)).toBe(0);
    });
});

describe("MAX_FLOW_COLS", () => {
    it("is at least as wide as every event's speaking order", () => {
        for (const event of Object.values(EVENTS)) {
            expect(MAX_FLOW_COLS).toBeGreaterThanOrEqual(event.aff.length + event.neg.length);
            expect(MAX_FLOW_COLS).toBeGreaterThanOrEqual(
                crossExColumns(event, "aff").length,
            );
        }
    });

    it("is the policy cross-examination, the widest thing any event derives", () => {
        expect(MAX_FLOW_COLS).toBe(8);
    });
});

describe("headerSettings", () => {
    it("gives a flow sheet one header row of speech abbreviations", () => {
        const cols = columnsForFlowSheet(round(), sheet());
        const settings = headerSettings(sheet(), cols);
        expect(settings.colHeaders).toEqual(["1AC", "1NC", "2AC", "Block", "1AR", "2NR", "2AR"]);
        expect(settings.nestedHeaders).toBeUndefined();
    });

    it("leaves overflow columns of a flow sheet unlabeled rather than dropping them", () => {
        const cols = columnsForFlowSheet(round(), sheet());
        const settings = headerSettings(sheet(), cols, 9);
        expect(settings.colHeaders).toHaveLength(9);
        expect((settings.colHeaders as string[]).slice(-2)).toEqual(["", ""]);
    });

    it("gives a cross-ex sheet a period tier above Question and Response", () => {
        const cx = sheet({ kind: "cx" });
        const cols = columnsForFlowSheet(round(), cx);
        const settings = headerSettings(cx, cols);
        const [groups, names] = settings.nestedHeaders as [
            { label: string; colspan: number }[],
            string[],
        ];
        expect(groups).toEqual([
            { label: "1AC CX", colspan: 2 },
            { label: "1NC CX", colspan: 2 },
            { label: "2AC CX", colspan: 2 },
            { label: "2NC CX", colspan: 2 },
        ]);
        expect(names.slice(0, 2)).toEqual(["Question", "Response"]);
    });

    it("pads the cross-ex period tier over a sheet wider than its columns", () => {
        const cx = sheet({ kind: "cx" });
        const cols = columnsForFlowSheet(round(), cx);
        const [groups] = headerSettings(cx, cols, 10).nestedHeaders as [
            { label: string; colspan: number }[],
            string[],
        ];
        expect(groups[groups.length - 1]).toEqual({ label: "", colspan: 2 });
    });

    it("merges the shared-crossfire pairs into one group each", () => {
        const cx = sheet({ kind: "cx" });
        const r = round({ event: "pf" });
        const cols = columnsForFlowSheet(r, cx);
        const [groups] = headerSettings(cx, cols).nestedHeaders as [
            { label: string; colspan: number }[],
            string[],
        ];
        expect(groups.map((g) => g.label)).toEqual(["First Cross", "Second Cross", "Grand Cross"]);
        expect(groups.every((g) => g.colspan === 2)).toBe(true);
    });
});
