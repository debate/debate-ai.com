/**
 * Where each peer is, and whether their editor is open on it.
 *
 * One entry per peer, because a debater has one cursor. A cell somebody is
 * merely parked on is shown and nothing more; a cell somebody has an editor
 * open on is claimed, so the other side sees it before they start typing and a
 * refusal is predictable rather than surprising. The claim is advisory: there
 * is no coordinator, so two peers can hold one cell during a partition and
 * last-writer-wins settles it underneath.
 *
 * What matters more than the claim is that it always goes away. A cell that
 * stays marked because a peer vanished is worse than no marking at all, so
 * there are three releases and only the last is timed: the cursor moving or
 * the editor closing, the connection dropping, and a TTL for a frozen process
 * on a live link.
 */

import type { ModelCol } from "../grid/colSpace";

/** Refresh cadence while a peer is anywhere at all. */
export const HEARTBEAT_MS = 250;
/** An entry nothing refreshed inside this window is gone. */
export const PRESENCE_TTL_MS = 1_000;

export interface Presence {
    endpointId: string;
    sheetId: string;
    col: ModelCol;
    row: number;
    /** When the peer last said it was still there. */
    heldAt: number;
    /** Their editor is open on this cell, so typing into it is refused. */
    editing: boolean;
    /**
     * This side granted them read access only, so they never claim and their
     * marker is one the debater can turn off. Carried on the entry rather than
     * looked up where it is painted: the grade lives in the session, and the
     * grid has only the presence table.
     */
    readOnly: boolean;
}

/**
 * One cell per peer: a cursor is on exactly one, so a new position replaces
 * whatever that peer was on before.
 */
export function claim(list: readonly Presence[], next: Presence): Presence[] {
    return [...list.filter((p) => p.endpointId !== next.endpointId), next];
}

/** The peer left the grid, or has no cell to report. Instant. */
export function releaseCell(list: readonly Presence[], endpointId: string): Presence[] {
    return list.filter((p) => p.endpointId !== endpointId);
}

/** The connection dropped, which releases everything that peer held. Instant. */
export function releasePeer(list: readonly Presence[], endpointId: string): Presence[] {
    return list.filter((p) => p.endpointId !== endpointId);
}

/** The backstop, for a frozen process on a connection that still looks alive. */
export function expire(
    list: readonly Presence[],
    now: number,
    ttlMs: number = PRESENCE_TTL_MS,
): Presence[] {
    return list.filter((p) => now - p.heldAt <= ttlMs);
}

/** Who is on this cell, if anyone. */
export function presenceAt(
    list: readonly Presence[],
    sheetId: string,
    col: number,
    row: number,
): Presence | null {
    return list.find((p) => p.sheetId === sheetId && p.col === col && p.row === row) ?? null;
}

/**
 * Who has an editor open on this cell, if anyone. A peer whose cursor is
 * merely resting here holds nothing and blocks nothing.
 */
export function lockAt(
    list: readonly Presence[],
    sheetId: string,
    col: number,
    row: number,
): Presence | null {
    const at = presenceAt(list, sheetId, col, row);
    return at?.editing ? at : null;
}
