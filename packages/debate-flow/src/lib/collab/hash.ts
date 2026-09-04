/**
 * The digest self-heal compares, and the stamp the sidecar carries.
 *
 * A sheet reaches this function from two directions: out of the store, where
 * rows are ragged and the meta map has whatever key order it accumulated, and
 * out of the replica, where a projection is always a clean rectangle in row
 * order. Both go through one canonical form here, or drift is reported forever
 * on a sheet that is perfectly in sync.
 */

import type { CellMeta } from "../model/flow";

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** FNV-1a, 32 bits, as lowercase hex. Not a cryptographic hash. */
export function hashText(text: string): string {
    let h = FNV_OFFSET;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, FNV_PRIME);
    }
    return (h >>> 0).toString(16).padStart(8, "0");
}

/** Separates the row block from the decoration block. */
const ROW = "\u0001";

function canonical(data: (string | null)[][], meta: Record<string, CellMeta>): string {
    // Both directions pad to a width of their own choosing: the store holds a
    // row per grid column, the projection only as many columns as the replica
    // has a cell in. Trailing empty columns are padding in both, exactly as
    // trailing empty rows are, so neither counts as content.
    let width = data.reduce((w, row) => Math.max(w, row.length), 0);
    while (width > 0 && data.every((row) => (row[width - 1] ?? "") === "")) width--;
    let height = data.length;
    while (height > 0 && data[height - 1].every((v) => (v ?? "") === "")) height--;
    const rows: string[] = [];
    for (let row = 0; row < height; row++) {
        const line: string[] = [];
        // Length-prefixed, so no cell text can forge a cell boundary. A
        // separator alone would let "a\u0000b" in one cell read as two cells.
        for (let col = 0; col < width; col++) {
            const text = data[row][col] ?? "";
            line.push(`${text.length}:${text}`);
        }
        rows.push(line.join(""));
    }

    // Row-major order, and an entry with no surviving key is not an entry.
    const decorations: string[] = [];
    for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
            const entry = meta[`${row},${col}`] as Record<string, unknown> | undefined;
            if (!entry) continue;
            const keys = Object.keys(entry).sort();
            if (keys.length === 0) continue;
            const pairs = keys.map((k) => `${k}=${JSON.stringify(entry[k])}`);
            decorations.push(`${row},${col}:${pairs.join(",")}`);
        }
    }

    return `${rows.join(ROW)}${ROW}${ROW}${decorations.join(ROW)}`;
}

/** One sheet's content, independent of raggedness and of meta key order. */
export function sheetDigest(data: (string | null)[][], meta: Record<string, CellMeta>): string {
    return hashText(canonical(data, meta));
}
