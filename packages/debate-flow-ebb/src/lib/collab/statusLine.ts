/**
 * What a session says about itself, in words a debater can act on.
 *
 * A status word and a peer count describe the machine. "Waiting for Sam to
 * open this round" and "Can't reach Sam" describe what happened and what to do
 * about it, and they are different sentences because they need different
 * answers: the first is five minutes before a round starting, the second is a
 * hotspot on one side and venue wifi on the other.
 *
 * Names arrive already resolved, so nothing here reaches for the contact table
 * and the whole module is a function of its arguments.
 */

export interface StatusPeer {
    name: string;
    /** Whether the link runs through a relay, which is worth a quiet note. */
    relayed: boolean;
}

export interface StatusPending {
    name: string;
    /** Whether a dial to them came back, rather than a link merely dropping. */
    unreachable: boolean;
}

function partners(count: number): string {
    return count === 1 ? "1 partner" : `${count} partners`;
}

/** The one line the collapsed chip carries. */
export function chipSummary(
    peers: readonly StatusPeer[],
    pending: readonly StatusPending[],
): string {
    if (peers.length === 0) {
        if (pending.length === 0) return "Waiting to be joined";
        if (pending.length === 1) {
            const one = pending[0];
            return one.unreachable ? `Can't reach ${one.name}` : `Waiting for ${one.name}`;
        }
        return `Waiting for ${partners(pending.length)}`;
    }
    const here =
        peers.length === 1
            ? `Connected to ${peers[0].name}${peers[0].relayed ? ", relayed" : ""}`
            : `Connected to ${partners(peers.length)}`;
    // Who is here leads, because that is the state the round is actually in.
    // A count of who is not is enough for one line; the panel names them.
    return pending.length === 0 ? here : `${here}, waiting for ${pending.length} more`;
}

/** The whole sentence for one peer who is not there. */
export function pendingLine(peer: StatusPending): string {
    return peer.unreachable
        ? `Can't reach ${peer.name}. You both need internet, or the same wifi.`
        : `Waiting for ${peer.name} to open this round`;
}
