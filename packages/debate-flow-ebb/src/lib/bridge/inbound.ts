/**
 * Inbound half of the cardmirror-bridge: CardMirror writing into ebb.
 *
 * The Rust host has already authenticated the caller and parsed the JSON, so
 * this layer decides what a route means for the live flow. Every failure is a
 * named error the caller can put in front of a user, never a throw: a send
 * that arrives while the dashboard is open answers "no-active-sheet" rather
 * than hanging until the host's deadline.
 */

import { recordOp } from "../collab/replica";
import { openSpanOps } from "../collab/spanOps";
import type { CellChange } from "../grid/cellShift";
import { shiftSpan } from "../grid/cellShift";
import { metaToClassName } from "../grid/codec";
import { gridCol, toModelCol } from "../grid/colSpace";
import { getActiveHot, getActiveSpacers, notifyGridMutated } from "../grid/hotInstance";
import { attachMetaUndo, snapshotClasses } from "../grid/metaUndo";
import { STRUCTURED_WRITE } from "../grid/staleSource";
import { focusedSheetId, useFlowStore } from "../store/useFlowStore";

import { cardmirrorLive } from "./enabled";
import { planFlowWrite } from "./flowPlan";
import type { BridgeReply, FlowRequest, RevealRequest } from "./protocol";
import { BAD_REQUEST, bridgeError, parseFlowRequest, parseRevealRequest } from "./protocol";
import { findCellsBySourceKey } from "./sourceSearch";

/** Last row of `col` holding text, or -1 when the column is empty. */
function lastFilledRow(rows: number, at: (row: number) => unknown): number {
    for (let r = rows - 1; r >= 0; r--) {
        const value = at(r);
        if (typeof value === "string" && value.length > 0) return r;
    }
    return -1;
}

function applyFlow(req: FlowRequest): BridgeReply {
    const hot = getActiveHot();
    const state = useFlowStore.getState();
    const sheet = state.round?.sheets.find((s) => s.id === focusedSheetId(state));
    if (!hot || !sheet) return bridgeError("no-active-sheet");
    const selection = hot.getSelectedLast();
    if (!selection) return bridgeError("no-active-cell");

    const [row, gcol] = selection;
    // The pane publishes its inert leading column count, so a send converts
    // against the number the grid was drawn with rather than deriving its own.
    const col = gridCol(gcol);
    const at = toModelCol(col, getActiveSpacers());
    // A spacer stands for a speech this sheet does not hold, so it is no more
    // a place to send a card to than an empty pane is.
    if (at === null) return bridgeError("no-active-cell");
    const cells = planFlowWrite(req.items, req.mode, req.docTitle, req.space);
    // Insert-paste pushes the column's tail down, so the grid has to hold the
    // whole displaced run; an overwrite only has to hold the write itself.
    const needed = state.insertPaste
        ? lastFilledRow(hot.countRows(), (r) => hot.getDataAtCell(r, col)) + 1 + cells.length
        : row + cells.length;
    if (needed > hot.countRows()) {
        hot.alter("insert_row_below", hot.countRows() - 1, needed - hot.countRows());
    }

    const before = snapshotClasses(hot, [col]);
    const changes: CellChange[] = state.insertPaste
        ? shiftSpan(hot, col, row, hot.countRows(), cells.length)
        : [];
    cells.forEach((cell, i) => changes.push([row + i, col, cell.text]));
    hot.setDataAtCell(changes, STRUCTURED_WRITE);
    // shiftSpan leaves the vacated cells' decorations stale, and every written
    // cell gets its own anyway, so both keys are set unconditionally.
    cells.forEach((cell, i) => {
        hot.setCellMeta(row + i, col, "className", metaToClassName(cell.meta));
        hot.setCellMeta(row + i, col, "source", cell.meta.source);
    });
    attachMetaUndo({ cols: [col], before, after: snapshotClasses(hot, [col]) });

    // Land the cursor under the send so a second one stacks beneath the first.
    hot.selectCell(Math.min(row + cells.length, hot.countRows() - 1), col);
    hot.render();
    notifyGridMutated();
    // Said as ops rather than re-deriving the sheet. A send opens a run in one
    // column and writes it; re-deriving would re-key every cell in the sheet
    // from its row position, and a partner holding the old keys would merge
    // the two sets rather than recognise them.
    if (state.insertPaste) {
        for (const op of openSpanOps(sheet.id, at, row, cells.length)) recordOp(op);
    }
    cells.forEach((cell, i) => {
        // `at` is the model column the grid column `col` converts to, so what
        // goes on the wire is the cell and not the slot it is drawn in.
        recordOp({ kind: "cellText", sheetId: sheet.id, col: at, row: row + i, text: cell.text });
        recordOp({ kind: "cellMeta", sheetId: sheet.id, col: at, row: row + i, meta: cell.meta });
    });
    return {
        status: 200,
        // The empty separator cells are not items, so they do not count.
        body: { ok: true, written: cells.length - req.space, sheet: sheet.title, row, col: at },
    };
}

// Repeating a reveal with the same keys walks to the next match instead of
// re-selecting the first, so the command cycles every cell a card reached.
let revealedFor: string | null = null;
let revealedIndex = 0;

function applyReveal(req: RevealRequest): BridgeReply {
    const { round, revealCell } = useFlowStore.getState();
    if (!round) return bridgeError("no-round");

    const hits = findCellsBySourceKey(round, req.keys);
    if (hits.length === 0) {
        revealedFor = null;
        return { status: 200, body: { ok: true, matches: 0 } };
    }

    const query = req.keys.join("\u0000");
    revealedIndex = query === revealedFor ? (revealedIndex + 1) % hits.length : 0;
    revealedFor = query;
    const hit = hits[revealedIndex];
    revealCell(hit.sheetId, hit.row, hit.col);

    return {
        status: 200,
        body: {
            ok: true,
            matches: hits.length,
            sheets: [...new Set(hits.map((h) => h.sheetTitle))],
            sheet: hit.sheetTitle,
            row: hit.row,
            col: hit.col,
        },
    };
}

/** Resets the reveal cursor. Tests call this between rounds. */
export function resetRevealCycle(): void {
    revealedFor = null;
    revealedIndex = 0;
}

/**
 * Answers one bridge route. Unknown routes read as a malformed request, and a
 * bridge that is switched off (or a web build, where it never existed) names
 * itself so the caller can say why nothing landed rather than reporting a
 * dead app.
 */
export function handleBridgeRequest(route: string, body: unknown): BridgeReply {
    if (!cardmirrorLive()) return bridgeError("integration-disabled");
    if (route === "flow") {
        const req = parseFlowRequest(body);
        return req ? applyFlow(req) : BAD_REQUEST;
    }
    if (route === "reveal") {
        const req = parseRevealRequest(body);
        return req ? applyReveal(req) : BAD_REQUEST;
    }
    return BAD_REQUEST;
}
