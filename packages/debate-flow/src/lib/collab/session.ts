/**
 * A shared session: who is connected, what they may do, and keeping them in
 * step.
 *
 * The opt-in gate is here and nowhere else. With the master switch off this
 * function returns null and never touches the link factory, so no endpoint is
 * bound, no peer is dialled, no discovery record is published, and no relay is
 * contacted. Later phases may grow the body; they must not grow a second entry
 * point around it.
 *
 * The topology is a star and the host is the hub, so the host is the only side
 * that decides admission and the only side that has to enforce a read-only
 * role.
 */

import { setPresences } from "../grid/presenceBridge";

import type { Contacts } from "./contacts";
import { collabSettings, type CollabSettings } from "./enabled";
import {
    admit,
    grantedRole,
    helloFrom,
    refusalMessage,
    REFUSED,
    type HostPolicy,
} from "./handshake";
import { INVITED, inviteFrom, type InviteNotice } from "./invite";
import type { DroppedCell } from "./merge";
import {
    HANDSHAKE_MS,
    isCellRef,
    type CellRef,
    type PairingPort,
    type PeerConn,
    type PeerLink,
    type PeerLinkFactory,
    type WireMessage,
} from "./peerLink";
import { claim, HEARTBEAT_MS, releaseCell, releasePeer, type Presence } from "./presence";
import { retryForever } from "./reconnect";
import {
    forgetRoundPeer,
    knownRoundRelays,
    knownRoundViewers,
    rememberRoundRelay,
    rememberRoundRole,
} from "./roundPeers";
import { attachSync, defaultSchedule, type PeerSync } from "./sync";
import { mintTicket, parseTicket, type Ticket } from "./ticket";
import type { CollabDoc, Role } from "./types";

export interface CollabPeer {
    endpointId: string;
    role: Role;
    connectionType: "direct" | "relayed";
    /**
     * What the peer calls themselves, when they said. A suggestion only: a
     * saved contact's name is the receiver's own word for them and wins.
     */
    name?: string;
    /**
     * The relay this peer is homed on, when the link could say. Saved with a
     * contact, it is what makes the same partner dialable from another
     * network: an EndpointId names them and does not route to them.
     */
    relayUrl?: string;
}

/** A peer that has just said it saved this side. */
export interface SavedByPeer {
    endpointId: string;
    /** What they go by, when they said. A suggestion, never a rename. */
    name?: string;
    /** Where they were reached, so the contact saved from this is dialable. */
    relayUrl?: string;
}

/**
 * A peer this side is trying to reach and has not.
 *
 * `unreachable` is what separates a partner who has not opened the round yet
 * from one this side cannot get to at all: the first is the ordinary case five
 * minutes before a round, and the second is the one a debater has to do
 * something about. It is set by a dial that came back rather than by a link
 * dropping, so it says a route was tried and refused.
 */
export interface PendingPeer {
    endpointId: string;
    unreachable: boolean;
}

export interface CollabSession {
    endpointId: string;
    roundId: string;
    peers(): CollabPeer[];
    /**
     * The peers a dial is still out for. Empty is a session holding everyone
     * it expects, or one nobody has joined yet; the peer list beside it is
     * what tells the two apart.
     */
    pending(): PendingPeer[];
    /**
     * What this side was admitted as. A host is always an editor: it holds the
     * file. A guest asks to edit and is granted whatever the host decided,
     * which is the only place a viewer learns it is one.
     */
    role(): Role;
    /**
     * The pairing half of this session's transport, for a share sheet putting
     * a code on the air. This session's link and not a second one, because an
     * install binds one endpoint: a link taken out for pairing would be
     * another share of it to remember to give back.
     */
    pairing(): PairingPort;
    /**
     * Mints the ticket the next peer presents. Replaces any unspent one.
     *
     * Async because the ticket names where this host can be reached, and a
     * relay is contacted after the socket is bound. Only the ticket waits for
     * it: the session and its dials do not, so a round reopening reconnects
     * its partners while the answer is still coming.
     */
    share(role: Role): Promise<Ticket>;
    /**
     * Dials a peer this round already trusts, with no ticket, and grades them
     * for this round. The grade is the caller's: an invitation is the gesture
     * that decides it, and nothing else this side holds has a say.
     */
    invite(endpointId: string, role: Role): Promise<void>;
    /**
     * Tells a connected peer this side has saved them, so they save this side
     * back and the pair is reachable in both directions. A no-op for a peer
     * this session is not holding: there is nowhere to say it.
     */
    announceContact(endpointId: string): void;
    /**
     * Drops one peer and keeps the rest. Deliberate, so it outlasts the link
     * and the app: that peer is not redialled, it is not let back in if it
     * dials, and the round stops remembering it.
     */
    disconnect(endpointId: string): void;
    /**
     * Whether a peer is being dialled again right now. True from the drop
     * until that peer answers, which is the one state the chip has an amber
     * dot for.
     */
    reconnecting(): boolean;
    /** Tells every peer about a local edit. */
    notifyLocalChange(): void;
    /**
     * Claims the cell this side has an editor open on, or releases it with
     * null. Sent immediately rather than on a tick, and refreshed on a
     * heartbeat so a frozen process stops holding it.
     */
    setPresence(cell: CellRef | null): void;
    /**
     * Says where this side's cursor is. Claims nothing, so a partner parked on
     * a cell never refuses a keystroke on it. Coalesced onto the heartbeat:
     * arrowing down a column moves the cursor faster than anything needs to
     * hear about, and the document is what the link is for.
     */
    setCursor(cell: CellRef | null): void;
    stop(): Promise<void>;
}

export interface CollabSessionDeps {
    createLink: PeerLinkFactory;
    roundId: string;
    appVersion: string;
    doc(): CollabDoc;
    apply(incoming: CollabDoc): DroppedCell[];
    /** Injectable so a caller can drive the switch without a store write. */
    settings?: () => CollabSettings;
    /** Peers this round already knows, re-dialled silently when it opens. */
    dial?: string[];
    /** A ticket to present on the first dial, from a paste. */
    ticket?: string;
    /** What this side asks to be. The host's ticket is the authority. */
    role?: Role;
    onPeersChanged?: (peers: CollabPeer[]) => void;
    /** Fires whenever the set of peers being waited for changes. */
    onPendingChanged?: (pending: PendingPeer[]) => void;
    /** Fires when the host names what this side was admitted as. */
    onRoleChanged?: (role: Role) => void;
    schedule?: (fn: () => void, ms: number) => () => void;
    /**
     * Whether this side still has the editor open that it claimed a cell with.
     * There is no close event to release the claim, so the heartbeat asks. A
     * caller with no grid to ask leaves it out, and the claim stands until it
     * is dropped by hand.
     */
    editing?: () => boolean;
    /** What this side calls the round, so an invite it sends can name it. */
    roundLabel?: string;
    /** What this side calls itself, carried to every peer it greets. */
    displayName?: string;
    /**
     * The contact table. It decides whether a dial this session cannot admit
     * is an invite worth showing, and it says where a saved partner was last
     * reached. It has no say in what any peer may do. Absent means every
     * refusal is silent.
     */
    contacts?: () => Contacts;
    onInvite?: (notice: InviteNotice) => void;
    /** Fires when a peer says it has saved this side. */
    onContact?: (peer: SavedByPeer) => void;
}

interface Live {
    conn: PeerConn;
    sync: PeerSync;
    peer: CollabPeer;
    /** Which side dialled, which is what decides a duplicate. */
    outbound: boolean;
}

/**
 * Whether a dial ended in the far side taking the invite rather than joining.
 * The notice landed, so the caller has nothing to report and nothing to retry.
 */
function isInvited(err: unknown): boolean {
    return err instanceof Error && err.message === INVITED;
}

export async function startCollabSession(deps: CollabSessionDeps): Promise<CollabSession | null> {
    const settings = (deps.settings ?? collabSettings)();
    if (!settings.enabled) return null;

    const link: PeerLink = await deps.createLink({
        // mDNS reaches the machine across the room with no internet at all.
        // DNS discovery would publish this install to a public registry for a
        // session that is always invited by hand, so it is never an option.
        discovery: "mdns",
        relay: settings.relay,
    });
    const endpointId = await link.endpointId();
    // Started here and awaited only by `share`, because a relay is contacted
    // after the socket is bound and that answer is seconds away. Waiting for
    // it here would hold the whole session behind it, including the dials
    // that put a reopened round's partners back. Not asked at all with
    // relaying off: there is no relay for this endpoint to be homed on.
    let homed = settings.relay ? link.relayUrl().catch(() => "") : Promise.resolve("");

    /**
     * Where this host can be reached, waited out only when a ticket needs it.
     *
     * An empty answer is asked again rather than kept. The first one is a
     * relay that had not answered by its deadline, and a debater clicking
     * Share a second time is the retry: a memoized empty would make every
     * later share on this session fail for as long as it runs, including the
     * one taken after the wifi came back.
     */
    async function homeRelay(): Promise<string> {
        const first = await homed;
        if (first) return first;
        homed = link.relayUrl().catch(() => "");
        return homed;
    }

    const dial = [...(deps.dial ?? [])];
    const readOnlyPeers = knownRoundViewers(deps.roundId);
    /**
     * Every peer the round remembers is graded, rather than left to a default:
     * membership with no grade beside it is the one thing that hands a viewer
     * the wider role. The round's own record is the whole source, because the
     * grant was made to this round and a peer promoted here stays promoted the
     * next time it opens.
     */
    const roles: Record<string, Role> = {};
    for (const id of dial) roles[id] = readOnlyPeers.includes(id) ? "viewer" : "editor";

    const policy: HostPolicy = {
        roundId: deps.roundId,
        pending: null,
        knownPeers: dial,
        roles,
    };
    const live = new Map<string, Live>();
    /** Peers this side reached out to, and so is the one to reach out again. */
    const dialled = new Set<string>();
    /** Peers the debater cut loose, which stay cut however they come back. */
    const gone = new Set<string>();
    /**
     * The dial loop running for each peer this side is trying to reach again,
     * valued by the call that stops it. Held so the session can say it is
     * reconnecting, and so stopping the session cancels a backoff that would
     * otherwise fire minutes later.
     */
    const retries = new Map<string, () => void>();
    /**
     * The peers a dial has come back empty for at least once. Held beside the
     * ladder rather than inside it, because the ladder is armed the moment a
     * link drops and a drop is not yet a failure to reach anyone.
     */
    const unreachable = new Set<string>();
    /**
     * Where each peer was last found: the round's own record, a saved contact,
     * the ticket in hand, and then the link itself once a connection stood up.
     * A reconnect two networks apart has nothing else to go on, because mDNS
     * answers across a room and an EndpointId is a name and not a route.
     */
    const relays = new Map(Object.entries(knownRoundRelays(deps.roundId)));
    for (const [id, contact] of Object.entries(deps.contacts?.() ?? {}))
        if (contact.relay) relays.set(id, contact.relay);
    if (deps.ticket) {
        const parsed = parseTicket(deps.ticket);
        if (parsed?.relayUrl) relays.set(parsed.endpointId, parsed.relayUrl);
    }
    /** Where each peer is. Advisory, and always expiring. */
    let presences: Presence[] = [];
    let stopped = false;
    /**
     * What this side is. A host never dials and so is never graded: it holds
     * the file, and the value stands at editor for its whole life.
     */
    let myRole: Role = deps.role ?? "editor";

    function setRole(next: Role): void {
        if (next === myRole) return;
        myRole = next;
        deps.onRoleChanged?.(next);
    }

    /** This side's own open editor, and this side's own cursor. */
    let held: CellRef | null = null;
    let at: CellRef | null = null;
    let cancelHeartbeat: (() => void) | null = null;
    const schedule = deps.schedule ?? defaultSchedule;

    /**
     * One message per send, because a peer is in one place: an open editor
     * speaks for the cursor too, so the two never race each other into the far
     * side's table.
     */
    function broadcastPosition(): void {
        dropSpentClaim();
        const msg: WireMessage = held
            ? { type: "presence", cell: held }
            : { type: "cursor", cell: at };
        for (const l of live.values()) l.conn.send(msg);
    }

    /**
     * Lets go of a claim the editor behind it no longer backs, and says
     * whether it had one to let go of.
     *
     * A claim is the one thing here that arrives as an event and cannot leave
     * as one, so it is checked wherever this side is about to speak. Left in,
     * it silences every cursor move after it - the partner's marker stays
     * pinned to the cell that was last edited, and stays refused, until the
     * debater happens to open another editor.
     */
    function dropSpentClaim(): boolean {
        if (!held || deps.editing?.() !== false) return false;
        held = null;
        return true;
    }

    /**
     * Refreshes the far side's TTL while this side is anywhere, and carries
     * whatever a coalesced cursor move skipped. It stops on its own once there
     * is nothing to say, so an idle pane costs no timer.
     */
    function armHeartbeat(): void {
        if (cancelHeartbeat) return;
        cancelHeartbeat = schedule(function tick() {
            cancelHeartbeat = null;
            if (stopped || (!held && !at)) return;
            broadcastPosition();
            cancelHeartbeat = schedule(tick, HEARTBEAT_MS);
        }, HEARTBEAT_MS);
    }

    function stopHeartbeat(): void {
        cancelHeartbeat?.();
        cancelHeartbeat = null;
    }

    function announce(): void {
        deps.onPeersChanged?.([...live.values()].map((l) => l.peer));
    }

    function pendingPeers(): PendingPeer[] {
        return [...retries.keys()].map((endpointId) => ({
            endpointId,
            unreachable: unreachable.has(endpointId),
        }));
    }

    function announcePending(): void {
        deps.onPendingChanged?.(pendingPeers());
    }

    function onPosition(
        peerId: string,
        cell: CellRef | null,
        editing: boolean,
        readOnly: boolean,
    ): void {
        presences = cell
            ? claim(presences, {
                  endpointId: peerId,
                  ...cell,
                  heldAt: Date.now(),
                  editing,
                  readOnly,
              })
            : releaseCell(presences, peerId);
        setPresences(presences);
    }

    /**
     * Lets go of a peer that said it is leaving.
     *
     * Out of the live map before the connection is closed, which is what
     * separates this from a link that dropped: the close handler finds a
     * connection nobody holds and leaves the redial ladder alone. A QUIC close
     * says nothing about why, so without the message a window that shut down
     * deliberately would be dialled again for the rest of the session.
     */
    function farewell(peerId: string, conn: PeerConn): void {
        const held = live.get(peerId);
        if (held?.conn !== conn) return;
        live.delete(peerId);
        held.sync.stop();
        presences = releasePeer(presences, peerId);
        setPresences(presences);
        announce();
        conn.close();
    }

    function track(
        conn: PeerConn,
        peer: CollabPeer,
        readOnly: boolean,
        outbound: boolean,
    ): PeerSync | null {
        // Nothing is climbing a backoff for a peer that is here, and nothing
        // is out of reach that just answered.
        retries.get(peer.endpointId)?.();
        retries.delete(peer.endpointId);
        unreachable.delete(peer.endpointId);
        announcePending();
        // Learned from the link that just stood up, which is the only source
        // for a peer this side never held a ticket or a contact for. Beside
        // the round's own record, so tomorrow's open dials an address.
        if (peer.relayUrl) {
            relays.set(peer.endpointId, peer.relayUrl);
            rememberRoundRelay(deps.roundId, peer.endpointId, peer.relayUrl);
        }
        const existing = live.get(peer.endpointId);
        if (existing) {
            // Resume is symmetric, so an inbound accept and an outbound dial
            // for one peer can both land, and the second into the map would
            // leave the first open with nothing holding it. Both ends keep the
            // connection the lower EndpointId dialled, which is a choice they
            // reach identically with no round trip to agree on it.
            //
            // Two that came the same way are not that race: a peer only dials
            // again over a link it has already given up on, so the newer one
            // is the live one.
            const opposed = existing.outbound !== outbound;
            const keepsOutbound = endpointId < peer.endpointId;
            if (opposed && outbound !== keepsOutbound) {
                conn.close();
                return null;
            }
            // Out of the map before the close, so the close handler reads a
            // connection nobody holds rather than the peer leaving.
            live.delete(peer.endpointId);
            existing.sync.stop();
            existing.conn.close();
        }
        // A peer says where it is, so this side can see a partner working and
        // is warned off a cell they have an editor on before typing into it.
        // Both go the moment the link does.
        conn.onMessage((msg) => {
            if (msg.type === "bye") {
                farewell(peer.endpointId, conn);
                return;
            }
            // They saved this side as a partner, so this side saves them back.
            // Only reachable for a peer already admitted to the round, which is
            // what keeps a dial from being a way to write into a stranger's
            // contact table.
            if (msg.type === "contact") {
                deps.onContact?.({
                    endpointId: peer.endpointId,
                    name: typeof msg.name === "string" ? msg.name : undefined,
                    relayUrl: peer.relayUrl,
                });
                return;
            }
            if (msg.type !== "presence" && msg.type !== "cursor") return;
            // The cell goes straight into the table, so a position that is not
            // one is not a position: a row below zero or a sheet named by
            // nothing would sit there unmatched until the peer left.
            if (msg.cell !== null && !isCellRef(msg.cell)) return;
            // A read-only peer has no editor, so it points and never claims. A
            // claim refuses the debater's keystroke, which is a write under
            // another name and outside what this side granted.
            onPosition(peer.endpointId, msg.cell, msg.type === "presence" && !readOnly, readOnly);
        });
        const sync = attachSync({
            conn,
            doc: deps.doc,
            apply: (incoming) => {
                const dropped = deps.apply(incoming);
                // The star has the host for a hub, and a hub that does not
                // pass a change on is not one: two editors and a viewer would
                // each see the host's typing at once and each other's only
                // when the repair tick came round, seconds later. A guest
                // holds one peer, the host, so this is the host's job alone
                // and stops after one hop.
                for (const [id, other] of live) {
                    if (id !== peer.endpointId) other.sync.notifyLocalChange();
                }
                return dropped;
            },
            readOnly,
            endpointId,
            from: peer.endpointId,
            schedule: deps.schedule,
        });
        live.set(peer.endpointId, { conn, sync, peer, outbound });
        conn.onClose(() => {
            const held = live.get(peer.endpointId);
            if (held?.conn !== conn) return;
            held.sync.stop();
            live.delete(peer.endpointId);
            // A peer that is gone is nowhere, instantly and without waiting
            // for the heartbeat to lapse.
            presences = releasePeer(presences, peer.endpointId);
            setPresences(presences);
            announce();
            // A link that blips mid-round is the ordinary case in a gym full
            // of laptops, and the dial that opened this one only retried while
            // the session was coming up. Without re-arming here, the first
            // drop is the last thing that ever happens to this peer.
            //
            // Only the side that dialled redials: the host cannot reach a
            // guest that has not spoken, and both sides trying would race two
            // connections into one slot.
            if (!stopped && dialled.has(peer.endpointId)) redial(peer.endpointId);
        });
        announce();
        return sync;
    }

    // --- Host side ---------------------------------------------------------

    await link.listen((conn) => {
        if (stopped) return;
        // The first message must be a hello, and this handler answers exactly
        // one. Without disarming, the first delta that arrived afterwards
        // would read as a malformed hello and close a healthy link.
        let greeted = false;
        // Every refusal below is reached by the far side choosing to speak, so
        // a dialler that opens a connection and says nothing is never refused
        // and holds its slot until the session ends. The clock is what bounds
        // a peer that has not authenticated yet.
        const ungreeted = schedule(() => {
            if (!greeted) conn.close();
        }, HANDSHAKE_MS);
        conn.onMessage((msg) => {
            if (greeted) return;
            greeted = true;
            ungreeted();

            // A peer the debater disconnected does not get back in by
            // dialling. Answered here rather than at the accept, because a
            // dialler is still wiring up its handlers until its hello is out.
            if (gone.has(conn.id)) {
                conn.close();
                return;
            }

            // The connection's own id, not the one the hello claims: iroh
            // proved the far side holds that key, and everything downstream is
            // filed under it.
            const remoteId = conn.id;
            const verdict = admit(msg, policy, remoteId);
            if (!verdict.ok) {
                // A contact dialling about a round this side is not holding is
                // offering it, not failing to join one. The notice is all that
                // crosses; joining is the receiver's own move.
                const notice = deps.contacts
                    ? inviteFrom(msg, deps.contacts(), policy.roundId, remoteId)
                    : null;
                if (notice && deps.onInvite) {
                    deps.onInvite(notice);
                    conn.send({ type: "helloAck", ok: false, reason: INVITED });
                } else if (!verdict.silent) {
                    conn.send({ type: "helloAck", ok: false, reason: verdict.reason });
                }
                // A silent refusal puts nothing at all on the wire. A stranger
                // who dialled learns that something closed, which is what an
                // unbound endpoint would have told them anyway.
                conn.close();
                return;
            }
            if (msg.type !== "hello") return;
            // Admitting a peer is what makes this window answerable for the
            // connection, and the only place that says so. Every window hears
            // an accepted connection, because the round arrives in the hello,
            // and the windows that are not hosting it refuse above - so a
            // refusal must leave ownership alone or it takes this guest away.
            conn.claim?.();
            if (verdict.spendSecret) policy.pending = null;
            if (!policy.knownPeers.includes(remoteId)) policy.knownPeers.push(remoteId);
            policy.roles[remoteId] = verdict.role;
            // Beside the round's own membership, not only in this closure: a
            // grant the contact table never saw has to survive the next open.
            rememberRoundRole(deps.roundId, remoteId, verdict.role);
            // The role goes back with the ack because the guest has no other
            // way to know it: it asked to be a partner and the ticket decided.
            conn.send({ type: "helloAck", ok: true, name: deps.displayName, role: verdict.role });
            const sync = track(
                conn,
                {
                    endpointId: remoteId,
                    role: verdict.role,
                    connectionType: conn.connectionType(),
                    relayUrl: conn.relayUrl() ?? undefined,
                    name: typeof msg.name === "string" ? msg.name : undefined,
                },
                verdict.role === "viewer",
                false,
            );
            // A guest may hold no file at all, so the host opens with the
            // whole document rather than a delta against a seed it cannot
            // assume.
            sync?.sendState();
        });
    });

    // --- Guest side --------------------------------------------------------

    async function dialPeer(target: string, ticket?: string): Promise<void> {
        if (stopped || gone.has(target)) return;
        dialled.add(target);
        const conn = await link.dial(target, relays.get(target) ?? null);
        const secret = ticket ? (parseTicket(ticket)?.secret ?? undefined) : undefined;

        return new Promise<void>((resolve, reject) => {
            let answered = false;
            conn.onMessage((msg) => {
                if (answered || msg.type !== "helloAck") return;
                answered = true;
                if (!msg.ok) {
                    conn.close();
                    // The far side wrote that string. What a refusal says on
                    // this screen is this side's to decide, so the wire reason
                    // picks the message rather than becoming it.
                    reject(new Error(refusalMessage(msg.reason)));
                    return;
                }
                // The ack names what this side was admitted as, which is the
                // only place a viewer finds out.
                setRole(msg.role ?? "editor");
                track(
                    conn,
                    {
                        endpointId: target,
                        // The role in the ack is this side's, not theirs. A
                        // guest's one peer is the host, which holds the file
                        // and is graded by nobody.
                        role: grantedRole(policy, target) ?? "editor",
                        connectionType: conn.connectionType(),
                        relayUrl: conn.relayUrl() ?? undefined,
                        name: typeof msg.name === "string" ? msg.name : undefined,
                    },
                    // The host dials too - every remembered peer when it
                    // reopens a round, and a contact on invite - so the side
                    // that dialled is not always the guest. What this side
                    // granted is what it drops writes against, on a link it
                    // opened as much as on one it answered.
                    grantedRole(policy, target) === "viewer",
                    true,
                );
                resolve();
            });
            conn.onClose(() => {
                // A silent refusal puts nothing on the wire, so from here it
                // is a close with no answer, and it says what a refusal says.
                if (!answered) reject(new Error(refusalMessage(REFUSED)));
            });

            // Sent last. A transport can answer synchronously, so the listener
            // has to be in place before the question goes out or the reply
            // lands on nobody.
            conn.send(
                helloFrom({
                    endpointId,
                    roundId: deps.roundId,
                    role: deps.role ?? "editor",
                    appVersion: deps.appVersion,
                    ticket: secret,
                    label: deps.roundLabel,
                    name: deps.displayName,
                }),
            );
        });
    }

    /**
     * Keeps trying a peer until it answers.
     *
     * On the session's own scheduler, not the injectable one: a session that
     * only retried when a test handed it a clock would never reconnect on a
     * real machine, which is the only place a link actually drops.
     */
    function redial(target: string): void {
        // One ladder per peer: a second drop while a retry is armed would
        // otherwise leave two of them climbing the same backoff.
        retries.get(target)?.();
        retries.set(
            target,
            retryForever({
                dial: () =>
                    dialPeer(target).catch((err: unknown) => {
                        // A dial that came back is a route tried and refused,
                        // which is what separates a partner who has not opened
                        // the round from one this side cannot get to.
                        unreachable.add(target);
                        announcePending();
                        throw err;
                    }),
                schedule,
            }),
        );
        announcePending();
    }

    // Every remembered peer at once, not one after another. A peer that is not
    // up costs its whole dial deadline, and a round that remembers three of
    // them would spend three of those before the session it is opening for
    // exists - with the debater watching a round that has not come up yet.
    await Promise.all(
        (deps.dial ?? []).map(async (target) => {
            try {
                await dialPeer(target, deps.ticket);
            } catch (err) {
                // A peer that is not up yet is ordinary, and a refusal is not
                // a reason to fail opening the round. Retry runs on its own,
                // except against a peer who answered: they heard this round
                // offered and are not holding it, so dialling again would only
                // repeat itself.
                if (stopped || isInvited(err)) return;
                // The opening dial is a route tried and refused just as a
                // redial is, so a round reopening against a partner who is
                // not up says so rather than reading as merely waiting.
                unreachable.add(target);
                redial(target);
            }
        }),
    );

    return {
        endpointId,
        roundId: deps.roundId,

        peers() {
            return [...live.values()].map((l) => l.peer);
        },

        pending() {
            return pendingPeers();
        },

        role() {
            return myRole;
        },

        pairing() {
            return link;
        },

        async share(role) {
            // Where this host can be reached, so a guest two networks away has
            // somewhere to send its first packet.
            const relayUrl = settings.relay ? await homeRelay() : "";
            // An EndpointId names a peer and does not route to one, so a
            // ticket with relaying on and no relay in it works across a room
            // and nowhere else - and looks correct while it fails. Refusing is
            // the honest answer: the debater retries, or turns relaying off
            // and is told what that costs.
            if (settings.relay && !relayUrl) {
                throw new Error("Could not reach a relay. Check your internet and try again.");
            }
            const ticket = mintTicket({
                endpointId,
                roundId: deps.roundId,
                role,
                relay: settings.relay,
                ...(relayUrl ? { relayUrl } : {}),
            });
            // The role rides with the secret. What the ticket grants is the
            // host's to decide, so a viewer's ticket cannot be spent as an
            // editor by a guest that simply says it is one.
            policy.pending = { secret: ticket.secret, role };
            return ticket;
        },

        async invite(target, role) {
            // A contact is admitted by EndpointId, so it joins the known list
            // before the dial rather than presenting a secret.
            if (!policy.knownPeers.includes(target)) policy.knownPeers.push(target);
            // Graded as it joins the list: a member with no grade beside it is
            // refused the wider role. The grade is the one the invitation
            // named, which is the only thing that decides it.
            policy.roles[target] = role;
            // Inviting is deliberate, so it undoes a deliberate disconnect on
            // the round's record as well as on this session's.
            rememberRoundRole(deps.roundId, target, role);
            gone.delete(target);
            try {
                await dialPeer(target);
            } catch (err) {
                // They are on another round, so the dial delivered a notice
                // instead of a peer. That is the invite working.
                if (!isInvited(err)) throw err;
            }
        },

        announceContact(target) {
            live.get(target)?.conn.send({
                type: "contact",
                ...(deps.displayName ? { name: deps.displayName } : {}),
            });
        },

        disconnect(target) {
            // Deliberate, so it outlasts the link and the app. The redial in
            // onClose is for a link that dropped on its own; a peer the debater
            // cut loose stays gone, whichever side dials next.
            gone.add(target);
            // And out of the round's own record, which is otherwise
            // append-only. Without this the next open re-dials them off the
            // sidecar and admits them on membership alone.
            forgetRoundPeer(deps.roundId, target);
            retries.get(target)?.();
            retries.delete(target);
            unreachable.delete(target);
            announcePending();
            const entry = live.get(target);
            if (!entry) return;
            // Out of the map before the close, so the close handler leaves the
            // redial alone: this is the peer going for good, not a link
            // dropping.
            live.delete(target);
            entry.sync.stop();
            entry.conn.send({ type: "bye" });
            entry.conn.close();
            presences = releasePeer(presences, target);
            setPresences(presences);
            announce();
        },

        notifyLocalChange() {
            for (const l of live.values()) l.sync.notifyLocalChange();
        },

        reconnecting() {
            return retries.size > 0;
        },

        setPresence(cell) {
            held = cell;
            // An open editor is what refuses a partner's keystroke, so it goes
            // out at once, and so does the release that hands the cell back.
            broadcastPosition();
            if (held || at) armHeartbeat();
            else stopHeartbeat();
        },

        setCursor(cell) {
            at = cell;
            // An open editor already speaks for this side's position, and a
            // cursor cannot move while one is open. A closed one speaks for
            // nothing, so the claim it left behind goes first.
            const freed = dropSpentClaim();
            if (held) return;
            // A heartbeat already ticking will carry this within HEARTBEAT_MS,
            // which is what keeps arrowing down a column off the wire. Two
            // exceptions go at once: a cursor nobody is behind, because the
            // tick that would have cleared it is about to stop, and a cell
            // just handed back, because until that lands a partner typing
            // into it is refused.
            if (!cancelHeartbeat || cell === null || freed) broadcastPosition();
            if (at) armHeartbeat();
            else stopHeartbeat();
        },

        async stop() {
            stopped = true;
            // A backoff can be half a minute wide, so a session that ended is
            // not a reason for one more dial.
            for (const stop of retries.values()) stop();
            retries.clear();
            unreachable.clear();
            announcePending();
            for (const l of [...live.values()]) {
                l.sync.stop();
                l.conn.send({ type: "bye" });
                l.conn.close();
            }
            live.clear();
            stopHeartbeat();
            held = null;
            at = null;
            presences = [];
            setPresences(presences);
            announce();
            await link.stop();
        },
    };
}
