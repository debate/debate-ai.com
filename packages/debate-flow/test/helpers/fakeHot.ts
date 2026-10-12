import { vi } from "vitest";

interface Coords {
    row: number;
    col: number;
}

/** Just enough Handsontable for the command layer. */
export class FakeHot {
    data: (string | null)[][];
    meta = new Map<string, Record<string, unknown>>();
    sel: [number, number, number, number] | null = null;
    undo = vi.fn();
    redo = vi.fn();
    render = vi.fn();
    alter = vi.fn((action: string, at: number, amount = 1) => {
        if (action === "insert_row_below") {
            const cols = this.data[0]?.length ?? 0;
            this.data.splice(at + 1, 0, ...Array.from({ length: amount }, () => Array.from({ length: cols }, () => null)));
        }
    });
    constructor(rows: number, cols: number) {
        this.data = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => `${r}:${c}`));
    }
    countRows() {
        return this.data.length;
    }
    countCols() {
        return this.data[0].length;
    }
    getDataAtCell(r: number, c: number) {
        return this.data[r][c];
    }
    setDataAtCell(changes: [number, number, string | null][]) {
        for (const [r, c, v] of changes) this.data[r][c] = v;
    }
    getCellMeta(r: number, c: number) {
        const k = `${r},${c}`;
        if (!this.meta.has(k)) this.meta.set(k, {});
        return this.meta.get(k)!;
    }
    setCellMeta(r: number, c: number, key: string, value: unknown) {
        this.getCellMeta(r, c)[key] = value;
    }
    select(r1: number, c1: number, r2 = r1, c2 = c1) {
        this.sel = [r1, c1, r2, c2];
    }
    private range() {
        const [r1, c1, r2, c2] = this.sel!;
        const tl: Coords = { row: Math.min(r1, r2), col: Math.min(c1, c2) };
        const br: Coords = { row: Math.max(r1, r2), col: Math.max(c1, c2) };
        return { highlight: { row: r1, col: c1 }, getTopLeftCorner: () => tl, getBottomRightCorner: () => br };
    }
    getSelectedRange() {
        return this.sel ? [this.range()] : undefined;
    }
    getSelectedRangeLast() {
        return this.sel ? this.range() : undefined;
    }
    getSelectedLast() {
        return this.sel ?? undefined;
    }
    selectCell = vi.fn((r: number, c: number) => {
        this.sel = [r, c, r, c];
    });
    getPlugin() {
        return { undo: this.undo, redo: this.redo };
    }
}

