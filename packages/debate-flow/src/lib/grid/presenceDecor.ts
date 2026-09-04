/**
 * Turns the presence table into something the grid can paint.
 *
 * A cell a peer is on is marked so the debater can see where their partner is
 * working without asking, and a cell a peer is editing is marked harder,
 * before the debater tries to type into it, so a refusal is predictable rather
 * than a surprise. Liveness is not this module's rule to invent: `expire` in
 * presence owns the TTL, and an entry past it decorates nothing, exactly as it
 * holds nothing.
 */

import { expire, lockAt, presenceAt, type Presence } from "../collab/presence";

import type { ModelCol } from "./colSpace";

/** Marks a cell a peer's cursor is on. */
export const PEER_CLASS = "ebb-peer";
/** Marks a cell a peer has an editor open on, which also wears PEER_CLASS. */
export const LOCK_CLASS = "ebb-locked";

/**
 * The peer on this cell, or null when nobody is.
 *
 * `showViewers` is the debater's own answer to a read-only peer's cursor: a
 * viewer reading along leaves a marker on every cell they scroll past, which is
 * noise to the side doing the writing. A viewer never claims a cell, so turning
 * them off can never hide a mark that would have refused a keystroke.
 */
export function presenceOn(
    list: readonly Presence[],
    sheetId: string,
    col: ModelCol,
    row: number,
    now: number,
    showViewers = true,
): Presence | null {
    const at = presenceAt(expire(list, now), sheetId, col, row);
    if (at?.readOnly && !showViewers) return null;
    return at;
}

/**
 * The one character the corner badge shows. A name is what the debater reads
 * everywhere else, so its first letter is what identifies the partner here;
 * a name that is only punctuation still has to leave a mark, so the fallback
 * is a bullet rather than an empty badge.
 */
export function peerInitial(name: string): string {
    const letter = [...name].find((c) => /[\p{L}\p{N}]/u.test(c));
    return letter ? letter.toUpperCase() : "*";
}

/**
 * Who has an editor open on that cell, named for a hint or tooltip. `nameOf`
 * resolves an endpoint id to a display name, which is the contacts list's job,
 * not this module's.
 */
export function lockLabel(
    list: readonly Presence[],
    sheetId: string,
    col: ModelCol,
    row: number,
    now: number,
    nameOf: (endpointId: string) => string,
): string | null {
    const held = lockAt(expire(list, now), sheetId, col, row);
    return held ? nameOf(held.endpointId) : null;
}
