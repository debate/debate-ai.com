// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
    toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
    bridge: { runJumpToSource: vi.fn(async () => {}), runSendToDoc: vi.fn(async () => {}) },
    collab: {
        runShare: vi.fn(async () => {}),
        runJoin: vi.fn(async () => {}),
        runInvite: vi.fn(async () => {}),
        runEnd: vi.fn(async () => {}),
    },
    file: {
        closeOpenFlow: vi.fn(async () => {}),
        openFlowFromPicker: vi.fn(async () => {}),
        revealOpenFlow: vi.fn(async () => {}),
        saveOpenFlow: vi.fn(async () => true),
        saveOpenFlowAs: vi.fn(async () => {}),
    },
    win: { closeCurrentWindow: vi.fn(async () => {}), openNewWindow: vi.fn(async () => {}) },
}));

vi.mock("sonner", () => ({ toast: m.toast }));
vi.mock("../src/lib/bridge/commands", () => m.bridge);
vi.mock("../src/lib/commands/collabCommands", () => m.collab);
vi.mock("../src/lib/commands/fileCommands", () => m.file);
vi.mock("../src/lib/commands/windowCommands", () => m.win);

import { executeCommand } from "../src/lib/commands/commands";
import { getReplica } from "../src/lib/collab/replica";
import { setActiveHot } from "../src/lib/grid/hotInstance";
import { isMovingIn, revertMove } from "../src/lib/grid/moveSession";
import { makeFlowRound, makeFlowSheet, type FlowRound } from "../src/lib/model/flow";
import { useCollabStore } from "../src/lib/store/useCollabStore";
import { useFlowStore } from "../src/lib/store/useFlowStore";

import { FakeHot } from "./helpers/fakeHot";

const initial = useFlowStore.getState();
let hot: FakeHot;
let mutated: ReturnType<typeof vi.fn>;

function load(): FlowRound {
    const round = makeFlowRound();
    round.sheets.push(
        makeFlowSheet({ title: "2.", group: "aff", order: 1 }),
        makeFlowSheet({ title: "1.", group: "neg", order: 2 }),
    );
    useFlowStore.getState().loadRound(round);
    return round;
}

function flowIds(): string[] {
    return useFlowStore
        .getState()
        .round!.sheets.filter((s) => s.kind !== "cx")
        .sort((a, b) => a.order - b.order)
        .map((s) => s.id);
}

beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useFlowStore.setState(initial, true);
    useCollabStore.getState().reset();
    hot = new FakeHot(4, 3);
    mutated = vi.fn();
});

describe("grid commands", () => {
    beforeEach(() => {
        const round = load();
        setActiveHot(hot as never, mutated, round.sheets[1].id, 0);
    });

    it("undo and redo reach the plugin", () => {
        executeCommand("edit.undo");
        executeCommand("edit.redo");
        expect(hot.undo).toHaveBeenCalled();
        expect(hot.redo).toHaveBeenCalled();
        expect(mutated).toHaveBeenCalledTimes(2);
    });

    it("toggles decorations across a range from the first cell's state", () => {
        hot.select(0, 0, 1, 1);
        hot.setCellMeta(1, 1, "className", "ebb-bold");
        executeCommand("format.toggleBold");
        for (const [r, c] of [
            [0, 0],
            [0, 1],
            [1, 0],
            [1, 1],
        ]) {
            expect(String(hot.getCellMeta(r, c).className)).toContain("bold");
        }
        expect(hot.render).toHaveBeenCalled();
        expect(mutated).toHaveBeenCalled();
        executeCommand("format.toggleBold");
        expect(String(hot.getCellMeta(0, 0).className)).not.toContain("bold");

        for (const id of ["format.toggleHighlight", "format.toggleCard", "format.toggleGroup", "format.toggleKicked"] as const) {
            executeCommand(id);
        }
        expect(String(hot.getCellMeta(0, 0).className).split(/\s+/).filter(Boolean)).toHaveLength(4);
        expect(getReplica()).not.toBeNull();
    });

    it("does nothing without a selection", () => {
        executeCommand("format.toggleBold");
        executeCommand("row.insertAbove");
        executeCommand("cell.insert");
        executeCommand("cell.move");
        expect(hot.render).not.toHaveBeenCalled();
        expect(hot.alter).not.toHaveBeenCalled();
    });

    it("alters rows at the selection", () => {
        hot.select(2, 1);
        executeCommand("row.insertAbove");
        executeCommand("row.insertBelow");
        executeCommand("row.delete");
        expect(hot.alter.mock.calls).toEqual([
            ["insert_row_above", 2],
            ["insert_row_below", 2],
            ["remove_row", 2],
        ]);
    });

    it("inserts a cell, shifting the column down", () => {
        hot.select(1, 0);
        executeCommand("cell.insert");
        expect(hot.data.map((r) => r[0])).toEqual(["0:0", "", "1:0", "2:0"]);
        executeCommand("cell.insertBelow");
        expect(hot.data.map((r) => r[0])).toEqual(["0:0", "", "", "1:0"]);
        // Past the bottom does nothing.
        hot.select(3, 0);
        const before = hot.data.map((r) => r[0]);
        executeCommand("cell.insertBelow");
        expect(hot.data.map((r) => r[0])).toEqual(before);
    });

    it("starts a move session over the selection", () => {
        hot.select(1, 0, 2, 1);
        executeCommand("cell.move");
        expect(isMovingIn(hot as never)).toBe(true);
        revertMove();
    });

    it("routes CardMirror commands", () => {
        executeCommand("cell.jumpToSource");
        executeCommand("cell.sendToDoc");
        expect(m.bridge.runJumpToSource).toHaveBeenCalled();
        expect(m.bridge.runSendToDoc).toHaveBeenCalled();
    });
});

describe("viewer guard", () => {
    it("refuses round edits for a viewer", () => {
        load();
        useCollabStore.getState().setSelfRole("viewer");
        const before = useFlowStore.getState().round!.sheets.length;
        executeCommand("sheet.newAff");
        expect(useFlowStore.getState().round!.sheets.length).toBe(before);
        expect(m.toast).toHaveBeenCalledWith("You are viewing this round, not editing it");
    });
});

describe("sheet commands", () => {
    it("steps through sheets and jumps by number", () => {
        load();
        const [a, b, c] = flowIds();
        useFlowStore.getState().setActiveSheet(a);
        executeCommand("sheet.next");
        expect(useFlowStore.getState().activeSheetId).toBe(b);
        executeCommand("sheet.next");
        executeCommand("sheet.next");
        expect(useFlowStore.getState().activeSheetId).toBe(c);
        executeCommand("sheet.prev");
        expect(useFlowStore.getState().activeSheetId).toBe(b);
        executeCommand("sheet.jump1");
        expect(useFlowStore.getState().activeSheetId).toBe(a);
        executeCommand("sheet.jump3");
        expect(useFlowStore.getState().activeSheetId).toBe(c);
        executeCommand("sheet.jump9");
        expect(useFlowStore.getState().activeSheetId).toBe(c);
    });

    it("moves the focused sheet or the selected range", () => {
        load();
        const [a, b, c] = flowIds();
        useFlowStore.getState().setActiveSheet(a);
        executeCommand("sheet.moveUp");
        expect(flowIds()).toEqual([a, b, c]);
        executeCommand("sheet.moveDown");
        expect(flowIds()).toEqual([b, a, c]);
        useFlowStore.getState().setSheetRange({ anchor: b, head: a });
        executeCommand("sheet.moveDown");
        expect(flowIds()).toEqual([c, b, a]);
    });

    it("extends a range from the focused sheet and opens the sidebar", () => {
        load();
        const [a, b, c] = flowIds();
        useFlowStore.getState().setActiveSheet(a);
        useFlowStore.getState().setSidebarCollapsed(true);
        executeCommand("sheet.extendUp");
        expect(useFlowStore.getState().sheetRange).toBeNull();
        executeCommand("sheet.extendDown");
        expect(useFlowStore.getState().sheetRange).toEqual({ anchor: a, head: b });
        expect(useFlowStore.getState().sidebarCollapsed).toBe(false);
        executeCommand("sheet.extendDown");
        expect(useFlowStore.getState().sheetRange).toEqual({ anchor: a, head: c });
        executeCommand("sheet.extendUp");
        expect(useFlowStore.getState().sheetRange).toEqual({ anchor: a, head: b });
    });

    it("adds and renames sheets", () => {
        load();
        const n = useFlowStore.getState().round!.sheets.length;
        executeCommand("sheet.newAff");
        executeCommand("sheet.newNeg");
        expect(useFlowStore.getState().round!.sheets.length).toBe(n + 2);
        useFlowStore.getState().setSidebarCollapsed(true);
        executeCommand("sheet.rename");
        expect(useFlowStore.getState().renamingSheetId).toBe(useFlowStore.getState().activeSheetId);
        expect(useFlowStore.getState().sidebarCollapsed).toBe(false);
    });

    it("no-ops sheet commands without a round", () => {
        for (const id of ["sheet.next", "sheet.moveUp", "sheet.extendDown", "sheet.newAff", "sheet.newNeg", "sheet.rename", "sheet.jump1"] as const) {
            executeCommand(id);
        }
        expect(useFlowStore.getState().round).toBeNull();
        expect(useFlowStore.getState().renamingSheetId).toBeNull();
    });
});

describe("ui and routing commands", () => {
    it("toggles UI state", () => {
        load();
        executeCommand("sheet.quickSwitch");
        expect(useFlowStore.getState()).toMatchObject({ quickSwitcherOpen: true, paletteSeed: "" });
        executeCommand("palette.open");
        expect(useFlowStore.getState().paletteSeed).toBe(">");
        executeCommand("flow.new");
        executeCommand("settings.open");
        executeCommand("info.open");
        executeCommand("rfd.toggle");
        executeCommand("help.open");
        executeCommand("sidebar.toggle");
        expect(useFlowStore.getState()).toMatchObject({
            newFlowOpen: true,
            settingsOpen: true,
            infoOpen: true,
            rfdOpen: true,
            cheatsheetOpen: true,
            sidebarCollapsed: true,
        });
        const z = useFlowStore.getState().gridZoom;
        executeCommand("view.zoomIn");
        expect(useFlowStore.getState().gridZoom).toBeCloseTo(z + 0.1);
        executeCommand("view.zoomOut");
        expect(useFlowStore.getState().gridZoom).toBeCloseTo(z);
        executeCommand("split.toggle");
        expect(useFlowStore.getState().splitSheetId).not.toBeNull();
        executeCommand("split.focusRight");
        expect(useFlowStore.getState().focusedPane).toBe(2);
        executeCommand("split.focusLeft");
        expect(useFlowStore.getState().focusedPane).toBe(1);
        executeCommand("theme.dark");
        expect(useFlowStore.getState().theme).toBe("dark");
        executeCommand("theme.light");
        expect(useFlowStore.getState().theme).toBe("light");
        executeCommand("theme.system");
        expect(useFlowStore.getState().theme).toBe("system");
        executeCommand("round.swapOrder");
    });

    it("routes file, window and collab commands", () => {
        load();
        executeCommand("flow.open");
        executeCommand("flow.save");
        executeCommand("flow.saveAs");
        executeCommand("flow.reveal");
        executeCommand("flow.close");
        executeCommand("window.new");
        executeCommand("window.close");
        expect(Object.values(m.file).every((f) => f.mock.calls.length === 1)).toBe(true);
        expect(m.win.openNewWindow).toHaveBeenCalled();
        expect(m.win.closeCurrentWindow).toHaveBeenCalled();

        executeCommand("collab.share");
        executeCommand("collab.shareView");
        executeCommand("collab.join");
        executeCommand("collab.invite");
        executeCommand("collab.inviteView");
        executeCommand("collab.end");
        expect(m.collab.runShare).toHaveBeenCalledTimes(2);
        expect(m.collab.runShare.mock.calls[1][1]).toBe("viewer");
        expect(m.collab.runInvite.mock.calls[1][1]).toBe("viewer");
        expect(m.collab.runJoin).toHaveBeenCalledTimes(1);
        expect(m.collab.runEnd).toHaveBeenCalledTimes(1);

        // The deps handed to collab commands report through toasts.
        const deps = m.collab.runShare.mock.calls[0][0] as { notify: (s: string) => void; fail: (s: string) => void; openFlow: (p: string) => void };
        deps.notify("ok");
        deps.fail("bad");
        deps.openFlow("/x.ebb");
        expect(m.toast.success).toHaveBeenCalledWith("ok");
        expect(m.toast.error).toHaveBeenCalledWith("bad");
    });
});
