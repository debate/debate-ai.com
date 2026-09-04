/**
 * The grid writes a partner's change comes down to.
 *
 * Reloading the pane would be simpler and is wrong: it destroys the editor the
 * debater is typing in, resets the scroll position, and repaints cells nobody
 * touched. So a remote apply is expressed as the cells whose text or
 * decoration actually moved, and a cell the apply rules hold back is left out
 * of the list rather than written and taken away again.
 *
 * The projection this diffs against is the same one `projectSheet` produces,
 * so what lands on the grid and what lands in the store agree cell for cell.
 */

import { modelCol, type ModelCol } from "../grid/colSpace";
import type { CellMeta } from "../model/flow";

import { liveCells, sheetWidth } from "./doc";
import type { CellRef } from "./selection";
import type { CollabSheet } from "./types";

export interface CellWrite {
    row: number;
    col: ModelCol;
    text: string | null;
}

export interface MetaWrite {
    row: number;
    col: ModelCol;
    /** Null clears the cell's decoration and provenance. */
    meta: CellMeta | null;
}

export interface GridPatch {
    writes: CellWrite[];
    meta: MetaWrite[];
    /** Live rows the tallest column now holds, so a short pane can grow first. */
    height: number;
}

/**
 * `before` is absent for a sheet a partner just added, which is every cell of
 * it written at once.
 */
export function gridPatchFor(
    before: CollabSheet | undefined,
    after: CollabSheet,
    deferred: readonly CellRef[] = [],
): GridPatch {
    const patch: GridPatch = { writes: [], meta: [], height: 0 };
    const width = Math.max(before ? sheetWidth(before) : 0, sheetWidth(after));

    for (let col = 0; col < width; col++) {
        const was = before ? liveCells(before, col) : [];
        const now = liveCells(after, col);
        patch.height = Math.max(patch.height, now.length);

        // A cell held back is named by identity, so a concurrent row insert
        // cannot slide the hold onto a different cell than the editor is on.
        const held = new Set(
            deferred
                .filter((ref) => ref.col === col)
                .map((ref) => now.findIndex((c) => c.rank === ref.rank && c.actor === ref.actor)),
        );

        for (let row = 0; row < Math.max(was.length, now.length); row++) {
            if (held.has(row)) continue;
            const mine = was[row];
            const theirs = now[row];
            const text = theirs?.text ?? null;
            if ((mine?.text ?? null) !== text) patch.writes.push({ row, col: modelCol(col), text });

            const nextMeta = theirs && Object.keys(theirs.meta).length > 0 ? theirs.meta : null;
            const mineMeta = mine && Object.keys(mine.meta).length > 0 ? mine.meta : null;
            if (JSON.stringify(mineMeta) !== JSON.stringify(nextMeta)) {
                patch.meta.push({ row, col: modelCol(col), meta: nextMeta as CellMeta | null });
            }
        }
    }
    return patch;
}
