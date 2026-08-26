/**
 * Search over every filled cell in a flow. Powers the search palette: one
 * query ranks cells across all sheets by relevance tier. The sheet title and
 * column header are a secondary match field, so "2ac warming" finds warming
 * answers in the 2AC column - ranked below a cell-text hit. A column answers
 * to its abbreviation and aliases too, so "mgc warming" works where the header
 * spells out Member of the Government Constructive. Same-tier ties stay in
 * flow order (sheet order, then row-major).
 */

import { speechTerms } from "../format/events";
import { columnsForFlowSheet } from "../grid/flowColumns";
import { sortedSheets, type FlowRound } from "../model/flow";
import type { Side } from "../model/types";

import { rank } from "./match";

export interface CellHit {
    sheetId: string;
    sheetTitle: string;
    row: number;
    col: number;
    /** Column header the cell sits under (e.g. "2AC", "Question"), for context. */
    colName: string;
    /** Every name that column answers to in search; never displayed. */
    colTerms: string;
    /** Side of the cell's speech column; drives the aff/neg ink, as in the grid. */
    side: Side;
    text: string;
    /** Cell is tagged as a card (a piece of evidence). */
    card: boolean;
}

/** Every non-empty cell in the round, in sheet-order then row-major. */
export function collectCells(round: FlowRound): CellHit[] {
    const cells: CellHit[] = [];
    for (const sheet of sortedSheets(round)) {
        const cols = columnsForFlowSheet(round, sheet);
        sheet.data.forEach((rowData, row) => {
            rowData.forEach((value, col) => {
                const text = value?.trim();
                if (!text) return;
                cells.push({
                    sheetId: sheet.id,
                    sheetTitle: sheet.title,
                    row,
                    col,
                    colName: cols[col]?.name ?? "",
                    colTerms: cols[col] ? speechTerms(cols[col]) : "",
                    side: cols[col]?.side ?? "aff",
                    text,
                    card: sheet.meta[`${row},${col}`]?.card ?? false,
                });
            });
        });
    }
    return cells;
}

/**
 * Rank the round's cells against `query`; an empty query lists every filled
 * cell in flow order. The palette paginates, so no cap here.
 *
 * ponytail: recollects cells and searches every call. A flow is a few hundred
 * short cells, so this is trivial; memoize on round identity if flows ever get
 * huge.
 */
export function searchCells(round: FlowRound, query: string): CellHit[] {
    return rank(
        collectCells(round),
        query,
        (c) => c.text,
        (c) => `${c.sheetTitle} ${c.colTerms}`,
        () => 0,
    );
}
