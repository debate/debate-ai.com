// @vitest-environment jsdom
/**
 * @fileoverview `executeCommand`: the sheet navigation, reordering and range
 * commands against the store, the UI toggles, the viewer guard on commands
 * that edit the round, and the grid commands (decorations, row/cell inserts)
 * against a small in-memory stand-in for the registered Handsontable grid.
 */

import type Handsontable from "handsontable";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { executeCommand } from "../src/lib/commands/commands";
import { BOLD_CLASS, HIGHLIGHT_CLASS } from "../src/lib/grid/codec";
import { setActiveHot } from "../src/lib/grid/hotInstance";
import { makeFlowRound, sortedSheets } from "../src/lib/model/flow";
import { useCollabStore } from "../src/lib/store/useCollabStore";
import { useFlowStore } from "../src/lib/store/useFlowStore";

const state = () => useFlowStore.getState();
const flowIds = () => sortedSheets(state().round!).filter((sheet) => sheet.kind !== "cx").map((sheet) => sheet.id);

/** A round with three aff flow sheets, the first one active. */
function openThreeSheets(): string[] {
    state().loadRound(makeFlowRound());
    state().addSheet({ group: "aff" });
    state().addSheet({ group: "aff" });
    const ids = flowIds();
    state().setActiveSheet(ids[0]!);
    return ids;
}

/** The slice of Handsontable the commands touch, over a plain rows x cols grid. */
class FakeHot {
    data: (string | null)[][];
    meta = new Map<string, Record<string, unknown>>();
    selection: [number, number, number, number] = [0, 0, 0, 0];
    altered: [string, number][] = [];
    renders = 0;
    undo = vi.fn();
    redo = vi.fn();

    constructor(rows: number, cols: number) {
        this.data = Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
    }
    select(r1: number, c1: number, r2 = r1, c2 = c1) {
        this.selection = [r1, c1, r2, c2];
    }
    countRows() {
        return this.data.length;
    }
    countCols() {
        return this.data[0]?.length ?? 0;
    }
    getDataAtCell(row: number, col: number) {
        return this.data[row]?.[col] ?? null;
    }
    setDataAtCell(changes: [number, number, string | null][]) {
        for (const [row, col, value] of changes) this.data[row]![col] = value;
    }
    getCellMeta(row: number, col: number) {
        return this.meta.get(`${row},${col}`) ?? {};
    }
    setCellMeta(row: number, col: number, key: string, value: unknown) {
        this.meta.set(`${row},${col}`, { ...this.getCellMeta(row, col), [key]: value });
    }
    className(row: number, col: number) {
        return (this.getCellMeta(row, col).className ?? "") as string;
    }
    getSelectedLast() {
        return this.selection;
    }
    getSelectedRange() {
        const [r1, c1, r2, c2] = this.selection;
        return [
            {
                highlight: { row: r1, col: c1 },
                getTopLeftCorner: () => ({ row: Math.min(r1, r2), col: Math.min(c1, c2) }),
                getBottomRightCorner: () => ({ row: Math.max(r1, r2), col: Math.max(c1, c2) }),
            },
        ];
    }
    alter(action: string, row: number) {
        this.altered.push([action, row]);
    }
    render() {
        this.renders++;
    }
    getPlugin() {
        return { undo: this.undo, redo: this.redo };
    }
}

let hot: FakeHot;
let mutated: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    useCollabStore.getState().setSelfRole("editor");
    state().closeRound();
    state().setSidebarCollapsed(false);
    hot = new FakeHot(4, 3);
    mutated = vi.fn<() => void>();
});

afterEach(() => {
    setActiveHot(null, null, null, 0);
});

function registerGrid(sheetId: string | null = null) {
    setActiveHot(hot as unknown as Handsontable, mutated, sheetId, 0);
}

describe("sheet commands", () => {
    it("steps to the next and previous sheet, stopping at the ends", () => {
        const ids = openThreeSheets();
        executeCommand("sheet.next");
        expect(state().activeSheetId).toBe(ids[1]);
        executeCommand("sheet.next");
        executeCommand("sheet.next");
        expect(state().activeSheetId).toBe(ids[2]);
        executeCommand("sheet.prev");
        expect(state().activeSheetId).toBe(ids[1]);
    });

    it("jumps to the Nth sheet, ignoring numbers past the end", () => {
        const ids = openThreeSheets();
        executeCommand("sheet.jump3");
        expect(state().activeSheetId).toBe(ids[2]);
        executeCommand("sheet.jump9");
        expect(state().activeSheetId).toBe(ids[2]);
    });

    it("moves the focused sheet down and back up", () => {
        const ids = openThreeSheets();
        executeCommand("sheet.moveDown");
        expect(flowIds()).toEqual([ids[1], ids[0], ids[2]]);
        executeCommand("sheet.moveUp");
        expect(flowIds()).toEqual(ids);
        // Already at the top: nothing moves.
        executeCommand("sheet.moveUp");
        expect(flowIds()).toEqual(ids);
    });

    it("extends a range from the focused sheet, opening a collapsed sidebar, and moves it as a block", () => {
        const ids = openThreeSheets();
        state().setSidebarCollapsed(true);
        executeCommand("sheet.extendDown");
        expect(state().sheetRange).toEqual({ anchor: ids[0], head: ids[1] });
        expect(state().sidebarCollapsed).toBe(false);

        executeCommand("sheet.moveDown");
        expect(flowIds()).toEqual([ids[2], ids[0], ids[1]]);

        // Past the first sheet the range cannot grow.
        state().setSheetRange({ anchor: ids[0]!, head: ids[0]! });
        executeCommand("sheet.extendUp");
        executeCommand("sheet.extendUp");
        expect(state().sheetRange?.head).toBe(ids[2]);
    });

    it("adds aff and neg sheets and starts a rename on the focused one", () => {
        openThreeSheets();
        executeCommand("sheet.newNeg");
        const neg = state().activeSheetId;
        expect(state().round!.sheets.find((sheet) => sheet.id === neg)?.group).toBe("neg");
        executeCommand("sheet.newAff");
        expect(flowIds()).toHaveLength(5);

        state().setSidebarCollapsed(true);
        executeCommand("sheet.rename");
        expect(state().renamingSheetId).toBe(state().activeSheetId);
        expect(state().sidebarCollapsed).toBe(false);
    });

    it("does nothing to sheets with no round open", () => {
        for (const id of ["sheet.next", "sheet.moveDown", "sheet.extendDown", "sheet.newAff", "sheet.rename", "sheet.jump1"] as const) {
            executeCommand(id);
        }
        expect(state().round).toBeNull();
        expect(state().renamingSheetId).toBeNull();
    });
});

describe("UI commands", () => {
    it("opens the palette, dialogs and drawers", () => {
        executeCommand("palette.open");
        expect(state()).toMatchObject({ quickSwitcherOpen: true, paletteSeed: ">" });
        executeCommand("sheet.quickSwitch");
        expect(state().paletteSeed).toBe("");
        executeCommand("flow.new");
        executeCommand("settings.open");
        executeCommand("info.open");
        executeCommand("help.open");
        expect(state()).toMatchObject({ newFlowOpen: true, settingsOpen: true, infoOpen: true, cheatsheetOpen: true });

        const sidebar = state().sidebarCollapsed;
        executeCommand("sidebar.toggle");
        expect(state().sidebarCollapsed).toBe(!sidebar);
        const rfd = state().rfdOpen;
        executeCommand("rfd.toggle");
        expect(state().rfdOpen).toBe(!rfd);
    });

    it("zooms the grid and switches theme", () => {
        const zoom = state().gridZoom;
        executeCommand("view.zoomIn");
        expect(state().gridZoom).toBeCloseTo(zoom + 0.1);
        executeCommand("view.zoomOut");
        expect(state().gridZoom).toBeCloseTo(zoom);
        executeCommand("theme.dark");
        expect(state().theme).toBe("dark");
        executeCommand("theme.light");
        expect(state().theme).toBe("light");
        executeCommand("theme.system");
        expect(state().theme).toBe("system");
    });

    it("splits panes and moves focus between them", () => {
        const ids = openThreeSheets();
        executeCommand("split.toggle");
        expect(state().splitSheetId).toBe(ids[1]);
        executeCommand("split.focusRight");
        expect(state().focusedPane).toBe(2);
        executeCommand("split.focusLeft");
        expect(state().focusedPane).toBe(1);
    });
});

describe("viewer guard", () => {
    it("refuses a command that edits the round, and still allows navigation", () => {
        const ids = openThreeSheets();
        useCollabStore.getState().setSelfRole("viewer");
        executeCommand("sheet.newAff");
        expect(flowIds()).toHaveLength(3);
        expect(toast).toHaveBeenCalledWith("You are viewing this round, not editing it");

        executeCommand("sheet.next");
        expect(state().activeSheetId).toBe(ids[1]);
    });
});

describe("grid commands", () => {
    it("bolds every cell of the selection, then un-bolds them all", () => {
        const [sheetId] = openThreeSheets();
        registerGrid(sheetId);
        hot.select(0, 0, 1, 1);
        hot.setCellMeta(1, 1, "className", BOLD_CLASS);

        executeCommand("format.toggleBold");
        expect([hot.className(0, 0), hot.className(0, 1), hot.className(1, 0), hot.className(1, 1)]).toEqual(
            Array(4).fill(BOLD_CLASS),
        );
        expect(mutated).toHaveBeenCalled();

        executeCommand("format.toggleBold");
        expect(hot.className(0, 0)).toBe("");
        expect(hot.className(1, 1)).toBe("");
    });

    it("keeps other decorations when toggling one", () => {
        registerGrid();
        hot.setCellMeta(0, 0, "className", BOLD_CLASS);
        executeCommand("format.toggleHighlight");
        expect(hot.className(0, 0).split(/\s+/).sort()).toEqual([BOLD_CLASS, HIGHLIGHT_CLASS].sort());
    });

    it("inserts and removes rows at the selection", () => {
        registerGrid();
        hot.select(2, 1);
        executeCommand("row.insertAbove");
        executeCommand("row.insertBelow");
        executeCommand("row.delete");
        expect(hot.altered).toEqual([
            ["insert_row_above", 2],
            ["insert_row_below", 2],
            ["remove_row", 2],
        ]);
    });

    it("inserts a blank cell, pushing the column down and leaving its neighbours", () => {
        registerGrid();
        hot.data = [
            ["a", "x"],
            ["b", "y"],
            ["c", "z"],
        ];
        hot.select(0, 0);
        executeCommand("cell.insert");
        expect(hot.data.map((row) => row[0])).toEqual(["", "a", "b"]);
        expect(hot.data.map((row) => row[1])).toEqual(["x", "y", "z"]);

        hot.select(2, 1);
        executeCommand("cell.insertBelow");
        expect(hot.data.map((row) => row[1])).toEqual(["x", "y", "z"]);
    });

    it("routes undo and redo to the grid's undo plugin", () => {
        registerGrid();
        executeCommand("edit.undo");
        executeCommand("edit.redo");
        expect(hot.undo).toHaveBeenCalledTimes(1);
        expect(hot.redo).toHaveBeenCalledTimes(1);
    });

    it("does nothing to the grid when none is registered", () => {
        executeCommand("format.toggleBold");
        executeCommand("row.delete");
        executeCommand("cell.insert");
        expect(mutated).not.toHaveBeenCalled();
    });
});
