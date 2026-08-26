/**
 * What one peer still owes another.
 *
 * A delta is an ordinary CollabDoc holding only the entries the far side has
 * not seen, so applying one is the same merge as applying a full state and
 * nothing new has to be correct. The same function answers both jobs: the push
 * after a local edit, and the repair a `vector` message asks for.
 */

import { compareStamps, ORIGIN_STAMP, type Stamp } from "./stamp";
import type { CollabCell, CollabDoc, CollabSheet, Register } from "./types";

/** The highest stamp seen from each actor. */
export type Vector = Record<string, Stamp>;

function raise(into: Vector, stamp: Stamp): void {
    const held = into[stamp.actor];
    if (!held || compareStamps(stamp, held) > 0) into[stamp.actor] = stamp;
}

/**
 * An actor comes off the wire and is used as a key here. On a plain object
 * `__proto__` finds `Object.prototype`'s accessor and swaps this vector's own
 * prototype instead of recording a stamp; a map with no prototype has no
 * accessor to find. Refusing the name instead would record nothing for that
 * actor, and a stamp no vector can hold is one every delta re-ships forever.
 */
export function vectorOf(doc: CollabDoc): Vector {
    const seen: Vector = Object.create(null);
    for (const reg of Object.values(doc.round)) raise(seen, reg.stamp);
    for (const sheet of Object.values(doc.sheets)) {
        for (const reg of Object.values(sheet.fields)) raise(seen, reg.stamp);
        if (sheet.deleted) raise(seen, sheet.deleted);
        for (const cell of Object.values(sheet.cells)) {
            raise(seen, cell.textStamp);
            raise(seen, cell.metaStamp);
            if (cell.deleted) raise(seen, cell.deleted);
        }
    }
    return seen;
}

/** Whether the far side is already at or past this stamp's actor. */
function known(seen: Vector, stamp: Stamp): boolean {
    // A peer's vector arrives as a plain object, where a lookup for an actor it
    // does not name resolves up the prototype chain rather than to nothing.
    if (!Object.hasOwn(seen, stamp.actor)) return false;
    return compareStamps(stamp, seen[stamp.actor]) <= 0;
}

function newRegisters(from: Record<string, Register>, seen: Vector): Record<string, Register> {
    const out: Record<string, Register> = {};
    for (const [path, reg] of Object.entries(from)) {
        if (!known(seen, reg.stamp)) out[path] = reg;
    }
    return out;
}

export function deltaSince(doc: CollabDoc, seen: Vector): CollabDoc {
    const sheets: Record<string, CollabSheet> = {};
    for (const [sheetId, sheet] of Object.entries(doc.sheets)) {
        const cells: Record<string, CollabCell> = {};
        for (const [key, cell] of Object.entries(sheet.cells)) {
            const fresh =
                !known(seen, cell.textStamp) ||
                !known(seen, cell.metaStamp) ||
                (cell.deleted !== null && !known(seen, cell.deleted));
            if (fresh) cells[key] = cell;
        }
        const fields = newRegisters(sheet.fields, seen);
        const deleted = sheet.deleted && !known(seen, sheet.deleted) ? sheet.deleted : null;
        // A sheet with nothing new in it is not worth naming.
        if (Object.keys(cells).length === 0 && Object.keys(fields).length === 0 && !deleted) {
            continue;
        }
        sheets[sheetId] = { id: sheetId, fields, deleted, cells };
    }
    return { roundId: doc.roundId, round: newRegisters(doc.round, seen), sheets };
}

export function isEmptyDelta(doc: CollabDoc): boolean {
    return Object.keys(doc.round).length === 0 && Object.keys(doc.sheets).length === 0;
}

/**
 * A vector that has seen only the file both peers opened. Every seeded value
 * shares the origin stamp, so this suppresses the whole seed and a first sync
 * between two peers who opened one round costs nothing.
 *
 * Prototypeless for the same reason `vectorOf` is: the sync raises this map by
 * the actor of every stamp it ships.
 */
export function emptyVector(): Vector {
    const seen: Vector = Object.create(null);
    seen[""] = ORIGIN_STAMP;
    return seen;
}
