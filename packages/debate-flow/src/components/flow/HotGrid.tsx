"use client";

import { HotTable } from "@handsontable/react-wrapper";
import type { HotTableRef } from "@handsontable/react-wrapper";
import type Handsontable from "handsontable";
import type { CellCoords, CellValue } from "handsontable";
import { registerAllModules } from "handsontable/registry";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import "handsontable/styles/handsontable.min.css";
import "handsontable/styles/ht-theme-main.min.css";

import { contactName } from "../../lib/collab/contacts";
import { liveCells } from "../../lib/collab/doc";
import {
    isReplicatedSource,
    rowOpFromHook,
    textOpsFromChanges,
    type ModelChange,
} from "../../lib/collab/gridOps";
import { gridPatchFor, type CellWrite, type GridPatch } from "../../lib/collab/gridPatch";
import { planRemoteApply } from "../../lib/collab/remoteApply";
import { getReplica, recordOp } from "../../lib/collab/replica";
import { rowOfIdentity, type CellRef } from "../../lib/collab/selection";
import { openSpanOps, replaceSpanOps } from "../../lib/collab/spanOps";
import { executeCommand } from "../../lib/commands/commands";
import { shiftMetaDown, type PasteShift } from "../../lib/grid/cellShift";
import { classNameToMeta, gridWidth, metaToClassName, padGrid, trimGrid } from "../../lib/grid/codec";
import {
    gridCol,
    modelCol,
    toGridCol,
    toModelCol,
    type GridCol,
    type ModelCol,
} from "../../lib/grid/colSpace";
import { FLOW_CONTEXT_MENU } from "../../lib/grid/contextMenu";
import {
    columnsForFlowSheet,
    headerSettings,
    spacerColumns,
    spacerCount,
    type SpeechCol,
} from "../../lib/grid/flowColumns";
import { getActiveHot, setActiveHot } from "../../lib/grid/hotInstance";
import {
    attachMetaUndo,
    rebaseUndoStacks,
    onRedoStackChange,
    onUndoStackChange,
    resetMetaUndo,
    restoreMetaRedo,
    restoreMetaUndo,
    snapshotClasses,
    type ClassEntry,
} from "../../lib/grid/metaUndo";
import {
    cellIsMoving,
    commitMove,
    isMovingIn,
    movingBlock,
    nudge,
    revertMove,
} from "../../lib/grid/moveSession";
import { disableTextAssistance, seedAppend } from "../../lib/grid/plainTextInput";
import {
    claimCell,
    claimCursor,
    editingHere,
    getPresences,
    onPresenceChanged,
} from "../../lib/grid/presenceBridge";
import {
    LOCK_CLASS,
    lockLabel,
    PEER_CLASS,
    peerInitial,
    presenceOn,
} from "../../lib/grid/presenceDecor";
import { setRemoteApply, type RemoteApplyHandler } from "../../lib/grid/remoteBridge";
import { breakEmptiedLinks, REMOTE_WRITE, type GridChange } from "../../lib/grid/staleSource";
import { effectiveKeymap } from "../../lib/keymap/effective";
import { resolveCommand } from "../../lib/keymap/resolve";
import type { CellMeta, CellSource, FlowSheet } from "../../lib/model/flow";
import { useCollabStore } from "../../lib/store/useCollabStore";
import { useFlowStore, ZOOM_STEP } from "../../lib/store/useFlowStore";

registerAllModules();

// Empty rows a sheet shows up front, so the cursor can arrow down into blank
// space to align an argument with the speech it answers. minSpareRows grows
// the grid further as cells past this fill, so it is headroom, not a cap; kept
// modest because every sheet switch re-renders and re-measures the full pad.
const MIN_ROWS = 250;

// Every speech column is this wide.
const COL_WIDTH = 280;

// A pane's inert leading columns wear this on the TD. The wash is a
// background rather than an opacity, so the gridlines stay at full strength
// and the column reads as part of the grid instead of a panel beside it.
const SPACER_CLASS = "cell-spacer";

const ARROW_DELTAS: Record<string, { dr: number; dc: number }> = {
    ArrowUp: { dr: -1, dc: 0 },
    ArrowDown: { dr: 1, dc: 0 },
    ArrowLeft: { dr: 0, dc: -1 },
    ArrowRight: { dr: 0, dc: 1 },
};

// Non-printable keys that still write the selected cell, so a held cell has to
// refuse them alongside the printable ones. Everything else navigates and is
// free on a cell a peer is editing.
const EDIT_KEYS: Record<string, true> = { Backspace: true, Delete: true, F2: true };

// How long the refusal hint stays up. Long enough to read at speed, short
// enough that it is gone before the next argument.
const LOCK_HINT_MS = 2_000;

/**
 * Runs the command this chord is bound to and reports whether one existed.
 * What to swallow is the caller's business: a grid answer this displaces is
 * a different one for a bare key than for a Ctrl/Meta chord.
 */
function runBoundCommand(e: KeyboardEvent): boolean {
    const commandId = resolveCommand(effectiveKeymap(useFlowStore.getState().keymapOverrides), {
        key: e.key,
        code: e.code,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
    });
    if (!commandId) return false;
    executeCommand(commandId);
    return true;
}

/**
 * Excel-style Cmd/Ctrl+Arrow: from a filled cell adjacent to a filled cell,
 * stop at the end of that contiguous run; otherwise skip empties and land on
 * the next filled cell, or the sheet edge if none remains. minCol is the
 * sheet's own first column, so a jump stops there rather than in the pad.
 */
function smartJump(
    hot: Handsontable,
    row: number,
    col: number,
    { dr, dc }: { dr: number; dc: number },
    minCol: number,
): { row: number; col: number } {
    const maxR = hot.countRows() - 1;
    const maxC = hot.countCols() - 1;
    const inBounds = (r: number, c: number) => r >= 0 && r <= maxR && c >= minCol && c <= maxC;
    const filled = (r: number, c: number) => {
        const v = hot.getDataAtCell(r, c);
        return v != null && String(v).trim() !== "";
    };
    if (!inBounds(row + dr, col + dc)) return { row, col };

    let r = row;
    let c = col;
    if (filled(row, col) && filled(row + dr, col + dc)) {
        // Ride the filled run to its last cell.
        while (inBounds(r + dr, c + dc) && filled(r + dr, c + dc)) {
            r += dr;
            c += dc;
        }
    } else {
        // Skip empties to the next filled cell, else stop at the edge.
        r += dr;
        c += dc;
        while (inBounds(r + dr, c + dc) && !filled(r, c)) {
            r += dr;
            c += dc;
        }
    }
    return { row: r, col: c };
}

/** Redraws the selection box over the travelling block after a nudge. */
function reselectMovingBlock(hot: Handsontable): void {
    const b = movingBlock();
    if (!b) return;
    hot.selectCells([
        [b.blockStart, b.cols[0], b.blockStart + b.height - 1, b.cols[b.cols.length - 1]],
    ]);
    hot.render();
}

/** The visual columns a paste lands in, clamped to the grid. */
function pasteCols(hot: Handsontable, { col, width }: PasteShift): GridCol[] {
    const last = Math.min(col + width, hot.countCols());
    return Array.from({ length: Math.max(last - col, 0) }, (_, i) => gridCol(col + i));
}

/**
 * The sheet's meta as it stands on the grid, keyed by model column. A sheet
 * saves its own cells and none of the pad's, so the spacers are skipped and
 * every key shifts down past them.
 */
export function collectMeta(hot: Handsontable, spacers = 0): Record<string, CellMeta> {
    const meta: Record<string, CellMeta> = {};
    for (let r = 0; r < hot.countRows(); r++) {
        for (let c = spacers; c < hot.countCols(); c++) {
            const cellMeta = hot.getCellMeta(r, c);
            const m = classNameToMeta((cellMeta.className ?? "") as string);
            // A blank cell's provenance describes text that is gone, so the
            // save drops it. This is what retires a stale source a sheet
            // carried in from before the emptying rule existed.
            const text = hot.getDataAtCell(r, c);
            const source =
                text === null || text === undefined || text === ""
                    ? undefined
                    : (cellMeta.source as CellSource | undefined);
            const key = `${r},${c - spacers}`;
            if (source) meta[key] = { ...m, source };
            else if (m) meta[key] = m;
        }
    }
    return meta;
}

/**
 * Clears the outgoing sheet's decoration and provenance cells, then injects
 * the incoming sheet's stored meta. `prevMeta` is the sheet being left; since
 * every meta change is snapshotted back into a sheet's stored meta, its keys
 * are exactly the decorations and provenance live on the grid, so the clear
 * touches only those instead of every cell in the padded grid. `prevMeta` is
 * null only when the outgoing sheet is gone from the store (it was just
 * deleted), where the full grid must be scanned to catch its orphans.
 *
 * Every stored key names a model column, on both sides. So the keyed clearing
 * pass shifts up past `prevSpacers`, the pad the outgoing sheet was drawn
 * with, and the inject pass shifts up past `spacers`, the pad the incoming one
 * is about to be drawn with. The two differ when the pane is reloaded under a
 * changed pad, which is the one case where a key has to be swept off one
 * column and written onto another; the `key in meta` shortcut is only sound
 * while they agree. The scanning pass needs neither, sweeping the whole grid.
 */
export function applyMeta(
    hot: Handsontable,
    meta: Record<string, CellMeta>,
    prevMeta: Record<string, CellMeta> | null,
    spacers = 0,
    prevSpacers = spacers,
): void {
    if (prevMeta) {
        for (const key of Object.keys(prevMeta)) {
            if (prevSpacers === spacers && key in meta) continue;
            const [r, c] = key.split(",").map(Number);
            if (!Number.isFinite(r) || !Number.isFinite(c)) continue;
            hot.setCellMeta(r, c + prevSpacers, "className", "");
            hot.setCellMeta(r, c + prevSpacers, "source", undefined);
        }
    } else {
        for (let r = 0; r < hot.countRows(); r++) {
            for (let c = 0; c < hot.countCols(); c++) {
                const cellMeta = hot.getCellMeta(r, c);
                const cls = (cellMeta.className ?? "") as string;
                if (cls && classNameToMeta(cls)) hot.setCellMeta(r, c, "className", "");
                if (cellMeta.source) hot.setCellMeta(r, c, "source", undefined);
            }
        }
    }
    for (const [key, m] of Object.entries(meta)) {
        // A key is `row,col` everywhere it is written, and a peer's document is
        // one of the places it is read from, so a key that is not that is
        // skipped rather than turned into NaN coordinates.
        const [r, c] = key.split(",").map(Number);
        if (!Number.isFinite(r) || !Number.isFinite(c)) continue;
        hot.setCellMeta(r, c + spacers, "className", metaToClassName(m));
        hot.setCellMeta(r, c + spacers, "source", m.source);
    }
}

/**
 * Puts a partner's cells on the grid without disturbing anything else.
 *
 * The pane is padded to MIN_ROWS and grows with the debater's own typing, so a
 * partner writing past the bottom is the one case that has to add rows first;
 * appending them below the last row shifts nothing that is already there.
 */
function writeRemotePatch(hot: Handsontable, patch: GridPatch, spacers: number): void {
    if (patch.writes.length === 0 && patch.meta.length === 0) return;
    hot.batch(() => {
        const short = patch.height - hot.countRows();
        if (short > 0) hot.alter("insert_row_below", hot.countRows() - 1, short, REMOTE_WRITE);
        for (const { row, col, meta } of patch.meta) {
            const at = toGridCol(col, spacers);
            hot.setCellMeta(row, at, "className", meta ? metaToClassName(meta) : "");
            hot.setCellMeta(row, at, "source", meta?.source);
        }
        hot.setDataAtCell(
            patch.writes.map(({ row, col, text }) => [row, toGridCol(col, spacers), text] as const),
            REMOTE_WRITE,
        );
    });
}

/**
 * One grid instance for one pane. In split mode two instances coexist, one
 * per pane; the focused pane owns the shared active-grid singleton so
 * commands (undo, bold, row insert) reach the right one. `data` and
 * `colHeaders` are deliberately NOT JSX props: the react-wrapper re-applies
 * every prop through updateSettings on each re-render, which would wipe the
 * live grid back to its initial state. The sheet-switch effect below owns
 * data, headers, and cell meta. memo() keeps parent re-renders (store
 * updates) away from the wrapper.
 */
export default memo(function HotGrid({ sheetId, pane }: { sheetId: string; pane: 1 | 2 }) {
    const splitSheetId = useFlowStore((s) => s.splitSheetId);
    const focusedPane = useFlowStore((s) => s.focusedPane);
    const gridZoom = useFlowStore((s) => s.gridZoom);
    // Inert leading columns: one per speech this sheet does not show. They are
    // real grid columns, so a grid column index is not a cell index while the
    // count is above zero, and every value crossing to the model converts.
    // The selector returns a number, so a render only follows a change in it,
    // and that render is what reloads the pane when the setting is flipped.
    const spacers = useFlowStore((s) => spacerCount(s.round, sheetId, s.alignSpeeches));
    // A viewer reads the flow; the host drops their writes, so text typed here
    // would vanish on the next merge. Refusing the keystroke is honest where
    // silently losing it is not, and the same rule takes away the context menu,
    // whose entries all edit the sheet.
    const viewOnly = useCollabStore((s) => s.selfRole === "viewer");
    const showViewers = useFlowStore((s) => s.collabShowViewers);
    const isFocused = splitSheetId == null || focusedPane === pane;
    const hotRef = useRef<HotTableRef>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    // The grid mounts empty and is populated imperatively a commit later, so it
    // stays transparent (revealing the pane background, not the theme's dark
    // grid) until the first data load lands. opacity keeps it in layout, so
    // autoRowSize still measures while hidden.
    const [ready, setReady] = useState(false);
    const currentSheetIdRef = useRef<string | null>(null);
    const viewCache = useRef(new Map<string, { row: number; col: ModelCol }>());
    // The pad the grid carries. The load settles it before the redraw, so it
    // is the count the cells on screen were drawn with, and it is the one
    // thing in this file that says what a grid column means: the save, the
    // change hook, the closing editor's op, a partner's patch, the renderers,
    // the readonly rule and the keyboard guards all read it. The store holds
    // the incoming count as early as the render does, a commit before the
    // grid carries it, so it answers for none of them.
    const loadedSpacersRef = useRef(0);
    // afterRenderer and afterGetColHeader run once per cell per render cycle, so
    // they index this instead of re-deriving the column list per cell. A sheet's
    // columns depend on kind/group/startSpeechId and the round's firstSide; the
    // sheet-switch effect re-fires on either and is the only writer.
    const colsRef = useRef<SpeechCol[]>([]);
    // Cross-ex sheets render a period tier (headerLevel 0) above the leaf
    // Aff/Neg headers (headerLevel 1); the period tier stays neutral and bold.
    const hasGroupTierRef = useRef(false);
    // The refusal message for a keystroke aimed at a cell a peer holds. It sits
    // in the pane's corner and clears itself, so the debater is told without
    // anything to dismiss.
    const [lockHint, setLockHint] = useState<string | null>(null);
    const lockHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // A partner's text for the cell an editor was open on, kept back from the
    // grid rather than dropped. Named by identity so a row insert arriving
    // afterwards cannot slide it onto a different cell.
    const deferredRef = useRef<{ sheetId: string; cells: CellRef[] } | null>(null);

    /**
     * Puts a held-back cell on the grid once the editor that held it is gone.
     *
     * Deferring the write is only half of not overwriting a debater mid-word:
     * the text still has to arrive, and Handsontable announces no editor
     * closing to arrive on. So this is asked rather than fired, at the two
     * moments that matter - before the grid is read back into the store, and
     * on the next selection, so a debater sees their partner's line rather
     * than waiting for one.
     *
     * Escape is the case that makes it necessary. The edit is abandoned, the
     * grid keeps the text that was there before the partner wrote, and the
     * next snapshot pushes that stale cell over their line in the store.
     */
    const flushDeferred = useCallback(() => {
        const pending = deferredRef.current;
        const hot = hotRef.current?.hotInstance;
        if (!pending || !hot || editingHere()) return;
        deferredRef.current = null;
        // A sheet switch reloads every cell from the same projection, so a
        // hold-back for the sheet left behind has already been honoured.
        if (pending.sheetId !== currentSheetIdRef.current) return;
        const sheet = getReplica()?.sheets[pending.sheetId];
        if (!sheet) return;
        const writes: CellWrite[] = [];
        for (const ref of pending.cells) {
            // Null is a cell a partner deleted while it was held: there is no
            // longer a row to write, and the delete itself already landed.
            const row = rowOfIdentity(sheet, ref);
            if (row === null) continue;
            writes.push({ row, col: ref.col, text: liveCells(sheet, ref.col)[row].text });
        }
        writeRemotePatch(hot, { writes, meta: [], height: 0 }, loadedSpacersRef.current);
    }, []);

    const snapshot = useCallback(() => {
        const hot = hotRef.current?.hotInstance;
        const sid = currentSheetIdRef.current;
        if (!hot || !sid) return;
        // Before the read, never after: the grid is about to become the store,
        // and a cell still holding pre-partner text would take their line with
        // it.
        flushDeferred();
        const lead = loadedSpacersRef.current;
        const rows = (hot.getData() as (string | null)[][]).map((row) => row.slice(lead));
        useFlowStore.getState().updateSheetData(sid, trimGrid(rows), collectMeta(hot, lead));
    }, [flushDeferred]);

    useEffect(() => {
        const hot = hotRef.current?.hotInstance ?? null;
        if (hot) {
            // The app keymap owns undo/redo; strip the grid's own bindings so
            // Cmd/Ctrl+Z cannot fire twice.
            const grid = hot.getShortcutManager().getContext("grid");
            grid?.removeShortcutsByKeys(["control/meta", "z"]);
            grid?.removeShortcutsByKeys(["control/meta", "shift", "z"]);
        }
        return () => {
            if (getActiveHot() === hot) setActiveHot(null, null, null, 0);
        };
    }, []);

    // A partner's change reaching this grid. The plan decides what may be
    // touched; this only carries it out, and it never scrolls, never takes
    // focus, and never writes under the editor the debater is typing in.
    useEffect(() => {
        const onRemote: RemoteApplyHandler = (before, after) => {
            const hot = hotRef.current?.hotInstance;
            const sid = currentSheetIdRef.current;
            if (!hot || !sid) return;

            const editor = hot.getActiveEditor();
            const editorOpen = Boolean(editor?.isOpened?.());
            const sel = hot.getSelectedLast();
            const lead = loadedSpacersRef.current;
            // Null for a cursor inside the pad: it names no cell of this
            // sheet, so the plan is made as if nothing were selected rather
            // than against the sheet's first column.
            const at = sel ? toModelCol(gridCol(sel[1]), lead) : null;
            const cursor = sel && at !== null ? { sheetId: sid, col: at, row: sel[0] } : null;
            const plan = planRemoteApply(before, after, {
                editorOpen,
                editorCell: editorOpen ? cursor : null,
                selection: cursor,
                activeSheetId: sid,
            });

            // What the editor held back, kept for the moment it closes. The
            // same cell deferred twice is the same identity, so the later plan
            // simply replaces the earlier one.
            if (plan.deferredCells.length > 0) {
                deferredRef.current = { sheetId: sid, cells: plan.deferredCells };
            }

            // A partner's text goes on cell by cell. Reloading the pane would
            // be simpler and would reset the scroll position and destroy the
            // open editor, which is exactly what a remote apply may not do.
            const target = after.sheets[sid];
            if (plan.writeCells && target && !plan.leftSheet) {
                writeRemotePatch(
                    hot,
                    gridPatchFor(before.sheets[sid], target, plan.deferredCells),
                    lead,
                );
            }

            // A stale index would make an undo write into a row the debater
            // never touched, so correct the two stacks together or drop both.
            if (plan.structural) {
                rebaseUndoStacks(
                    (hot as unknown as { undoRedo?: Parameters<typeof rebaseUndoStacks>[0] })
                        .undoRedo,
                    plan.structural,
                );
            }

            if (plan.selectRow !== null && sel) {
                // The fifth argument is what keeps the viewport still. Its
                // default is true, and the difference is invisible until a
                // partner types on a sheet the debater has scrolled away from.
                hot.selectCell(plan.selectRow, sel[1], plan.selectRow, sel[1], false);
            }
        };
        setRemoteApply(onRemote);
        return () => setRemoteApply(null);
    }, []);

    // A peer moving, claiming, or releasing a cell has to show up without
    // waiting for an unrelated render, so the table's own change drives the
    // repaint. Only decorations move, so the pass is a render and never a data
    // write.
    useEffect(() => {
        return onPresenceChanged(() => hotRef.current?.hotInstance?.render());
    }, []);

    // Turning viewers off has to take the marks already on screen with it, and
    // presence itself has not changed, so nothing else repaints.
    useEffect(() => {
        hotRef.current?.hotInstance?.render();
    }, [showViewers]);

    useEffect(() => {
        return () => clearTimeout(lockHintTimer.current ?? undefined);
    }, []);

    // One hint at a time: a held-down key replaces the message and restarts
    // the clock rather than stacking timers that clear it out from under a
    // later refusal.
    const showLockHint = useCallback((holder: string) => {
        setLockHint(`${holder} is editing this cell`);
        clearTimeout(lockHintTimer.current ?? undefined);
        lockHintTimer.current = setTimeout(() => setLockHint(null), LOCK_HINT_MS);
    }, []);

    // Zoom scales the grid via CSS on the wrapper; Handsontable measures its
    // viewport once, so re-measure it against the new box or the last
    // rows/cols stay clipped or leave a gap.
    useEffect(() => {
        hotRef.current?.hotInstance?.refreshDimensions();
    }, [gridZoom]);

    // Mod+scroll zooms only the grid. Native listener (not React onWheel) so the
    // preventDefault sticks and the browser's own page zoom never fires. Trackpad
    // pinch also arrives as ctrl+wheel, so both modifiers count.
    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            if (!e.ctrlKey && !e.metaKey) return;
            // Still swallow the gesture when zoom is off, so it goes inert rather
            // than falling through to the browser's own page zoom.
            e.preventDefault();
            if (!useFlowStore.getState().scrollZoom) return;
            useFlowStore.getState().zoomGrid(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, []);

    // The focused pane owns the singleton so commands (undo, bold, rows) hit it.
    const wasFocusedRef = useRef(isFocused);
    useEffect(() => {
        if (!isFocused) {
            wasFocusedRef.current = false;
            return;
        }
        const hot = hotRef.current?.hotInstance ?? null;
        setActiveHot(hot, snapshot, currentSheetIdRef.current, loadedSpacersRef.current);
        const gainedFocus = !wasFocusedRef.current;
        wasFocusedRef.current = true;
        // A keyboard focus switch (Alt+h/l) moves the accent and command
        // target to this pane; pull the grid's DOM focus too so typing edits here.
        // Split mode only: single-pane focus never transitions and the click path
        // already holds focus.
        if (gainedFocus && useFlowStore.getState().splitSheetId != null && hot) {
            const sel = hot.getSelectedLast();
            // The fallback is the first real column; a spacer takes no cursor.
            const id = requestAnimationFrame(() =>
                hot.selectCell(sel?.[0] ?? 0, sel?.[1] ?? loadedSpacersRef.current),
            );
            return () => cancelAnimationFrame(id);
        }
    }, [isFocused, snapshot]);

    // Sheet switching swaps data/columns on this pane's instance.
    const firstSide = useFlowStore((s) => s.round?.firstSide);
    useEffect(() => {
        const hot = hotRef.current?.hotInstance;
        const round = useFlowStore.getState().round;
        if (!hot || !round || !sheetId) return;
        const sheet = round.sheets.find((s) => s.id === sheetId);
        if (!sheet) return;

        // A sheet swap would leave the preview mutations written into a sheet the
        // session never snapshotted, so unwind it against the sheet it belongs to.
        if (isMovingIn(hot)) revertMove();

        // Read from the store rather than from the render's own `spacers`:
        // this effect also runs on a sheet switch, when that value can be a
        // commit behind.
        const aligned = useFlowStore.getState().alignSpeeches;
        const lead = spacerCount(round, sheet.id, aligned);

        const prev = currentSheetIdRef.current;
        const prevLead = loadedSpacersRef.current;
        // The decorations live on the grid belong to the sheet being left, at
        // the pad it was drawn with; clear exactly those. A reload of the same
        // sheet under a changed pad is leaving its own decorations behind, so
        // there the sheet names them itself. null when the outgoing sheet is
        // gone (just deleted), cueing applyMeta to scan; {} on the first load,
        // where the grid carries nothing to clear.
        const prevMeta = !prev
            ? {}
            : prev === sheet.id
              ? sheet.meta
              : (round.sheets.find((s) => s.id === prev)?.meta ?? null);
        if (prev) {
            // Sheet stepping carries the platform modifier, so it arrives with
            // the editor open and mid-word. The editor closes onto its own
            // cell, and afterChange snapshots against currentSheetIdRef before
            // the line below retargets it, so the word lands on the sheet it
            // was typed on rather than being dropped with the swap. Flipping
            // the setting reloads this same sheet and takes the word with it
            // for the same reason.
            hot.getActiveEditor()?.finishEditing();
            const sel = hot.getSelectedLast();
            // Converted against the pad the grid was drawn with, which is the
            // outgoing sheet's and not the incoming one's. Null is a cursor
            // inside that pad, which names no cell to remember.
            const at = sel ? toModelCol(gridCol(sel[1]), prevLead) : null;
            if (sel && at !== null) viewCache.current.set(prev, { row: sel[0], col: at });
        }
        currentSheetIdRef.current = sheet.id;

        const own = columnsForFlowSheet(round, sheet);
        // The spacers carry their own speech's side, so one combined list is
        // what the renderers index by grid column.
        const cols = lead ? [...spacerColumns(round, sheet), ...own] : own;
        colsRef.current = cols;
        hasGroupTierRef.current = sheet.kind === "cx";
        // Stored data can be wider than the derived columns (a swap narrowed
        // the orientation after text was written); pad to the wider of the two
        // so overflow columns survive the load and the next save.
        const width = gridWidth(own, sheet.data);
        // Settled before the redraw, so the renderers, the readonly rule and
        // every conversion the redraw reaches speak in the pad the cells they
        // are handed carry.
        loadedSpacersRef.current = lead;
        // Coalesce the data/header swap and the per-cell meta loop into one
        // render instead of updateSettings' render plus an explicit one.
        hot.batch(() => {
            hot.updateSettings({
                data: padGrid(sheet.data, width, MIN_ROWS, lead),
                ...headerSettings(sheet, cols, lead + width),
            });
            applyMeta(hot, sheet.meta, prevMeta, lead, prevLead);
        });
        // The grid now carries the new pad, so the registry says so before
        // anything reaching it through `getActiveSpacers` can act on it.
        if (getActiveHot() === hot) {
            setActiveHot(hot, snapshot, sheet.id, lead);
        }
        // A reload under a changed pad re-keys every column, and both undo
        // histories hold the grid coordinates their action was recorded with.
        // Nothing empties Handsontable's stack on a sheet switch, so what goes
        // here is every edit the pane has made this session and not just this
        // sheet's. rebaseActions shifts rows; a column delta would want
        // machinery of its own for what is a settings toggle, and an undo
        // replayed one column off would write into a cell nobody touched,
        // which is worse than the loss.
        if (prev === sheet.id && prevLead !== lead) {
            hot.getPlugin("undoRedo")?.clear();
            resetMetaUndo();
        }
        const v = viewCache.current.get(sheet.id) ?? { row: 0, col: modelCol(0) };
        hot.selectCell(v.row, toGridCol(v.col, lead));
        setReady(true);
    }, [sheetId, firstSide, spacers, snapshot]);

    // Clicking or arrowing into a pane focuses it (so keystrokes route here).
    //
    // The same selection is what the partner sees as this side's cursor. In a
    // split only the focused pane may own that broadcast, and this hook is
    // where the focus moves, so the last selection is always the focused one
    // and an unconditional claim here cannot make the two panes fight over it.
    // The session coalesces the claim onto the heartbeat, so firing per
    // selection costs no extra message.
    const afterSelectionEnd = useCallback(() => {
        // Moving off a cell is the ordinary way an editor closes, so it is the
        // first chance to give a partner's held-back line the screen.
        flushDeferred();
        // A selection is a read of the grid as it stands, and so is anything a
        // command reaching it through the registry will do, so both the claim
        // and the publish speak in the pad it was drawn with.
        const lead = loadedSpacersRef.current;
        setActiveHot(
            hotRef.current?.hotInstance ?? null,
            snapshot,
            currentSheetIdRef.current,
            lead,
        );
        const { splitSheetId, focusedPane, focusPane } = useFlowStore.getState();
        if (splitSheetId != null && focusedPane !== pane) focusPane(pane);
        const sid = currentSheetIdRef.current;
        const cell = hotRef.current?.hotInstance?.getSelectedRangeLast()?.highlight;
        if (sid && cell && cell.row != null && cell.col != null) {
            // A cursor inside the pad is on no cell of this sheet, so the
            // partner hears nothing rather than hearing the first column.
            const at = toModelCol(gridCol(cell.col), lead);
            if (at !== null) claimCursor({ sheetId: sid, col: at, row: cell.row });
        }
    }, [pane, snapshot, flushDeferred]);

    // Search palette jump: declared after the sheet-switch effect so that when
    // both fire in one commit (a cross-sheet jump) this selection wins. The rAF
    // defers past the dialog's focus restore so the grid keeps keyboard focus.
    const revealTarget = useFlowStore((s) => s.revealTarget);
    useEffect(() => {
        if (!revealTarget || revealTarget.sheetId !== sheetId) return;
        const id = requestAnimationFrame(() => {
            const hot = hotRef.current?.hotInstance;
            if (!hot) return;
            const at = toGridCol(modelCol(revealTarget.col), loadedSpacersRef.current);
            hot.selectCell(revealTarget.row, at);
            // A jump teleports the viewport, so the landing cell announces
            // itself: a one-shot decay from the sheet's selection violet.
            // WAAPI on the live TD self-cleans; a mid-flash re-render that
            // swaps the TD just ends the flash early.
            hot.getCell(revealTarget.row, at)?.animate(
                [
                    { backgroundColor: "rgba(124, 58, 237, 0.2)" },
                    { backgroundColor: "transparent" },
                ],
                { duration: 600, easing: "cubic-bezier(0.25, 1, 0.5, 1)" },
            );
        });
        return () => cancelAnimationFrame(id);
    }, [revealTarget, sheetId]);

    // Speech switch: seed every sheet's remembered cursor to row 0 of the
    // chosen speech's column, then select it on this pane only when this
    // pane is focused; the other pane just gets the seed. Declared after the
    // sheet-switch effect so its rAF selection wins when a switch also
    // changes activeSheetId in the same commit (single-pane mode).
    const speechTarget = useFlowStore((s) => s.speechTarget);
    useEffect(() => {
        if (!speechTarget) return;
        const round = useFlowStore.getState().round;
        if (!round) return;
        const { speechId } = speechTarget;
        for (const sheet of round.sheets) {
            // A sheet's own columns start at its leftmost speech, so the index
            // this finds is a model column on every sheet of the round.
            const col = columnsForFlowSheet(round, sheet).findIndex((c) => c.id === speechId);
            if (col >= 0) viewCache.current.set(sheet.id, { row: 0, col: modelCol(col) });
        }
        if (!isFocused) return;
        // The rAF defers past the dropdown's focus restore so the grid keeps
        // keyboard focus.
        const id = requestAnimationFrame(() => {
            const hot = hotRef.current?.hotInstance;
            const sheet = round.sheets.find((s) => s.id === currentSheetIdRef.current);
            if (!hot || !sheet) return;
            const col = columnsForFlowSheet(round, sheet).findIndex((c) => c.id === speechId);
            hot.selectCell(0, toGridCol(modelCol(col >= 0 ? col : 0), loadedSpacersRef.current));
        });
        return () => cancelAnimationFrame(id);
    }, [speechTarget, isFocused]);

    const afterGetColHeader = useCallback(
        (col: number, TH: HTMLTableCellElement, headerLevel: number) => {
            // The period tier sits above both sides' columns, so it wears neutral
            // ink and bold rather than either side's color.
            if (hasGroupTierRef.current && headerLevel === 0) {
                TH.classList.add("hd-group");
                return;
            }
            // The combined column list gives a spacer its own speech's ink;
            // dimming rather than the color is what says it is not on this
            // sheet.
            if (col >= 0 && col < loadedSpacersRef.current) TH.classList.add("hd-spacer");
            const side = col < 0 ? undefined : colsRef.current[col]?.side;
            if (side) TH.classList.add(side === "aff" ? "hd-aff" : "hd-neg");
        },
        [],
    );

    // Cells inherit their column header's side color: blue for aff, red for neg.
    // The move tint, the linked rail, and the presence marks are classes on the
    // TD alone, never cellMeta, so none of them can leak into a saved sheet
    // through collectMeta.
    const afterRenderer = useCallback(
        (
            TD: HTMLTableCellElement,
            row: number,
            col: number,
            _prop: string | number,
            value: unknown,
            cellProperties: { source?: unknown },
        ) => {
            const side = colsRef.current[col]?.side;
            if (side) TD.classList.add(side === "aff" ? "cell-aff" : "cell-neg");
            // Null is a spacer: it stands for a speech this sheet does not
            // hold, so it is greyed and asked nothing further. Clamping to the
            // first column instead would paint a partner's cursor on the pad
            // and on that column at once.
            const at = toModelCol(gridCol(col), loadedSpacersRef.current);
            if (at === null) {
                TD.classList.add(SPACER_CLASS);
                delete TD.dataset.peer;
                return;
            }
            if (cellIsMoving(hotRef.current?.hotInstance ?? null, row, gridCol(col))) {
                TD.classList.add("cell-moving");
            }
            // Empty text came from nowhere, so a blank cell wears no rail even
            // when a source saved before the emptying rule existed outlived it.
            if (cellProperties.source && value !== null && value !== undefined && value !== "") {
                TD.classList.add("cell-linked");
            }
            // Where the partner is, marked before the debater types into the
            // cell, so a refusal on a cell they have an editor open on is
            // predictable instead of a surprise. Presence expires against the
            // clock, so a peer that vanished stops marking the cell on the next
            // pass. Only a cell that carries a peer pays for the name lookup;
            // every other cell pays one class test. The badge letter rides on
            // the TD's dataset and is cleared unconditionally, because
            // Handsontable reuses TD elements and resets className alone, so a
            // stale letter would outlive the peer moving away.
            const sid = currentSheetIdRef.current;
            const here = getPresences();
            const peer =
                sid && here.length > 0
                    ? presenceOn(
                          here,
                          sid,
                          at,
                          row,
                          Date.now(),
                          useFlowStore.getState().collabShowViewers,
                      )
                    : null;
            if (peer) {
                TD.classList.add(PEER_CLASS);
                if (peer.editing) TD.classList.add(LOCK_CLASS);
                TD.dataset.peer = peerInitial(
                    contactName(useFlowStore.getState().contacts, peer.endpointId),
                );
            } else {
                delete TD.dataset.peer;
            }
        },
        [],
    );

    // changes is null on loadData/updateSettings passes; snapshotting those
    // loops setState -> render -> afterChange forever.
    //
    // A partner's write is already in the replica and in the store, so it
    // leaves through neither: recording it would bounce their own text back at
    // them, and snapshotting it would push the grid over the projection that
    // wrote it, taking a deferred cell's remote text with it.
    //
    // "edit" is a cell the user typed, emptied, or cut: every structured write
    // names itself instead, and carries its own meta bookkeeping. So this is
    // the one path that can strand provenance on a cell it no longer describes.
    const afterChange = useCallback(
        (changes: unknown, source: unknown) => {
            if (!changes || source === REMOTE_WRITE) return;
            const hot = hotRef.current?.hotInstance;
            if (hot && source === "edit" && breakEmptiedLinks(hot, changes as GridChange[])) {
                hot.render();
            }
            const sid = currentSheetIdRef.current;
            if (sid && isReplicatedSource(source)) {
                const lead = loadedSpacersRef.current;
                const named: ModelChange[] = [];
                for (const [row, prop, oldValue, newValue] of changes as GridChange[]) {
                    // Nothing can write in the pad, so a change there is a bug
                    // rather than an edit, and an op for it would put a cell no
                    // sheet holds on the wire.
                    const at = typeof prop === "number" ? toModelCol(gridCol(prop), lead) : null;
                    if (at === null) continue;
                    named.push([row, at, oldValue, newValue]);
                }
                for (const op of textOpsFromChanges(sid, named)) recordOp(op);
            }
            snapshot();
        },
        [snapshot],
    );

    const afterCreateRow = useCallback(
        (index: number, amount: number, source?: string) => {
            if (source === REMOTE_WRITE) return;
            const sid = currentSheetIdRef.current;
            if (sid)
                for (const op of rowOpFromHook("insert", sid, index, amount, source)) recordOp(op);
            snapshot();
        },
        [snapshot],
    );

    const afterRemoveRow = useCallback(
        (index: number, amount: number, _physicalRows: number[], source?: string) => {
            if (source === REMOTE_WRITE) return;
            const sid = currentSheetIdRef.current;
            if (sid)
                for (const op of rowOpFromHook("remove", sid, index, amount, source)) recordOp(op);
            snapshot();
        },
        [snapshot],
    );

    // A cell this side is typing in is claimed so a partner sees it before
    // they start on the same one. Only the claim is announced: Handsontable
    // has no hook for an editor closing, so the release is the session asking
    // `editingHere` rather than anything fired from here.
    const afterBeginEditing = useCallback((row: number, col: number) => {
        const hot = hotRef.current?.hotInstance;
        const input = hot?.rootElement.querySelector<HTMLTextAreaElement>(
            "textarea.handsontableInput",
        );
        if (input) disableTextAssistance(input);
        // Append mode: a printable key opens a "fast edit", which Handsontable
        // starts from an empty box so the character wipes the cell. Seeding the
        // box with the cell's own text turns that into an addition. Enter, F2
        // and a double click open in full edit mode with the text already
        // there, so they are left alone.
        const editor = hot?.getActiveEditor();
        if (hot && input && editor && !editor.isInFullEditMode()) {
            const existing = hot.getDataAtCell(row, col);
            if (useFlowStore.getState().appendEdit && typeof existing === "string" && existing)
                seedAppend(input, existing);
        }
        const sid = currentSheetIdRef.current;
        // A spacer is read-only, so this is a guard rather than a path.
        const at = toModelCol(gridCol(col), loadedSpacersRef.current);
        if (sid && at !== null) claimCell({ sheetId: sid, col: at, row });
    }, []);

    // A pane that went away leaves no ghost on the partner's screen: both the
    // claim and the cursor go with it.
    useEffect(
        () => () => {
            claimCell(null);
            claimCursor(null);
        },
        [],
    );

    // Insert-paste: the shift_down populate moves text but not decorations, so
    // the displaced classes are re-laid once the grid has grown. The hook's own
    // `coords` argument describes the COPY range, not the paste target, so the
    // target comes from the selection - the same place Handsontable reads it.
    const insertPaste = useFlowStore((s) => s.insertPaste);
    const pasteShift = useRef<PasteShift | null>(null);
    const pasteClasses = useRef<ClassEntry[]>([]);

    const beforePaste = useCallback(
        (data: CellValue[][]) => {
            pasteShift.current = null;
            const hot = hotRef.current?.hotInstance;
            const sel = hot?.getSelectedRangeLast();
            if (!insertPaste || !hot || !sel || data.length === 0) return;
            const tl = sel.getTopLeftCorner();
            const br = sel.getBottomRightCorner();
            if (tl.row == null || tl.col == null || br.row == null || br.col == null) return;
            // A selection wider or taller than the clipboard block repeats it.
            const shift: PasteShift = {
                row: tl.row,
                col: gridCol(tl.col),
                width: Math.max(data[0].length, br.col - tl.col + 1),
                height: Math.max(data.length, br.row - tl.row + 1),
            };
            pasteShift.current = shift;
            pasteClasses.current = snapshotClasses(hot, pasteCols(hot, shift));
            // Said before Handsontable moves anything, so the text writes that
            // follow land on rows the replica has already opened. Said as ops,
            // because the alternative is re-deriving the sheet afterwards,
            // which re-keys every cell out from under a partner holding it.
            const sid = currentSheetIdRef.current;
            if (sid) {
                for (const col of pasteCols(hot, shift)) {
                    // The shift's columns stay the grid's for the meta pass
                    // that follows the paste; only the ops speak in cells.
                    const at = toModelCol(col, loadedSpacersRef.current);
                    if (at === null) continue;
                    for (const op of openSpanOps(sid, at, shift.row, shift.height)) recordOp(op);
                }
            }
        },
        [insertPaste],
    );

    const afterPaste = useCallback(() => {
        const shift = pasteShift.current;
        pasteShift.current = null;
        const hot = hotRef.current?.hotInstance;
        if (!hot || !shift) return;
        shiftMetaDown(hot, shift);
        const cols = pasteCols(hot, shift);
        attachMetaUndo({
            cols,
            before: pasteClasses.current,
            after: snapshotClasses(hot, cols),
        });
        hot.render();
        // afterChange snapshotted the shifted text while the meta was still
        // the old layout, so the store needs the settled state. The replica
        // does not: the opens beforePaste recorded moved each cell with its
        // own decoration, which is what a cell identity is for.
        snapshot();
    }, [snapshot]);

    // Returning false is Handsontable's documented way to cancel an undo push.
    // The session's live preview mutations never reach the stack; its commit,
    // fired after the session closes, is the one action recorded.
    const beforeUndoStackChange = useCallback(
        () => (isMovingIn(hotRef.current?.hotInstance ?? null) ? false : undefined),
        [],
    );

    // Handsontable's undo stack carries text but not decorations; metaUndo
    // reunites them against the action it recorded.
    const afterUndo = useCallback(() => {
        const hot = hotRef.current?.hotInstance;
        if (!hot || !restoreMetaUndo(hot)) return;
        hot.render();
        snapshot();
    }, [snapshot]);

    const afterRedo = useCallback(() => {
        const hot = hotRef.current?.hotInstance;
        if (!hot || !restoreMetaRedo(hot)) return;
        hot.render();
        snapshot();
    }, [snapshot]);

    const beforeKeyDown = useCallback(
        function (this: unknown, e: KeyboardEvent) {
            const hot = hotRef.current?.hotInstance;
            if (hot?.getActiveEditor()?.isOpened()) return;

            // Move mode is modal: Up and Down nudge the block, Meta/Ctrl with them
            // lands it against the next filled cell, Enter commits, Esc reverts, and
            // every other key is swallowed so nothing edits the grid mid-move.
            // stopImmediate is what swallows them: it keeps the chord from reaching
            // useKeymap's window listener, where an undo would unwind an edit made
            // before the session while its live preview sat on top of the grid.
            if (hot && isMovingIn(hot)) {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (e.key === "Escape") {
                    // The session's nudges never reached the replica, and the
                    // revert puts the grid back where the replica still has
                    // it, so there is nothing to reconcile.
                    revertMove();
                    hot.render();
                } else if (e.key === "Enter") {
                    // The span the move rearranged, captured before the
                    // session closes and takes the block descriptor with it.
                    const block = movingBlock();
                    hot.batch(() => commitMove());
                    hot.render();
                    snapshot();
                    const sid = currentSheetIdRef.current;
                    if (block && sid) {
                        // Expressed as ops rather than a re-derive: a re-derive
                        // re-keys every cell from its row, which a peer holding
                        // the old keys would not agree with.
                        for (const col of block.cols) {
                            // A block never covers a spacer, so a null here is
                            // a session that should not have opened rather
                            // than a column to fold into the first one.
                            const at = toModelCol(col, loadedSpacersRef.current);
                            if (at === null) continue;
                            const texts = hot
                                .getDataAtCol(col)
                                .map((v) => (typeof v === "string" ? v : null));
                            for (const op of replaceSpanOps(sid, at, 0, texts)) recordOp(op);
                        }
                    }
                } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                    const dr = e.key === "ArrowDown" ? 1 : -1;
                    const block = movingBlock()!;
                    let delta = dr;
                    if (e.metaKey || e.ctrlKey) {
                        // The leading edge is the row that meets the next filled cell.
                        const lead =
                            dr > 0 ? block.blockStart + block.height - 1 : block.blockStart;
                        delta =
                            smartJump(
                                hot,
                                lead,
                                block.cols[0],
                                { dr, dc: 0 },
                                loadedSpacersRef.current,
                            ).row - lead;
                    }
                    nudge(delta);
                    reselectMovingBlock(hot);
                }
                return false;
            }

            // A Ctrl/Meta+Arrow bound to a command is that command, not a
            // cursor move. Handsontable's grid context answers this chord with
            // a jump to the far edge and the pane answers it with the
            // Excel-style jump below, so a rebind that only reached
            // useKeymap's window listener would fire beside a cursor that had
            // already left. Resolving it here runs the command alone;
            // stopImmediate is what keeps that listener from firing it a
            // second time. This sits above the spacer guards so a binding
            // still runs at the sheet's own first column, where a leftward
            // jump is otherwise swallowed. Arrows only: every other Ctrl/Meta
            // chord passes the grid untouched and the window keymap owns it.
            if ((e.metaKey || e.ctrlKey) && ARROW_DELTAS[e.key] && runBoundCommand(e)) {
                e.preventDefault();
                e.stopImmediatePropagation();
                return false;
            }

            // Nothing may leave the cursor or a range's edge on a spacer. A
            // spacer holds no cell of this sheet, so a cursor parked there is
            // refused every keystroke with no lock hint to say why, and an
            // edge left there decorates columns collectMeta refuses to save,
            // so the bolding outlives every sheet switch with nothing stored
            // to clear it by. A shift-extend leaves the highlight on the
            // anchor and walks the range's `to`, so that is the edge about to
            // enter the pad; every other key moves the highlight itself.
            //
            // Handsontable's grid context aims Home, Shift+Home, Ctrl/Meta+Home
            // and Ctrl/Meta+A at grid column 0. Each is answered with the
            // sheet's own first column rather than swallowed, because a key
            // that silently does nothing is the same puzzle the pad exists to
            // avoid.
            const range = hot?.getSelectedRangeLast();
            const pad = loadedSpacersRef.current;
            if (hot && range) {
                const shiftLeft = e.key === "ArrowLeft" || e.key === "Home";
                const edge = e.shiftKey && shiftLeft ? range.to : range.highlight;
                const mod = e.metaKey || e.ctrlKey;
                // At the sheet's own first column Shift+Tab has nowhere to
                // move inside the grid, so Handsontable lets the browser tab
                // focus out to the previous tabbable element (a sidebar
                // sheet). stopImmediate is what also keeps the chord off
                // useKeymap's window listener.
                if (e.key === "Tab" && e.shiftKey && edge.col === pad) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    return false;
                }
                if (pad > 0) {
                    if (e.key === "ArrowLeft" && edge.col === pad) {
                        e.preventDefault();
                        return false;
                    }
                    if (e.key === "Home") {
                        e.preventDefault();
                        // Ctrl/Meta+Home is the top of the sheet; a header
                        // selection highlights row -1, which names no cell to
                        // land on.
                        const row = mod ? 0 : Math.max(0, edge.row ?? 0);
                        if (e.shiftKey) {
                            hot.selection.setRangeEnd(hot._createCellCoords(row, pad));
                        } else {
                            hot.selectCell(row, pad);
                        }
                        return false;
                    }
                    // Ctrl/Meta+A takes the cells; Ctrl+Shift+Space takes the
                    // cells and their headers. Both start at the sheet's own
                    // first column, so a decoration applied to the selection
                    // cannot land on a spacer, where nothing saves it and
                    // nothing sweeps it up again.
                    const selectAll =
                        (mod && !e.shiftKey && (e.key === "a" || e.key === "A")) ||
                        (e.ctrlKey && e.shiftKey && e.key === " ");
                    if (selectAll) {
                        e.preventDefault();
                        // The viewport stays where the debater left it.
                        hot.selectCell(0, pad, hot.countRows() - 1, hot.countCols() - 1, false);
                        return false;
                    }
                }
            }

            // A chord bound to an app command must run as a command, not type into
            // the grid. With no Ctrl/Meta modifier Handsontable "fast edits" the
            // selected cell - opening an empty editor whose later commit wipes the
            // cell (e.g. Alt+\ split-toggle, or the bare [ ] ? sheet keys). Run the
            // command here and stop the grid touching the cell; stopImmediate keeps
            // useKeymap from firing it a second time. Ctrl/Meta chords never
            // fast-edit, so the window keymap owns them, arrows aside.
            if (!e.metaKey && !e.ctrlKey && runBoundCommand(e)) {
                e.preventDefault();
                e.stopImmediatePropagation();
                return;
            }

            // A cell a peer holds refuses the keystroke and says who has it.
            // Silence would be worse than the collision it prevents: nothing
            // would tell the debater why the character never arrived. This
            // sits below the command lookup, so a bare key bound to a command
            // still runs it - a held cell blocks editing, not the whole app.
            if (hot && !e.metaKey && !e.ctrlKey && (e.key.length === 1 || EDIT_KEYS[e.key])) {
                const sid = currentSheetIdRef.current;
                const cell = hot.getSelectedRangeLast()?.highlight;
                // No hint for a cursor in the pad: nobody can hold a cell this
                // sheet does not have.
                const at =
                    cell?.col != null
                        ? toModelCol(gridCol(cell.col), loadedSpacersRef.current)
                        : null;
                const holder =
                    sid && cell && cell.row != null && at !== null
                        ? lockLabel(getPresences(), sid, at, cell.row, Date.now(), (id) =>
                              contactName(useFlowStore.getState().contacts, id),
                          )
                        : null;
                if (holder) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    showLockHint(holder);
                    return false;
                }
            }
            const dir = ARROW_DELTAS[e.key];
            if (hot && (e.metaKey || e.ctrlKey) && dir) {
                e.preventDefault();
                const cur = hot.getSelectedRangeLast();
                // Shift-extend jumps from the range's moving edge so repeated presses
                // walk outward; a plain jump starts from the active cell.
                const origin = e.shiftKey ? cur?.to : cur?.highlight;
                if (!origin || origin.row == null || origin.col == null) return false;
                const { row, col } = smartJump(
                    hot,
                    origin.row,
                    origin.col,
                    dir,
                    loadedSpacersRef.current,
                );
                if (e.shiftKey) hot.selection.setRangeEnd(hot._createCellCoords(row, col));
                else hot.selectCell(row, col);
                // Returning false is Handsontable's contract for suppressing its own
                // key handling; native stopImmediatePropagation does not, since the
                // shortcut recorder checks its private isImmediatePropagationEnabled
                // flag rather than the DOM event's state.
                return false;
            }
        },
        [showLockHint, snapshot],
    );

    // A spacer stands for a speech this sheet does not hold, so it is scenery:
    // a click on one lands on the sheet's own first cell rather than parking
    // the cursor in a column that refuses every keystroke. A header click
    // arrives with a negative row and is redirected the same way.
    const beforeOnCellMouseDown = useCallback(
        (_event: unknown, coords: CellCoords) => {
            const lead = loadedSpacersRef.current;
            if (coords.col != null && coords.col >= 0 && coords.col < lead) coords.col = lead;
        },
        [],
    );

    // The same redirect for the moving end of a drag, which reaches the grid
    // here rather than through the mousedown. A range whose edge sits in the
    // pad decorates it, and collectMeta refuses to save a spacer's cells, so
    // the bolding would sit on the grid with nothing stored to clear it by.
    const beforeOnCellMouseOver = useCallback(
        (_event: unknown, coords: CellCoords) => {
            const lead = loadedSpacersRef.current;
            if (coords.col != null && coords.col >= 0 && coords.col < lead) coords.col = lead;
        },
        [],
    );

    // Whether a cell takes the editor. Handsontable merges what this returns
    // into meta it keeps between renders, so the answer has to be total: a
    // cell outside the pad that answered `{}` would keep a refusal laid down
    // while the pad was wider, and the load that narrows the pad clears no
    // cell state. The viewer's clause is what keeps a `false` here from
    // overriding the pane-wide readOnly the same role sets.
    const cellRule = useCallback(
        (_row: number, col: number) => ({
            readOnly: viewOnly || col < loadedSpacersRef.current,
        }),
        [viewOnly],
    );

    return (
        // ht-blurred hides this pane's cell-selection marker while its cursor
        // stays in memory, so only the focused pane shows an active cell.
        <div
            ref={wrapRef}
            className={`ht-theme-main relative h-full min-h-0 overflow-hidden${isFocused ? "" : " ht-blurred"}`}
            style={{ opacity: ready ? 1 : 0 }}
            data-testid="hot-grid"
        >
            {/* The refusal message for a held cell. It sits in the corner and
                takes no pointer events, so it never covers the cell being
                worked in, never takes focus, and never needs dismissing. */}
            {lockHint !== null && (
                <div
                    role="status"
                    data-testid="lock-hint"
                    className="bg-foreground/90 text-background pointer-events-none absolute right-2 bottom-2 z-10 rounded-md px-2 py-1 text-xs shadow-sm"
                >
                    {lockHint}
                </div>
            )}
            {/* zoom scales the grid's content and layout uniformly. A zoomed
                width/height:100% child still fills this pane exactly (CSS zoom
                resolves the percentage against the pane), and Handsontable reads
                its own clientHeight (pane / zoom) to fill the visible box, so its
                scrollbars stay at the pane edges instead of overflowing. */}
            <div data-testid="grid-zoom" style={{ zoom: gridZoom, width: "100%", height: "100%" }}>
                <HotTable
                    ref={hotRef}
                    rowHeaders={false}
                    colWidths={COL_WIDTH}
                    wordWrap={true}
                    autoRowSize={true}
                    autoColumnSize={false}
                    height="100%"
                    minSpareRows={1}
                    enterBeginsEditing={false}
                    undo={true}
                    outsideClickDeselects={false}
                    readOnly={viewOnly}
                    contextMenu={viewOnly ? false : (FLOW_CONTEXT_MENU as unknown as string[])}
                    copyPaste={{ pasteMode: insertPaste ? "shift_down" : "overwrite" }}
                    cells={cellRule}
                    beforeOnCellMouseDown={beforeOnCellMouseDown}
                    beforeOnCellMouseOver={beforeOnCellMouseOver}
                    afterGetColHeader={afterGetColHeader}
                    afterRenderer={afterRenderer}
                    afterChange={afterChange}
                    beforePaste={beforePaste}
                    afterPaste={afterPaste}
                    beforeUndoStackChange={beforeUndoStackChange}
                    afterUndoStackChange={onUndoStackChange}
                    afterRedoStackChange={onRedoStackChange}
                    afterUndo={afterUndo}
                    afterRedo={afterRedo}
                    afterCreateRow={afterCreateRow}
                    afterRemoveRow={afterRemoveRow}
                    afterSelectionEnd={afterSelectionEnd}
                    afterBeginEditing={afterBeginEditing}
                    beforeKeyDown={beforeKeyDown}
                    licenseKey="non-commercial-and-evaluation"
                />
            </div>
        </div>
    );
});
