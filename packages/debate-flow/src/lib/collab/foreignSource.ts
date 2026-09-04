/**
 * Whose machine a cell's provenance belongs to.
 *
 * `CellSource.token` is opaque and machine-local: it means something to the
 * CardMirror running beside the peer that made it and nothing at all anywhere
 * else. So a partner's sourced cell must not try to jump; it degrades to the
 * same "open X first" path a stale local source already takes.
 *
 * Nothing new has to be recorded to know this. The meta that carried the
 * source was written by somebody, and the replica already stamps every meta
 * write with the actor who made it.
 *
 * That actor is a claim, not a proof: it travels inside the peer's own document
 * and nothing signs a register, so a modified client can stamp a meta write
 * with this machine's id and its token then reads as local. The guard is
 * therefore worth exactly what a stale local source is worth - it stops an
 * honest partner's token being handed to the wrong CardMirror, and it is not a
 * boundary. Whatever the bridge does with a token it is given has to be safe on
 * its own account.
 */

import { liveCells } from "./doc";
import type { CollabSheet } from "./types";

/** The peer whose meta write carried this cell's source, if any. */
export function sourceOwner(
    sheet: CollabSheet | undefined,
    col: number,
    row: number,
): string | null {
    if (!sheet) return null;
    const cell = liveCells(sheet, col)[row];
    if (!cell || !cell.meta.source) return null;
    // The origin stamp belongs to the file rather than to a peer, and a source
    // read off this machine's own disk is this machine's to jump to.
    return cell.metaStamp.actor || null;
}

/** Whether that token is worth handing to the local CardMirror. */
export function isForeignSource(owner: string | null, myEndpointId: string): boolean {
    return owner !== null && owner !== "" && owner !== myEndpointId;
}
