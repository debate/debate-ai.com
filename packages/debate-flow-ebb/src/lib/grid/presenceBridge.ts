/**
 * Where the presence a session tracks meets the live grid, in both directions.
 *
 * Presence is grid state, so it lives beside the other grid registries rather
 * than in `useCollabStore`. Each peer refreshes its cell on a 250ms heartbeat,
 * and the store is what the session chip subscribes to; routing presence
 * through it would re-render React several times a second for a value only the
 * grid paints.
 *
 * An entry landing here has to repaint something, so the registry notifies as
 * well as stores. Expiry is deliberately not its business: the decorators take
 * a `now` and ask presence, so a stale entry stops painting on the next render
 * with no timer here.
 *
 * The outbound half is the same shape as `remoteBridge`, and for the same
 * reason: the grid may not import the session, and the session may not import
 * a component. The grid says where its cursor is and which cell it has an
 * editor open on; whatever session is live decides who hears about it.
 */

import type { Presence } from "../collab/presence";

import type { ModelCol } from "./colSpace";
import { getActiveHot } from "./hotInstance";

/** One array backs every empty table, so a clear changes no identity. */
const NO_PRESENCE: readonly Presence[] = [];

let presences: readonly Presence[] = NO_PRESENCE;
const listeners = new Set<() => void>();

/** The session layer publishes the whole table; there is no incremental path. */
export function setPresences(next: readonly Presence[]): void {
    presences = next.length === 0 ? NO_PRESENCE : next;
    for (const listener of listeners) listener();
}

export function getPresences(): readonly Presence[] {
    return presences;
}

/**
 * A mounted grid asks to repaint when the table changes. Both panes of a split
 * subscribe, so listeners are a set and the returned unsubscribe drops only
 * the caller's own.
 */
export function onPresenceChanged(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
        listeners.delete(cb);
    };
}

/**
 * A cell a pane is on, or null when it is on none. The column is the model's:
 * a partner draws this side's cursor against their own sheet, and their pane
 * may be padded differently or not at all.
 */
export type HeldCell = { sheetId: string; col: ModelCol; row: number } | null;

let claimHandler: ((cell: HeldCell) => void) | null = null;
let cursorHandler: ((cell: HeldCell) => void) | null = null;

/** The runtime registers both for the life of a session. */
export function setClaimHandler(next: ((cell: HeldCell) => void) | null): void {
    claimHandler = next;
}

export function setCursorHandler(next: ((cell: HeldCell) => void) | null): void {
    cursorHandler = next;
}

/**
 * Says this machine is editing a cell, or has stopped.
 *
 * A no-op with no session, which is the ordinary case: a debater flowing alone
 * announces nothing to anybody.
 */
export function claimCell(cell: HeldCell): void {
    claimHandler?.(cell);
}

/**
 * Says where this machine's cursor is. Fires on every selection, so the
 * session coalesces it onto the heartbeat rather than putting a message on the
 * wire per arrow key.
 */
export function claimCursor(cell: HeldCell): void {
    cursorHandler?.(cell);
}

/**
 * Whether an editor is open here right now.
 *
 * Handsontable announces an editor opening and says nothing when one closes,
 * so a claim cannot be released by an event: whoever holds one asks instead,
 * and the grid answers from the editor itself. Escape is the case that proves
 * it - the editor shuts, the selection does not move, and no hook runs at all.
 *
 * The focused pane is the one asked, which in a split is the pane that opened
 * the editor: an editor only opens on a selection, and selecting is what moves
 * the focus here.
 */
export function editingHere(): boolean {
    return getActiveHot()?.getActiveEditor()?.isOpened() ?? false;
}
