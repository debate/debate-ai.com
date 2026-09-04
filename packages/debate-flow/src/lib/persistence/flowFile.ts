/**
 * The .ebb file format: a version envelope wrapping one FlowRound, written as
 * pretty-printed JSON so the file stays diffable and readable outside ebb.
 *
 * Version 3 is the Handsontable-native model. Versions 1-2 are the legacy node
 * model and are rejected outright; they were never migratable. A file on disk
 * outlives the build that wrote it, so an older version is normalized rather
 * than refused, and only a newer one is refused - this build cannot know what
 * it would silently drop.
 *
 * Validation is strict on purpose. A database row was written by code that had
 * already type-checked it; a file can be truncated by a full disk, mangled by a
 * sync client, or hand-edited. Failing at this boundary with the path to the bad
 * value beats rendering half a round.
 *
 * Size is part of strict. Types alone say nothing about how much a well-formed
 * file can ask for, and the two grid dimensions are independent, so both the
 * text length and the cells a round claims are bounded here - at the boundary,
 * where a refusal is a message with a path, rather than at the allocation,
 * where it is a dead webview.
 */

import { EVENTS } from "../format/events";
import { normalizeFlow, type FlowRound } from "../model/flow";
import { uid } from "../model/ids";

export const FLOW_FILE_VERSION = 3;

/**
 * Serialize a round as .ebb file text.
 *
 * A round projected from a replica carries register values a peer chose, and
 * the parser below refuses several of them. A file this parser cannot read back
 * is a round the debater loses for good, so the write refuses first - by type,
 * by cell count, and by the bytes the read caps at. The projection spends
 * `MAX_ROUND_BYTES` so a peer cannot reach that last one; reaching it anyway
 * fails the autosave loudly and leaves the file already on disk readable.
 */
export function serializeFlow(round: FlowRound): string {
    checkRound(round, "round");
    const text = JSON.stringify({ version: FLOW_FILE_VERSION, round }, null, 2) + "\n";
    // Bytes and not characters, the way `MAX_ROUND_BYTES` counts and for the
    // same reason: the shell refuses the file by the bytes on disk and one
    // character is up to three of them, so a round of Chinese inside the
    // character cap is a file the app writes and then cannot read back.
    if (utf8Bytes(text) > MAX_FLOW_BYTES) {
        fail("round", `is longer than the ${MAX_FLOW_BYTES} bytes a flow file holds`);
    }
    return text;
}

// --- Validation --------------------------------------------------------------

type Obj = Record<string, unknown>;

function fail(path: string, expected: string): never {
    throw new Error(`Invalid flow file: ${path} ${expected}`);
}

function obj(value: unknown, path: string): Obj {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        fail(path, "is not an object");
    }
    return value as Obj;
}

function str(value: unknown, path: string): string {
    if (typeof value !== "string") fail(path, "is not a string");
    return value;
}

/** Absent and null both mean "unset"; anything else must be the right type. */
function optional(value: unknown): boolean {
    return value === undefined || value === null;
}

function optStr(value: unknown, path: string): void {
    if (!optional(value) && typeof value !== "string") fail(path, "is not a string");
}

function optBool(value: unknown, path: string): void {
    if (!optional(value) && typeof value !== "boolean") fail(path, "is not a boolean");
}

function finiteNum(value: unknown, path: string): number {
    if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "is not a number");
    return value;
}

function checkDebater(value: unknown, path: string): void {
    const d = obj(value, path);
    str(d.first, `${path}.first`);
    str(d.last, `${path}.last`);
}

function checkScouting(value: unknown, path: string): void {
    const sc = obj(value, path);
    for (const side of ["aff", "neg"] as const) {
        const team = obj(sc[side], `${path}.${side}`);
        checkDebater(team.first, `${path}.${side}.first`);
        checkDebater(team.second, `${path}.${side}.second`);
    }
    for (const key of [
        "affSchool",
        "negSchool",
        "tournament",
        "round",
        "flight",
        "date",
        "judge",
    ]) {
        optStr(sc[key], `${path}.${key}`);
    }
    if (!optional(sc.decision)) {
        const d = obj(sc.decision, `${path}.decision`);
        if (!optional(d.vote) && d.vote !== "aff" && d.vote !== "neg") {
            fail(`${path}.decision.vote`, 'is not "aff" or "neg"');
        }
        optStr(d.rfd, `${path}.decision.rfd`);
        if (!optional(d.peerNotes)) {
            // One entry per peer, each that peer's own notes. A hand edit that
            // put something else in here would reach the RFD preview.
            const notes = obj(d.peerNotes, `${path}.decision.peerNotes`);
            for (const [endpointId, note] of Object.entries(notes)) {
                optStr(note, `${path}.decision.peerNotes.${endpointId}`);
            }
        }
    }
}

function checkCellMeta(value: unknown, path: string): void {
    const m = obj(value, path);
    optBool(m.bold, `${path}.bold`);
    optBool(m.highlight, `${path}.highlight`);
    optBool(m.card, `${path}.card`);
    optBool(m.group, `${path}.group`);
    if (!optional(m.answers)) {
        const a = obj(m.answers, `${path}.answers`);
        str(a.sheetId, `${path}.answers.sheetId`);
        finiteNum(a.row, `${path}.answers.row`);
        finiteNum(a.col, `${path}.answers.col`);
    }
    if (!optional(m.source)) {
        const s = obj(m.source, `${path}.source`);
        str(s.app, `${path}.source.app`);
        str(s.token, `${path}.source.token`);
        str(s.key, `${path}.source.key`);
        optStr(s.title, `${path}.source.title`);
    }
}

/**
 * Whether the file can hold this scouting, or this cell decoration.
 *
 * Both are projected out of registers a peer chose, and the projection has to
 * refuse a value this parser refuses or the round it writes cannot be reopened.
 * It asks here rather than restating the contract, which would drift.
 */
export function holdsScouting(value: unknown): boolean {
    try {
        checkScouting(value, "scouting");
        return true;
    } catch {
        return false;
    }
}

/** As `holdsScouting`, for one cell's decoration. */
export function holdsCellMeta(value: unknown): boolean {
    try {
        checkCellMeta(value, "meta");
        return true;
    } catch {
        return false;
    }
}

/** A cell-meta key is the cell's coordinate, which is how it is looked up. */
const CELL_KEY = /^\d+,\d+$/;

/**
 * Ceiling on the cells one round can claim, counted per sheet as its rows times
 * its widest row. Every consumer materializes that product - the grid pads to
 * it, the print view builds a table of it, the exporter walks it - and the two
 * dimensions are independent, so a sheet of one 100,000-column row followed by
 * 100,000 single-cell rows asks for 10^10 cells from under a megabyte of file.
 * A fat real round is a few hundred thousand cells.
 */
export const MAX_ROUND_CELLS = 2_000_000;

/**
 * The cells one sheet claims: its rows times its widest row, which is the
 * rectangle every consumer pads it to. `MAX_ROUND_CELLS` counts these, and the
 * projection that writes a round spends the same number as its budget, so both
 * ask here rather than restating the product. A projection that counted a sheet
 * differently would write a round this parser then refuses.
 */
export function paddedCells(rows: readonly unknown[][]): number {
    let widest = 0;
    for (const row of rows) widest = Math.max(widest, row.length);
    return rows.length * widest;
}

/**
 * Ceiling on the bytes a flow file takes on disk, which is where the shell
 * refuses to hand one back (`MAX_FLOW_BYTES` in `src-tauri/src/flowfile.rs`).
 * The same number as `MAX_FLOW_TEXT_CHARS` and a different measure of the same
 * file: that one is the characters a parse walks, this one is the bytes the
 * read never gets to, so the write refuses here.
 */
export const MAX_FLOW_BYTES = 64 * 1024 * 1024;

/**
 * Ceiling on the bytes one round's own values can claim of the file.
 *
 * `MAX_ROUND_CELLS` bounds how many cells a round holds and nothing bounds how
 * long one is, and a peer chooses both, so a round inside the cell ceiling
 * still serializes past the size a reopen accepts - and a round the app wrote
 * and cannot reopen is the whole round gone. Three quarters of the read cap;
 * the rest is the envelope and the slack in counting a value high.
 *
 * Bytes and not characters, because the shell refuses the file by the bytes on
 * disk before the parse refuses it by the characters they decode to, and one
 * character is up to three bytes: a round of Chinese counted in characters
 * would pass a budget under the parse cap and still be a file the shell will
 * not hand back.
 */
export const MAX_ROUND_BYTES = 48 * 1024 * 1024;

/**
 * What the indent, the separators and the newline of one line of the file cost
 * on top of the value sitting on it. A cell is six levels in, so twelve spaces
 * and a comma; counted high, because a budget that binds early costs a peer
 * rows and one that binds late costs the debater the file.
 */
const FILE_LINE = 16;

/**
 * What one value costs the flow file: its own JSON in UTF-8, plus a line's
 * worth of structure for every line it spans. An empty grid is almost nothing
 * to hold and megabytes to write, so a budget counting only the values would
 * still read as unspent at the size the reader refuses. `MAX_ROUND_BYTES`
 * counts these, and the projection that writes a round spends the same number
 * as its budget, so both ask here rather than restating the format.
 *
 * Counted rather than encoded, and a scalar - which is what a cell is - never
 * built in its indented form: every cell of every sheet is priced on every
 * projection, and a `TextEncoder` pass would allocate the round to answer.
 */
export function fileBytes(value: unknown): number {
    const text =
        value !== null && typeof value === "object"
            ? (JSON.stringify(value, null, 2) ?? "null")
            : (JSON.stringify(value) ?? "null");
    let bytes = text.length;
    let lines = 1;
    for (let i = 0; i < text.length; i += 1) {
        const code = text.charCodeAt(i);
        if (code < 0x80) {
            if (code === 10) lines += 1;
            continue;
        }
        // A surrogate pair is charged six where it takes four, which is the
        // side of the count a budget belongs on.
        bytes += code < 0x800 ? 1 : 2;
    }
    return bytes + lines * FILE_LINE;
}

/**
 * The bytes one string takes on disk, exactly. Counted rather than encoded for
 * the reason above, doubly so here: the string being measured is the whole file,
 * and a `TextEncoder` pass would hold a second copy of it to answer. Exact and
 * not high, because this one decides whether a save is refused - `JSON.stringify`
 * escapes an unpaired surrogate, so every surrogate left in the text is half of
 * a pair and carries half of the four bytes the pair takes.
 */
function utf8Bytes(text: string): number {
    let bytes = text.length;
    for (let i = 0; i < text.length; i += 1) {
        const code = text.charCodeAt(i);
        if (code < 0x80) continue;
        bytes += code < 0x800 || (code >= 0xd800 && code < 0xe000) ? 1 : 2;
    }
    return bytes;
}

/** Validate one sheet, returning the cells the grid pads it to. */
function checkSheet(value: unknown, path: string): number {
    const s = obj(value, path);
    str(s.id, `${path}.id`);
    str(s.title, `${path}.title`);
    if (s.group !== "aff" && s.group !== "neg") fail(`${path}.group`, 'is not "aff" or "neg"');
    finiteNum(s.order, `${path}.order`);
    if (!optional(s.kind) && s.kind !== "flow" && s.kind !== "cx") {
        fail(`${path}.kind`, 'is not "flow" or "cx"');
    }
    optStr(s.startSpeechId, `${path}.startSpeechId`);

    if (!Array.isArray(s.data)) fail(`${path}.data`, "is not an array");
    s.data.forEach((row, r) => {
        if (!Array.isArray(row)) fail(`${path}.data[${r}]`, "is not a row");
        row.forEach((cell, c) => {
            if (cell !== null && typeof cell !== "string") {
                fail(`${path}.data[${r}][${c}]`, "is not text or null");
            }
        });
    });

    // Sparse and optional: an older sheet may predate cell metadata entirely.
    // A key reaches the grid as a row and a column, and a decoration can sit on
    // a padded cell past the stored rows, so the form is checked and the range
    // is not.
    if (!optional(s.meta)) {
        const meta = obj(s.meta, `${path}.meta`);
        for (const key of Object.keys(meta)) {
            if (!CELL_KEY.test(key)) fail(`${path}.meta["${key}"]`, 'is not a "row,col" cell');
            checkCellMeta(meta[key], `${path}.meta["${key}"]`);
        }
    }
    return paddedCells(s.data);
}

/** Validate a parsed round, throwing with the path to the first bad value. */
export function checkRound(value: unknown, path: string): FlowRound {
    const r = obj(value, path);
    str(r.id, `${path}.id`);
    finiteNum(r.createdAt, `${path}.createdAt`);
    finiteNum(r.updatedAt, `${path}.updatedAt`);
    if (!optional(r.event)) {
        const event = str(r.event, `${path}.event`);
        // `in` walks the prototype chain, so "constructor" would pass and name
        // no event at all.
        if (!Object.hasOwn(EVENTS, event)) fail(`${path}.event`, "is not a known debate event");
    }
    if (!optional(r.firstSide) && r.firstSide !== "aff" && r.firstSide !== "neg") {
        fail(`${path}.firstSide`, 'is not "aff" or "neg"');
    }
    checkScouting(r.scouting, `${path}.scouting`);
    if (!Array.isArray(r.sheets)) fail(`${path}.sheets`, "is not an array");
    let cells = 0;
    r.sheets.forEach((s, i) => {
        cells += checkSheet(s, `${path}.sheets[${i}]`);
    });
    if (cells > MAX_ROUND_CELLS) {
        fail(`${path}.sheets`, `hold more than ${MAX_ROUND_CELLS} cells`);
    }
    return value as FlowRound;
}

// --- Reading -----------------------------------------------------------------

/**
 * Ceiling on flow file text. A parse costs several times the text in live
 * objects and the shell holds a copy of its own, so a file this large is
 * refused before the parse rather than after it. Six of them sit in the recents
 * list the start screen reads on every launch.
 */
export const MAX_FLOW_TEXT_CHARS = 64 * 1024 * 1024;

function parseEnvelope(text: string): Obj {
    if (text.length > MAX_FLOW_TEXT_CHARS) {
        throw new Error("Not a flow file: it is too large to be one");
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error("Not a flow file: the contents are not valid JSON");
    }
    const envelope = obj(parsed, "the file");
    const version = finiteNum(envelope.version, "the file version");
    if (version > FLOW_FILE_VERSION) {
        throw new Error(
            `This flow was written by a newer version of ebb (file version ${version}). Update ebb to open it.`,
        );
    }
    if (version < FLOW_FILE_VERSION) {
        throw new Error(
            `Flow file version ${version} is from a retired format and cannot be opened.`,
        );
    }
    return envelope;
}

/**
 * Parse .ebb file text into the round it holds, preserving its identity.
 * Opening a file is not importing one: the path is the identity now, so the
 * round's own id, createdAt, and history survive the round trip.
 */
export function parseFlowFile(text: string): FlowRound {
    const envelope = parseEnvelope(text);
    if (envelope.kind === "backup") {
        throw new Error("That is a multi-flow backup, not a single flow.");
    }
    return normalizeFlow(checkRound(envelope.round, "round"));
}

/**
 * Parse a legacy export - either a single `{version, round}` or a
 * `{version, kind:"backup", rounds}` - into rounds with fresh identities.
 * These files were snapshots rather than documents, so materializing one into
 * the flows folder mints a new identity per round the way importing always did.
 */
export function parseLegacyExport(text: string): FlowRound[] {
    const envelope = parseEnvelope(text);
    const backup = envelope.kind === "backup";
    if (backup && !Array.isArray(envelope.rounds)) fail("rounds", "is not an array");
    const raw = backup ? (envelope.rounds as unknown[]) : [envelope.round];

    const now = Date.now();
    return raw.map((r, i) => ({
        ...normalizeFlow(checkRound(r, backup ? `rounds[${i}]` : "round")),
        id: uid("round"),
        createdAt: now,
        updatedAt: now,
    }));
}
