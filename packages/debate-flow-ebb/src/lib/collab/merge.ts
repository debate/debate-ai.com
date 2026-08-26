/**
 * The one sync primitive.
 *
 * A delta and a full state message are the same shape, so both arrive here.
 * The result depends on the pair and not on the order they arrived in, which
 * is what lets a dropped link, a restart, and a replayed message all be
 * harmless.
 *
 * A delete wins unconditionally. Resurrecting a cell would re-insert one
 * column's entry and leave that column offset by one row below the deletion
 * point, which reads as a bug and is silent. The cells a delete discards are
 * reported instead, because that is the one loss a debater cannot see.
 */

import { isRank } from "./rank";
import { compareStamps, type Stamp } from "./stamp";
import type { CollabCell, CollabDoc, CollabSheet, Register } from "./types";

/**
 * A round is a debate flow, and a flow is a bounded object.
 *
 * Nothing here evicts and nothing collects a tombstone, so every distinct key a
 * peer has ever sent is retained for the life of the round, written to the
 * sidecar beside every autosave, and walked again on every message and every
 * repair tick. The line cap on the transport bounds one message and not how
 * many. Growth stops at these; a key this replica already holds still merges,
 * so refusing to grow costs no value the two sides had already agreed on.
 */
const MAX_SHEETS = 512;
const MAX_CELLS = 200_000;
const MAX_REGISTERS = 4_096;

export interface DroppedCell {
    sheetId: string;
    col: number;
    rank: string;
    /** The text that is gone. */
    text: string;
    /** The peer that wrote the text. */
    writtenBy: string;
    /** The peer whose delete discarded it. */
    deletedBy: string;
}

export interface MergeResult {
    doc: CollabDoc;
    dropped: DroppedCell[];
}

/** The first delete, so two concurrent deletes settle the same way on both peers. */
function firstDelete(a: Stamp | null, b: Stamp | null): Stamp | null {
    if (a === null) return b;
    if (b === null) return a;
    return compareStamps(a, b) <= 0 ? a : b;
}

function mergeRegisters(
    a: Record<string, Register>,
    b: Record<string, Register>,
): Record<string, Register> {
    const out: Record<string, Register> = { ...a };
    let room = MAX_REGISTERS - Object.keys(out).length;
    for (const [path, reg] of Object.entries(b)) {
        const mine = out[path];
        if (!mine) {
            if (room <= 0) continue;
            room -= 1;
        }
        out[path] = mine && compareStamps(mine.stamp, reg.stamp) >= 0 ? mine : reg;
    }
    return out;
}

function mergeCell(a: CollabCell, b: CollabCell): CollabCell {
    const text = compareStamps(a.textStamp, b.textStamp) >= 0 ? a : b;
    const meta = compareStamps(a.metaStamp, b.metaStamp) >= 0 ? a : b;
    return {
        col: a.col,
        rank: a.rank,
        actor: a.actor,
        text: text.text,
        textStamp: text.textStamp,
        meta: meta.meta,
        metaStamp: meta.metaStamp,
        deleted: firstDelete(a.deleted, b.deleted),
    };
}

function mergeSheet(
    sheetId: string,
    local: CollabSheet | undefined,
    incoming: CollabSheet,
    dropped: DroppedCell[],
): CollabSheet {
    // A sheet the far side holds and this replica does not merges from nothing
    // rather than being taken whole, so the ceiling and the rank check below
    // cover a fresh sheet too, and the sheet is named by the key it arrived
    // under: `incoming.id` need not agree with it, and two sheets projecting
    // under one id silently swallow every later local edit to one of them.
    const base = local ?? { id: sheetId, fields: {}, deleted: null, cells: {} };
    const cells: Record<string, CollabCell> = { ...base.cells };
    let room = MAX_CELLS - Object.keys(cells).length;
    const buried: DroppedCell[] = [];
    for (const [key, remote] of Object.entries(incoming.cells)) {
        const mine = cells[key];
        if (!mine) {
            // A rank this build cannot order throws on the next local insert
            // into that column and would come back from the sidecar after a
            // restart, so a cell carrying one never joins the round at all.
            if (room <= 0 || !isRank(remote.rank)) continue;
            room -= 1;
        }
        const merged = mine ? mergeCell(mine, remote) : remote;
        cells[key] = merged;
        // A cell this replica held alive, with text, that the merge just
        // buried. The peer that typed it is the one that must be told.
        if (
            mine &&
            mine.deleted === null &&
            merged.deleted !== null &&
            (merged.text ?? "").trim() !== ""
        ) {
            buried.push({
                sheetId,
                col: merged.col,
                rank: merged.rank,
                text: merged.text as string,
                writtenBy: merged.textStamp.actor,
                deletedBy: merged.deleted.actor,
            });
        }
    }
    // The report reads in grid order, not in whatever order the keys arrived.
    buried.sort((x, y) => x.col - y.col || (x.rank < y.rank ? -1 : x.rank > y.rank ? 1 : 0));
    dropped.push(...buried);
    return {
        id: sheetId,
        fields: mergeRegisters(base.fields, incoming.fields),
        deleted: firstDelete(base.deleted, incoming.deleted),
        cells,
    };
}

export function merge(local: CollabDoc, incoming: CollabDoc): MergeResult {
    const dropped: DroppedCell[] = [];
    const sheets: Record<string, CollabSheet> = { ...local.sheets };
    let room = MAX_SHEETS - Object.keys(sheets).length;
    for (const [sheetId, remote] of Object.entries(incoming.sheets)) {
        const mine = sheets[sheetId];
        if (!mine) {
            if (room <= 0) continue;
            room -= 1;
        }
        sheets[sheetId] = mergeSheet(sheetId, mine, remote, dropped);
    }
    return {
        doc: {
            roundId: local.roundId,
            round: mergeRegisters(local.round, incoming.round),
            sheets,
        },
        dropped,
    };
}
