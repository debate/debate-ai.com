// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
    toast: vi.fn(),
    invoke: vi.fn(),
    desktop: { value: true },
}));

vi.mock("sonner", () => ({ toast: m.toast }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: m.invoke }));
vi.mock("../src/lib/update/adapter", () => ({ isDesktop: () => m.desktop.value }));

import { debateEditorInsert, debateEditorJump, resolveDebateEditorTextType } from "../src/lib/bridge/debate-editor";
import { jumpToSource, runJumpToSource, runSendToDoc } from "../src/lib/bridge/commands";
import { DEBATE_EDITOR_APP, planFlowWrite } from "../src/lib/bridge/flowPlan";
import { handleBridgeRequest, resetRevealCycle } from "../src/lib/bridge/inbound";
import { findCellsBySourceKey } from "../src/lib/bridge/sourceSearch";
import { setActiveHot } from "../src/lib/grid/hotInstance";
import { makeFlowRound, type FlowRound } from "../src/lib/model/flow";
import { useFlowStore } from "../src/lib/store/useFlowStore";

import { FakeHot } from "./helpers/fakeHot";

const initial = useFlowStore.getState();

beforeEach(() => {
    vi.clearAllMocks();
    m.desktop.value = true;
    window.localStorage.clear();
    useFlowStore.setState(initial, true);
    setActiveHot(null, null, null, 0);
    resetRevealCycle();
});

describe("planFlowWrite", () => {
    const items = [
        { kind: "block", text: "Block", token: "t1", key: "k1" },
        { kind: "tag", text: "Tag", token: "t2", key: "k2" },
        { kind: "cite", text: "Cite", token: "", key: "" },
        { kind: "analytic", text: "Analytic", token: "", key: "" },
    ];

    it("plans one cell per item, folding cites into the card above", () => {
        const cells = planFlowWrite(items, "column", "Doc", 2);
        expect(cells.map((c) => c.text)).toEqual(["Block", "Tag\nCite", "Analytic", "", ""]);
        expect(cells[0].meta).toEqual({ bold: true, source: { app: DEBATE_EDITOR_APP, token: "t1", key: "k1", title: "Doc" } });
        expect(cells[1].meta.card).toBe(true);
        expect(cells[2].meta).toEqual({});
    });

    it("joins everything into one cell in cell mode", () => {
        const cells = planFlowWrite(items, "cell", "", 1);
        expect(cells).toHaveLength(2);
        expect(cells[0].text).toBe("Block\nTag\nCite\nAnalytic");
        expect(cells[0].meta).toEqual({ source: { app: DEBATE_EDITOR_APP, token: "t1", key: "k1" } });
        expect(planFlowWrite([{ kind: "x", text: "a", token: "", key: "" }], "cell", "")[0].meta).toEqual({});
        expect(planFlowWrite([], "column", "")).toEqual([]);
    });
});

function roundWithSources(): FlowRound {
    const round = makeFlowRound();
    const sheet = round.sheets[1];
    sheet.title = "Case";
    sheet.data = [["a", "b"], ["c", "d"]];
    sheet.meta = {
        "1,0": { source: { app: "cardmirror", token: "t", key: "K" } },
        "0,1": { source: { app: "cardmirror", token: "t", key: "K" } },
        "bad,x": { source: { app: "cardmirror", token: "t", key: "K" } },
        "0,0": { bold: true },
    };
    return round;
}

describe("findCellsBySourceKey", () => {
    it("finds cells by key in reading order and skips bad keys", () => {
        const round = roundWithSources();
        const hits = findCellsBySourceKey(round, ["K"]);
        expect(hits.map((h) => [h.row, h.col])).toEqual([
            [0, 1],
            [1, 0],
        ]);
        expect(findCellsBySourceKey(round, [])).toEqual([]);
    });
});

describe("handleBridgeRequest", () => {
    it("refuses when the integration is off or the request is bad", () => {
        m.desktop.value = false;
        expect(handleBridgeRequest("flow", {})).toEqual({ status: 200, body: { ok: false, error: "integration-disabled" } });
        m.desktop.value = true;
        expect(handleBridgeRequest("flow", {}).status).toBe(400);
        expect(handleBridgeRequest("reveal", {}).status).toBe(400);
        expect(handleBridgeRequest("other", {}).status).toBe(400);
    });

    it("needs an active sheet and cell", () => {
        const body = { items: [{ text: "x" }] };
        expect(handleBridgeRequest("flow", body).body).toEqual({ ok: false, error: "no-active-sheet" });
        const round = makeFlowRound();
        useFlowStore.getState().loadRound(round);
        const hot = new FakeHot(3, 2);
        setActiveHot(hot as never, null, round.sheets[1].id, 0);
        expect(handleBridgeRequest("flow", body).body).toEqual({ ok: false, error: "no-active-cell" });
        setActiveHot(hot as never, null, round.sheets[1].id, 1);
        hot.select(0, 0);
        expect(handleBridgeRequest("flow", body).body).toEqual({ ok: false, error: "no-active-cell" });
    });

    it("writes items down the column, growing the grid", () => {
        const round = makeFlowRound();
        useFlowStore.getState().loadRound(round);
        const hot = new FakeHot(2, 2);
        const mutated = vi.fn();
        setActiveHot(hot as never, mutated, round.sheets[1].id, 0);
        hot.select(1, 1);
        const reply = handleBridgeRequest("flow", {
            docTitle: "Doc",
            items: [
                { kind: "tag", text: "T1", source: "tok", key: "k" },
                { kind: "analytic", text: "A" },
            ],
            space: 1,
        });
        expect(reply).toEqual({ status: 200, body: { ok: true, written: 2, sheet: "1.", row: 1, col: 1 } });
        expect(hot.data.map((r) => r[1])).toEqual(["0:1", "T1", "A", ""]);
        expect(String(hot.getCellMeta(1, 1).className)).toContain("card");
        expect(hot.getCellMeta(1, 1).source).toMatchObject({ token: "tok", title: "Doc" });
        expect(hot.selectCell).toHaveBeenCalledWith(3, 1);
        expect(mutated).toHaveBeenCalled();
    });

    it("pushes existing cells down with insert paste", () => {
        const round = makeFlowRound();
        useFlowStore.getState().loadRound(round);
        useFlowStore.setState({ insertPaste: true });
        const hot = new FakeHot(3, 1);
        setActiveHot(hot as never, null, round.sheets[1].id, 0);
        hot.select(0, 0);
        handleBridgeRequest("flow", { mode: "cell", items: [{ text: "new" }] });
        expect(hot.data.map((r) => r[0])).toEqual(["new", "0:0", "1:0", "2:0"]);
    });

    it("reveals matches, cycling on repeat", () => {
        expect(handleBridgeRequest("reveal", { keys: ["K"] }).body).toEqual({ ok: false, error: "no-round" });
        const round = roundWithSources();
        useFlowStore.getState().loadRound(round);
        const first = handleBridgeRequest("reveal", { keys: ["K"] });
        expect(first.body).toMatchObject({ ok: true, matches: 2, sheets: ["Case"], row: 0, col: 1 });
        expect(useFlowStore.getState().revealTarget).toEqual({ sheetId: round.sheets[1].id, row: 0, col: 1 });
        expect(handleBridgeRequest("reveal", { keys: ["K"] }).body).toMatchObject({ row: 1, col: 0 });
        expect(handleBridgeRequest("reveal", { keys: ["K"] }).body).toMatchObject({ row: 0, col: 1 });
        expect(handleBridgeRequest("reveal", { keys: ["none"] }).body).toEqual({ ok: true, matches: 0 });
    });
});

describe("Debate Editor transport", () => {
    it("resolves text types", () => {
        expect(resolveDebateEditorTextType("tag")).toBe("tag");
        expect(resolveDebateEditorTextType("nope")).toBe("analytic");
    });

    it("is unsupported off desktop and maps failures", async () => {
        m.desktop.value = false;
        expect(await debateEditorJump("t")).toEqual({ ok: false, error: "unsupported" });
        m.desktop.value = true;
        m.invoke.mockRejectedValueOnce("not-running");
        expect(await debateEditorJump("t")).toEqual({ ok: false, error: "not-running" });
        m.invoke.mockRejectedValueOnce(new Error("weird"));
        expect(await debateEditorJump("t")).toEqual({ ok: false, error: "bad-response" });
        m.invoke.mockResolvedValueOnce({ ok: true, docTitle: "D", inserted: true, error: 3 });
        expect(await debateEditorInsert("x", "tag")).toEqual({
            ok: true,
            value: { ok: true, docTitle: "D", inserted: true, error: undefined, pending: undefined },
        });
        expect(m.invoke).toHaveBeenLastCalledWith("cardmirror_insert", { text: "x", role: "tag", newParagraph: true });
        m.invoke.mockResolvedValueOnce(null);
        expect(await debateEditorJump("t")).toEqual({ ok: true, value: expect.objectContaining({ ok: false }) });
    });
});

describe("bridge commands", () => {
    const source = { app: "cardmirror", token: "tok", key: "k", title: "Doc" };

    it("jumpToSource explains every outcome", async () => {
        await jumpToSource(null);
        expect(m.toast).toHaveBeenLastCalledWith("This cell did not come from Debate Editor.");
        await jumpToSource(source, true);
        expect(m.toast).toHaveBeenLastCalledWith('Open "Doc" in Debate Editor first.');
        await jumpToSource({ ...source, title: undefined }, true);
        expect(m.toast).toHaveBeenLastCalledWith("That cell came from a partner's Debate Editor.");

        m.toast.mockClear();
        m.invoke.mockResolvedValueOnce({ ok: true });
        await jumpToSource(source);
        expect(m.toast).not.toHaveBeenCalled();

        const cases: [unknown, string][] = [
            [{ ok: false, pending: "x" }, "Waiting for approval in Debate Editor. No need to try again."],
            [{ ok: false, error: "doc-not-open", docTitle: "D" }, 'Open "D" in Debate Editor first.'],
            [{ ok: false, error: "doc-not-open" }, "Open the document in Debate Editor."],
            [{ ok: false, error: "not-found" }, "That card is no longer in the document."],
            [{ ok: false, error: "not-allowed" }, expect.stringMatching(/blocking ebb/) as never],
            [{ ok: false, error: "zzz" }, "Debate Editor could not open this cell's source."],
        ];
        for (const [reply, msg] of cases) {
            m.invoke.mockResolvedValueOnce(reply);
            await jumpToSource(source);
            expect(m.toast).toHaveBeenLastCalledWith(msg);
        }
        m.invoke.mockRejectedValueOnce("timeout");
        await jumpToSource(source);
        expect(m.toast).toHaveBeenLastCalledWith("Debate Editor did not answer.");

        useFlowStore.setState({ cardmirrorEnabled: false });
        m.toast.mockClear();
        await jumpToSource(null);
        expect(m.toast).not.toHaveBeenCalled();
    });

    it("runJumpToSource reads the selected cell's source", async () => {
        await runJumpToSource();
        expect(m.toast).toHaveBeenLastCalledWith("This cell did not come from Debate Editor.");
        const round = makeFlowRound();
        useFlowStore.getState().loadRound(round);
        const hot = new FakeHot(2, 2);
        setActiveHot(hot as never, null, round.sheets[1].id, 0);
        hot.select(0, 0);
        hot.setCellMeta(0, 0, "source", source);
        m.invoke.mockResolvedValueOnce({ ok: true });
        await runJumpToSource();
        expect(m.invoke).toHaveBeenCalledWith("cardmirror_jump", { source: "tok" });
    });

    it("runSendToDoc sends the selected text", async () => {
        await runSendToDoc();
        expect(m.toast).toHaveBeenLastCalledWith("Select a cell with text to send.");
        const hot = new FakeHot(2, 2);
        setActiveHot(hot as never, null, null, 0);
        hot.select(0, 0, 1, 0);
        m.invoke.mockResolvedValueOnce({ ok: true, docTitle: "Speech" });
        await runSendToDoc();
        expect(m.invoke).toHaveBeenCalledWith("cardmirror_insert", { text: "0:0\n1:0", role: "analytic", newParagraph: true });
        expect(m.toast).toHaveBeenLastCalledWith('Sent to "Speech".');
        m.invoke.mockResolvedValueOnce({ ok: true });
        await runSendToDoc();
        expect(m.toast).toHaveBeenLastCalledWith("Sent to Debate Editor.");
        m.invoke.mockResolvedValueOnce({ ok: false, error: "doc-readonly" });
        await runSendToDoc();
        expect(m.toast).toHaveBeenLastCalledWith("That Debate Editor document is in read mode.");
        m.desktop.value = false;
        m.toast.mockClear();
        await runSendToDoc();
        expect(m.toast).not.toHaveBeenCalled();
    });
});
