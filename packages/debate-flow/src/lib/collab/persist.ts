/**
 * The replica across a restart.
 *
 * Recovery is best-effort by construction: a sidecar is only ever an
 * accelerator, so a missing, stale, malformed, or unreadable one falls back to
 * seeding from the file, which two peers do identically. Persisting is
 * likewise never allowed to fail a save; the flow itself is already on disk by
 * the time this runs.
 *
 * The replica is maintained whether or not a peer exists, so recovery always
 * seeds. Only the disk write is gated on the master switch: a debater who has
 * never turned shared editing on gets no extra file.
 */

import type { FlowRound } from "../model/flow";

import { collabSettings } from "./enabled";
import { hashText } from "./hash";
import { getReplica, healReplica, replicaRoundId, seedReplica } from "./replica";
import { knownRoundPeers, knownRoundRelays, knownRoundViewers, setRoundPeers } from "./roundPeers";
import { parseSidecar, serializeSidecar } from "./sidecar";
import { getSidecarFs } from "./sidecarFs";
import type { CollabDoc } from "./types";

/**
 * Seeds the replica for a round that is being opened, and answers with the
 * peers that round remembers, which is who a session re-dials.
 */
export async function recoverReplica(round: FlowRound, flowText: string): Promise<string[]> {
    if (!collabSettings().enabled) {
        seedReplica(round);
        return [];
    }
    let recovered = null;
    try {
        const fs = await getSidecarFs();
        recovered = parseSidecar(await fs.read(round.id), round.id, hashText(flowText));
    } catch {
        // A broken config directory is not a reason to refuse to open a round.
    }
    seedReplica(round, "", recovered?.doc ?? null);
    // A recovered sidecar replaces this round's set, read-only grants included,
    // because it is the only record of them. Without one the round keeps what
    // it already knows: one taken from an invitation knows its host before any
    // sidecar for it exists.
    if (recovered) setRoundPeers(round.id, recovered.peers, recovered.viewers, recovered.relays);
    return knownRoundPeers(round.id);
}

/**
 * Keeps the document a join received, beside the file it just wrote.
 *
 * Without it the new file opens by seeding, which re-derives every rank from a
 * row's position. A cell the host created during its own session is keyed by
 * the rank and the author that made it instead, so the two sets of keys never
 * meet and the first state the host sends back arrives as a second copy of
 * every such row.
 *
 * Best-effort like every other sidecar write: a failure costs the guest a
 * re-seed, which is where it started.
 */
export async function adoptJoinedDoc(
    doc: CollabDoc,
    flowText: string,
    peers: string[],
): Promise<void> {
    try {
        const fs = await getSidecarFs();
        await fs.write(
            doc.roundId,
            serializeSidecar({
                roundId: doc.roundId,
                flowHash: hashText(flowText),
                peers,
                viewers: [],
                // Where the ticket said the host is, recorded before this file
                // has ever been opened: the session that opens it re-dials the
                // host, and by EndpointId alone that dial reaches one room.
                relays: knownRoundRelays(doc.roundId),
                doc,
            }),
        );
    } catch {
        // The round is on disk; only the head start on its replica is lost.
    }
}

/** Repairs any drift, then makes the replica durable beside the saved file. */
export async function persistReplica(round: FlowRound, flowText: string): Promise<void> {
    if (!collabSettings().enabled) return;
    if (replicaRoundId() !== round.id) return;
    healReplica(round);
    const doc = getReplica();
    if (!doc) return;
    try {
        const fs = await getSidecarFs();
        await fs.write(
            round.id,
            serializeSidecar({
                roundId: round.id,
                flowHash: hashText(flowText),
                peers: knownRoundPeers(round.id),
                viewers: knownRoundViewers(round.id),
                relays: knownRoundRelays(round.id),
                doc,
            }),
        );
    } catch {
        // The flow itself is already saved. A sidecar that did not land only
        // costs a re-seed on the next open.
    }
}
