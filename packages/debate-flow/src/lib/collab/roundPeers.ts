/**
 * The peers a round has been shared with, and which of them read and do not
 * write.
 *
 * Kept per round rather than for whichever round was touched last. A join dials
 * the round it is joining, not the one on screen, and for a round that already
 * exists on disk this module is its only record of the host; a single slot for
 * all rounds meant that record was written over the open round's, and the open
 * round's next autosave put the loss in its sidecar. There is no slot to
 * contend for now: every entry names its round, and nothing here reaches an
 * entry other than the one it was handed the id of.
 *
 * One entry per round opened or joined since the app started, and every one of
 * them dropped when the last round closes.
 *
 * Written into the sidecar on every save, so that opening the file tomorrow
 * re-dials the same partners with no ticket and no interaction. Remembering
 * only ever adds: a partner who is offline right now is still this round's
 * partner, and forgetting them would cost a ticket to get back. Cutting a peer
 * loose is the one exception, because a debater who does that means it to
 * outlast the session.
 *
 * The read-only mark rides with the membership, and this is the only place a
 * grade is kept at all. Membership with no grade beside it reads as the wider
 * role, so a grant kept only where a toast put it is destroyed by the gesture
 * that most looks like withdrawing trust.
 */

import type { Role } from "./types";

interface Membership {
    peers: string[];
    /** The peers of this round that were admitted read-only. */
    readOnly: string[];
    /**
     * Where each of them was last found. An EndpointId names a peer and does
     * not route to them: the only lookup this build runs is mDNS, which
     * answers across a room and no further, so without this a round reopened
     * from another network re-dials names it cannot reach.
     */
    relays: Record<string, string>;
}

const rounds = new Map<string, Membership>();

function entryFor(roundId: string): Membership {
    const held = rounds.get(roundId);
    if (held) return held;
    const fresh: Membership = { peers: [], readOnly: [], relays: {} };
    rounds.set(roundId, fresh);
    return fresh;
}

/**
 * Replaces one round's set, for a round being opened off its sidecar.
 *
 * The grades are named rather than defaulted because this is the only call that
 * can drop one, and a replace that says nothing about them promotes every
 * viewer the round remembered.
 */
export function setRoundPeers(
    roundId: string,
    peers: readonly string[],
    readOnlyPeers: readonly string[],
    relays: Record<string, string> = {},
): void {
    rounds.set(roundId, {
        peers: [...new Set(peers)],
        readOnly: [...new Set(readOnlyPeers)],
        relays: { ...relays },
    });
}

/**
 * Records where a peer was reached, so the next open dials an address and not
 * only a name. Overwrites: a peer that moved networks is at the newer one, and
 * the older is a relay they are no longer connected to.
 */
export function rememberRoundRelay(roundId: string, peer: string, relayUrl: string): void {
    entryFor(roundId).relays[peer] = relayUrl;
}

/** Where this round's peers were last found, for the dials that reopen it. */
export function knownRoundRelays(roundId: string): Record<string, string> {
    return { ...(rounds.get(roundId)?.relays ?? {}) };
}

/** Adds peers to one round's set. No other round's set is reachable from here. */
export function rememberRoundPeers(roundId: string, peers: readonly string[]): void {
    const held = entryFor(roundId);
    for (const peer of peers) if (!held.peers.includes(peer)) held.peers.push(peer);
}

/**
 * Records a peer and what it was admitted as, so the grant outlives the session
 * that made it. A peer admitted wider loses the mark: a later invitation or
 * ticket is the debater deciding again.
 *
 * A grade is a membership, so this remembers the peer too. The two lists have
 * no way to disagree about who belongs.
 */
export function rememberRoundRole(roundId: string, peer: string, role: Role): void {
    const held = entryFor(roundId);
    if (!held.peers.includes(peer)) held.peers.push(peer);
    const marked = held.readOnly.includes(peer);
    if (role === "viewer") {
        if (!marked) held.readOnly.push(peer);
    } else if (marked) {
        held.readOnly = held.readOnly.filter((p) => p !== peer);
    }
}

/** Empty for a round nothing has been recorded about, which is what a fresh open is. */
export function knownRoundPeers(roundId: string): string[] {
    return [...(rounds.get(roundId)?.peers ?? [])];
}

/** Of those peers, the ones a session has to keep read-only. */
export function knownRoundViewers(roundId: string): string[] {
    return [...(rounds.get(roundId)?.readOnly ?? [])];
}

/**
 * Drops one peer for good, for a debater who cut them loose. The set is
 * otherwise append-only, so without this the cut lasts only until the next open
 * re-dials them off the sidecar and admits them on membership alone.
 */
export function forgetRoundPeer(roundId: string, peer: string): void {
    const held = rounds.get(roundId);
    if (!held) return;
    held.peers = held.peers.filter((p) => p !== peer);
    held.readOnly = held.readOnly.filter((p) => p !== peer);
}

/** Drops every set, for a debater back at the start screen with nothing open. */
export function forgetRoundPeers(): void {
    rounds.clear();
}
