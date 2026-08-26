/**
 * Zustand store for the active flow round and editor UI state.
 *
 * The grid's cell data lives in Handsontable at runtime; this store holds the
 * persisted FlowRound document plus app-level UI state. Every round-mutating
 * action replaces objects immutably and bumps updatedAt, which is what the
 * autosave subscription watches.
 */

import { create } from "zustand";

import { resolveCardMirrorTextType, type CardMirrorTextType } from "../bridge/cardmirror";
import { resolveContacts, type Contacts } from "../collab/contacts";
import { forgetJoined } from "../collab/joined";
import { clearReplica, recordOp, seedReplica } from "../collab/replica";
import { forgetRoundPeers } from "../collab/roundPeers";
import { flattenLeaves, type Json } from "../collab/types";
import type { CommandId } from "../commands/registry";
import { type FontId, DEFAULT_FONT_ID, resolveFontId } from "../fonts/registry";
import { getEvent } from "../format/events";
import {
    compareSheets,
    firstFlowSheetId,
    makeFlowSheet,
    sortedSheets,
    type CellMeta,
    type FlowRound,
    type FlowSheet,
} from "../model/flow";
import type { Scouting, Side } from "../model/types";
import { resolveThemeMode, type ThemeMode } from "../theme/mode";
import { loadUpdateConfig, saveUpdateConfig } from "../update/settings";
import type { UpdateConfig } from "../update/types";

// --- State shape -------------------------------------------------------------

/** Payload for the delete-sheet Undo toast; the sheet carries its own data. */
export interface RemovedFlowSheet {
    sheet: FlowSheet;
    wasActive: boolean;
}

/** The two edges of the sidebar's sheet selection; the anchor stays displayed. */
export interface SheetRange {
    anchor: string;
    head: string;
}

export interface FlowState {
    round: FlowRound | null;
    /**
     * Absolute path of the .ebb file the open round came from, or null on the
     * start screen. It lives beside the round rather than in its own store so
     * autosave can never observe a new round next to a stale path and write a
     * flow into the wrong file.
     */
    docPath: string | null;
    activeSheetId: string | null;
    /** Grid cell the reveal asked to jump to; carries the sheet so the matching pane selects it. */
    revealTarget: { sheetId: string; row: number; col: number } | null;
    /** Second pane's sheet id when split; null = single pane. */
    splitSheetId: string | null;
    /** Which pane is focused (1 = left, 2 = right); only meaningful when split. */
    focusedPane: 1 | 2;
    /** Speech (column) to switch to; HotGrid seeds every sheet's cursor to its top row and selects it on the active sheet. A fresh object re-fires the effect. */
    speechTarget: { speechId: string } | null;
    /** CommandId -> custom chord, overriding the preset binding. */
    keymapOverrides: Record<string, string>;
    flowFont: FontId;
    /** Live grid-only zoom (1 = 100%); scales the flow grid, not the chrome. Session-only, seeded from defaultGridZoom. */
    gridZoom: number;
    /** Persisted zoom the grid opens at; the header control adjusts gridZoom without disturbing this. */
    defaultGridZoom: number;
    theme: ThemeMode;
    /** Custom aff/neg ink; null keeps the theme default. */
    affColor: string | null;
    negColor: string | null;
    /**
     * Folder new flows are filed in. null follows the platform default that
     * `flow_paths` resolves; a value here overrides it.
     */
    flowsDir: string | null;
    /** Desktop auto-update behavior (background checks opt-in). */
    updateConfig: UpdateConfig;
    /** The unified command/search palette. */
    quickSwitcherOpen: boolean;
    /** Initial query the palette opens with; ">" seeds command mode. */
    paletteSeed: string;
    /** The New flow prompt, reachable from the start screen and the File menu. */
    newFlowOpen: boolean;
    settingsOpen: boolean;
    cheatsheetOpen: boolean;
    infoOpen: boolean;
    sidebarCollapsed: boolean;
    /** RFD drawer open/closed; persisted like sidebarCollapsed. */
    rfdOpen: boolean;
    /** Vim keybindings in the RFD editor; persisted like sidebarCollapsed. */
    rfdVim: boolean;
    /** Paste pushes the target columns' existing cells down instead of overwriting them. */
    insertPaste: boolean;
    /**
     * Typing on a selected cell adds to the text already there instead of
     * replacing it. Off, the first character wipes the cell, which is
     * Handsontable's own behavior.
     */
    appendEdit: boolean;
    /** Mod+scroll (and trackpad pinch) zooms the grid; off leaves the wheel alone. */
    scrollZoom: boolean;
    /**
     * Every flow sheet's grid sits at the round's speaking order, leading with
     * one inert column per speech it does not show, so a speech holds one
     * screen position across sheets. Off, a sheet starts flush at its own
     * first speech.
     */
    alignSpeeches: boolean;
    /** Hover tips on buttons and controls; off renders the trigger bare. */
    tooltips: boolean;
    /** Master switch for the CardMirror bridge; off leaves every route dead. */
    cardmirrorEnabled: boolean;
    /** How CardMirror types text sent to it from a cell. */
    cardmirrorTextType: CardMirrorTextType;
    /** Master switch for shared editing; off leaves every route dead. */
    collabEnabled: boolean;
    /** Whether a session may fall back to a relay when a direct link fails. */
    collabRelayEnabled: boolean;
    /**
     * Whether an endpoint stays bound between rounds so a saved contact's
     * invite has somewhere to land. Its own switch, not part of the master
     * one: shared editing being available is not a reason to be on the
     * network from launch, and this is the only setting in ebb that puts it
     * there without the debater asking for a round.
     */
    collabListenEnabled: boolean;
    /**
     * Whether a read-only peer's cursor is painted on the grid. A viewer
     * reading along leaves a marker on every cell they scroll past, which is
     * noise to the debater doing the writing.
     */
    collabShowViewers: boolean;
    /**
     * What a shared round calls this side. Empty means the machine's own name
     * is broadcast instead, which is why the hostname is never written here:
     * the config file syncs between machines.
     */
    collabName: string;
    /** Peers shared with before, keyed by EndpointId. */
    contacts: Contacts;
    renamingSheetId: string | null;
    /**
     * The sidebar's sheet selection, held as its two edges rather than a list
     * of ids: the visible range is derived through `sheetRangeIds` on every
     * render, so a sheet deleted out from under it resolves to no selection
     * instead of leaving a stale id behind, and a block move keeps the same
     * two edges without rewriting anything.
     *
     * Local to this sidebar. Never an op, never in a `.ebb`, never on the
     * wire: two debaters sharing a round each aim at what they are about to
     * move.
     */
    sheetRange: SheetRange | null;
}

export interface FlowActions {
    loadRound(
        round: FlowRound,
        opts?: { docPath?: string | null; activeSheetId?: string | null; newFlow?: boolean },
    ): void;
    /** Drop the open round and its path, returning to the start screen. */
    closeRound(): void;
    addSheet(input: { title?: string; group: "aff" | "neg" }): string;
    /** Batch version of addSheet: appends all in one update, activates the first. */
    addSheets(inputs: { title?: string; group: "aff" | "neg" }[]): string[];
    renameSheet(sheetId: string, title: string): void;
    removeSheet(sheetId: string): RemovedFlowSheet | null;
    restoreSheet(removed: RemovedFlowSheet): void;
    /** Renumbers the given flow sheets to contiguous order by array position. */
    reorderSheets(orderedFlowSheetIds: string[]): void;
    /** Sets or clears the sidebar's sheet selection. */
    setSheetRange(range: SheetRange | null): void;
    setActiveSheet(sheetId: string): void;
    /** Switch to a sheet and select one of its cells (used by the search palette). */
    revealCell(sheetId: string, row: number, col: number): void;
    /**
     * In single-pane mode, focuses the topmost flow sheet and seeds the
     * cursor at the given speech's top row. In split mode, records the
     * speech target for the focused pane without changing which sheets show.
     */
    switchSpeech(speechId: string): void;
    /** Flips which side speaks first; no-op unless the event's order varies (PF). */
    swapSpeakingOrder(): void;
    /** Opens a second pane on the next sheet, or collapses back to the focused pane's sheet. */
    toggleSplit(): void;
    /** Focuses the given pane; no-op outside split. */
    focusPane(pane: 1 | 2): void;
    /** Grid snapshot sink: replaces one sheet's data/meta (no-op when unchanged). */
    updateSheetData(
        sheetId: string,
        data: (string | null)[][],
        meta: Record<string, CellMeta>,
    ): void;
    /**
     * The round a partner's change produced. Written whole rather than sheet
     * by sheet: a partner can add, retitle, and delete sheets as well as type
     * in one, and the replica's projection already describes all of it.
     */
    applyRemoteRound(next: FlowRound): void;
    setScouting(patch: Partial<Scouting>): void;
    setKeymapOverride(commandId: CommandId, chord: string): void;
    clearKeymapOverride(commandId: CommandId): void;
    setFlowFont(id: FontId): void;
    /** Sets the live grid zoom to an absolute factor, clamped to the zoom bounds. */
    setGridZoom(zoom: number): void;
    /** Steps the live grid zoom by `delta`, clamped to the zoom bounds. */
    zoomGrid(delta: number): void;
    /** Sets the persisted default zoom, also applying it to the live grid. */
    setDefaultGridZoom(zoom: number): void;
    setRfdVim(on: boolean): void;
    setInsertPaste(on: boolean): void;
    setAppendEdit(on: boolean): void;
    setScrollZoom(on: boolean): void;
    setAlignSpeeches(on: boolean): void;
    setTooltips(on: boolean): void;
    setCardmirrorEnabled(on: boolean): void;
    setCardmirrorTextType(type: CardMirrorTextType): void;
    setCollabEnabled(on: boolean): void;
    setCollabRelayEnabled(on: boolean): void;
    setCollabListenEnabled(on: boolean): void;
    setCollabShowViewers(on: boolean): void;
    setCollabName(name: string): void;
    setContacts(contacts: Contacts): void;
    setTheme(mode: ThemeMode): void;
    /** Sets one side's custom ink; null resets it to the theme default. */
    setSideColor(side: Side, color: string | null): void;
    /** null restores the platform default. */
    setFlowsDir(dir: string | null): void;
    /** Merges a partial update config, persisting the result. */
    setUpdateConfig(patch: Partial<UpdateConfig>): void;
    /**
     * Replaces every externally-syncable setting at once and persists all three
     * localStorage buckets. Used by the desktop config-file sync when the file
     * changes underneath the app; the caller suppresses the write-back so this
     * does not bounce straight back out to disk.
     */
    applyExternalConfig(config: AppConfig): void;
    /** Opens/closes the palette; `seed` sets the initial query (">" = command mode). */
    setQuickSwitcherOpen(open: boolean, seed?: string): void;
    /** Follow the open round to a new file after Save As. */
    setDocPath(path: string): void;
    setNewFlowOpen(open: boolean): void;
    setSettingsOpen(open: boolean): void;
    setCheatsheetOpen(open: boolean): void;
    setInfoOpen(open: boolean): void;
    setSidebarCollapsed(collapsed: boolean): void;
    setRfdOpen(open: boolean): void;
    setRenamingSheet(id: string | null): void;
}

export type FlowStore = FlowState & FlowActions;

/**
 * The full set of settings the desktop config file mirrors, in the store's own
 * camelCase vocabulary. The config module maps this to/from the plain-text file.
 */
export interface AppConfig extends DisplaySettings {
    keymapOverrides: Record<string, string>;
    updateConfig: UpdateConfig;
}

// --- Settings persistence (localStorage) --------------------------------------

const KEYMAP_SETTINGS_KEY = "ebb-keymap-settings";
const DISPLAY_SETTINGS_KEY = "ebb-display-settings";
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;
/** One "zoom in/out" step: 10%. */
export const ZOOM_STEP = 0.1;

/** Clamps to the zoom bounds and snaps to whole percents so steps never drift. */
export function clampZoom(zoom: number): number {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(zoom * 100) / 100));
}

/**
 * A valid zoom factor from a hand-edited config value: a finite number clamped
 * to the bounds (so 5 becomes the 3.0 max, not a reset), else 1 (100%).
 */
export function resolveZoom(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) ? clampZoom(value) : 1;
}

function loadKeymapOverrides(): Record<string, string> {
    if (typeof window === "undefined") return {};
    try {
        const raw = window.localStorage.getItem(KEYMAP_SETTINGS_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as { keymapOverrides?: Record<string, string> };
        return parsed.keymapOverrides ?? {};
    } catch {
        return {};
    }
}

function saveKeymapOverrides(keymapOverrides: Record<string, string>): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(KEYMAP_SETTINGS_KEY, JSON.stringify({ keymapOverrides }));
    } catch {
        // localStorage unavailable (private mode, quota) - ignore.
    }
}

interface DisplaySettings {
    flowFont: FontId;
    defaultGridZoom: number;
    sidebarCollapsed: boolean;
    rfdOpen: boolean;
    rfdVim: boolean;
    insertPaste: boolean;
    appendEdit: boolean;
    scrollZoom: boolean;
    alignSpeeches: boolean;
    tooltips: boolean;
    cardmirrorEnabled: boolean;
    cardmirrorTextType: CardMirrorTextType;
    collabEnabled: boolean;
    collabRelayEnabled: boolean;
    collabListenEnabled: boolean;
    collabShowViewers: boolean;
    collabName: string;
    contacts: Contacts;
    theme: ThemeMode;
    affColor: string | null;
    negColor: string | null;
    flowsDir: string | null;
}

/** Accepts only a `#rrggbb` literal, the shape native color inputs emit. */
export function resolveColor(value: unknown): string | null {
    return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : null;
}

/** A hand-edited or stale stored value as a boolean, falling back when it is neither. */
export function bool(value: unknown, fallback: boolean): boolean {
    return typeof value === "boolean" ? value : fallback;
}

function loadDisplaySettings(): DisplaySettings {
    const fallback: DisplaySettings = {
        flowFont: DEFAULT_FONT_ID,
        defaultGridZoom: 1,
        sidebarCollapsed: false,
        rfdOpen: false,
        rfdVim: false,
        insertPaste: false,
        appendEdit: true,
        scrollZoom: true,
        alignSpeeches: false,
        tooltips: true,
        cardmirrorEnabled: true,
        cardmirrorTextType: "analytic",
        theme: "system",
        collabEnabled: false,
        collabRelayEnabled: true,
        collabListenEnabled: false,
        collabShowViewers: true,
        collabName: "",
        contacts: {},
        affColor: null,
        negColor: null,
        flowsDir: null,
    };
    if (typeof window === "undefined") return fallback;
    try {
        const raw = window.localStorage.getItem(DISPLAY_SETTINGS_KEY);
        if (!raw) return fallback;
        const p = JSON.parse(raw) as Partial<DisplaySettings>;
        return {
            flowFont: resolveFontId(p.flowFont),
            defaultGridZoom: resolveZoom(p.defaultGridZoom),
            sidebarCollapsed: bool(p.sidebarCollapsed, false),
            rfdOpen: bool(p.rfdOpen, false),
            rfdVim: bool(p.rfdVim, false),
            insertPaste: bool(p.insertPaste, false),
            appendEdit: bool(p.appendEdit, true),
            scrollZoom: bool(p.scrollZoom, true),
            alignSpeeches: bool(p.alignSpeeches, false),
            tooltips: bool(p.tooltips, true),
            cardmirrorEnabled: bool(p.cardmirrorEnabled, true),
            cardmirrorTextType: resolveCardMirrorTextType(p.cardmirrorTextType),
            theme: resolveThemeMode(p.theme),
            collabEnabled: bool(p.collabEnabled, false),
            collabRelayEnabled: bool(p.collabRelayEnabled, true),
            collabListenEnabled: bool(p.collabListenEnabled, false),
            collabShowViewers: bool(p.collabShowViewers, true),
            collabName: typeof p.collabName === "string" ? p.collabName : "",
            contacts: resolveContacts(p.contacts),
            flowsDir: typeof p.flowsDir === "string" && p.flowsDir ? p.flowsDir : null,
            affColor: resolveColor(p.affColor),
            negColor: resolveColor(p.negColor),
        };
    } catch {
        return fallback;
    }
}

function saveDisplaySettings(s: DisplaySettings): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(DISPLAY_SETTINGS_KEY, JSON.stringify(s));
    } catch {
        // ignore
    }
}

/** The persisted display fields as they currently stand in the store. */
function displaySettingsOf(s: FlowState): DisplaySettings {
    return {
        flowFont: s.flowFont,
        defaultGridZoom: s.defaultGridZoom,
        sidebarCollapsed: s.sidebarCollapsed,
        rfdOpen: s.rfdOpen,
        rfdVim: s.rfdVim,
        insertPaste: s.insertPaste,
        appendEdit: s.appendEdit,
        scrollZoom: s.scrollZoom,
        alignSpeeches: s.alignSpeeches,
        tooltips: s.tooltips,
        cardmirrorEnabled: s.cardmirrorEnabled,
        cardmirrorTextType: s.cardmirrorTextType,
        theme: s.theme,
        collabEnabled: s.collabEnabled,
        collabRelayEnabled: s.collabRelayEnabled,
        collabListenEnabled: s.collabListenEnabled,
        collabShowViewers: s.collabShowViewers,
        collabName: s.collabName,
        contacts: s.contacts,
        flowsDir: s.flowsDir,
        affColor: s.affColor,
        negColor: s.negColor,
    };
}

/**
 * Writes a display-settings patch to localStorage and the store together, so a
 * setter cannot update one without the other.
 */
function persistDisplay(
    set: (patch: Partial<DisplaySettings>) => void,
    get: () => FlowState,
    patch: Partial<DisplaySettings>,
): void {
    saveDisplaySettings({ ...displaySettingsOf(get()), ...patch });
    set(patch);
}

const initialDisplaySettings = loadDisplaySettings();

// --- Store ---------------------------------------------------------------------

/** A round copy with updatedAt bumped; every content edit routes through this. */
function touch(round: FlowRound): FlowRound {
    return { ...round, updatedAt: Date.now() };
}

/** The sheet id shown in the focused pane. */
export function focusedSheetId(
    s: Pick<FlowState, "activeSheetId" | "splitSheetId" | "focusedPane">,
): string | null {
    return s.splitSheetId != null && s.focusedPane === 2 ? s.splitSheetId : s.activeSheetId;
}

/**
 * Assign `sheetId` to the focused pane. In single mode that is just
 * `activeSheetId`. In split mode, picking the sheet already in the OTHER pane
 * swaps the two panes rather than showing a sheet twice.
 *
 * Every focus change funnels through here, which is where the sheet range
 * collapses: a selection is aimed at the block a debater is about to move, so
 * it never outlives the sheet it was built from.
 */
function assignFocused(
    s: Pick<FlowState, "activeSheetId" | "splitSheetId" | "focusedPane">,
    sheetId: string,
): { activeSheetId: string | null; splitSheetId: string | null; sheetRange: null } {
    if (s.splitSheetId == null) {
        return { activeSheetId: sheetId, splitSheetId: null, sheetRange: null };
    }
    const focusedCur = s.focusedPane === 1 ? s.activeSheetId : s.splitSheetId;
    const other = s.focusedPane === 1 ? s.splitSheetId : s.activeSheetId;
    const newOther = sheetId === other ? focusedCur : other;
    return s.focusedPane === 1
        ? { activeSheetId: sheetId, splitSheetId: newOther, sheetRange: null }
        : { activeSheetId: newOther, splitSheetId: sheetId, sheetRange: null };
}

export const useFlowStore = create<FlowStore>()((set, get) => ({
    round: null,
    docPath: null,
    activeSheetId: null,
    revealTarget: null,
    splitSheetId: null,
    focusedPane: 1,
    speechTarget: null,
    keymapOverrides: loadKeymapOverrides(),
    flowFont: initialDisplaySettings.flowFont,
    gridZoom: initialDisplaySettings.defaultGridZoom,
    defaultGridZoom: initialDisplaySettings.defaultGridZoom,
    theme: initialDisplaySettings.theme,
    flowsDir: initialDisplaySettings.flowsDir,
    affColor: initialDisplaySettings.affColor,
    negColor: initialDisplaySettings.negColor,
    updateConfig: loadUpdateConfig(),
    quickSwitcherOpen: false,
    paletteSeed: "",
    newFlowOpen: false,
    settingsOpen: false,
    cheatsheetOpen: false,
    infoOpen: false,
    sidebarCollapsed: initialDisplaySettings.sidebarCollapsed,
    rfdOpen: initialDisplaySettings.rfdOpen,
    rfdVim: initialDisplaySettings.rfdVim,
    insertPaste: initialDisplaySettings.insertPaste,
    appendEdit: initialDisplaySettings.appendEdit,
    scrollZoom: initialDisplaySettings.scrollZoom,
    alignSpeeches: initialDisplaySettings.alignSpeeches,
    tooltips: initialDisplaySettings.tooltips,
    cardmirrorEnabled: initialDisplaySettings.cardmirrorEnabled,
    cardmirrorTextType: initialDisplaySettings.cardmirrorTextType,
    collabEnabled: initialDisplaySettings.collabEnabled,
    collabRelayEnabled: initialDisplaySettings.collabRelayEnabled,
    collabListenEnabled: initialDisplaySettings.collabListenEnabled,
    collabShowViewers: initialDisplaySettings.collabShowViewers,
    collabName: initialDisplaySettings.collabName,
    contacts: initialDisplaySettings.contacts,
    renamingSheetId: null,
    sheetRange: null,

    loadRound(round, opts) {
        // Unconditional: opening one flow straight over another never closes
        // the first, so this is the only point that always sees the switch.
        seedReplica(round);
        set({
            round,
            docPath: opts?.docPath ?? null,
            activeSheetId:
                opts?.activeSheetId !== undefined ? opts.activeSheetId : firstFlowSheetId(round),
            splitSheetId: null,
            focusedPane: 1,
            // A brand-new flow always opens with the RFD drawer closed; an
            // existing flow restores the persisted preference. loadRound never
            // persists rfdOpen, so forcing it closed here stays transient.
            rfdOpen: opts?.newFlow ? false : loadDisplaySettings().rfdOpen,
            quickSwitcherOpen: false,
            renamingSheetId: null,
            sheetRange: null,
        });
    },

    closeRound() {
        clearReplica();
        // The remembered peers belong to the round that was open. Leaving the
        // start screen holding a closed round's partner ids keeps who a debater
        // shared with resident in memory for nothing.
        forgetRoundPeers();
        // And a join is a gesture about the round that was open, not a
        // standing grant: the next open of the same file is an open again.
        forgetJoined();
        set({
            round: null,
            docPath: null,
            activeSheetId: null,
            splitSheetId: null,
            renamingSheetId: null,
            sheetRange: null,
        });
    },

    addSheet(input) {
        const { round } = get();
        if (!round) return "";
        const maxOrder = round.sheets.length ? Math.max(...round.sheets.map((s) => s.order)) : -1;
        // Default title enumerates flow sheets per-side: the nth aff sheet is "n.".
        const count = round.sheets.filter(
            (s) => s.kind === "flow" && s.group === input.group,
        ).length;
        const title = input.title ?? `${count + 1}.`;
        const sheet = makeFlowSheet({ ...input, title, order: maxOrder + 1 });
        set({
            round: touch({ ...round, sheets: [...round.sheets, sheet] }),
            activeSheetId: sheet.id,
        });
        recordOp({ kind: "addSheet", sheet });
        return sheet.id;
    },

    addSheets(inputs) {
        const { round } = get();
        if (!round || inputs.length === 0) return [];
        let maxOrder = round.sheets.length ? Math.max(...round.sheets.map((s) => s.order)) : -1;
        // Continue per-side numbering from the current flow-sheet count, like addSheet.
        const counts: Record<"aff" | "neg", number> = {
            aff: round.sheets.filter((s) => s.kind === "flow" && s.group === "aff").length,
            neg: round.sheets.filter((s) => s.kind === "flow" && s.group === "neg").length,
        };
        const created = inputs.map((input) => {
            counts[input.group] += 1;
            const title = input.title ?? `${counts[input.group]}.`;
            return makeFlowSheet({ ...input, title, order: ++maxOrder });
        });
        set({
            round: touch({ ...round, sheets: [...round.sheets, ...created] }),
            activeSheetId: created[0].id,
        });
        // One op per sheet: the op union has no batch member.
        for (const sheet of created) recordOp({ kind: "addSheet", sheet });
        return created.map((s) => s.id);
    },

    renameSheet(sheetId, title) {
        const { round } = get();
        if (!round) return;
        set({
            round: touch({
                ...round,
                sheets: round.sheets.map((s) => (s.id === sheetId ? { ...s, title } : s)),
            }),
        });
        recordOp({ kind: "sheetField", sheetId, path: "title", value: title });
    },

    swapSpeakingOrder() {
        const { round } = get();
        if (!round || !getEvent(round.event).variableOrder) return;
        const firstSide = (round.firstSide ?? "aff") === "aff" ? "neg" : "aff";
        set({ round: touch({ ...round, firstSide }) });
        recordOp({ kind: "roundField", path: "firstSide", value: firstSide });
    },

    removeSheet(sheetId) {
        const { round, activeSheetId, splitSheetId } = get();
        if (!round) return null;
        const sheet = round.sheets.find((s) => s.id === sheetId);
        if (!sheet || sheet.kind === "cx") return null;

        const wasActive = activeSheetId === sheetId;
        const remaining = round.sheets.filter((s) => s.id !== sheetId);
        const nextRound = touch({ ...round, sheets: remaining });
        recordOp({ kind: "removeSheet", sheetId });

        // A deleted anchor or head would resolve to no selection on its own,
        // but deleting from the middle of a range would silently shrink it,
        // and a range that quietly changed what it covers is worse than one
        // that ended.
        const cleared = { sheetRange: null } as const;

        // Deleting a sheet that a split pane is showing collapses the split:
        // the surviving pane keeps its sheet, so the two panes never end up
        // pointing at the same sheet or at one that no longer exists.
        if (splitSheetId != null) {
            if (sheetId === splitSheetId) {
                set({ ...cleared, round: nextRound, splitSheetId: null, focusedPane: 1 });
            } else if (wasActive) {
                set({
                    ...cleared,
                    round: nextRound,
                    activeSheetId: splitSheetId,
                    splitSheetId: null,
                    focusedPane: 1,
                });
            } else {
                set({ ...cleared, round: nextRound });
            }
            return { sheet, wasActive };
        }

        let nextActive = activeSheetId;
        if (wasActive) {
            const flows = remaining.filter((s) => s.kind !== "cx").sort(compareSheets);
            const below = flows.filter((s) => s.order < sheet.order).pop();
            nextActive = (below ?? flows[0])?.id ?? null;
        }
        set({ ...cleared, round: nextRound, activeSheetId: nextActive });
        return { sheet, wasActive };
    },

    restoreSheet(removed) {
        const { round } = get();
        if (!round) return;
        set({
            round: touch({ ...round, sheets: [...round.sheets, removed.sheet] }),
            ...(removed.wasActive ? { activeSheetId: removed.sheet.id } : {}),
        });
        recordOp({ kind: "addSheet", sheet: removed.sheet });
    },

    reorderSheets(orderedFlowSheetIds) {
        const { round } = get();
        if (!round) return;
        const orderById = new Map(orderedFlowSheetIds.map((id, i) => [id, i] as const));
        set({
            round: touch({
                ...round,
                sheets: round.sheets.map((s) =>
                    orderById.has(s.id) ? { ...s, order: orderById.get(s.id)! } : s,
                ),
            }),
        });
        // A renumber touches every sheet it names, so each one reports its own.
        for (const [sheetId, order] of orderById) {
            recordOp({ kind: "sheetField", sheetId, path: "order", value: order });
        }
    },

    setSheetRange(range) {
        set({ sheetRange: range });
    },

    setActiveSheet(sheetId) {
        set(assignFocused(get(), sheetId));
    },

    revealCell(sheetId, row, col) {
        // A fresh object each call so the pane's effect re-fires even when the
        // same cell is revealed twice in a row.
        set({ ...assignFocused(get(), sheetId), revealTarget: { sheetId, row, col } });
    },

    switchSpeech(speechId) {
        const { round, splitSheetId } = get();
        if (!round) return;
        // A fresh speechTarget object re-fires the pane effect even for a
        // repeat pick of the same speech.
        if (splitSheetId != null) {
            // Split: apply to the focused pane; do not disturb which sheets show.
            set({ speechTarget: { speechId } });
            return;
        }
        const topId = firstFlowSheetId(round);
        if (!topId) return;
        set({ activeSheetId: topId, speechTarget: { speechId } });
    },

    toggleSplit() {
        const { round, splitSheetId, activeSheetId } = get();
        if (!round) return;
        if (splitSheetId != null) {
            set({ activeSheetId: focusedSheetId(get()), splitSheetId: null, focusedPane: 1 });
            return;
        }
        const order = sortedSheets(round);
        const i = order.findIndex((s) => s.id === activeSheetId);
        const next = order[i + 1] ?? order[i - 1];
        // No second sheet to show -> stay single-pane.
        if (!next) return;
        set({ splitSheetId: next.id, focusedPane: 1 });
    },

    focusPane(pane) {
        if (get().splitSheetId == null) return;
        set({ focusedPane: pane });
    },

    updateSheetData(sheetId, data, meta) {
        const { round } = get();
        if (!round) return;
        const sheet = round.sheets.find((s) => s.id === sheetId);
        if (!sheet) return;
        if (
            JSON.stringify(sheet.data) === JSON.stringify(data) &&
            JSON.stringify(sheet.meta) === JSON.stringify(meta)
        ) {
            return;
        }
        set({
            round: touch({
                ...round,
                sheets: round.sheets.map((s) => (s.id === sheetId ? { ...s, data, meta } : s)),
            }),
        });
    },

    applyRemoteRound(next) {
        const { round, activeSheetId, splitSheetId, focusedPane } = get();
        if (!round || round.id !== next.id) return;
        const alive = (id: string | null) =>
            id !== null && next.sheets.some((s) => s.id === id) ? id : null;
        // A partner deleting the sheet under the cursor leaves the pane
        // pointing at nothing, so the view falls back the way a local delete
        // does rather than rendering an empty grid.
        const split = alive(splitSheetId);
        set({
            round: touch(next),
            activeSheetId: alive(activeSheetId) ?? firstFlowSheetId(next),
            splitSheetId: split,
            focusedPane: split === null ? 1 : focusedPane,
        });
    },

    setScouting(patch) {
        const { round } = get();
        if (!round) return;
        set({ round: touch({ ...round, scouting: { ...round.scouting, ...patch } }) });
        // Flattened, so a nested patch lands as scouting.decision.vote rather
        // than as one register holding the whole decision object.
        const leaves: Record<string, Json> = {};
        flattenLeaves(patch, "scouting", leaves);
        for (const [path, value] of Object.entries(leaves)) {
            recordOp({ kind: "roundField", path, value });
        }
    },

    setKeymapOverride(commandId, chord) {
        const keymapOverrides = { ...get().keymapOverrides, [commandId]: chord };
        saveKeymapOverrides(keymapOverrides);
        set({ keymapOverrides });
    },

    clearKeymapOverride(commandId) {
        const keymapOverrides = { ...get().keymapOverrides };
        delete keymapOverrides[commandId];
        saveKeymapOverrides(keymapOverrides);
        set({ keymapOverrides });
    },

    setFlowFont: (id) => persistDisplay(set, get, { flowFont: id }),

    setGridZoom(zoom) {
        const z = clampZoom(zoom);
        if (z === get().gridZoom) return;
        set({ gridZoom: z });
    },

    zoomGrid(delta) {
        get().setGridZoom(get().gridZoom + delta);
    },

    setDefaultGridZoom(zoom) {
        const z = clampZoom(zoom);
        saveDisplaySettings({ ...displaySettingsOf(get()), defaultGridZoom: z });
        set({ defaultGridZoom: z, gridZoom: z });
    },

    setRfdVim: (on) => persistDisplay(set, get, { rfdVim: on }),

    setInsertPaste: (on) => persistDisplay(set, get, { insertPaste: on }),

    setAppendEdit: (on) => persistDisplay(set, get, { appendEdit: on }),

    setScrollZoom: (on) => persistDisplay(set, get, { scrollZoom: on }),

    setAlignSpeeches: (on) => persistDisplay(set, get, { alignSpeeches: on }),

    setTooltips: (on) => persistDisplay(set, get, { tooltips: on }),

    setCardmirrorEnabled: (on) => persistDisplay(set, get, { cardmirrorEnabled: on }),

    setCardmirrorTextType: (type) => persistDisplay(set, get, { cardmirrorTextType: type }),

    setCollabEnabled: (on) => persistDisplay(set, get, { collabEnabled: on }),

    setContacts: (contacts) => persistDisplay(set, get, { contacts }),

    setCollabRelayEnabled: (on) => persistDisplay(set, get, { collabRelayEnabled: on }),

    setCollabListenEnabled: (on) => persistDisplay(set, get, { collabListenEnabled: on }),

    setCollabShowViewers: (on) => persistDisplay(set, get, { collabShowViewers: on }),

    setCollabName: (name) => persistDisplay(set, get, { collabName: name }),

    setTheme: (mode) => persistDisplay(set, get, { theme: mode }),

    setSideColor: (side, color) =>
        persistDisplay(set, get, side === "aff" ? { affColor: color } : { negColor: color }),

    setFlowsDir(dir) {
        const flowsDir = dir?.trim() ? dir.trim() : null;
        saveDisplaySettings({ ...displaySettingsOf(get()), flowsDir });
        set({ flowsDir });
    },

    setUpdateConfig(patch) {
        const updateConfig = { ...get().updateConfig, ...patch };
        saveUpdateConfig(updateConfig);
        set({ updateConfig });
    },

    applyExternalConfig(config) {
        const { keymapOverrides, updateConfig, ...display } = config;
        saveDisplaySettings(display);
        saveKeymapOverrides(keymapOverrides);
        saveUpdateConfig(updateConfig);
        // The live grid follows the incoming default; on boot they already match.
        set({
            ...display,
            gridZoom: display.defaultGridZoom,
            keymapOverrides,
            updateConfig,
        });
    },

    setQuickSwitcherOpen(open, seed = "") {
        set({ quickSwitcherOpen: open, paletteSeed: open ? seed : "" });
    },
    setDocPath(path) {
        set({ docPath: path });
    },
    setNewFlowOpen(open) {
        set({ newFlowOpen: open });
    },
    setSettingsOpen(open) {
        set({ settingsOpen: open });
    },
    setCheatsheetOpen(open) {
        set({ cheatsheetOpen: open });
    },
    setInfoOpen(open) {
        set({ infoOpen: open });
    },
    setSidebarCollapsed: (collapsed) => persistDisplay(set, get, { sidebarCollapsed: collapsed }),
    setRfdOpen: (open) => persistDisplay(set, get, { rfdOpen: open }),
    setRenamingSheet(id) {
        set({ renamingSheetId: id });
    },
}));
