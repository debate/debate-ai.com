/**
 * Forward search from an origin app's provenance keys back to the ebb cells
 * that carry them. The bridge's /reveal route walks these hits in order, so the
 * order has to be stable across calls: sheet order, then row, then column.
 */

import { sortedSheets, type FlowRound } from "../model/flow";

export interface SourceHit {
    sheetId: string;
    sheetTitle: string;
    row: number;
    col: number;
}

/** Every cell whose provenance key is in `keys`, in sheet then row then column order. */
export function findCellsBySourceKey(round: FlowRound, keys: readonly string[]): SourceHit[] {
    const wanted = new Set(keys);
    if (wanted.size === 0) return [];

    const hits: SourceHit[] = [];
    for (const sheet of sortedSheets(round)) {
        // Stored meta is a sparse "row,col" map with no ordering of its own, so
        // the cells are collected first and then sorted into grid order.
        const found: SourceHit[] = [];
        for (const [cell, meta] of Object.entries(sheet.meta)) {
            const key = meta.source?.key;
            if (key === undefined || !wanted.has(key)) continue;
            const [row, col] = cell.split(",").map(Number);
            if (!Number.isFinite(row) || !Number.isFinite(col)) continue;
            found.push({ sheetId: sheet.id, sheetTitle: sheet.title, row, col });
        }
        found.sort((a, b) => a.row - b.row || a.col - b.col);
        hits.push(...found);
    }
    return hits;
}
