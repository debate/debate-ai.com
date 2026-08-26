/**
 * Command handlers for the Handsontable-based editor.
 *
 * `executeCommand` reads and writes `useFlowStore.getState()` and reaches the
 * live grid through the hotInstance registry. All handlers silently no-op
 * when the round, sheet, or grid is missing so the keyboard layer can fire
 * commands unconditionally.
 */

import { toast } from "sonner";

import { runJumpToSource, runSendToDoc } from "../bridge/commands";
import { recordOp } from "../collab/replica";
import { insertCell as insertCellChanges } from "../grid/cellShift";
import {
    BOLD_CLASS,
    CARD_CLASS,
    GROUP_CLASS,
    HIGHLIGHT_CLASS,
    KICKED_CLASS,
    toggleClassToken,
} from "../grid/codec";
import { gridCol, toModelCol } from "../grid/colSpace";
import {
    getActiveHot,
    getActiveSheetId,
    getActiveSpacers,
    notifyGridMutated,
} from "../grid/hotInstance";
import { attachMetaUndo, snapshotClasses } from "../grid/metaUndo";
import { beginMove } from "../grid/moveSession";
import { STRUCTURED_WRITE } from "../grid/staleSource";
import { moveSheetRange, sheetRangeIds, sortedSheets } from "../model/flow";
import { askToShare } from "../store/useCollabConsent";
import { useCollabStore } from "../store/useCollabStore";
import { chooseContact } from "../store/useContactPicker";
import { focusedSheetId, useFlowStore, ZOOM_STEP } from "../store/useFlowStore";
import { askForCode } from "../store/useJoinDialog";
import { openShareSheet, showShareCode, showShareFailure } from "../store/useShareSheet";

import { runEnd, runInvite, runJoin, runShare, type CollabCommandDeps } from "./collabCommands";
import {
    closeOpenFlow,
    openFlowFromPicker,
    revealOpenFlow,
    saveOpenFlow,
    saveOpenFlowAs,
} from "./fileCommands";
import { navigateToFlow } from "./flowNav";
import { EDITS_ROUND, type CommandId } from "./registry";
import { closeCurrentWindow, openNewWindow } from "./windowCommands";

/** Jumps to the Nth (1-indexed, order-sorted) flow sheet, no-op if out of range. */
function jumpToSheet(n: number): void {
    const { round, setActiveSheet } = useFlowStore.getState();
    if (!round) return;
    const sheets = sortedSheets(round).filter((s) => s.kind !== "cx");
    const target = sheets[n - 1];
    if (target) setActiveSheet(target.id);
}

/**
 * Toggles a decoration class over every cell of the current selection. The
 * target state comes from the FIRST cell (missing the class = add to all),
 * so mixed ranges converge instead of flip-flopping per cell.
 */
function toggleDecoration(
    token:
        | typeof BOLD_CLASS
        | typeof HIGHLIGHT_CLASS
        | typeof CARD_CLASS
        | typeof GROUP_CLASS
        | typeof KICKED_CLASS,
): void {
    const hot = getActiveHot();
    const ranges = hot?.getSelectedRange();
    if (!hot || !ranges || ranges.length === 0) return;

    const first = ranges[0].highlight;
    const firstCls = (hot.getCellMeta(first.row ?? 0, first.col ?? 0).className ?? "") as string;
    const adding = !firstCls.split(/\s+/).includes(token);

    const flipped: [row: number, col: number][] = [];
    for (const range of ranges) {
        const tl = range.getTopLeftCorner();
        const br = range.getBottomRightCorner();
        for (let r = tl.row ?? 0; r <= (br.row ?? -1); r++) {
            for (let c = tl.col ?? 0; c <= (br.col ?? -1); c++) {
                const cls = (hot.getCellMeta(r, c).className ?? "") as string;
                const has = cls.split(/\s+/).includes(token);
                if (has === adding) continue;
                hot.setCellMeta(r, c, "className", toggleClassToken(cls, token));
                flipped.push([r, c]);
            }
        }
    }
    hot.render();
    notifyGridMutated();

    // A decoration reaches no afterChange hook, so the replica hears about it
    // here or not at all. The snapshot above already put the new meta in the
    // store, which is what each op reports.
    const sheetId = getActiveSheetId();
    const sheet = useFlowStore.getState().round?.sheets.find((s) => s.id === sheetId);
    if (sheetId && sheet) {
        const spacers = getActiveSpacers();
        for (const [row, col] of flipped) {
            // `flipped` holds grid columns; a stored meta key and an op both
            // name a cell, so both are read at the converted column. The
            // pane's guards keep a range's edge as well as the cursor out of
            // the pad, so a null here decorates nothing.
            const at = toModelCol(gridCol(col), spacers);
            if (at === null) continue;
            recordOp({
                kind: "cellMeta",
                sheetId,
                col: at,
                row,
                meta: sheet.meta[`${row},${at}`] ?? {},
            });
        }
    }
}

/** Insert or remove a row at the current selection. */
function alterRow(action: "insert_row_above" | "insert_row_below" | "remove_row"): void {
    const hot = getActiveHot();
    const sel = hot?.getSelectedLast();
    if (!hot || !sel) return;
    hot.alter(action, sel[0]);
    notifyGridMutated();
}

/**
 * Insert a blank cell at or just below the selection, shifting that column's
 * cells (text and decoration meta) below it down by one. Unlike a row insert,
 * adjacent speech columns keep their rows; the last row's value falls off the
 * bottom.
 */
function runInsertCell(where: "at" | "below"): void {
    const hot = getActiveHot();
    const sel = hot?.getSelectedLast();
    if (!hot || !sel) return;
    const col = gridCol(sel[1]);
    const row = where === "below" ? sel[0] + 1 : sel[0];
    if (row > hot.countRows() - 1) return;

    const before = snapshotClasses(hot, [col]);
    hot.setDataAtCell(insertCellChanges(hot, row, col), STRUCTURED_WRITE);
    attachMetaUndo({ cols: [col], before, after: snapshotClasses(hot, [col]) });
    hot.render();
    notifyGridMutated();

    // A structured write is refused by the afterChange seam precisely so this
    // op can describe the shift, rather than the whole column arriving as a
    // few hundred unrelated text writes.
    const sheetId = getActiveSheetId();
    // The op names a cell, so the grid column converts; a spacer takes no
    // cursor, so a null here opens nothing.
    const at = toModelCol(col, getActiveSpacers());
    if (sheetId && at !== null) recordOp({ kind: "insertCell", sheetId, col: at, row });
}

/**
 * Opens the modal move session over the selection's bounding rectangle. From
 * here `HotGrid`'s beforeKeyDown owns Up, Down, Enter, and Esc until the
 * session closes.
 */
function startMove(): void {
    const hot = getActiveHot();
    const sel = hot?.getSelectedRangeLast();
    if (!hot || !sel) return;
    const tl = sel.getTopLeftCorner();
    const br = sel.getBottomRightCorner();
    if (tl.row == null || tl.col == null || br.row == null || br.col == null) return;
    beginMove(hot, { startRow: tl.row, endRow: br.row, startCol: tl.col, endCol: br.col });
    hot.render();
}

/**
 * How the collaboration commands reach the user: corner messages, and three
 * dialogs. The share sheet is one, because a code has to be on screen while a
 * partner types it; the code field is the second, because a paste is not a
 * notice; the consent question is the third, asked once at the moment a
 * debater says what they want. The contact picker is the fourth, because
 * choosing who to dial is a decision.
 */
function collabDeps(): CollabCommandDeps {
    return {
        chooseContact,
        notify: (message) => toast.success(message),
        fail: (message) => toast.error(message),
        consent: askToShare,
        openShare: openShareSheet,
        showCode: showShareCode,
        failShare: showShareFailure,
        askForCode,
        openFlow: (path) => navigateToFlow(path),
    };
}

export function executeCommand(id: CommandId): void {
    // A viewer reads the round. The host drops their writes, so a command that
    // changed the flow here would look like it worked and be gone on the next
    // merge. Saying so beats losing it quietly, and it leaves every command
    // that only navigates, looks, or configures free to run.
    if (EDITS_ROUND[id] && useCollabStore.getState().selfRole === "viewer") {
        toast("You are viewing this round, not editing it");
        return;
    }
    const state = useFlowStore.getState();
    const { round } = state;

    switch (id) {
        // --- Grid ------------------------------------------------------------
        case "edit.undo":
            getActiveHot()?.getPlugin("undoRedo")?.undo();
            notifyGridMutated();
            return;
        case "edit.redo":
            getActiveHot()?.getPlugin("undoRedo")?.redo();
            notifyGridMutated();
            return;
        case "format.toggleBold":
            toggleDecoration(BOLD_CLASS);
            return;
        case "format.toggleHighlight":
            toggleDecoration(HIGHLIGHT_CLASS);
            return;
        case "format.toggleCard":
            toggleDecoration(CARD_CLASS);
            return;
        case "format.toggleGroup":
            toggleDecoration(GROUP_CLASS);
            return;
        case "format.toggleKicked":
            toggleDecoration(KICKED_CLASS);
            return;
        case "row.insertAbove":
            alterRow("insert_row_above");
            return;
        case "row.insertBelow":
            alterRow("insert_row_below");
            return;
        case "row.delete":
            alterRow("remove_row");
            return;
        case "cell.insert":
            runInsertCell("at");
            return;
        case "cell.insertBelow":
            runInsertCell("below");
            return;
        case "cell.move":
            startMove();
            return;

        // --- CardMirror -------------------------------------------------------
        case "cell.jumpToSource":
            void runJumpToSource();
            return;
        case "cell.sendToDoc":
            void runSendToDoc();
            return;

        // --- Sheets ----------------------------------------------------------
        case "sheet.next":
        case "sheet.prev": {
            if (!round) return;
            const sheets = sortedSheets(round).filter((s) => s.kind !== "cx");
            if (sheets.length === 0) return;
            const idx = sheets.findIndex((s) => s.id === focusedSheetId(state));
            const base = idx === -1 ? 0 : idx;
            const next =
                id === "sheet.next" ? Math.min(base + 1, sheets.length - 1) : Math.max(base - 1, 0);
            state.setActiveSheet(sheets[next].id);
            return;
        }
        case "sheet.moveUp":
        case "sheet.moveDown": {
            if (!round) return;
            const sheets = sortedSheets(round).filter((s) => s.kind !== "cx");
            const focused = focusedSheetId(state);
            const range = state.sheetRange;
            const selected = range ? sheetRangeIds(sheets, range.anchor, range.head) : [];
            // With no range the chord acts on the focused sheet alone, so a
            // single-sheet move needs no selection gesture first. A focused CX
            // sheet is not in this list, so it moves nothing.
            const block = selected.length > 0 ? selected : focused ? [focused] : [];
            const ordered = sheets.map((s) => s.id);
            const moved = moveSheetRange(ordered, block, id === "sheet.moveUp" ? -1 : 1);
            if (moved === ordered) return;
            // The range keeps its two edges: they are still the block's, so the
            // selection follows the block without being rewritten.
            state.reorderSheets([...moved]);
            return;
        }
        case "sheet.extendUp":
        case "sheet.extendDown": {
            if (!round) return;
            const sheets = sortedSheets(round).filter((s) => s.kind !== "cx");
            const range = state.sheetRange;
            // No range yet: both edges start at the sheet on screen.
            const anchor = range?.anchor ?? focusedSheetId(state);
            const anchorIdx = sheets.findIndex((s) => s.id === anchor);
            if (anchor == null || anchorIdx === -1) return;
            const headIdx = range ? sheets.findIndex((s) => s.id === range.head) : anchorIdx;
            if (headIdx === -1) return;
            // Stepping the head toward the anchor shrinks the range; away from
            // it grows the range; past either end does nothing.
            const next = headIdx + (id === "sheet.extendUp" ? -1 : 1);
            if (next < 0 || next >= sheets.length) return;
            // A collapsed sidebar draws no rows, so the range being built would
            // be invisible; open it, the courtesy sheet.rename already pays.
            if (state.sidebarCollapsed) state.setSidebarCollapsed(false);
            state.setSheetRange({ anchor, head: sheets[next].id });
            return;
        }
        case "sheet.newAff": {
            if (!round) return;
            state.addSheet({ group: "aff" });
            return;
        }
        case "sheet.newNeg": {
            if (!round) return;
            state.addSheet({ group: "neg" });
            return;
        }
        case "sheet.rename": {
            const target = focusedSheetId(state);
            if (!target) return;
            // Rename edits the sheet's sidebar row; a collapsed sidebar renders no
            // row to focus, so open it first (else the command silently no-ops).
            if (state.sidebarCollapsed) state.setSidebarCollapsed(false);
            state.setRenamingSheet(target);
            return;
        }
        case "sheet.quickSwitch":
            state.setQuickSwitcherOpen(true);
            return;
        case "round.swapOrder":
            useFlowStore.getState().swapSpeakingOrder();
            return;
        case "palette.open":
            // Same palette, seeded with ">" so it opens in command mode.
            state.setQuickSwitcherOpen(true, ">");
            return;
        case "sheet.jump1":
        case "sheet.jump2":
        case "sheet.jump3":
        case "sheet.jump4":
        case "sheet.jump5":
        case "sheet.jump6":
        case "sheet.jump7":
        case "sheet.jump8":
        case "sheet.jump9": {
            jumpToSheet(Number(id.slice("sheet.jump".length)));
            return;
        }

        // --- Window -------------------------------------------------------------
        case "window.new":
            void openNewWindow();
            return;
        case "window.close":
            void closeCurrentWindow();
            return;

        // --- Flow files ---------------------------------------------------------
        // These are the only asynchronous commands. Each reports its own
        // failures with a toast, so nothing here needs to await them.
        case "flow.new":
            state.setNewFlowOpen(true);
            return;
        case "flow.open":
            void openFlowFromPicker();
            return;
        case "flow.save":
            void saveOpenFlow();
            return;
        case "flow.saveAs":
            void saveOpenFlowAs();
            return;
        case "flow.reveal":
            void revealOpenFlow();
            return;
        case "flow.close":
            void closeOpenFlow();
            return;

        // --- UI ---------------------------------------------------------------
        case "settings.open":
            state.setSettingsOpen(true);
            return;
        case "info.open":
            state.setInfoOpen(true);
            return;
        case "rfd.toggle":
            state.setRfdOpen(!state.rfdOpen);
            return;
        case "help.open":
            state.setCheatsheetOpen(!state.cheatsheetOpen);
            return;
        case "sidebar.toggle":
            state.setSidebarCollapsed(!state.sidebarCollapsed);
            return;
        case "view.zoomIn":
            state.zoomGrid(ZOOM_STEP);
            return;
        case "view.zoomOut":
            state.zoomGrid(-ZOOM_STEP);
            return;
        case "split.toggle":
            state.toggleSplit();
            return;
        case "split.focusLeft":
            state.focusPane(1);
            return;
        case "split.focusRight":
            state.focusPane(2);
            return;
        case "theme.light":
            state.setTheme("light");
            return;
        case "theme.dark":
            state.setTheme("dark");
            return;
        case "theme.system":
            state.setTheme("system");
            return;
        case "collab.share":
            void runShare(collabDeps());
            return;
        case "collab.shareView":
            void runShare(collabDeps(), "viewer");
            return;
        case "collab.join":
            void runJoin(collabDeps());
            return;
        case "collab.invite":
            void runInvite(collabDeps());
            return;
        case "collab.inviteView":
            void runInvite(collabDeps(), "viewer");
            return;
        case "collab.end":
            void runEnd(collabDeps());
            return;
    }
}
