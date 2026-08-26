/**
 * Accepting an invitation.
 *
 * A join is deliberately short-lived: it dials the host once with the ticket,
 * takes the round's state, and puts a real `.ebb` on this machine. Then it
 * hangs up. The round opens like any other file, and its own session re-dials
 * the host, which by then knows this peer by EndpointId and needs no ticket.
 * That is one code path for joining and for every reconnect after it.
 *
 * A guest owns a real file for the same reason every peer does: a dead peer, a
 * dead network, and a dead app each cost nothing.
 */

import { emptyScouting, type FlowRound } from "../model/flow";
import { parseFlowFile, serializeFlow } from "../persistence/flowFile";
import { getFlowFs, type FlowFs } from "../persistence/flowFs";
import { suggestFilename } from "../persistence/flowPaths";
import { resolveFlowsDir } from "../persistence/flowsDir";
import { loadRecents } from "../persistence/recents";
import { buildSummary, recentLabel } from "../start/summary";
import { askToRejoin, type RejoinAsk } from "../store/useRejoinDialog";

import { projectDoc } from "./doc";
import { collabLive, collabSettings, type CollabSettings } from "./enabled";
import { helloFrom } from "./handshake";
import { markJoined } from "./joined";
import { broadcastName } from "./machineName";
import { merge } from "./merge";
import type { PeerLinkFactory, WireMessage } from "./peerLink";
import { adoptJoinedDoc } from "./persist";
import { incomingDoc } from "./rfdSync";
import { rememberRoundPeers, rememberRoundRelay } from "./roundPeers";
import { parseTicket } from "./ticket";
import type { CollabDoc, Role } from "./types";

export interface JoinDeps {
    /** The pasted ticket, verbatim. Absent when a contact's invite is being taken. */
    ticket?: string;
    /**
     * The round a saved contact offered. No secret rides along: they dialled
     * this install by EndpointId, so their host already admits it by name.
     */
    invite?: { endpointId: string; roundId: string };
    createLink: PeerLinkFactory;
    appVersion: string;
    /**
     * What to call this side. The host hears this before anything else and
     * offers it as the contact name, so a join that greets namelessly is
     * saved on the far side as a short EndpointId for good.
     */
    displayName?: string;
    /**
     * Whether this peer belongs in a round this install already holds. Both the
     * round an invite names and the document that answers for it are the
     * issuer's to choose, so one naming a round already on this disk is asking
     * for a place in the debater's own round rather than offering a new one, and
     * only the debater can grant that. Defaults to the ticket dialog.
     */
    confirmRejoin?: (ask: RejoinAsk) => Promise<boolean>;
    settings?: () => CollabSettings;
    fs?: FlowFs;
}

export interface JoinResult {
    roundId: string;
    hostEndpointId: string;
    path: string;
    /** False when a local file already held this round. */
    created: boolean;
}

/** The local file holding this round, and the round it holds, if there is one. */
async function findExisting(
    fs: FlowFs,
    roundId: string,
): Promise<{ path: string; round: FlowRound } | null> {
    for (const recent of await loadRecents(fs)) {
        try {
            const snapshot = await fs.readFlow(recent.path);
            if (!snapshot) continue;
            const round = parseFlowFile(snapshot.text);
            if (round.id === roundId) return { path: recent.path, round };
        } catch {
            // A recent that no longer parses is not a match, and not a reason
            // to fail a join.
        }
    }
    return null;
}

/**
 * Null when shared editing is off, and when the debater declines to admit this
 * peer to a round they already hold; throws with a reason the corner can show.
 */
export async function joinRound(deps: JoinDeps): Promise<JoinResult | null> {
    const settings = (deps.settings ?? collabSettings)();
    if (!collabLive()) return null;

    const ticket = deps.ticket ? parseTicket(deps.ticket) : null;
    if (deps.ticket && !ticket) throw new Error("That does not look like an ebb ticket");
    const host = ticket ?? deps.invite;
    if (!host) throw new Error("That does not look like an ebb ticket");
    // A contact's invite carries no role, so this side asks to edit and the
    // host's ack is what says otherwise. Only a ticket names a grant up front.
    const role: Role = ticket?.role ?? "editor";

    const link = await deps.createLink({
        discovery: "mdns",
        // Both sides have to agree before a relay carries anything.
        relay: settings.relay && (ticket?.relay ?? true),
    });

    try {
        const endpointId = await link.endpointId();
        const name = deps.displayName ?? (await broadcastName());
        // Where the ticket says the host is. Without it the dial has only an
        // EndpointId, which mDNS answers for across a room and nowhere else -
        // so a partner on another network is unreachable by name alone.
        const conn = await link.dial(host.endpointId, ticket?.relayUrl ?? null);

        const raw = await new Promise<CollabDoc>((resolve, reject) => {
            conn.onMessage((msg: WireMessage) => {
                if (msg.type === "helloAck" && !msg.ok) {
                    reject(new Error(msg.reason));
                    return;
                }
                // The host opens with the whole document, which is the round.
                // The round the ticket named, at that: a host that answers with
                // a different one is offering a round this side was not invited
                // to, and taking it would write this peer into that round's
                // record and clobber the open round's own.
                if (msg.type === "state" && msg.doc.roundId === host.roundId) resolve(msg.doc);
            });
            conn.onClose(() => reject(new Error("The host hung up")));
            conn.send(
                helloFrom({
                    endpointId,
                    roundId: host.roundId,
                    role,
                    appVersion: deps.appVersion,
                    ticket: ticket?.secret,
                    name,
                }),
            );
        });

        // The same rule every later message goes through: the host's own
        // reasoning is theirs, and a note this install left with them on an
        // earlier round is not a partner's.
        const raised = incomingDoc(raw, endpointId, host.endpointId);
        // A join is the one document path that skips `merge`, which is where the
        // growth ceilings and the rank check live. The host chooses every byte
        // of a guest's first document, so it goes through the same gate as the
        // second one rather than straight into the sidecar.
        const { doc } = merge({ roundId: raised.roundId, round: {}, sheets: {} }, raised);
        const io = deps.fs ?? (await getFlowFs());
        const existing = await findExisting(io, doc.roundId);

        const now = Date.now();
        const base: FlowRound = {
            id: doc.roundId,
            createdAt: now,
            updatedAt: now,
            scouting: emptyScouting(),
            sheets: [],
        };
        const round = projectDoc(doc, base);

        if (existing) {
            // The round is already here, so this invite is not offering one: it
            // asks for a place in a round the debater holds, and both halves of
            // the check that got this far are the issuer's own choice. Only the
            // debater grants that, and the answer comes before anything is
            // recorded, so a decline writes nothing and leaves this round's
            // membership and its grades exactly as they were.
            const ask = deps.confirmRejoin ?? askToRejoin;
            const granted = await ask({
                round: recentLabel(buildSummary(existing.round), existing.path),
                endpointId: host.endpointId,
            });
            if (!granted) return null;
        }

        // The file about to be opened has no sidecar yet, so this is the only
        // record of who to re-dial once it is.
        rememberRoundPeers(doc.roundId, [host.endpointId]);
        // And where the host was, for the same reason: the session that opens
        // this file re-dials by EndpointId, which routes across a room only.
        if (ticket?.relayUrl) rememberRoundRelay(doc.roundId, host.endpointId, ticket.relayUrl);

        // The debater asked for this round, so its session is owed whatever
        // Listen for invites says.
        markJoined(doc.roundId);

        if (existing)
            return {
                roundId: doc.roundId,
                hostEndpointId: host.endpointId,
                path: existing.path,
                created: false,
            };

        const dir = await resolveFlowsDir(io);
        const text = serializeFlow(round);
        const path = await io.createFlow(dir, suggestFilename(round), text);
        // The file is the host's document flattened, and flattening loses which
        // peer created each row. Keeping the document itself is what makes the
        // guest's first merge with the host a merge rather than a duplication.
        await adoptJoinedDoc(doc, text, [host.endpointId]);
        return { roundId: doc.roundId, hostEndpointId: host.endpointId, path, created: true };
    } finally {
        // The round's own session owns the peer from here.
        await link.stop();
    }
}
