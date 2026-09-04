/**
 * The one live session, and the store the chip reads.
 *
 * Module state rather than store state, for the same reason the replica is:
 * the session is a connection, not a value a component renders. What the chip
 * needs - a status and a peer list - is pushed into `useCollabStore` as it
 * changes, and nothing else about the session is visible to React.
 *
 * Every route in and out of a session passes through here, so the master
 * switch is enforced in exactly one place.
 */

import { toast } from "sonner";

import { errorMessage } from "../errorMessage";
import { editingHere, setClaimHandler, setCursorHandler } from "../grid/presenceBridge";
import { applyRemote } from "../grid/remoteBridge";
import type { FlowRound } from "../model/flow";
import { serializeFlow } from "../persistence/flowFile";
import { basename } from "../persistence/flowPaths";
import {
    useCollabStore,
    type CollabPendingView,
    type CollabPeerView,
} from "../store/useCollabStore";
import { useFlowStore } from "../store/useFlowStore";
import { getCurrentVersion } from "../update/adapter";

import { addContact, contactName, contactOf, type Contact } from "./contacts";
import { projectDoc } from "./doc";
import { collabLive, collabSettings } from "./enabled";
import { announceInvite } from "./inbox";
import type { InviteNotice } from "./invite";
import { startInviteListener, type InviteListener } from "./inviteListener";
import { joinRound, type JoinResult } from "./join";
import { joinedHere } from "./joined";
import { lossMessage } from "./lossReport";
import { broadcastName } from "./machineName";
import { merge, type DroppedCell } from "./merge";
import { hostPairing, redeemCode } from "./pairing";
import { createPeerLinkFor } from "./peerLink";
import { persistReplica } from "./persist";
import {
    adoptReplicaActor,
    getReplica,
    replaceReplicaDoc,
    replicaActor,
    replicaRoundId,
    seedReplica,
    setLocalChangeListener,
} from "./replica";
import { dropSelfNote } from "./rfdSync";
import {
    knownRoundPeers,
    rememberRoundPeers,
    rememberRoundRelay,
    rememberRoundRole,
} from "./roundPeers";
import {
    startCollabSession,
    type CollabPeer,
    type CollabSession,
    type PendingPeer,
    type SavedByPeer,
} from "./session";
import { encodeTicket } from "./ticket";
import type { CollabDoc, Role } from "./types";

let session: CollabSession | null = null;
/** Bound between rounds so a saved contact's invite has somewhere to land. */
let listener: InviteListener | null = null;
/** In-flight listener change, so two callers cannot bind two endpoints. */
let watching: Promise<void> | null = null;
/**
 * A session is coming up but has not been assigned yet. There is one endpoint
 * per install: a listener that bound during this window would share it with
 * the session, hear the session's own peers as diallers, and hang up on them.
 */
let starting = false;
/** The name each peer was last offered under, so one session asks once. */
const offered = new Map<string, string>();

/**
 * A peer nobody has saved is worth one offer, because the alternative is
 * trading keys by hand next time. The name defaults to the one they broadcast,
 * falling back to the short id, and is theirs to change in Settings; what
 * matters is the id behind it.
 *
 * Asked again when a peer that greeted this machine namelessly has since said
 * what to call them. The offer carries the name it will save, so one made
 * before the name arrived would save a short EndpointId as this partner's name
 * for good. The toast is addressed per peer, so the later offer replaces the
 * earlier one in place rather than stacking a second question beside it.
 */
function offerToSave(peers: CollabPeer[]): void {
    const contacts = useFlowStore.getState().contacts;
    for (const peer of peers) {
        if (contactOf(contacts, peer.endpointId)) continue;
        const name = contactName(contacts, peer.endpointId, peer.name);
        if (offered.get(peer.endpointId) === name) continue;
        offered.set(peer.endpointId, name);
        toast(`Save ${name} as a partner?`, {
            id: `collab-save-${peer.endpointId}`,
            duration: 20_000,
            action: {
                label: "Save",
                // Where they were reached goes with them. Without it the saved
                // contact is dialable across the room and nowhere else, which
                // is not what a partner saved on a tournament trip expects of
                // the next round from a hotel.
                onClick: () =>
                    saveContact(peer.endpointId, {
                        name,
                        ...(peer.relayUrl ? { relay: peer.relayUrl } : {}),
                    }),
            },
        });
    }
}

/**
 * A peer said it saved this side, so this side saves them back.
 *
 * Only reachable over a connection this window already admitted to a round, so
 * it is not a way for a stranger to write into the contact table. The corner
 * says so, because a table that grew on its own is one a debater should be able
 * to find and prune.
 *
 * A name already saved is left alone: it is this side's own word for that peer,
 * and a partner must not be able to rename themselves out from under it.
 */
function saveBack(peer: SavedByPeer): void {
    const contacts = useFlowStore.getState().contacts;
    const saved = contactOf(contacts, peer.endpointId);
    const name = contactName(contacts, peer.endpointId, peer.name);
    if (saved) {
        if (!peer.relayUrl || saved.relay === peer.relayUrl) return;
        saveContact(peer.endpointId, { ...saved, relay: peer.relayUrl });
        return;
    }
    saveContact(peer.endpointId, {
        name,
        ...(peer.relayUrl ? { relay: peer.relayUrl } : {}),
    });
    // Nothing left to ask, so the offer this side would have made is spent.
    offered.set(peer.endpointId, name);
    toast(`${name} saved you as a partner`, { id: `collab-saved-by-${peer.endpointId}` });
}

/**
 * Keeps a saved contact's relay in step with where they actually are.
 *
 * Which relay a peer is homed on follows latency, so a partner who flew to a
 * tournament is on a different one than the row saved at home. The saved
 * address is the only thing that reaches them on a round that has no record of
 * its own, so a stale one is a contact that quietly stops working. Written
 * only when it changed, because the table lives in the config file.
 */
function refreshContactRelays(peers: CollabPeer[]): void {
    const contacts = useFlowStore.getState().contacts;
    for (const peer of peers) {
        if (!peer.relayUrl) continue;
        const saved = contactOf(contacts, peer.endpointId);
        if (!saved || saved.relay === peer.relayUrl) continue;
        saveContact(peer.endpointId, { ...saved, relay: peer.relayUrl });
    }
}

/**
 * What this side may do, for the surfaces that have to stop offering an edit.
 * A viewer learns it from the host's ack, which lands after the session is
 * already up, so this is pushed rather than read once.
 */
function publishRole(role: Role): void {
    useCollabStore.getState().setSelfRole(role);
}

/**
 * Who the session is still trying to reach, named the way the chip names
 * everyone else: the contact table's word for them, then a short id.
 */
function publishPending(pending: PendingPeer[]): void {
    const contacts = useFlowStore.getState().contacts;
    const view: CollabPendingView[] = pending.map((p) => ({
        endpointId: p.endpointId,
        name: contactName(contacts, p.endpointId),
        unreachable: p.unreachable,
    }));
    useCollabStore.getState().setPending(view);
}

function publish(peers: CollabPeer[]): void {
    const contacts = useFlowStore.getState().contacts;
    const view: CollabPeerView[] = peers.map((p) => ({
        endpointId: p.endpointId,
        name: contactName(contacts, p.endpointId, p.name),
        role: p.role,
        connectionType: p.connectionType,
    }));
    useCollabStore.getState().setPeers(view);
    // An empty list is two different situations, and the chip has a word for
    // each. A dial in flight is a partner this side lost and is going back
    // for; nothing in flight is a session waiting to be joined.
    const waiting = session?.reconnecting() ? "reconnecting" : "connecting";
    useCollabStore.getState().setStatus(view.length > 0 ? "connected" : waiting);
    if (session)
        rememberRoundPeers(
            session.roundId,
            view.map((p) => p.endpointId),
        );
    refreshContactRelays(peers);
    offerToSave(peers);
}

/**
 * Everything that happens to a remote document on the way in: merge it, keep
 * the replica, write the round it now describes, move the grid under the apply
 * rules, and tell the user about anything the merge buried.
 *
 * The store holds the projection of the replica, so this is what puts a
 * partner's text in front of the user, into the autosave, and into every
 * export. The grid follows separately because what may be painted over is
 * governed by the apply rules, which is a different question from what the
 * document says.
 */
export function applyRemoteDoc(round: FlowRound, incoming: CollabDoc): DroppedCell[] {
    const before = getReplica();
    if (!before) return [];
    const result = merge(before, incoming);
    replaceReplicaDoc(result.doc);
    const store = useFlowStore.getState();
    // The round on screen, not the one the session opened with: createdAt and
    // updatedAt belong to this file and no partner ever sends them.
    const base = store.round?.id === result.doc.roundId ? store.round : round;
    // `before` is what `base` was projected from, so every sheet the merge
    // left alone is handed straight back rather than derived again.
    store.applyRemoteRound(projectDoc(result.doc, base, before));
    applyRemote(before, result.doc);
    // A delete leaves no mark on the grid, so this is the only place the user
    // learns their text is gone.
    const loss = lossMessage(store.contacts, result.dropped, replicaActor());
    if (loss) toast.warning(loss, { duration: 10_000 });
    return result.dropped;
}

export function currentSession(): CollabSession | null {
    return session;
}

/**
 * Opens a session for the round already loaded. Returns null when shared
 * editing is not offered here, which is the whole gate: nothing below this
 * line runs.
 */
export async function startForRound(
    round: FlowRound,
    knownPeers: string[] = [],
): Promise<CollabSession | null> {
    if (!collabLive()) return null;
    if (session?.roundId === round.id) return session;
    // A session speaks for one round, so opening another one ends it.
    if (session) await endSession();
    // Claimed before the release, and held until the session is assigned, so
    // no listener can bind the endpoint in between.
    starting = true;
    // One endpoint per install, so the idle listener lets go of it first.
    await releaseInviteWatch();

    useCollabStore.getState().setStatus("connecting");
    // The replica is already live from opening the round; the session reads it
    // rather than holding a second copy.
    if (replicaRoundId() !== round.id) seedReplica(round);

    const store = useFlowStore.getState();
    try {
        session = await startCollabSession({
            createLink: createPeerLinkFor,
            roundId: round.id,
            // The filename is what a debater calls this round everywhere else,
            // so it is what an invite names.
            roundLabel: store.docPath ? basename(store.docPath).replace(/\.ebb$/i, "") : "",
            appVersion: await getCurrentVersion(),
            displayName: await broadcastName(),
            doc: () => getReplica() as CollabDoc,
            apply: (incoming) => applyRemoteDoc(round, incoming),
            dial: knownPeers,
            onPeersChanged: publish,
            onPendingChanged: publishPending,
            onRoleChanged: publishRole,
            contacts: () => useFlowStore.getState().contacts,
            onInvite: announceInvite,
            onContact: saveBack,
            editing: editingHere,
        });
    } catch (err) {
        // A chip left saying "connecting" would outlast the corner message and
        // read as a session that is still coming up.
        session = null;
        starting = false;
        useCollabStore.getState().reset();
        await syncInviteWatch();
        throw err;
    }
    starting = false;

    // The switches were read before the bind, and a bind is an endpoint plus
    // one QUIC dial per remembered peer: seconds on a tournament LAN, which is
    // long enough for a debater to reach the kill switch during it. A session
    // that came up into a world where shared editing is off is ended here or
    // never, because the chip and the Settings controls are both hidden by
    // then and no surface is left to end it from.
    if (session && !collabLive()) {
        await endSession();
        return null;
    }

    if (!session) {
        useCollabStore.getState().reset();
        await syncInviteWatch();
        return session;
    }
    rememberRoundPeers(round.id, knownPeers);
    useCollabStore.getState().setEndpointId(session.endpointId);
    publishRole(session.role());
    // Every cell written from here carries this machine's own identity, so a
    // cell it inserts can never collide with one a peer inserts at the same
    // position.
    adoptReplicaActor(session.endpointId);
    // An earlier session may have left this machine's own note in the file
    // under this machine's id, where the drawer reads it as a partner's. This
    // is the first moment the id is known, so it is where that is undone.
    const held = getReplica();
    const clean = held && dropSelfNote(held, session.endpointId);
    if (clean && clean !== held) {
        replaceReplicaDoc(clean);
        useFlowStore.getState().applyRemoteRound(projectDoc(clean, round));
    }
    // Push, not poll: every op the grid and the store record is offered to the
    // peers the moment it lands, coalesced a frame later by the sync.
    setLocalChangeListener(notifyLocalChange);
    // An open editor claims its cell, so a partner is warned off before they
    // type rather than after the merge has picked a winner. A cursor claims
    // nothing and only says where this side is looking.
    setClaimHandler((cell) => session?.setPresence(cell));
    setCursorHandler((cell) => session?.setCursor(cell));
    return session;
}

/**
 * Re-dials the peers a round remembers, which is what makes a reconnect cost
 * no ticket and no interaction. A round nobody has shared stays offline.
 *
 * Opening a flow is not consent to be reachable, so a round with remembered
 * peers is only re-dialled while Listen for invites is on. That switch is the
 * one that answers "may ebb be on the network with nobody asking", and an
 * endpoint bound because a file was double-clicked is exactly that: it would
 * mint the local network prompt during startup and put this install back on
 * the LAN, on an identity every past peer holds, for a round the debater only
 * meant to read. With it off, Share this round is what starts the session,
 * and it dials the same remembered peers on the way up. A round this window
 * joined by hand is the exception, because typing a code or pressing Join is
 * the debater asking for that round to be live now.
 *
 * Called for every flow that opens, including the ones nobody shares, because
 * this is also where a session for the round being left is ended. A session
 * outliving its round is not a stale chip: the replica is a singleton and has
 * already been re-pointed at the new flow, so the next keystroke in a private
 * round would be pushed to the last round's partner, and their edits would be
 * merged onto a grid they were never invited to.
 */
export async function resumeSession(round: FlowRound): Promise<CollabSession | null> {
    if (session && session.roundId !== round.id) await endSession();
    if (!collabSettings().listen && !joinedHere(round.id)) return null;
    const peers = knownRoundPeers(round.id);
    if (peers.length === 0) return null;
    return startForRound(round, peers);
}

/** A code on the air, and the call that takes it off. */
export interface HostedCode {
    code: string;
    stop(): Promise<void>;
}

/**
 * How many codes one Share click is worth.
 *
 * A code names its own relay, so a relay that will not answer is a property of
 * that code and a new one is a new relay. Three is enough to get past one
 * unreachable server and few enough that a debater is not left watching
 * `Getting ready...` while ebb works through a list.
 */
const CODE_ATTEMPTS = 3;

/**
 * Puts a pairing code on the air for the open round.
 *
 * Null when shared editing is not offered here, which is the whole gate. The
 * session comes up first: the ticket the code hands over names this install's
 * real endpoint and the relay it is homed on, so there has to be one.
 */
export async function startPairing(round: FlowRound, role: Role): Promise<HostedCode | null> {
    if (!collabLive()) return null;
    const active = currentSession() ?? (await startForRound(round));
    if (!active) return null;
    const port = active.pairing();
    const store = useFlowStore.getState();
    const label = store.docPath ? basename(store.docPath).replace(/\.ebb$/i, "") : "";
    const name = await broadcastName();
    let last: unknown = new Error("Could not put a code on the air");
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
        const code = await port.newCode();
        try {
            const live = await hostPairing({
                port,
                code,
                // A partner is one person and the code is spent on them. A
                // viewer code stays open, because there can be more than one
                // viewer and none of them is recorded anywhere.
                once: role === "editor",
                mintTicket: async () => encodeTicket(await active.share(role)),
                ...(name ? { displayName: name } : {}),
                ...(label ? { roundLabel: label } : {}),
                onGuest: (guest) => {
                    // Where this guest was reached, kept beside the round: an
                    // EndpointId names them and does not route to them, so a
                    // later open would otherwise have a name and nowhere to
                    // send it.
                    if (guest.relayUrl) {
                        rememberRoundRelay(round.id, guest.endpointId, guest.relayUrl);
                    }
                },
            });
            return { code, stop: live.stop };
        } catch (err) {
            // The relay this code named did not answer. A new code picks a
            // different one, which is cheaper than telling the debater to try
            // again.
            last = err;
        }
    }
    throw last instanceof Error ? last : new Error("Could not put a code on the air");
}

/**
 * Redeems a code and opens the round it names.
 *
 * The pairing link is taken out and given back around the exchange alone: what
 * opens the round is the ticket, over the join path that already exists, so a
 * code is a different way to the same door and not a second door.
 */
export async function joinByCode(code: string): Promise<JoinResult | null> {
    if (!collabLive()) return null;
    const link = await createPeerLinkFor({
        discovery: "mdns",
        relay: collabSettings().relay,
    });
    let ticket: string;
    try {
        const paired = await redeemCode({
            port: link,
            code,
            displayName: await broadcastName(),
        });
        ticket = paired.ticket;
    } finally {
        await link.stop();
    }
    return joinRound({
        ticket,
        createLink: createPeerLinkFor,
        appVersion: await getCurrentVersion(),
    });
}

/**
 * Brings a round that was just joined online when it is the flow already open.
 *
 * Routing to the file is what starts a session, and a join whose round this
 * window already holds routes to the URL it is already on: nothing loads, so
 * nothing resumes, and the debater is left watching a flow that never
 * connects while their partner's invitation lands in the corner instead.
 *
 * Reports rather than throws. The join itself has landed by the time this
 * runs, and a round nobody can be reached about is still a round to flow.
 */
export async function resumeJoined(path: string): Promise<void> {
    const store = useFlowStore.getState();
    if (store.docPath !== path || !store.round) return;
    try {
        await resumeSession(store.round);
    } catch (err) {
        toast.error(errorMessage(err, "Could not reconnect to your partners"));
    }
}

/** Tells the live session an edit landed. A no-op with no session. */
export function notifyLocalChange(): void {
    session?.notifyLocalChange();
}

/**
 * Ends the session, whatever the transport thinks. The state above the link is
 * already torn down by the time the link is asked to stop, so a shell that
 * refuses cannot leave a half-ended session behind - and End session is a
 * button a debater presses mid-round, which must never answer with an error.
 */
export async function endSession(): Promise<void> {
    const held = session;
    session = null;
    setLocalChangeListener(null);
    setClaimHandler(null);
    setCursorHandler(null);
    offered.clear();
    try {
        await held?.stop();
    } catch {
        // The endpoint is going away with the session either way.
    }
    // After the stop, never before it: a session announces an empty peer list
    // on its way out, and a reset that ran first would be overwritten by it
    // and leave the chip saying "connecting" for a session that is over.
    useCollabStore.getState().reset();
    await syncInviteWatch();
}

/**
 * Lets go of everything holding the endpoint, for a window on its way out.
 *
 * Not `endSession`, which finishes by re-syncing the invite watch: with Listen
 * for invites on that would bind an endpoint for a window that is closing.
 * Nothing is re-bound here, and the idle listener is released too, because a
 * window with no session still holds a share of the same endpoint.
 *
 * The stop is what puts the farewell on the wire, so the peers of a closed
 * window see it leave at once rather than waiting out a QUIC timeout.
 */
export async function shutdownCollab(): Promise<void> {
    const held = session;
    session = null;
    setLocalChangeListener(null);
    setClaimHandler(null);
    setCursorHandler(null);
    offered.clear();
    try {
        await held?.stop();
    } catch {
        // The process is going away with the session either way.
    }
    await releaseInviteWatch();
}

/**
 * Hangs up on one peer. The rest of the session stays up: one partner leaving
 * is not the round ending.
 *
 * The connection is what closes. Filtering the published list alone would put
 * the peer back in the chip on the next thing that changed it, and leave them
 * reading and writing the round in the meantime.
 */
export async function disconnectPeer(endpointId: string): Promise<void> {
    const held = session;
    if (!held) return;
    held.disconnect(endpointId);
    publish(held.peers());
    // Autosave only fires on a round whose content changed, so a debater who
    // cuts a peer loose and quits without typing again leaves them in the
    // sidecar and gets them back on the next open. The cut is the decision, so
    // it reaches disk where it is made.
    const { round } = useFlowStore.getState();
    if (round?.id === held.roundId) await persistReplica(round, serializeFlow(round));
}

/**
 * Dials a contact directly, with no ticket: their EndpointId already
 * authorizes, which is what a contact is for. The grade is this invitation's
 * and is recorded on the round before anything is dialled, because opening a
 * session for a round dials its remembered peers on the way up and a grade
 * that arrived after that dial would be too late to apply to it.
 */
export async function inviteContact(
    round: FlowRound,
    endpointId: string,
    role: Role,
): Promise<void> {
    const live = session;
    rememberRoundRole(round.id, endpointId, role);
    const held = live ?? (await startForRound(round, [endpointId]));
    if (!held) throw new Error("Turn on shared editing in Settings first");
    // Opening a session for this round dials the contact on the way up, and
    // that dial is the invitation. Dialling again would put a second notice on
    // their screen for one share.
    if (!live) return;
    if (held.peers().some((p) => p.endpointId === endpointId)) return;
    // A session was already up, so the contact is dialled onto it.
    await held.invite(endpointId, role);
}

/**
 * Saves a peer so the next round needs no ticket. Only ever from one click.
 *
 * A peer this side is connected to is told, so they save this side back and
 * the pair is reachable in both directions. Admission is one-sided - a dial is
 * only announced to a receiver who has the dialler saved - so without this a
 * debater who saved their partner still could not invite them.
 */
export function saveContact(endpointId: string, contact: Contact): void {
    const store = useFlowStore.getState();
    store.setContacts(addContact(store.contacts, endpointId, contact));
    session?.announceContact(endpointId);
}

/**
 * Binds or releases the idle listener to match the world: it is up exactly
 * when shared editing and Listen for invites are both on and no session is
 * holding the endpoint, carrying the relay setting the switches say now.
 * Called on boot, when any of the three switches moves, and at both ends of a
 * session.
 */
export async function syncInviteWatch(): Promise<void> {
    // Binding an endpoint takes a moment, so callers are serialized rather
    // than allowed to race a listener nobody holds a handle to.
    const next = (watching ?? Promise.resolve())
        .catch(() => {})
        .then(async () => {
            const settings = collabSettings();
            const wanted = settings.enabled && settings.listen && !session && !starting;
            // The relay is chosen when the endpoint binds, so withdrawing that
            // consent only takes effect by letting this one go and binding
            // again. A listener nobody is talking to loses nothing by it.
            if (wanted && listener && listener.relay !== settings.relay) await dropListener();
            if (wanted !== (listener !== null)) {
                if (!wanted) {
                    await dropListener();
                } else {
                    try {
                        listener = await startInviteListener({
                            createLink: createPeerLinkFor,
                            contacts: () => useFlowStore.getState().contacts,
                            openRoundId: () => useFlowStore.getState().round?.id ?? null,
                            onInvite: (notice: InviteNotice) => announceInvite(notice),
                        });
                    } catch {
                        // An endpoint that will not bind costs an invitation, and
                        // nothing else. Ending a session, or opening the app, still
                        // succeeds.
                        listener = null;
                    }
                }
            }
            // The identity outlives any one binding, so it is published whenever
            // one is in hand rather than only at the moment it binds.
            if (listener) useCollabStore.getState().setEndpointId(listener.endpointId);
        });
    watching = next;
    await next;
}

/**
 * Lets go of the listener. For callers already inside the watch chain.
 *
 * A shell that refuses to stop is not a reason to keep a handle nobody can
 * use: the endpoint is dropped here either way, so a session asking for it
 * next is never blocked by a failed release.
 */
async function dropListener(): Promise<void> {
    const held = listener;
    listener = null;
    try {
        await held?.stop();
    } catch {
        // Nothing above this holds the listener any more.
    }
}

/**
 * Lets go of the listener from outside the watch chain, queued behind a bind
 * already in flight. Releasing ahead of that bind would let it land afterwards
 * and take the endpoint a session is on its way to needing.
 */
async function releaseInviteWatch(): Promise<void> {
    const next = (watching ?? Promise.resolve()).catch(() => {}).then(dropListener);
    watching = next;
    await next;
}
