/**
 * Seeding a replica from a file, and projecting one back into a round.
 *
 * Seeding is a pure function of the file: row `i` of every column gets
 * `seedRank(i)`, every value gets the origin stamp, and every seeded cell is
 * credited to no actor. Two peers that open one round therefore hold
 * byte-identical replicas before they exchange a single message, which is what
 * makes the first merge correct instead of a duplication.
 */

import { getEvent } from "../format/events";
import { MAX_FLOW_COLS } from "../grid/flowColumns";
import {
    compareSheets,
    emptyScouting,
    type CellMeta,
    type FlowRound,
    type FlowSheet,
} from "../model/flow";
import type { Scouting } from "../model/types";
import {
    MAX_ROUND_CELLS,
    MAX_ROUND_BYTES,
    fileBytes,
    holdsCellMeta,
    holdsScouting,
    paddedCells,
} from "../persistence/flowFile";

import { seedRank } from "./rank";
import { ORIGIN_STAMP, type Stamp } from "./stamp";
import {
    cellKey,
    compareCells,
    flattenLeaves,
    setPath,
    type CollabCell,
    type CollabDoc,
    type CollabSheet,
    type Json,
    type Register,
} from "./types";

/** Fields of a sheet the replica stores as cells, not as registers. */
const SHEET_GRID_FIELDS: Record<string, true> = { id: true, data: true, meta: true };
/** Fields of a round that stay local: the file's own bookkeeping. */
const ROUND_LOCAL_FIELDS: Record<string, true> = {
    id: true,
    createdAt: true,
    updatedAt: true,
    sheets: true,
};

/**
 * The tallest a column gets, beside the widest a sheet gets. Both coordinates
 * arrive inside a peer's document and both become the bound of a loop that
 * walks a sheet: the projection here, the grid patch, and the local row insert
 * and remove. The projection materializes their product, so bounding one alone
 * buys nothing - four thousand cells in one column asks for as many array slots
 * as a column index far out does.
 *
 * The width is what a flow is rather than a round number of its own, because a
 * column is a speech. A cell at column 511 of an eight-speech sheet is not a
 * flow cell, and padding the rectangle out to it hands a peer the divisor the
 * round's cell and byte budgets turn into rows: one cell on the debater's own
 * sheet, and every row of it costs sixty-four times what the sheet writes.
 * `MAX_FLOW_COLS` is the widest of every event, so no register a peer writes
 * narrows it onto a column the debater has already typed in.
 *
 * A speech is not two thousand lines, so their product leaves one sheet three
 * orders under the MAX_ROUND_CELLS the file enforces on read. A hundred and
 * twenty-three sheets pass it, which is why the round's own budget is spent in
 * `projectDoc` rather than here.
 */
const MAX_ROWS = 2048;

/** A sheet's live cells in one column, in row order. */
export function liveCells(sheet: CollabSheet, col: number): CollabCell[] {
    const live = Object.values(sheet.cells)
        .filter((c) => c.col === col && c.deleted === null)
        .sort(compareCells);
    // A row past the bound projects nowhere, which is already what a cell
    // nobody can see looks like.
    return live.length > MAX_ROWS ? live.slice(0, MAX_ROWS) : live;
}

/** One past the highest column index the sheet holds a flow cell in. */
export function sheetWidth(sheet: CollabSheet): number {
    let width = 0;
    for (const cell of Object.values(sheet.cells)) {
        // A cell outside the range projects nowhere, for the same reason.
        if (!Number.isInteger(cell.col) || cell.col < 0 || cell.col >= MAX_FLOW_COLS) continue;
        width = Math.max(width, cell.col + 1);
    }
    return width;
}

/** What one padded, empty grid slot costs the file: a line holding `null`. */
const EMPTY_CELL = fileBytes(null);

/** A sheet's live cells by column, and what the file charges for them. */
interface Costed {
    /** Each column's live cells in row order, which is what the grid writes. */
    columns: CollabCell[][];
    /**
     * The cells the sheet's grid pads out to, which is what the file counts it
     * as. `projectDoc` has to know this before it can decide how much of the
     * round's budget the sheet may have, so it is derived from the columns
     * rather than from a rectangle that does not exist yet.
     */
    cells: number;
    /**
     * What the whole sheet costs the file. Every slot the grid pads to is a
     * line whether a cell sits on it or not, and every live cell, decoration
     * and register adds what the file writes for it. Counted over the whole
     * sheet, high rather than exactly, so what a sheet is charged depends on
     * the document alone.
     */
    bytes: number;
    /**
     * The registers' part of `bytes`. A sheet's shape is fit into half the
     * sheet's byte budget, so this alone decides whether a register comes off.
     */
    shape: number;
}

/**
 * What a sheet costs, held against the sheet object.
 *
 * `projectDoc` costs every sheet in the round before it can divide the budget
 * and then derives the one the merge touched, so one projection asks for the
 * same walk over a sheet's cells twice and the next projection asks for it
 * again - up to thirty times a second while a partner types, for sheets
 * nothing has touched. A sheet is replaced and never written to, which is the
 * invariant the reuse path's `settled.sheets[id] === sheet` already rests on,
 * so an entry describes its key for as long as the key exists and a sheet
 * nothing holds any more takes its entry with it.
 */
const COSTED = new WeakMap<CollabSheet, Costed>();

function costOf(sheet: CollabSheet): Costed {
    const known = COSTED.get(sheet);
    if (known) return known;

    const width = sheetWidth(sheet);
    const columns: CollabCell[][] = [];
    let height = 0;
    for (let col = 0; col < width; col++) {
        const live = liveCells(sheet, col);
        columns.push(live);
        height = Math.max(height, live.length);
    }
    let shape = 0;
    for (const [path, reg] of Object.entries(sheet.fields)) {
        shape += path.length + fileBytes(reg.value);
    }
    const cells = width * height;
    let bytes = cells * EMPTY_CELL + shape;
    for (const cell of Object.values(sheet.cells)) {
        if (cell.deleted !== null) continue;
        if (typeof cell.text === "string") bytes += fileBytes(cell.text);
        if (Object.keys(cell.meta).length > 0) bytes += fileBytes(cell.meta);
    }

    const costed: Costed = { columns, cells, bytes, shape };
    COSTED.set(sheet, costed);
    return costed;
}

/**
 * The sheet a projection carries every register of.
 *
 * A copy already projected is handed back rather than derived again, and a copy
 * an earlier, tighter share clamped is not the sheet. Rows coming off the
 * bottom show in the copy's own cell count; registers coming off the shape show
 * nowhere, because dropping one changes no cell count. So a projection that fit
 * its whole shape says so here and one that did not says nothing, and a copy
 * from anywhere but a projection says nothing either.
 */
const WHOLE_SHAPE = new WeakMap<FlowSheet, CollabSheet>();

/**
 * The shape a map of registers describes, in the bytes the file allows it.
 *
 * Every path here is a peer's and so is every value, `MAX_REGISTERS` bounds how
 * many of them there are and nothing bounds how long, and all of them are
 * written: a path this build does not know is forwarded whole so a newer build
 * still reads it. Cheapest first, so a peer holding four thousand spare paths on
 * the debater's sheet spends what is left over rather than the title, and by
 * path when two cost the same, so two replicas holding one document drop the
 * same ones. Written in the map's own order, so a peer's spending does not
 * shuffle the file's keys. Returns the bytes left.
 */
function fitShape(
    fields: Record<string, Register>,
    bytes: number,
    out: Record<string, unknown>,
): number {
    const costed = Object.entries(fields)
        .map(([path, reg]) => ({ path, cost: path.length + fileBytes(reg.value) }))
        .sort((a, b) => a.cost - b.cost || (a.path < b.path ? -1 : 1));
    const kept = new Set<string>();
    let spare = bytes;
    for (const { path, cost } of costed) {
        if (cost > spare) continue;
        spare -= cost;
        kept.add(path);
    }
    for (const [path, reg] of Object.entries(fields)) {
        if (kept.has(path)) setPath(out, path, reg.value);
    }
    return spare;
}

export function seedSheet(sheet: FlowSheet, stamp: Stamp): CollabSheet {
    const leaves: Record<string, Json> = {};
    for (const [key, value] of Object.entries(sheet)) {
        if (SHEET_GRID_FIELDS[key]) continue;
        flattenLeaves(value, key, leaves);
    }
    const fields: Record<string, Register> = {};
    for (const [path, value] of Object.entries(leaves)) fields[path] = { value, stamp };

    // The grid is a rectangle even when the stored rows are ragged, so the
    // replica seeds the rectangle and a short row gains empty cells.
    const width = sheet.data.reduce((w, row) => Math.max(w, row.length), 0);
    const cells: Record<string, CollabCell> = {};
    sheet.data.forEach((row, rowIndex) => {
        const rank = seedRank(rowIndex);
        for (let col = 0; col < width; col++) {
            const meta = sheet.meta[`${rowIndex},${col}`];
            cells[cellKey(col, rank, "")] = {
                col,
                rank,
                actor: "",
                text: row[col] ?? null,
                textStamp: stamp,
                meta: meta ? ({ ...meta } as Record<string, Json>) : {},
                metaStamp: stamp,
                deleted: null,
            };
        }
    });
    return { id: sheet.id, fields, deleted: null, cells };
}

export function seedDoc(round: FlowRound): CollabDoc {
    const leaves: Record<string, Json> = {};
    for (const [key, value] of Object.entries(round)) {
        if (ROUND_LOCAL_FIELDS[key]) continue;
        flattenLeaves(value, key, leaves);
    }
    const roundRegisters: Record<string, Register> = {};
    for (const [path, value] of Object.entries(leaves)) {
        roundRegisters[path] = { value, stamp: ORIGIN_STAMP };
    }
    const sheets: Record<string, CollabSheet> = {};
    for (const sheet of round.sheets) sheets[sheet.id] = seedSheet(sheet, ORIGIN_STAMP);
    return { roundId: round.id, round: roundRegisters, sheets };
}

/**
 * The sheet a replica describes.
 *
 * Every field but the grid is a replicated register holding whatever a peer put
 * on the wire, and each one below is written to the file, whose parser refuses a
 * title that is not text, a group that is not a side, or an order that is not a
 * number. A round the parser refuses is a round the debater loses, so a value
 * the file cannot hold falls back to what a file predating that field gets.
 *
 * `room` is the cells of the round's budget this sheet may claim and `bytes`
 * the bytes of it; see `projectDoc`. A sheet on its own cannot reach the cell
 * default, because MAX_FLOW_COLS times MAX_ROWS is under it, but it can reach
 * the byte default, because a peer picks how long every cell is.
 */
export function projectSheet(
    sheet: CollabSheet,
    room = MAX_ROUND_CELLS,
    bytes = MAX_ROUND_BYTES,
): FlowSheet {
    return project(sheet, costOf(sheet), room, bytes);
}

/** `projectSheet` over a cost already taken, which is what `projectDoc` holds. */
function project(sheet: CollabSheet, costed: Costed, room: number, bytes: number): FlowSheet {
    // Half the sheet's bytes to its registers and half kept for the grid: the
    // merge lets a peer hold four thousand register paths on the debater's own
    // sheet, and spending the whole share on those would write the sheet with
    // no rows in it at all.
    const forShape = Math.floor(bytes / 2);
    const shape: Record<string, unknown> = {};
    let spare = bytes - forShape + fitShape(sheet.fields, forShape, shape);

    const columns = costed.columns;
    const width = columns.length;
    let height = 0;
    for (const live of columns) height = Math.max(height, live.length);
    // The file counts a sheet as its rows times its widest row, so the rows
    // that fit in `room` are room / width. Rows come off the bottom, which is
    // the end of the flow a sheet the format cannot hold has run past, and the
    // least of that sheet to lose: dropping columns would lose whole speeches
    // and dropping the sheet would lose one the debater may be looking at.
    if (width > 0) height = Math.min(height, Math.floor(room / width));
    const data: (string | null)[][] = [];
    const meta: Record<string, CellMeta> = {};
    for (let row = 0; row < height; row++) {
        const line: (string | null)[] = [];
        const decorated: [string, CellMeta][] = [];
        let cost = 0;
        for (let col = 0; col < width; col++) {
            const cell = columns[col][row];
            const text = typeof cell?.text === "string" ? cell.text : null;
            line.push(text);
            cost += text === null ? EMPTY_CELL : fileBytes(text);
            if (cell && Object.keys(cell.meta).length > 0 && holdsCellMeta(cell.meta)) {
                const key = `${row},${col}`;
                decorated.push([key, cell.meta as CellMeta]);
                cost += key.length + fileBytes(cell.meta);
            }
        }
        // A row past what the sheet's bytes buy comes off the bottom for
        // the same reason a row past `room` does. The whole row or none of it:
        // half a row of a speech reads as text the debater deleted.
        if (cost > spare) break;
        spare -= cost;
        data.push(line);
        for (const [key, value] of decorated) meta[key] = value;
    }
    const projected: FlowSheet = {
        ...(shape as Omit<FlowSheet, "id" | "data" | "meta">),
        id: sheet.id,
        title: typeof shape.title === "string" ? shape.title : "",
        group: shape.group === "neg" ? "neg" : "aff",
        order: typeof shape.order === "number" && Number.isFinite(shape.order) ? shape.order : 0,
        kind: shape.kind === "cx" ? "cx" : "flow",
        data,
        meta,
    };
    if (typeof projected.startSpeechId !== "string") delete projected.startSpeechId;
    // `fitShape` takes the cheapest registers first, so it keeps every one of
    // them exactly when they fit together.
    if (costed.shape <= forShape) WHOLE_SHAPE.set(projected, sheet);
    return projected;
}

/**
 * The round a replica describes. `base` supplies the two fields the replica
 * deliberately does not carry, so a partner's clock never rewrites this file's
 * creation time.
 *
 * `settled` is the document `base` was last projected from, when the caller
 * has one. A merge builds a new object only for the sheets it touched, so a
 * sheet whose replica is the very same object describes the very same sheet,
 * and the copy already in `base` stands rather than being derived again.
 * Without that, one cell arriving from a partner re-derives every sheet in the
 * round, up to thirty times a second while they type.
 *
 * This is also where the file's two ceilings are spent, because both are totals
 * across sheets while the merge's `MAX_CELLS` is per sheet: a hundred and
 * twenty-three sheets a peer grew to the tallest this build projects sum past
 * the cell ceiling, and a few thousand cells of a few kilobytes sum past the
 * bytes a reopen accepts. Either way every autosave of that round is then
 * refused for as long as the round holds them. The budgets belong here and not
 * in the merge - what the merge accepts must not depend on the replica's own
 * other sheets, or two peers holding different sheets would accept different
 * cells and diverge. A projection is local: the replica still holds every cell
 * it was sent, and only the file is bounded.
 *
 * Cheapest sheet first, each held to an equal share of what is left, so a round
 * the format holds is projected exactly as it would be with no budget at all: a
 * sheet that needs less than its share leaves the remainder to the rest, and
 * the budget only binds once the sheets have asked for more than two million
 * cells, or forty-eight million bytes, between them. A sheet is then held to
 * its share rather than to nothing, and the share buys the sheet rows, because
 * `sheetWidth` is what a flow is however far out a peer writes: at the
 * 512-sheet ceiling the smallest cell share is 3,906, which is 488 rows of a
 * full-width sheet. The smallest byte share is 48 KiB, of which the grid keeps
 * 24 KiB - a few dozen rows of typed argument, so a round of sheets a peer
 * invented costs the debater rows off the bottom of a full sheet and can never
 * empty one. A fat real round is a few hundred rows by eight speeches across
 * six sheets, three orders under either ceiling.
 */
export function projectDoc(doc: CollabDoc, base: FlowRound, settled?: CollabDoc): FlowRound {
    const shape: Record<string, unknown> = {};
    // The round's own registers come off the top, up to half: they are a peer's
    // to write too and the file carries them whether or not it carries a single
    // sheet, so the sheets keep the other half the way a grid keeps half of its
    // own sheet's.
    const forShape = Math.floor(MAX_ROUND_BYTES / 2);
    let unspentBytes = MAX_ROUND_BYTES - forShape + fitShape(doc.round, forShape, shape);
    const already = new Map(base.sheets.map((s) => [s.id, s]));
    // Every sheet costs what the document says it costs, never what the copy
    // already projected came back as. Costing a reused sheet from that copy
    // would feed a clamp back into itself, keeping a sheet small long after the
    // round that crowded it out is gone, and would read a local value into a
    // decision two replicas holding the same document have to make alike.
    // Cheapest first, then by id: `order` would not do, being a register a peer
    // writes.
    const costed = Object.values(doc.sheets)
        .filter((s) => s.deleted === null)
        .map((sheet) => ({
            sheet,
            cost: costOf(sheet),
            untouched: settled?.sheets[sheet.id] === sheet ? already.get(sheet.id) : undefined,
        }))
        .sort((a, b) => a.cost.cells - b.cost.cells || (a.sheet.id < b.sheet.id ? -1 : 1));

    let unspent = MAX_ROUND_CELLS;
    let unserved = costed.length;
    const sheets = costed
        .map(({ sheet, cost, untouched }) => {
            const share = Math.min(cost.cells, Math.floor(unspent / unserved));
            const byteShare = Math.floor(unspentBytes / unserved);
            unserved -= 1;
            // Charged what the document says the sheet costs, capped at the
            // share, whether it spends that or is clamped under it. Charging
            // what came back would mean measuring the projection, and counting
            // a sheet high only ever hands the next one less of a budget no
            // real round reaches.
            unspentBytes -= Math.min(cost.bytes, byteShare);
            // Reused only when the copy already projected is the whole sheet
            // and this share buys the whole sheet again. One that came back
            // clamped would otherwise be handed back unchanged, keeping the
            // sheet small after the round that crowded it out is gone and
            // leaving a replica that once clamped writing a different file than
            // one that never did. A clamp has two halves and both are asked
            // for: rows off the bottom, which the copy's own cell count shows,
            // and registers off the shape, which nothing about the copy shows.
            if (
                untouched &&
                cost.cells <= share &&
                cost.bytes <= byteShare &&
                cost.shape <= Math.floor(byteShare / 2) &&
                paddedCells(untouched.data) === cost.cells &&
                WHOLE_SHAPE.get(untouched) === sheet
            ) {
                unspent -= cost.cells;
                return untouched;
            }
            // Clamped to its share, and counted as what it came back as.
            const projected = project(sheet, cost, share, byteShare);
            unspent -= paddedCells(projected.data);
            return projected;
        })
        .sort(compareSheets);
    return {
        ...(shape as Omit<FlowRound, "id" | "createdAt" | "updatedAt" | "scouting" | "sheets">),
        id: doc.roundId,
        createdAt: base.createdAt,
        updatedAt: base.updatedAt,
        // Replicated registers, so a peer chooses all three, and all three are
        // written to the file. `getEvent` already names the fallback an
        // unknown event gets on read; this is the same fallback on write.
        event: getEvent(shape.event as string).id,
        firstSide: shape.firstSide === "neg" ? "neg" : "aff",
        scouting: holdsScouting(shape.scouting) ? (shape.scouting as Scouting) : emptyScouting(),
        sheets,
    };
}
