/**
 * What a partner's change is allowed to touch.
 *
 * One decision, in one place, so the rule that governs all of it cannot drift:
 * a remote apply adjusts indices and never navigates. It does not scroll, it
 * does not take focus, and it does not write under an open editor. A partner's
 * edits are visible and never directive, because the person at this keyboard
 * is mid-speech and cannot afford to be moved.
 */

import { modelCol, type ModelCol } from "../grid/colSpace";

import { liveCells } from "./doc";
import { followSelection, type CellRef } from "./selection";
import type { CollabDoc, CollabSheet } from "./types";
import type { StructuralChange } from "./undoRebase";

export interface ApplyContext {
    editorOpen: boolean;
    editorCell: { sheetId: string; col: ModelCol; row: number } | null;
    selection: { sheetId: string; col: ModelCol; row: number } | null;
    activeSheetId: string | null;
}

export interface ApplyPlan {
    /** Whether any cell may be written into the grid at all. */
    writeCells: boolean;
    /** Cells held back because the editor is open on them. */
    deferredCells: CellRef[];
    /** The row the selection moves to, or null to leave it where it is. */
    selectRow: number | null;
    /** What the undo stack has to be corrected for, if anything. */
    structural: StructuralChange | null;
    /**
     * Typed as the literal false. The hard rule is that a remote apply never
     * scrolls, and a type is harder to forget than a comment.
     */
    scroll: false;
    /** The active sheet a partner deleted out from under the viewer. */
    leftSheet: string | null;
}

/** How many live cells a column holds, which is what a row insert changes. */
function heightOf(sheet: CollabSheet | undefined, col: number): number {
    return sheet ? liveCells(sheet, col).length : 0;
}

/**
 * The structural change a partner made to one column, in the terms the undo
 * stack needs. Derived from the live heights rather than from the op, because
 * a delta can carry several ops at once and only the net effect matters.
 */
function structuralFor(
    before: CollabSheet | undefined,
    after: CollabSheet | undefined,
    col: number,
    around: number,
): StructuralChange | null {
    const was = heightOf(before, col);
    const now = heightOf(after, col);
    if (now > was) return { kind: "insertRow", at: around, amount: now - was };
    if (now < was) return { kind: "removeRow", at: around, amount: was - now };
    return null;
}

/** The first row whose identity changed, which is where a shift began. */
function firstMovedRow(before: CollabSheet, after: CollabSheet, col: number): number {
    const was = liveCells(before, col);
    const now = liveCells(after, col);
    const shared = Math.min(was.length, now.length);
    for (let row = 0; row < shared; row++) {
        if (was[row].rank !== now[row].rank || was[row].actor !== now[row].actor) return row;
    }
    return shared;
}

export function planRemoteApply(before: CollabDoc, after: CollabDoc, ctx: ApplyContext): ApplyPlan {
    const plan: ApplyPlan = {
        writeCells: true,
        deferredCells: [],
        selectRow: null,
        structural: null,
        scroll: false,
        leftSheet: null,
    };

    // A sheet the viewer is standing on that a partner removed.
    if (ctx.activeSheetId) {
        const wasAlive = before.sheets[ctx.activeSheetId]?.deleted === null;
        const nowGone = after.sheets[ctx.activeSheetId]?.deleted !== null;
        if (wasAlive && nowGone) plan.leftSheet = ctx.activeSheetId;
    }

    // The cell under an open editor is held back. It is already in the
    // replica, so last-writer-wins still decides; only the grid write waits,
    // so nothing overwrites what is being typed right now.
    if (ctx.editorOpen && ctx.editorCell) {
        const sheet = after.sheets[ctx.editorCell.sheetId];
        const cell = sheet ? liveCells(sheet, ctx.editorCell.col)[ctx.editorCell.row] : undefined;
        if (cell) {
            plan.deferredCells.push({
                col: modelCol(cell.col),
                rank: cell.rank,
                actor: cell.actor,
            });
        }
    }

    const sel = ctx.selection;
    if (!sel) return plan;

    const wasSheet = before.sheets[sel.sheetId];
    const nowSheet = after.sheets[sel.sheetId];
    if (!wasSheet || !nowSheet) return plan;

    plan.structural = structuralFor(
        wasSheet,
        nowSheet,
        sel.col,
        firstMovedRow(wasSheet, nowSheet, sel.col),
    );

    const followed = followSelection(wasSheet, nowSheet, sel.row, sel.col);
    // Null means leave it alone, which is also what happens when the cursor's
    // own row was the one deleted: it holds its index rather than jumping.
    plan.selectRow = followed === sel.row ? null : followed;
    return plan;
}
