/**
 * Turns a CardMirror send into the cells it lands in.
 *
 * Column mode writes one row per extracted item, downward from the active
 * cell. A cite never takes a row of its own: it rides as a second line
 * inside the cell above it, which is how a debater flows a card ("Perm
 * solves" over "Smith 24"). Cell mode collapses the whole send into the
 * active cell, matching what a Verbatim Flow single-cell send produces.
 */

import type { CellMeta } from "../model/flow";

import type { FlowItem } from "./protocol";

/** The origin app id every cell this module plans is stamped with. */
export const CARDMIRROR_APP = "cardmirror";

/** One cell to write, with the decorations and provenance it carries. */
export interface PlannedCell {
    text: string;
    meta: CellMeta;
}

/** Document headings read as structure on a flow, so they land bold. */
const HEADING_KINDS: Record<string, true> = { pocket: true, hat: true, block: true };

function sourceOf(item: FlowItem, docTitle: string): CellMeta["source"] {
    if (!item.token) return undefined;
    return {
        app: CARDMIRROR_APP,
        token: item.token,
        key: item.key,
        ...(docTitle ? { title: docTitle } : {}),
    };
}

function metaFor(item: FlowItem, docTitle: string): CellMeta {
    const meta: CellMeta = {};
    if (HEADING_KINDS[item.kind]) meta.bold = true;
    else if (item.kind === "tag") meta.card = true;
    const source = sourceOf(item, docTitle);
    if (source) meta.source = source;
    return meta;
}

/** The empty separator cells a send leaves below it, as the send asked. */
function spacerCells(space: number): PlannedCell[] {
    return Array.from({ length: space }, () => ({ text: "", meta: {} }));
}

/**
 * The cells a send produces, in write order. Empty only when `items` is,
 * which the protocol layer already rejects.
 *
 * `space` appends that many blank cells below the send, so consecutive sends
 * read as separate cards. They are real writes rather than a cursor jump: an
 * insert paste shifts the column's tail into those rows, and the shift leaves
 * the vacated cells holding their old text.
 */
export function planFlowWrite(
    items: readonly FlowItem[],
    mode: "column" | "cell",
    docTitle: string,
    space = 0,
): PlannedCell[] {
    if (items.length === 0) return [];

    if (mode === "cell") {
        // The whole send is one cell, so it carries no decoration (the items
        // disagree) and the first item's provenance, which is the heading the
        // send started from.
        const first = items[0];
        const source = sourceOf(first, docTitle);
        return [
            {
                text: items.map((i) => i.text).join("\n"),
                meta: source ? { source } : {},
            },
            ...spacerCells(space),
        ];
    }

    const cells: PlannedCell[] = [];
    for (const item of items) {
        const previous = cells[cells.length - 1];
        // A leading cite has no tag to ride on, so it falls through and takes
        // its own plain row rather than being dropped.
        if (item.kind === "cite" && previous) {
            previous.text = `${previous.text}\n${item.text}`;
            continue;
        }
        cells.push({ text: item.text, meta: metaFor(item, docTitle) });
    }
    return [...cells, ...spacerCells(space)];
}
