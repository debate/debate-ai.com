// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getReplica } from "../src/lib/collab/replica";
import { makeFlowRound, makeFlowSheet, type FlowRound } from "../src/lib/model/flow";
import {
    accountSettingsOf,
    bool,
    clampZoom,
    focusedSheetId,
    resolveColor,
    resolveZoom,
    useFlowStore,
    ZOOM_MAX,
    ZOOM_MIN,
} from "../src/lib/store/useFlowStore";

const initial = useFlowStore.getState();

function fixture(event: "policy" | "pf" = "policy"): FlowRound {
    const round = makeFlowRound({ event });
    const extra = [
        makeFlowSheet({ title: "2.", group: "aff", order: 1 }),
        makeFlowSheet({ title: "1.", group: "neg", order: 2 }),
    ];
    round.sheets.push(...extra);
    return round;
}

function flows(): string[] {
    const r = useFlowStore.getState().round!;
    return r.sheets
        .filter((s) => s.kind !== "cx")
        .sort((a, b) => a.order - b.order)
        .map((s) => s.id);
}

beforeEach(() => {
    window.localStorage.clear();
    useFlowStore.setState(initial, true);
});

describe("pure helpers", () => {
    it("clamps and resolves zoom", () => {
        expect(clampZoom(10)).toBe(ZOOM_MAX);
        expect(clampZoom(0.1)).toBe(ZOOM_MIN);
        expect(clampZoom(1.234)).toBe(1.23);
        expect(resolveZoom(5)).toBe(3);
        expect(resolveZoom("2")).toBe(1);
        expect(resolveZoom(Number.NaN)).toBe(1);
    });

    it("validates colors and booleans", () => {
        expect(resolveColor("#AbCdEf")).toBe("#AbCdEf");
        expect(resolveColor("red")).toBeNull();
        expect(resolveColor(3)).toBeNull();
        expect(bool(true, false)).toBe(true);
        expect(bool("yes", false)).toBe(false);
    });

    it("picks the focused sheet", () => {
        expect(focusedSheetId({ activeSheetId: "a", splitSheetId: null, focusedPane: 2 })).toBe("a");
        expect(focusedSheetId({ activeSheetId: "a", splitSheetId: "b", focusedPane: 2 })).toBe("b");
        expect(focusedSheetId({ activeSheetId: "a", splitSheetId: "b", focusedPane: 1 })).toBe("a");
    });
});

describe("round lifecycle", () => {
    it("loads a round, seeds the replica and closes it", () => {
        const round = fixture();
        useFlowStore.getState().loadRound(round, { docPath: "/x.ebb" });
        const s = useFlowStore.getState();
        expect(s.round).toBe(round);
        expect(s.docPath).toBe("/x.ebb");
        expect(s.activeSheetId).toBe(round.sheets[1].id);
        expect(getReplica()?.roundId).toBe(round.id);

        s.closeRound();
        expect(useFlowStore.getState()).toMatchObject({ round: null, docPath: null, activeSheetId: null });
        expect(getReplica()).toBeNull();
    });

    it("honours an explicit active sheet and forces rfd closed for a new flow", () => {
        window.localStorage.setItem("ebb-display-settings", JSON.stringify({ rfdOpen: true }));
        const round = fixture();
        useFlowStore.getState().loadRound(round, { activeSheetId: null, newFlow: true });
        expect(useFlowStore.getState().activeSheetId).toBeNull();
        expect(useFlowStore.getState().rfdOpen).toBe(false);
        useFlowStore.getState().loadRound(round);
        expect(useFlowStore.getState().rfdOpen).toBe(true);
    });

    it("no-ops round edits without a round", () => {
        const s = useFlowStore.getState();
        expect(s.addSheet({ group: "aff" })).toBe("");
        expect(s.addSheets([{ group: "aff" }])).toEqual([]);
        expect(s.removeSheet("x")).toBeNull();
        s.renameSheet("x", "y");
        s.restoreSheet({ sheet: makeFlowSheet({ title: "a", group: "aff", order: 0 }), wasActive: true });
        s.reorderSheets(["x"]);
        s.switchSpeech("1ac");
        s.toggleSplit();
        s.updateSheetData("x", [], {});
        s.setScouting({});
        s.swapSpeakingOrder();
        s.applyRemoteRound(fixture());
        expect(useFlowStore.getState().round).toBeNull();
    });
});

describe("sheet editing", () => {
    beforeEach(() => useFlowStore.getState().loadRound(fixture()));

    it("adds sheets with per-side numbering", () => {
        const id = useFlowStore.getState().addSheet({ group: "aff" });
        const sheet = useFlowStore.getState().round!.sheets.find((s) => s.id === id)!;
        expect(sheet.title).toBe("3.");
        expect(sheet.order).toBe(3);
        expect(useFlowStore.getState().activeSheetId).toBe(id);

        const ids = useFlowStore.getState().addSheets([
            { group: "neg" },
            { group: "neg", title: "T" },
            { group: "aff" },
        ]);
        const titles = ids.map((i) => useFlowStore.getState().round!.sheets.find((s) => s.id === i)!.title);
        expect(titles).toEqual(["2.", "T", "4."]);
        expect(useFlowStore.getState().activeSheetId).toBe(ids[0]);
        expect(useFlowStore.getState().addSheets([])).toEqual([]);
    });

    it("renames, reorders and records ops in the replica", () => {
        const [a, b, c] = flows();
        useFlowStore.getState().renameSheet(a, "Renamed");
        expect(useFlowStore.getState().round!.sheets.find((s) => s.id === a)!.title).toBe("Renamed");
        expect(getReplica()!.sheets[a]).toBeDefined();
        useFlowStore.getState().reorderSheets([c, a, b]);
        expect(flows()).toEqual([c, a, b]);
    });

    it("removes a sheet, falling back to the one above, and restores it", () => {
        const [a, b, c] = flows();
        useFlowStore.getState().setActiveSheet(b);
        const removed = useFlowStore.getState().removeSheet(b)!;
        expect(removed.wasActive).toBe(true);
        expect(useFlowStore.getState().activeSheetId).toBe(a);
        useFlowStore.getState().restoreSheet(removed);
        expect(useFlowStore.getState().activeSheetId).toBe(b);
        expect(flows()).toEqual([a, b, c]);

        // Removing the first flow sheet falls to the next one.
        useFlowStore.getState().setActiveSheet(a);
        useFlowStore.getState().removeSheet(a);
        expect(useFlowStore.getState().activeSheetId).toBe(b);

        // Non-active removal leaves focus; restoring a non-active sheet keeps it.
        const r2 = useFlowStore.getState().removeSheet(c)!;
        expect(r2.wasActive).toBe(false);
        expect(useFlowStore.getState().activeSheetId).toBe(b);
        useFlowStore.getState().restoreSheet(r2);
        expect(useFlowStore.getState().activeSheetId).toBe(b);
    });

    it("refuses to remove the cx sheet or an unknown id", () => {
        const cx = useFlowStore.getState().round!.sheets.find((s) => s.kind === "cx")!;
        expect(useFlowStore.getState().removeSheet(cx.id)).toBeNull();
        expect(useFlowStore.getState().removeSheet("nope")).toBeNull();
    });

    it("collapses a split when a shown sheet is removed", () => {
        const [a, b, c] = flows();
        useFlowStore.getState().setActiveSheet(a);
        useFlowStore.getState().toggleSplit();
        expect(useFlowStore.getState().splitSheetId).toBe(b);
        useFlowStore.getState().removeSheet(b);
        expect(useFlowStore.getState()).toMatchObject({ splitSheetId: null, focusedPane: 1, activeSheetId: a });

        useFlowStore.getState().toggleSplit();
        expect(useFlowStore.getState().splitSheetId).toBe(c);
        useFlowStore.getState().removeSheet(a);
        expect(useFlowStore.getState()).toMatchObject({ splitSheetId: null, activeSheetId: c });
    });

    it("keeps a split when an off-screen sheet is removed", () => {
        const [a, b, c] = flows();
        useFlowStore.getState().setActiveSheet(a);
        useFlowStore.getState().toggleSplit();
        useFlowStore.getState().removeSheet(c);
        expect(useFlowStore.getState()).toMatchObject({ splitSheetId: b, activeSheetId: a });
    });
});

describe("focus and panes", () => {
    beforeEach(() => useFlowStore.getState().loadRound(fixture()));

    it("swaps panes when focusing the sheet in the other pane", () => {
        const [a, b, c] = flows();
        useFlowStore.getState().setActiveSheet(a);
        useFlowStore.getState().toggleSplit();
        useFlowStore.getState().setActiveSheet(b);
        expect(useFlowStore.getState()).toMatchObject({ activeSheetId: b, splitSheetId: a });
        useFlowStore.getState().focusPane(2);
        useFlowStore.getState().setActiveSheet(c);
        expect(useFlowStore.getState()).toMatchObject({ activeSheetId: b, splitSheetId: c });
        useFlowStore.getState().setActiveSheet(b);
        expect(useFlowStore.getState()).toMatchObject({ activeSheetId: c, splitSheetId: b });

        // Speech switch in split mode just records the target.
        useFlowStore.getState().switchSpeech("2ac");
        expect(useFlowStore.getState().speechTarget).toEqual({ speechId: "2ac" });
        expect(useFlowStore.getState().splitSheetId).toBe(b);

        // Toggling back keeps the focused pane's sheet.
        useFlowStore.getState().toggleSplit();
        expect(useFlowStore.getState()).toMatchObject({ activeSheetId: b, splitSheetId: null, focusedPane: 1 });
        useFlowStore.getState().focusPane(2);
        expect(useFlowStore.getState().focusedPane).toBe(1);
    });

    it("opens a split on the previous sheet when on the last, and not with one sheet", () => {
        const [, , c] = flows();
        useFlowStore.getState().setActiveSheet(c);
        useFlowStore.getState().toggleSplit();
        expect(useFlowStore.getState().splitSheetId).not.toBeNull();

        const solo = makeFlowRound({ event: "parli" as never });
        useFlowStore.getState().loadRound(solo);
        useFlowStore.getState().toggleSplit();
        expect(useFlowStore.getState().splitSheetId).toBeNull();
    });

    it("reveals cells and switches speech in single mode", () => {
        const [, b] = flows();
        useFlowStore.getState().revealCell(b, 3, 2);
        expect(useFlowStore.getState().revealTarget).toEqual({ sheetId: b, row: 3, col: 2 });
        expect(useFlowStore.getState().activeSheetId).toBe(b);
        useFlowStore.getState().switchSpeech("1nc");
        expect(useFlowStore.getState().activeSheetId).toBe(flows()[0]);
        expect(useFlowStore.getState().speechTarget).toEqual({ speechId: "1nc" });
        useFlowStore.getState().setSheetRange({ anchor: b, head: b });
        expect(useFlowStore.getState().sheetRange).toEqual({ anchor: b, head: b });
    });
});

describe("content", () => {
    it("updates sheet data only on change", () => {
        useFlowStore.getState().loadRound(fixture());
        const [a] = flows();
        const before = useFlowStore.getState().round;
        useFlowStore.getState().updateSheetData(a, [], {});
        expect(useFlowStore.getState().round).toBe(before);
        useFlowStore.getState().updateSheetData(a, [["x"]], { "0,0": { bold: true } });
        expect(useFlowStore.getState().round!.sheets.find((s) => s.id === a)!.data).toEqual([["x"]]);
        useFlowStore.getState().updateSheetData("missing", [["x"]], {});
    });

    it("applies a remote round and falls back when the active sheet vanished", () => {
        const round = fixture();
        useFlowStore.getState().loadRound(round);
        const [a, b, c] = flows();
        useFlowStore.getState().setActiveSheet(b);
        useFlowStore.getState().toggleSplit();
        const next: FlowRound = { ...round, sheets: round.sheets.filter((s) => s.id !== b && s.id !== c) };
        useFlowStore.getState().applyRemoteRound(next);
        expect(useFlowStore.getState()).toMatchObject({ activeSheetId: a, splitSheetId: null, focusedPane: 1 });
        // Another round id is ignored.
        useFlowStore.getState().applyRemoteRound({ ...next, id: "other", sheets: [] });
        expect(useFlowStore.getState().round!.sheets).toHaveLength(next.sheets.length);
    });

    it("patches scouting as flattened leaves", () => {
        useFlowStore.getState().loadRound(fixture());
        useFlowStore.getState().setScouting({ decision: { vote: "neg" } } as never);
        expect(useFlowStore.getState().round!.scouting).toMatchObject({ decision: { vote: "neg" } });
    });

    it("swaps speaking order only for variable-order events", () => {
        useFlowStore.getState().loadRound(fixture("policy"));
        useFlowStore.getState().swapSpeakingOrder();
        expect(useFlowStore.getState().round!.firstSide).toBe("aff");
        useFlowStore.getState().loadRound(fixture("pf"));
        useFlowStore.getState().swapSpeakingOrder();
        expect(useFlowStore.getState().round!.firstSide).toBe("neg");
        useFlowStore.getState().swapSpeakingOrder();
        expect(useFlowStore.getState().round!.firstSide).toBe("aff");
    });
});

describe("settings", () => {
    const display = () => JSON.parse(window.localStorage.getItem("ebb-display-settings")!);
    const synced = () => JSON.parse(window.localStorage.getItem("ebbSyncedSettings")!);

    it("persists display toggles to local and synced storage", () => {
        const s = useFlowStore.getState();
        s.setRfdVim(true);
        s.setInsertPaste(true);
        s.setAppendEdit(false);
        s.setScrollZoom(false);
        s.setAlignSpeeches(true);
        s.setTooltips(false);
        s.setCardmirrorEnabled(false);
        s.setCardmirrorTextType("tag" as never);
        s.setCollabEnabled(true);
        s.setCollabRelayEnabled(false);
        s.setCollabListenEnabled(true);
        s.setCollabShowViewers(false);
        s.setCollabName("Sam");
        s.setContacts({});
        s.setTheme("dark");
        s.setSideColor("aff", "#123456");
        s.setSideColor("neg", "#654321");
        s.setSidebarCollapsed(true);
        s.setRfdOpen(true);
        s.setFlowFont(s.flowFont);
        const st = useFlowStore.getState();
        expect(st).toMatchObject({
            rfdVim: true,
            insertPaste: true,
            appendEdit: false,
            scrollZoom: false,
            alignSpeeches: true,
            tooltips: false,
            cardmirrorEnabled: false,
            collabEnabled: true,
            collabRelayEnabled: false,
            collabListenEnabled: true,
            collabShowViewers: false,
            collabName: "Sam",
            theme: "dark",
            affColor: "#123456",
            negColor: "#654321",
            sidebarCollapsed: true,
            rfdOpen: true,
        });
        expect(display()).toMatchObject({ rfdVim: true, collabName: "Sam", sidebarCollapsed: true });
        const disp = synced().find((r: { id: string }) => r.id === "display").values;
        expect(disp).toMatchObject({ rfdVim: true, theme: "dark", affColor: "#123456" });
        // Device-only keys never reach the synced record.
        expect(disp.collabName).toBeUndefined();
        expect(disp.sidebarCollapsed).toBeUndefined();
    });

    it("handles keymap overrides", () => {
        useFlowStore.getState().setKeymapOverride("format.toggleBold", "Mod+J");
        expect(useFlowStore.getState().keymapOverrides).toEqual({ "format.toggleBold": "Mod+J" });
        const km = synced().find((r: { id: string }) => r.id === "keymap");
        expect(km.keymapOverrides).toEqual({ "format.toggleBold": "Mod+J" });
        useFlowStore.getState().clearKeymapOverride("format.toggleBold");
        expect(useFlowStore.getState().keymapOverrides).toEqual({});
        expect(JSON.parse(window.localStorage.getItem("ebb-keymap-settings")!)).toEqual({ keymapOverrides: {} });
    });

    it("zooms within bounds", () => {
        const s = useFlowStore.getState();
        s.setGridZoom(1);
        s.zoomGrid(0.1);
        expect(useFlowStore.getState().gridZoom).toBe(1.1);
        s.setGridZoom(99);
        expect(useFlowStore.getState().gridZoom).toBe(3);
        s.setDefaultGridZoom(1.5);
        expect(useFlowStore.getState()).toMatchObject({ defaultGridZoom: 1.5, gridZoom: 1.5 });
        expect(display().defaultGridZoom).toBe(1.5);
    });

    it("trims the flows dir and stores update config", () => {
        useFlowStore.getState().setFlowsDir("  /flows  ");
        expect(useFlowStore.getState().flowsDir).toBe("/flows");
        useFlowStore.getState().setFlowsDir("   ");
        expect(useFlowStore.getState().flowsDir).toBeNull();
        useFlowStore.getState().setUpdateConfig({ autoCheckEnabled: true });
        expect(useFlowStore.getState().updateConfig.autoCheckEnabled).toBe(true);
        expect(JSON.parse(window.localStorage.getItem("df-update-settings")!)).toEqual({ autoCheckEnabled: true });
    });

    it("applies an external config wholesale", () => {
        const s = useFlowStore.getState();
        s.applyExternalConfig({
            flowFont: s.flowFont,
            defaultGridZoom: 2,
            sidebarCollapsed: true,
            rfdOpen: false,
            rfdVim: true,
            insertPaste: false,
            appendEdit: true,
            scrollZoom: true,
            alignSpeeches: false,
            tooltips: true,
            cardmirrorEnabled: true,
            cardmirrorTextType: s.cardmirrorTextType,
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
            keymapOverrides: { "sheet.next": "Mod+]" },
            updateConfig: { autoCheckEnabled: false },
        });
        expect(useFlowStore.getState()).toMatchObject({
            gridZoom: 2,
            defaultGridZoom: 2,
            theme: "light",
            rfdVim: true,
            keymapOverrides: { "sheet.next": "Mod+]" },
        });
    });

    it("applies account settings and exposes the synced subset", () => {
        useFlowStore.getState().applyAccountSettings({
            flowFont: "nope",
            theme: "dark",
            cardmirrorTextType: "analytic",
            defaultGridZoom: 9,
            rfdVim: true,
            keymapOverrides: { "sheet.prev": "Mod+[" },
        } as never);
        const st = useFlowStore.getState();
        expect(st).toMatchObject({ theme: "dark", defaultGridZoom: 3, gridZoom: 3, rfdVim: true });
        expect(st.keymapOverrides).toEqual({ "sheet.prev": "Mod+[" });
        const sub = accountSettingsOf(st);
        expect(sub).toMatchObject({ theme: "dark", defaultGridZoom: 3, rfdVim: true });
        expect(Object.keys(sub)).not.toContain("collabName");

        useFlowStore.getState().applyAccountSettings({ tooltips: false } as never);
        expect(useFlowStore.getState()).toMatchObject({ tooltips: false, gridZoom: 3 });
    });

    it("toggles transient UI flags", () => {
        const s = useFlowStore.getState();
        s.setQuickSwitcherOpen(true, ">");
        expect(useFlowStore.getState()).toMatchObject({ quickSwitcherOpen: true, paletteSeed: ">" });
        s.setQuickSwitcherOpen(false, ">");
        expect(useFlowStore.getState().paletteSeed).toBe("");
        s.setDocPath("/a.ebb");
        s.setNewFlowOpen(true);
        s.setSettingsOpen(true);
        s.setCheatsheetOpen(true);
        s.setInfoOpen(true);
        s.setRenamingSheet("x");
        expect(useFlowStore.getState()).toMatchObject({
            docPath: "/a.ebb",
            newFlowOpen: true,
            settingsOpen: true,
            cheatsheetOpen: true,
            infoOpen: true,
            renamingSheetId: "x",
        });
    });
});

describe("initial load from storage", () => {
    it("reads stored and synced settings at module init", async () => {
        window.localStorage.setItem(
            "ebb-display-settings",
            JSON.stringify({ rfdVim: true, collabName: "Pat", flowsDir: "/f", affColor: "bad", defaultGridZoom: 2 }),
        );
        window.localStorage.setItem(
            "ebbSyncedSettings",
            JSON.stringify([
                { id: "display", values: { theme: "dark", tooltips: false } },
                { id: "keymap", keymapOverrides: { "sheet.next": "Mod+N", bad: 3 } },
            ]),
        );
        vi.resetModules();
        const mod = await import("../src/lib/store/useFlowStore");
        const st = mod.useFlowStore.getState();
        expect(st).toMatchObject({
            rfdVim: true,
            collabName: "Pat",
            flowsDir: "/f",
            affColor: null,
            defaultGridZoom: 2,
            gridZoom: 2,
            theme: "dark",
            tooltips: false,
        });
        expect(st.keymapOverrides).toEqual({ "sheet.next": "Mod+N" });
    });

    it("falls back on corrupt storage", async () => {
        window.localStorage.setItem("ebb-display-settings", "{not json");
        window.localStorage.setItem("ebb-keymap-settings", JSON.stringify({ keymapOverrides: { a: "b" } }));
        vi.resetModules();
        const mod = await import("../src/lib/store/useFlowStore");
        const st = mod.useFlowStore.getState();
        expect(st.appendEdit).toBe(true);
        expect(st.keymapOverrides).toEqual({ a: "b" });
    });
});
