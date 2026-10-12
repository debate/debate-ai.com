import { beforeEach, describe, expect, it } from "vitest";

import { seedDoc } from "../src/lib/collab/doc";
import { helloFrom } from "../src/lib/collab/handshake";
import { merge } from "../src/lib/collab/merge";
import type { PeerConn, WireMessage } from "../src/lib/collab/peerLink";
import { createMemoryNet, memoryRelay, type MemoryNet } from "../src/lib/collab/peerLinkMemory";
import { HEARTBEAT_MS } from "../src/lib/collab/presence";
import {
    forgetRoundPeers,
    knownRoundPeers,
    knownRoundRelays,
} from "../src/lib/collab/roundPeers";
import {
    startCollabSession,
    type CollabPeer,
    type CollabSession,
    type CollabSessionDeps,
    type PendingPeer,
    type SavedByPeer,
} from "../src/lib/collab/session";
import { encodeTicket } from "../src/lib/collab/ticket";
import type { CollabDoc, Role } from "../src/lib/collab/types";
import { getPresences } from "../src/lib/grid/presenceBridge";
import { makeFlowRound } from "../src/lib/model/flow";

const flush = async () => {
    for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
};

/** A hand-cranked clock: nothing fires until a test says so. */
function manualClock() {
    let tasks: { fn: () => void; ms: number; live: boolean }[] = [];
    return {
        schedule(fn: () => void, ms: number) {
            const t = { fn, ms, live: true };
            tasks.push(t);
            return () => {
                t.live = false;
            };
        },
        /** Runs every armed task whose delay is at most `ms`, once. */
        run(ms: number) {
            const due = tasks.filter((t) => t.live && t.ms <= ms);
            tasks = tasks.filter((t) => !due.includes(t));
            for (const t of due) {
                t.live = false;
                t.fn();
            }
            return due.length;
        },
        pending(ms: number) {
            return tasks.filter((t) => t.live && t.ms === ms).length;
        },
    };
}

const on = { enabled: true, relay: true, listen: false };
const direct = { enabled: true, relay: false, listen: false };

interface Side {
    session: CollabSession;
    doc: CollabDoc;
    peers: CollabPeer[];
    pending: PendingPeer[];
    roles: Role[];
    contacts: SavedByPeer[];
    applied: number;
}

async function start(
    net: MemoryNet,
    id: string,
    roundId: string,
    doc: CollabDoc,
    extra: Partial<CollabSessionDeps> = {},
): Promise<Side> {
    const side = { doc, peers: [], pending: [], roles: [], contacts: [], applied: 0 } as unknown as Side;
    const session = await startCollabSession({
        createLink: net.create(id),
        roundId,
        appVersion: "1.0.0",
        settings: () => on,
        doc: () => side.doc,
        apply: (incoming) => {
            side.applied++;
            const r = merge(side.doc, incoming);
            side.doc = r.doc;
            return r.dropped;
        },
        onPeersChanged: (p) => (side.peers = p),
        onPendingChanged: (p) => (side.pending = p),
        onRoleChanged: (r) => side.roles.push(r),
        onContact: (c) => side.contacts.push(c),
        ...extra,
    });
    side.session = session!;
    return side;
}

const A = "a".repeat(64);
const B = "b".repeat(64);
const C = "c".repeat(64);
const Z = "f".repeat(64);

beforeEach(() => forgetRoundPeers());

describe("startCollabSession", () => {
    it("returns null with shared editing off", async () => {
        const net = createMemoryNet();
        const round = makeFlowRound();
        const s = await startCollabSession({
            createLink: net.create(A),
            roundId: round.id,
            appVersion: "1",
            settings: () => ({ enabled: false, relay: false, listen: false }),
            doc: () => seedDoc(round),
            apply: () => [],
        });
        expect(s).toBeNull();
        expect(net.calls).toEqual([]);
    });

    it("admits a guest holding a ticket and syncs the host's state", async () => {
        const net = createMemoryNet();
        const clock = manualClock();
        const round = makeFlowRound();
        const hostDoc = seedDoc(round);
        const host = await start(net, A, round.id, hostDoc, { schedule: clock.schedule, displayName: "Host" });
        expect(host.session.endpointId).toBe(A);
        expect(host.session.role()).toBe("editor");
        expect(host.session.pairing()).toBeDefined();

        const ticket = await host.session.share("editor");
        expect(ticket.endpointId).toBe(A);
        expect(ticket.relayUrl).toBe(memoryRelay(A));

        const guestDoc = seedDoc(makeFlowRound());
        const guest = await start(net, B, round.id, { ...guestDoc, roundId: round.id }, {
            schedule: clock.schedule,
            dial: [A],
            ticket: encodeTicket(ticket),
            displayName: "Guest",
        });
        await flush();

        expect(host.peers.map((p) => p.endpointId)).toEqual([B]);
        expect(host.peers[0]).toMatchObject({ role: "editor", name: "Guest", connectionType: "relayed" });
        expect(guest.peers.map((p) => p.endpointId)).toEqual([A]);
        expect(guest.peers[0].name).toBe("Host");
        // The host opened with its whole state, which the guest merged.
        expect(guest.applied).toBeGreaterThan(0);
        expect(Object.keys(guest.doc.sheets)).toEqual(expect.arrayContaining(Object.keys(hostDoc.sheets)));
        // The host remembered the guest beside the round.
        expect(knownRoundPeers(round.id)).toContain(B);
        expect(knownRoundRelays(round.id)).toMatchObject({ [B]: memoryRelay(B) });

        // Local changes coalesce on the clock and the repair tick runs.
        host.session.notifyLocalChange();
        expect(clock.run(30)).toBeGreaterThan(0);
        expect(clock.run(5_000)).toBeGreaterThan(0);

        // Contact announcement reaches the other side's handler.
        host.session.announceContact(B);
        expect(guest.contacts).toEqual([{ endpointId: A, name: "Host", relayUrl: memoryRelay(A) }]);

        // Presence and cursor travel and land in the presence table.
        const cell = { sheetId: round.sheets[1].id, col: 0, row: 2 };
        guest.session.setPresence(cell as never);
        expect(getPresences().some((p) => p.endpointId === B && p.editing)).toBe(true);
        guest.session.setPresence(null);
        guest.session.setCursor(cell as never);
        expect(getPresences().some((p) => p.endpointId === B && !p.editing)).toBe(true);
        expect(clock.pending(HEARTBEAT_MS)).toBeGreaterThan(0);
        clock.run(HEARTBEAT_MS);
        guest.session.setCursor(null);
        expect(getPresences().some((p) => p.endpointId === B)).toBe(false);

        // Guest leaves: the host hears the farewell and drops the peer.
        await guest.session.stop();
        expect(host.peers).toEqual([]);
        expect(host.session.reconnecting()).toBe(false);
        await host.session.stop();
    });

    it("refuses a guest with no ticket and a wrong round silently", async () => {
        const net = createMemoryNet();
        const clock = manualClock();
        const round = makeFlowRound();
        const host = await start(net, A, round.id, seedDoc(round), { schedule: clock.schedule });
        const guest = await start(net, B, round.id, seedDoc(round), { schedule: clock.schedule, dial: [A] });
        await flush();
        expect(host.peers).toEqual([]);
        expect(guest.peers).toEqual([]);
        // A refused opening dial arms the reconnect ladder.
        expect(guest.session.reconnecting()).toBe(true);
        expect(guest.pending).toEqual([{ endpointId: A, unreachable: true }]);
        expect(guest.session.pending()).toEqual([{ endpointId: A, unreachable: true }]);
        await guest.session.stop();
        expect(guest.pending).toEqual([]);
        await host.session.stop();
    });

    it("re-admits a remembered peer and redials after a drop", async () => {
        const net = createMemoryNet();
        const clock = manualClock();
        const round = makeFlowRound();
        // Each side remembers the other on this round.
        const host = await start(net, A, round.id, seedDoc(round), { schedule: clock.schedule, dial: [] });
        await host.session.invite(B, "viewer").catch(() => {});
        const guest = await start(net, B, round.id, seedDoc(round), {
            schedule: clock.schedule,
            dial: [A],
            settings: () => direct,
        });
        await flush();
        // The host graded B a viewer when it invited them.
        expect(host.peers).toEqual([expect.objectContaining({ endpointId: B, role: "viewer" })]);
        expect(guest.roles).toEqual(["viewer"]);
        expect(guest.session.role()).toBe("viewer");

        // The host disconnects the guest deliberately; they do not get back in.
        host.session.disconnect(B);
        await flush();
        expect(host.peers).toEqual([]);
        expect(guest.peers).toEqual([]);
        expect(knownRoundPeers(round.id)).not.toContain(B);
        await guest.session.stop();
        await host.session.stop();
    });

    it("re-arms a dial when the link drops and reconnects on retry", async () => {
        const net = createMemoryNet();
        const clock = manualClock();
        const round = makeFlowRound();
        const accepted: PeerConn[] = [];
        const factory = net.create(A);
        const host = await start(net, A, round.id, seedDoc(round), {
            schedule: clock.schedule,
            createLink: async (config) => {
                const link = await factory(config);
                return {
                    ...link,
                    listen: (onPeer) =>
                        link.listen((conn) => {
                            accepted.push(conn);
                            onPeer(conn);
                        }),
                };
            },
        });
        // Host learns of B through an invite (dial fails: B is not up yet).
        await expect(host.session.invite(B, "editor")).rejects.toThrow();
        const guest = await start(net, B, round.id, seedDoc(round), { schedule: clock.schedule, dial: [A] });
        await flush();
        expect(guest.peers.map((p) => p.endpointId)).toEqual([A]);
        expect(host.peers.map((p) => p.endpointId)).toEqual([B]);

        // The link drops with no farewell.
        accepted[0].close();
        await flush();
        expect(guest.peers).toEqual([]);
        expect(host.peers).toEqual([]);
        expect(guest.session.reconnecting()).toBe(true);
        expect(guest.pending).toEqual([{ endpointId: A, unreachable: false }]);

        // The retry fires and the remembered guest is admitted again.
        for (let i = 0; i < 3 && guest.peers.length === 0; i++) {
            clock.run(60_000);
            await flush();
        }
        expect(guest.peers.map((p) => p.endpointId)).toEqual([A]);
        expect(guest.session.reconnecting()).toBe(false);
        await guest.session.stop();
        await host.session.stop();
    });

    it("throws from share when relaying is on and no relay answered", async () => {
        const net = createMemoryNet();
        const round = makeFlowRound();
        const factory = net.create(A);
        const host = await start(net, A, round.id, seedDoc(round), {
            createLink: async (config) => {
                const link = await factory(config);
                return { ...link, relayUrl: async () => "" };
            },
        });
        await expect(host.session.share("viewer")).rejects.toThrow(/relay/);
        await host.session.stop();

        const plain = await start(createMemoryNet(), C, round.id, seedDoc(round), { settings: () => direct });
        const t = await plain.session.share("viewer");
        expect(t.relayUrl).toBeUndefined();
        await plain.session.stop();
    });

    it("turns a contact's dial about another round into an invite notice", async () => {
        const net = createMemoryNet();
        const clock = manualClock();
        const hostRound = makeFlowRound();
        const otherRound = makeFlowRound();
        const notices: unknown[] = [];
        const host = await start(net, A, hostRound.id, seedDoc(hostRound), {
            schedule: clock.schedule,
            contacts: () => ({ [B]: { name: "Bee" } }) as never,
            onInvite: (n) => notices.push(n),
        });
        const guest = await start(net, B, otherRound.id, seedDoc(otherRound), {
            schedule: clock.schedule,
            roundLabel: "Finals",
        });
        await guest.session.invite(A, "editor");
        await flush();
        expect(notices).toHaveLength(1);
        expect(notices[0]).toMatchObject({ endpointId: B });
        expect(guest.peers).toEqual([]);
        await guest.session.stop();
        await host.session.stop();
    });

    it("closes a connection that never says hello", async () => {
        const net = createMemoryNet();
        const clock = manualClock();
        const round = makeFlowRound();
        const host = await start(net, A, round.id, seedDoc(round), { schedule: clock.schedule });
        const raw = await net.create(Z)({ discovery: "off", relay: false });
        const conn = await raw.dial(A);
        let closed = false;
        conn.onClose(() => (closed = true));
        await flush();
        clock.run(10_000);
        expect(closed).toBe(true);
        await host.session.stop();
    });

    it("ignores malformed positions and handles bye from a peer", async () => {
        const net = createMemoryNet();
        const clock = manualClock();
        const round = makeFlowRound();
        const host = await start(net, A, round.id, seedDoc(round), { schedule: clock.schedule });
        const ticket = await host.session.share("editor");
        const raw = await net.create(B)({ discovery: "off", relay: false });
        const conn = await raw.dial(A);
        const got: WireMessage[] = [];
        conn.onMessage((m) => got.push(m));
        conn.send(
            helloFrom({ endpointId: B, roundId: round.id, role: "editor", appVersion: "1", ticket: ticket.secret }),
        );
        await flush();
        expect(got[0]).toMatchObject({ type: "helloAck", ok: true, role: "editor" });
        expect(host.peers.map((p) => p.endpointId)).toEqual([B]);
        conn.send({ type: "cursor", cell: { sheetId: "", col: -1, row: -1 } } as never);
        expect(getPresences().some((p) => p.endpointId === B)).toBe(false);
        conn.send({ type: "presence", cell: { sheetId: "s", col: 0, row: 0 } } as WireMessage);
        expect(getPresences().some((p) => p.endpointId === B)).toBe(true);
        conn.send({ type: "bye" } as WireMessage);
        expect(host.peers).toEqual([]);
        expect(getPresences().some((p) => p.endpointId === B)).toBe(false);
        await host.session.stop();
    });
});
