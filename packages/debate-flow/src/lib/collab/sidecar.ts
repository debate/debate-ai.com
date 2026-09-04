/**
 * The replica, made durable.
 *
 * One file per round, holding the CollabDoc, the peers the round knows, and a
 * hash of the `.ebb` it belongs to. On open a matching hash recovers the
 * replica; a missing, stale, or malformed one seeds from the file instead. The
 * sidecar is therefore an optimization and can never be a source of
 * corruption, which is why every failure below returns the same null.
 *
 * Without it one hole stays open: an app restart while diverged re-derives
 * ranks from position, so two rows independently inserted at one index collide
 * and last-writer-wins eats a cell.
 */

import { isEndpointId, isRelayUrl } from "./contacts";
import type { CollabDoc } from "./types";

/**
 * Bumped whenever a field the admission rules read starts carrying meaning,
 * because an older file parses with that field absent and so reads as the
 * widest case. Version 3 is what `viewers` costs: an older file names its
 * read-only members under another key or not at all, and every peer it
 * remembers would come back an editor. An unknown version is discarded, so a
 * bump costs a re-seed of the replica and never a promotion.
 */
export const SIDECAR_VERSION = 3;

export interface Sidecar {
    version: number;
    roundId: string;
    /** Digest of the `.ebb` text this document was last in step with. */
    flowHash: string;
    peers: string[];
    /** Of those peers, the ones admitted read-only. The grant this round made. */
    viewers: string[];
    /**
     * Where each of those peers was last found. Addressing and not admission,
     * so a file written by a build that did not record it reads as a round
     * whose peers are reachable across the room and no further, which is what
     * that build could do anyway.
     */
    relays: Record<string, string>;
    doc: CollabDoc;
}

export function serializeSidecar(input: {
    roundId: string;
    flowHash: string;
    peers: string[];
    viewers: string[];
    relays: Record<string, string>;
    doc: CollabDoc;
}): string {
    const sidecar: Sidecar = { version: SIDECAR_VERSION, ...input };
    return JSON.stringify(sidecar);
}

function isDoc(value: unknown): value is CollabDoc {
    if (value === null || typeof value !== "object") return false;
    const doc = value as Partial<CollabDoc>;
    return (
        typeof doc.roundId === "string" &&
        typeof doc.round === "object" &&
        doc.round !== null &&
        typeof doc.sheets === "object" &&
        doc.sheets !== null
    );
}

/**
 * Whatever of a stored list is still an id iroh could parse back into a key.
 * Anything else is a hand edit or a peer's junk, and every entry here is
 * dialled on the next open.
 */
function endpointIds(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((p): p is string => typeof p === "string" && isEndpointId(p));
}

/**
 * Whatever of a stored table still names a peer and an https relay. The value
 * is a dial target the next time this round opens, so a scheme somebody chose
 * by hand is not one: an iroh relay is https and nothing else.
 */
function relayUrls(value: unknown): Record<string, string> {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
    const out: Record<string, string> = Object.create(null);
    for (const [peer, url] of Object.entries(value as Record<string, unknown>)) {
        if (!isEndpointId(peer)) continue;
        if (!isRelayUrl(url)) continue;
        out[peer] = url;
    }
    return out;
}

/** The recovered sidecar, or null for every reason it cannot be trusted. */
export function parseSidecar(
    text: string | null,
    roundId: string,
    flowHash: string,
): Sidecar | null {
    if (!text) return null;
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch {
        return null;
    }
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
    const s = raw as Partial<Sidecar>;
    if (s.version !== SIDECAR_VERSION) return null;
    if (s.roundId !== roundId) return null;
    if (s.flowHash !== flowHash) return null;
    if (!isDoc(s.doc)) return null;
    return {
        version: SIDECAR_VERSION,
        roundId,
        flowHash,
        peers: endpointIds(s.peers),
        viewers: endpointIds(s.viewers),
        relays: relayUrls(s.relays),
        doc: s.doc,
    };
}
