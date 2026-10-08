// @vitest-environment jsdom
/**
 * @fileoverview `useFlowStore` — the open round's sheet actions (add, number,
 * rename, remove/restore, reorder, split panes, remote apply), its zoom
 * clamping, and the display/keymap settings it persists to localStorage and
 * mirrors into the account-synced record.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FlowRound } from "../src/lib/model/flow";

type StoreModule = typeof import("../src/lib/store/useFlowStore");
type ModelModule = typeof import("../src/lib/model/flow");

let store: StoreModule;
let model: ModelModule;

/** A fresh store module, so the settings it reads at import see this test's localStorage. */
async function loadStore(): Promise<void> {
    vi.resetModules();
    store = await import("../src/lib/store/useFlowStore");
    model = await import("../src/lib/model/flow");
}

beforeEach(async () => {
    localStorage.clear();
    await loadStore();
});

const state = () => store.useFlowStore.getState();

/** A policy round (CX sheet + "1." aff sheet), loaded into the store. */
function openRound(input: Parameters<ModelModule["makeFlowRound"]>[0] = {}): FlowRound {
    const round = model.makeFlowRound(input);
    state().loadRound(round, { docPath: "/flows/r.ebb" });
    return round;
}

const flowSheets = () => model.sortedSheets(state().round!).filter((sheet) => sheet.kind !== "cx");

describe("zoom helpers", () => {
    it("clamps and snaps to whole percents", () => {
        expect(store.clampZoom(0.1)).toBe(store.ZOOM_MIN);
        expect(store.clampZoom(9)).toBe(store.ZOOM_MAX);
        expect(store.clampZoom(1.234)).toBe(1.23);
    });

    it("resolves a hand-edited zoom, falling back to 100%", () => {
        expect(store.resolveZoom(5)).toBe(store.ZOOM_MAX);
        expect(store.resolveZoom("2")).toBe(1);
        expect(store.resolveZoom(Number.NaN)).toBe(1);
    });

    it("accepts only #rrggbb colours and real booleans", () => {
        expect(store.resolveColor("#a1B2c3")).toBe("#a1B2c3");
        expect(store.resolveColor("red")).toBeNull();
        expect(store.bool(false, true)).toBe(false);
        expect(store.bool("false", true)).toBe(true);
    });
});

describe("opening and closing a round", () => {
    it("opens on the first flow sheet with the path, and closes back to the start screen", () => {
        const round = openRound();
        expect(state().docPath).toBe("/flows/r.ebb");
        expect(state().activeSheetId).toBe(model.firstFlowSheetId(round));

        state().closeRound();
        expect(state()).toMatchObject({ round: null, docPath: null, activeSheetId: null });
    });

    it("forces the RFD drawer closed for a brand-new flow only", () => {
        localStorage.setItem("ebb-display-settings", JSON.stringify({ rfdOpen: true }));
        state().loadRound(model.makeFlowRound(), { newFlow: true });
        expect(state().rfdOpen).toBe(false);
        state().loadRound(model.makeFlowRound());
        expect(state().rfdOpen).toBe(true);
    });
});

describe("sheet actions", () => {
    it("numbers new sheets per side and activates them", () => {
        openRound();
        const id = state().addSheet({ group: "aff" });
        expect(state().activeSheetId).toBe(id);
        expect(flowSheets().map((sheet) => sheet.title)).toEqual(["1.", "2."]);

        const ids = state().addSheets([{ group: "neg" }, { group: "neg" }, { group: "aff", title: "Kritik" }]);
        expect(state().activeSheetId).toBe(ids[0]);
        expect(flowSheets().map((sheet) => `${sheet.group}:${sheet.title}`)).toEqual([
            "aff:1.",
            "aff:2.",
            "neg:1.",
            "neg:2.",
            "aff:Kritik",
        ]);
        expect(state().addSheets([])).toEqual([]);
    });

    it("no-ops without an open round", () => {
        expect(state().addSheet({ group: "aff" })).toBe("");
        expect(state().addSheets([{ group: "aff" }])).toEqual([]);
        expect(state().removeSheet("x")).toBeNull();
        state().renameSheet("x", "y");
        state().toggleSplit();
        expect(state().round).toBeNull();
    });

    it("renames a sheet and bumps updatedAt", () => {
        const round = openRound();
        const id = model.firstFlowSheetId(round)!;
        vi.spyOn(Date, "now").mockReturnValue(round.updatedAt + 1000);
        state().renameSheet(id, "Case");
        expect(flowSheets()[0]!.title).toBe("Case");
        expect(state().round!.updatedAt).toBe(round.updatedAt + 1000);
        vi.restoreAllMocks();
    });

    it("removes a sheet, moving focus to the one above, and restores it", () => {
        openRound();
        const [first, second] = [model.firstFlowSheetId(state().round!)!, state().addSheet({ group: "aff" })];
        const removed = state().removeSheet(second);
        expect(removed?.wasActive).toBe(true);
        expect(state().activeSheetId).toBe(first);

        state().restoreSheet(removed!);
        expect(state().activeSheetId).toBe(second);
        expect(flowSheets()).toHaveLength(2);
    });

    it("refuses to remove the cross-ex sheet or an unknown id", () => {
        const round = openRound();
        const cx = round.sheets.find((sheet) => sheet.kind === "cx")!;
        expect(state().removeSheet(cx.id)).toBeNull();
        expect(state().removeSheet("missing")).toBeNull();
    });

    it("reorders sheets by the given id order", () => {
        openRound();
        const a = model.firstFlowSheetId(state().round!)!;
        const b = state().addSheet({ group: "aff" });
        state().reorderSheets([b, a]);
        expect(flowSheets().map((sheet) => sheet.id)).toEqual([b, a]);
    });

    it("skips a sheet-data write that changes nothing", () => {
        const round = openRound();
        const id = model.firstFlowSheetId(round)!;
        const before = state().round;
        state().updateSheetData(id, [], {});
        expect(state().round).toBe(before);

        state().updateSheetData(id, [["Plan text"]], {});
        expect(flowSheets()[0]!.data).toEqual([["Plan text"]]);
        state().updateSheetData("missing", [["x"]], {});
    });

    it("swaps the speaking order only for variable-order events", () => {
        openRound({ event: "policy" });
        state().swapSpeakingOrder();
        expect(state().round!.firstSide).toBe("aff");

        openRound({ event: "pf", firstSide: "aff" });
        state().swapSpeakingOrder();
        expect(state().round!.firstSide).toBe("neg");
    });

    it("merges scouting patches", () => {
        openRound();
        state().setScouting({ tournament: "TOC" });
        expect(state().round!.scouting.tournament).toBe("TOC");
    });
});

describe("split panes", () => {
    it("opens a split on the next sheet, swaps panes when picking the other pane's sheet, and closes", () => {
        openRound();
        const first = model.firstFlowSheetId(state().round!)!;
        const second = state().addSheet({ group: "aff" });
        state().setActiveSheet(first);

        state().toggleSplit();
        expect(state().splitSheetId).toBe(second);

        state().focusPane(2);
        expect(store.focusedSheetId(state())).toBe(second);
        state().setActiveSheet(first);
        expect(state()).toMatchObject({ activeSheetId: second, splitSheetId: first });

        state().toggleSplit();
        expect(state()).toMatchObject({ activeSheetId: first, splitSheetId: null, focusedPane: 1 });
    });

    it("stays single-pane when there is no other sheet, and ignores pane focus", () => {
        const round = model.makeFlowRound({ event: "parli" });
        state().loadRound({ ...round, sheets: round.sheets.filter((sheet) => sheet.kind !== "cx") });
        state().toggleSplit();
        expect(state().splitSheetId).toBeNull();
        state().focusPane(2);
        expect(state().focusedPane).toBe(1);
    });

    it("collapses the split when a shown sheet is removed", () => {
        openRound();
        const first = model.firstFlowSheetId(state().round!)!;
        const second = state().addSheet({ group: "aff" });
        state().setActiveSheet(first);
        state().toggleSplit();

        state().removeSheet(first);
        expect(state()).toMatchObject({ activeSheetId: second, splitSheetId: null });
    });

    it("routes a speech switch to the focused pane when split, else to the top sheet", () => {
        openRound();
        const second = state().addSheet({ group: "aff" });
        state().switchSpeech("1NC");
        expect(state().activeSheetId).toBe(model.firstFlowSheetId(state().round!));
        expect(state().speechTarget).toEqual({ speechId: "1NC" });

        state().toggleSplit();
        state().setActiveSheet(second);
        state().switchSpeech("2AC");
        expect(state().activeSheetId).toBe(second);
    });

    it("reveals a cell with a fresh target object each time", () => {
        openRound();
        const id = model.firstFlowSheetId(state().round!)!;
        state().revealCell(id, 2, 3);
        const first = state().revealTarget;
        state().revealCell(id, 2, 3);
        expect(state().revealTarget).toEqual({ sheetId: id, row: 2, col: 3 });
        expect(state().revealTarget).not.toBe(first);
    });
});

describe("applyRemoteRound", () => {
    it("ignores a different round, and falls back when the partner deleted the open sheet", () => {
        const round = openRound();
        const second = state().addSheet({ group: "aff" });
        state().applyRemoteRound({ ...round, id: "other" });
        expect(state().activeSheetId).toBe(second);

        state().applyRemoteRound(round);
        expect(state().activeSheetId).toBe(model.firstFlowSheetId(round));
        expect(state().splitSheetId).toBeNull();
    });
});

describe("persisted settings", () => {
    it("writes display changes to localStorage and the synced record", () => {
        state().setTooltips(false);
        state().setTheme("dark");
        state().setSideColor("aff", "#112233");
        state().setSideColor("neg", "#445566");
        expect(JSON.parse(localStorage.getItem("ebb-display-settings")!)).toMatchObject({
            tooltips: false,
            theme: "dark",
            affColor: "#112233",
            negColor: "#445566",
        });
        const synced = JSON.parse(localStorage.getItem("ebbSyncedSettings")!) as { id: string; values?: Record<string, unknown> }[];
        expect(synced.find((record) => record.id === "display")?.values).toMatchObject({ tooltips: false, theme: "dark" });
    });

    it("keeps device-only settings out of the synced record", () => {
        state().setFlowsDir("  /home/me/flows  ");
        expect(state().flowsDir).toBe("/home/me/flows");
        state().setCollabName("Ada");
        const synced = localStorage.getItem("ebbSyncedSettings")!;
        expect(synced).not.toContain("/home/me/flows");
        expect(synced).not.toContain("Ada");
        state().setFlowsDir("   ");
        expect(state().flowsDir).toBeNull();
    });

    it("sets and clears keymap overrides", () => {
        state().setKeymapOverride("edit.undo", "Mod-u");
        expect(state().keymapOverrides).toEqual({ "edit.undo": "Mod-u" });
        expect(JSON.parse(localStorage.getItem("ebb-keymap-settings")!)).toEqual({
            keymapOverrides: { "edit.undo": "Mod-u" },
        });
        state().clearKeymapOverride("edit.undo");
        expect(state().keymapOverrides).toEqual({});
    });

    it("adjusts the live zoom without touching the default, and the default resets the live zoom", () => {
        state().zoomGrid(store.ZOOM_STEP);
        expect(state().gridZoom).toBe(1.1);
        expect(state().defaultGridZoom).toBe(1);
        state().setGridZoom(1.1);
        state().setDefaultGridZoom(2);
        expect(state()).toMatchObject({ gridZoom: 2, defaultGridZoom: 2 });
    });

    it("loads settings saved by a previous session, preferring the synced record", async () => {
        localStorage.setItem(
            "ebb-display-settings",
            JSON.stringify({ tooltips: false, theme: "light", defaultGridZoom: 1.5, affColor: "nope", flowsDir: "/d" }),
        );
        localStorage.setItem(
            "ebbSyncedSettings",
            JSON.stringify([
                { id: "display", values: { theme: "dark" } },
                { id: "keymap", keymapOverrides: { "edit.redo": "Mod-y" } },
            ]),
        );
        await loadStore();
        expect(state()).toMatchObject({
            tooltips: false,
            theme: "dark",
            defaultGridZoom: 1.5,
            gridZoom: 1.5,
            affColor: null,
            flowsDir: "/d",
            keymapOverrides: { "edit.redo": "Mod-y" },
        });
    });

    it("falls back to defaults for unreadable stored settings", async () => {
        localStorage.setItem("ebb-display-settings", "{broken");
        localStorage.setItem("ebb-keymap-settings", "{broken");
        await loadStore();
        expect(state()).toMatchObject({ tooltips: true, theme: "system", keymapOverrides: {} });
    });

    it("applies account settings, clamping the zoom and resolving the font", () => {
        state().applyAccountSettings({
            flowFont: "not-a-font" as never,
            defaultGridZoom: 7,
            theme: "dark",
            cardmirrorTextType: "tag",
            rfdVim: true,
            keymapOverrides: { "edit.undo": "Mod-z" },
        });
        expect(state()).toMatchObject({
            defaultGridZoom: store.ZOOM_MAX,
            gridZoom: store.ZOOM_MAX,
            theme: "dark",
            cardmirrorTextType: "tag",
            rfdVim: true,
            keymapOverrides: { "edit.undo": "Mod-z" },
        });
        expect(store.accountSettingsOf(state())).toMatchObject({ theme: "dark", rfdVim: true });
    });

    it("applies a whole external config file", () => {
        const current = state();
        const { keymapOverrides, updateConfig } = current;
        state().applyExternalConfig({
            flowFont: current.flowFont,
            defaultGridZoom: 1.25,
            sidebarCollapsed: true,
            rfdOpen: false,
            rfdVim: false,
            insertPaste: true,
            appendEdit: true,
            scrollZoom: true,
            alignSpeeches: true,
            tooltips: true,
            cardmirrorEnabled: true,
            cardmirrorTextType: "analytic",
            collabEnabled: false,
            collabRelayEnabled: true,
            collabListenEnabled: false,
            collabShowViewers: true,
            collabName: "",
            contacts: {},
            theme: "light",
            affColor: null,
            negColor: null,
            flowsDir: null,
            keymapOverrides,
            updateConfig,
        });
        expect(state()).toMatchObject({ gridZoom: 1.25, sidebarCollapsed: true, insertPaste: true, theme: "light" });
    });

    it("tracks the transient dialog flags", () => {
        state().setQuickSwitcherOpen(true, ">");
        expect(state()).toMatchObject({ quickSwitcherOpen: true, paletteSeed: ">" });
        state().setQuickSwitcherOpen(false, ">");
        expect(state().paletteSeed).toBe("");
        state().setNewFlowOpen(true);
        state().setSettingsOpen(true);
        state().setCheatsheetOpen(true);
        state().setInfoOpen(true);
        state().setRenamingSheet("s1");
        state().setDocPath("/x.ebb");
        expect(state()).toMatchObject({
            newFlowOpen: true,
            settingsOpen: true,
            cheatsheetOpen: true,
            infoOpen: true,
            renamingSheetId: "s1",
            docPath: "/x.ebb",
        });
    });
});
