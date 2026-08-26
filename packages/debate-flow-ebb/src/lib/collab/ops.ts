/**
 * Local edits, expressed at the coordinates the grid reports.
 *
 * A row index counts live cells in a column, so `afterChange`,
 * `afterCreateRow`, and `afterRemoveRow` payloads translate without a diff and
 * without a heuristic. Every op returns a new document; nothing here mutates.
 */

import type { CellMeta, FlowSheet } from "../model/flow";

import { liveCells, seedSheet, sheetWidth } from "./doc";
import { isRank, rankBetween } from "./rank";
import type { Clock, Stamp } from "./stamp";
import { cellKey, type CollabCell, type CollabDoc, type CollabSheet, type Json } from "./types";

export interface OpContext {
    actor: string;
    clock: Clock;
}

export type CollabOp =
    | { kind: "cellText"; sheetId: string; col: number; row: number; text: string | null }
    | { kind: "cellMeta"; sheetId: string; col: number; row: number; meta: CellMeta }
    | { kind: "insertCell"; sheetId: string; col: number; row: number }
    | { kind: "removeCell"; sheetId: string; col: number; row: number }
    | { kind: "insertRow"; sheetId: string; row: number }
    | { kind: "removeRow"; sheetId: string; row: number }
    | { kind: "sheetField"; sheetId: string; path: string; value: Json }
    | { kind: "addSheet"; sheet: FlowSheet }
    | { kind: "removeSheet"; sheetId: string }
    | { kind: "roundField"; path: string; value: Json };

function withSheet(doc: CollabDoc, sheetId: string, sheet: CollabSheet): CollabDoc {
    return { ...doc, sheets: { ...doc.sheets, [sheetId]: sheet } };
}

function withCells(sheet: CollabSheet, cells: Record<string, CollabCell>): CollabSheet {
    return { ...sheet, cells: { ...sheet.cells, ...cells } };
}

function blankCell(col: number, rank: string, actor: string, stamp: Stamp): CollabCell {
    return {
        col,
        rank,
        actor,
        text: null,
        textStamp: stamp,
        meta: {},
        metaStamp: stamp,
        deleted: null,
    };
}

/**
 * A rank between two live neighbours that no cell of this actor already
 * holds.
 *
 * A tombstone keeps its key, and the rank a column derives is a pure function
 * of its live neighbours, so a delete followed by an insert at the same place
 * can compute a rank that is already spent. Writing that key would overwrite
 * the tombstone, and the deleted cell would come back on the next merge.
 *
 * The two neighbours can also hold the same rank: two peers inserting at one
 * position derive it identically, and the merge keeps both cells with their
 * authors breaking the tie. No rank sorts between those two, so an insert
 * aimed at the pair takes the room above them instead of asking for a gap
 * that cannot exist. One row lower than asked for, on a pair that is already
 * one row apart, and the alternative is throwing mid-keystroke.
 */
function freshRank(
    sheet: CollabSheet,
    pending: Record<string, CollabCell>,
    col: number,
    before: string | null,
    after: string | null,
    actor: string,
): string {
    // Only ranks this build can order: `nextAbove` hands one back as the
    // ceiling, and `rankBetween` asserts its invariants by throwing, which
    // would land mid-keystroke. A replica written before that check reached the
    // merge can still hold one.
    const taken: string[] = [];
    for (const cell of Object.values(sheet.cells)) {
        if (cell.col === col && isRank(cell.rank)) taken.push(cell.rank);
    }
    for (const cell of Object.values(pending)) {
        if (cell.col === col && isRank(cell.rank)) taken.push(cell.rank);
    }

    /** The lowest rank the column holds above `floor`, or null for open sky. */
    function nextAbove(floor: string): string | null {
        let best: string | null = null;
        for (const r of taken) if (r > floor && (best === null || r < best)) best = r;
        return best;
    }

    // A neighbour a replica written before that check still holds cannot be
    // subdivided either, so an insert aimed at it takes the open position
    // rather than throwing under the debater's keystroke.
    const floor = isRank(before) ? before : null;
    const roof = isRank(after) ? after : null;
    const ceiling = floor !== null && roof !== null && floor >= roof ? nextAbove(floor) : roof;
    let rank = rankBetween(floor, ceiling);
    while (sheet.cells[cellKey(col, rank, actor)] || pending[cellKey(col, rank, actor)]) {
        // Step above the spent rank, staying below whatever occupies the next
        // position, so the new cell keeps the row the caller asked for.
        rank = rankBetween(rank, nextAbove(rank));
    }
    return rank;
}

/**
 * The cell a write lands on, plus the blanks a column needs to reach it. The
 * grid writes below the last stored row freely, so a column grows to meet it.
 */
function growTo(
    sheet: CollabSheet,
    col: number,
    row: number,
    ctx: OpContext,
): { cells: Record<string, CollabCell>; target: CollabCell } {
    const live = liveCells(sheet, col);
    const existing = live[row];
    if (existing) return { cells: {}, target: existing };
    const cells: Record<string, CollabCell> = {};
    let last = live[live.length - 1] ?? null;
    for (let i = live.length; i <= row; i++) {
        const rank = freshRank(sheet, cells, col, last?.rank ?? null, null, ctx.actor);
        last = blankCell(col, rank, ctx.actor, ctx.clock.tick());
        cells[cellKey(col, rank, ctx.actor)] = last;
    }
    return { cells, target: last as CollabCell };
}

function insertInColumn(
    sheet: CollabSheet,
    col: number,
    row: number,
    ctx: OpContext,
): Record<string, CollabCell> {
    const live = liveCells(sheet, col);
    const rank = freshRank(
        sheet,
        {},
        col,
        live[row - 1]?.rank ?? null,
        live[row]?.rank ?? null,
        ctx.actor,
    );
    return {
        [cellKey(col, rank, ctx.actor)]: blankCell(col, rank, ctx.actor, ctx.clock.tick()),
    };
}

function removeInColumn(
    sheet: CollabSheet,
    col: number,
    row: number,
    stamp: Stamp,
): Record<string, CollabCell> {
    const cell = liveCells(sheet, col)[row];
    if (!cell) return {};
    return { [cellKey(col, cell.rank, cell.actor)]: { ...cell, deleted: stamp } };
}

export function applyOp(doc: CollabDoc, op: CollabOp, ctx: OpContext): CollabDoc {
    if (op.kind === "roundField") {
        return {
            ...doc,
            round: { ...doc.round, [op.path]: { value: op.value, stamp: ctx.clock.tick() } },
        };
    }
    if (op.kind === "addSheet") {
        return withSheet(doc, op.sheet.id, seedSheet(op.sheet, ctx.clock.tick()));
    }

    const sheet = doc.sheets[op.sheetId];
    if (!sheet) return doc;

    switch (op.kind) {
        case "removeSheet":
            return withSheet(doc, op.sheetId, { ...sheet, deleted: ctx.clock.tick() });

        case "sheetField":
            return withSheet(doc, op.sheetId, {
                ...sheet,
                fields: {
                    ...sheet.fields,
                    [op.path]: { value: op.value, stamp: ctx.clock.tick() },
                },
            });

        case "cellText": {
            const { cells, target } = growTo(sheet, op.col, op.row, ctx);
            const key = cellKey(op.col, target.rank, target.actor);
            return withSheet(
                doc,
                op.sheetId,
                withCells(sheet, {
                    ...cells,
                    [key]: { ...target, text: op.text, textStamp: ctx.clock.tick() },
                }),
            );
        }

        case "cellMeta": {
            const { cells, target } = growTo(sheet, op.col, op.row, ctx);
            const key = cellKey(op.col, target.rank, target.actor);
            return withSheet(
                doc,
                op.sheetId,
                withCells(sheet, {
                    ...cells,
                    [key]: {
                        ...target,
                        meta: { ...(op.meta as Record<string, Json>) },
                        metaStamp: ctx.clock.tick(),
                    },
                }),
            );
        }

        case "insertCell":
            return withSheet(
                doc,
                op.sheetId,
                withCells(sheet, insertInColumn(sheet, op.col, op.row, ctx)),
            );

        case "removeCell":
            return withSheet(
                doc,
                op.sheetId,
                withCells(sheet, removeInColumn(sheet, op.col, op.row, ctx.clock.tick())),
            );

        case "insertRow": {
            const cells: Record<string, CollabCell> = {};
            const width = sheetWidth(sheet);
            for (let col = 0; col < width; col++) {
                Object.assign(cells, insertInColumn(sheet, col, op.row, ctx));
            }
            return withSheet(doc, op.sheetId, withCells(sheet, cells));
        }

        case "removeRow": {
            const cells: Record<string, CollabCell> = {};
            const stamp = ctx.clock.tick();
            const width = sheetWidth(sheet);
            for (let col = 0; col < width; col++) {
                Object.assign(cells, removeInColumn(sheet, col, op.row, stamp));
            }
            return withSheet(doc, op.sheetId, withCells(sheet, cells));
        }
    }
}
