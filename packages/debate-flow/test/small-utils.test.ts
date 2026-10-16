// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { copyText, selectNode } from "../src/lib/clipboard";
import { chipSummary, pendingLine } from "../src/lib/collab/statusLine";
import { safeSheetName } from "../src/lib/export/sheetNames";
import { EVENTS } from "../src/lib/format/events";
import { makeFlowRound, makeFlowSheet, type FlowRound } from "../src/lib/model/flow";
import { collectCells, searchCells } from "../src/lib/search/cellSearch";
import { searchCommands, searchSpeechCommands, speechCommandLabel } from "../src/lib/search/commandSearch";
import { rank } from "../src/lib/search/match";
import { relativeTime, resultLabel } from "../src/lib/start/format";
import { applySideColors, DEFAULT_SIDE_COLORS } from "../src/lib/theme/applySideColors";

describe("rank", () => {
    const items = ["warming bad", "software", "at: warming", "warming", "warm"];
    const id = (s: string) => s;

    it("orders by tier: exact, prefix, word-start, substring", () => {
        expect(rank(items, "warming", id, () => "", () => 0)).toEqual([
            "warming",
            "warming bad",
            "at: warming",
        ]);
        expect(rank(items, "war", id, () => "", () => 0)).toEqual([
            "warming bad",
            "warming",
            "warm",
            "at: warming",
            "software",
        ]);
    });

    it("requires every token, in any order", () => {
        expect(rank(items, "bad warming", id, () => "", () => 0)).toEqual(["warming bad"]);
        expect(rank(items, "zzz", id, () => "", () => 0)).toEqual([]);
    });

    it("puts secondary-only matches last and uses the tiebreak", () => {
        const rows = [
            { p: "alpha", s: "2ac" },
            { p: "2ac alpha", s: "" },
        ];
        const out = rank(rows, "2ac", (r) => r.p, (r) => r.s, () => 0);
        expect(out.map((r) => r.p)).toEqual(["2ac alpha", "alpha"]);
        expect(rank([3, 1, 2], "", String, () => "", (a, b) => a - b)).toEqual([1, 2, 3]);
    });
});

describe("cell search", () => {
    function round(): FlowRound {
        const r = makeFlowRound({ event: "policy" });
        const sheet = r.sheets.find((s) => s.kind !== "cx")!;
        sheet.title = "Econ DA";
        sheet.data = [
            ["growth good", "warming answer"],
            ["  ", null],
            ["card text", ""],
        ];
        sheet.meta = { "2,0": { card: true } };
        return r;
    }

    it("collects every filled cell with its column context", () => {
        const cells = collectCells(round());
        expect(cells.map((c) => c.text)).toEqual(["growth good", "warming answer", "card text"]);
        expect(cells[0]).toMatchObject({ row: 0, col: 0, colName: "1AC", side: "aff", sheetTitle: "Econ DA" });
        expect(cells[1]).toMatchObject({ colName: "1NC", side: "neg" });
        expect(cells[2].card).toBe(true);
        expect(cells[0].card).toBe(false);
    });

    it("ranks text hits above column-only hits", () => {
        const hits = searchCells(round(), "warming");
        expect(hits.map((h) => h.text)).toEqual(["warming answer"]);
        const byCol = searchCells(round(), "1nc");
        expect(byCol.map((h) => h.text)).toEqual(["warming answer"]);
        expect(searchCells(round(), "")).toHaveLength(3);
    });
});

describe("command search", () => {
    it("lists every command for an empty query and narrows by label", () => {
        const all = searchCommands("");
        expect(all.length).toBeGreaterThan(20);
        const bold = searchCommands("bold");
        expect(bold[0].id).toBe("format.toggleBold");
    });

    it("searches speeches by name and alias", () => {
        const speeches = EVENTS.policy.aff;
        expect(speechCommandLabel(speeches[0])).toBe("Go to speech: 1AC");
        const hits = searchSpeechCommands("2ac", speeches);
        expect(hits[0]).toEqual({ speechId: "2ac", label: "Go to speech: 2AC" });
        expect(searchSpeechCommands("", speeches)).toHaveLength(speeches.length);
    });
});

describe("start format", () => {
    const now = 10_000_000_000;
    it.each([
        [10, "just now"],
        [60 * 5, "5 min ago"],
        [3600 * 3, "3h ago"],
        [86400 * 2, "2d ago"],
        [86400 * 14, "2w ago"],
        [86400 * 60, "2mo ago"],
        [86400 * 800, "2y ago"],
    ])("relativeTime %is", (secs, label) => {
        expect(relativeTime(now - secs * 1000, now)).toBe(label);
    });

    it("clamps future times to just now", () => {
        expect(relativeTime(now + 100_000, now)).toBe("just now");
    });

    it("labels results", () => {
        expect(resultLabel(undefined)).toEqual({ text: "undecided", side: null });
        expect(resultLabel({ vote: "aff" } as never)).toEqual({ text: "Aff", side: "aff" });
        expect(resultLabel({ vote: "neg" } as never)).toEqual({ text: "Neg", side: "neg" });
    });
});

describe("safeSheetName", () => {
    it("strips illegal characters, caps length and dedupes", () => {
        const used = new Set<string>();
        expect(safeSheetName("A/B:C?", used)).toBe("A B C");
        expect(safeSheetName("a b c", used)).toBe("a b c (2)");
        expect(safeSheetName("A B C", used)).toBe("A B C (3)");
        expect(safeSheetName("", used)).toBe("Sheet");
        expect(safeSheetName("'quoted'", used)).toBe("quoted");
        const long = "x".repeat(40);
        expect(safeSheetName(long, used)).toBe("x".repeat(31));
        expect(safeSheetName(long, used)).toBe(`${"x".repeat(27)} (2)`);
    });
});

describe("statusLine", () => {
    it("summarizes nobody connected", () => {
        expect(chipSummary([], [])).toBe("Waiting to be joined");
        expect(chipSummary([], [{ name: "Sam", unreachable: false }])).toBe("Waiting for Sam");
        expect(chipSummary([], [{ name: "Sam", unreachable: true }])).toBe("Can't reach Sam");
        expect(
            chipSummary([], [
                { name: "A", unreachable: false },
                { name: "B", unreachable: true },
            ]),
        ).toBe("Waiting for 2 partners");
    });

    it("summarizes connected peers", () => {
        expect(chipSummary([{ name: "Sam", relayed: true }], [])).toBe("Connected to Sam, relayed");
        expect(chipSummary([{ name: "Sam", relayed: false }], [])).toBe("Connected to Sam");
        expect(
            chipSummary(
                [
                    { name: "A", relayed: false },
                    { name: "B", relayed: false },
                ],
                [{ name: "C", unreachable: false }],
            ),
        ).toBe("Connected to 2 partners, waiting for 1 more");
    });

    it("explains a pending peer", () => {
        expect(pendingLine({ name: "Sam", unreachable: true })).toMatch(/^Can't reach Sam\./);
        expect(pendingLine({ name: "Sam", unreachable: false })).toBe("Waiting for Sam to open this round");
    });
});

describe("clipboard", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("reports whether the write landed", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
        await expect(copyText("hi")).resolves.toBe(true);
        expect(writeText).toHaveBeenCalledWith("hi");
        writeText.mockRejectedValueOnce(new Error("denied"));
        await expect(copyText("hi")).resolves.toBe(false);
    });

    it("selects a node's text and ignores null", () => {
        const p = document.createElement("p");
        p.textContent = "copy me";
        document.body.appendChild(p);
        selectNode(null);
        selectNode(p);
        expect(window.getSelection()?.toString()).toBe("copy me");
        p.remove();
    });
});

describe("applySideColors", () => {
    it("injects, updates and removes the override style", () => {
        expect(DEFAULT_SIDE_COLORS.aff).toMatch(/^#/);
        applySideColors({ aff: "#111111", neg: null });
        const el = document.getElementById("ebb-side-colors")!;
        expect(el.textContent).toBe(":root, .dark, .handsontable { --aff: #111111; }");
        applySideColors({ aff: "#111111", neg: "#222222" });
        expect(document.getElementById("ebb-side-colors")!.textContent).toContain("--neg: #222222;");
        expect(document.querySelectorAll("#ebb-side-colors")).toHaveLength(1);
        applySideColors({ aff: null, neg: null });
        expect(document.getElementById("ebb-side-colors")).toBeNull();
    });
});

it("makeFlowSheet is usable as a fixture", () => {
    expect(makeFlowSheet({ title: "t", group: "neg", order: 2 })).toMatchObject({ kind: "flow", data: [] });
});
