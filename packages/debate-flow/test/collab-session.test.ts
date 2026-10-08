/**
 * @fileoverview `startCollabSession` end to end over the in-memory link: the
 * opt-in gate, a ticketed guest being admitted with the host's role, the
 * single-use secret, edits travelling host-to-guest, presence, a deliberate
 * disconnect that is not let back in, and a clean stop.
 */

import { afterEach, describe, expect, it } from "vitest";
import { seedDoc } from "../src/lib/collab/doc";
import { merge } from "../src/lib/collab/merge";
import { createMemoryNet, type MemoryNet } from "../src/lib/collab/peerLinkMemory";
import { startCollabSession, type CollabSession, type CollabSessionDeps } from "../src/lib/collab/session";
import { encodeTicket } from "../src/lib/collab/ticket";
import type { CollabDoc } from "../src/lib/collab/types";
import { modelCol } from "../src/lib/grid/colSpace";
import { getPresences } from "../src/lib/grid/presenceBridge";
import { emptyScouting, type FlowRound } from "../src/lib/model/flow";

const ROUND: FlowRound = {
    id: "round-1",
    createdAt: 0,
    updatedAt: 0,
    event: "policy",
    firstSide: "aff",
    scouting: emptyScouting(),
    sheets: [{ id: "s1", title: "1.", group: "aff", order: 0, kind: "flow", data: [["Plan"]], meta: {} }],
};

// Real-looking EndpointIds: a ticket naming anything iroh could not issue is refused.
const HOST = "a".repeat(64);
const GUEST = "b".repeat(64);
const FIRST = "c".repeat(64);
const SECOND = "d".repeat(64);
const NOBODY = "e".repeat(64);

const on = () => ({ enabled: true, relay: false, listen: false });
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
async function settle(): Promise<void> {
    for (let i = 0; i < 10; i++) await tick();
}

/** A side of the session holding its own document. */
function side(net: MemoryNet, id: string, doc: CollabDoc, extra: Partial<CollabSessionDeps> = {}) {
    const state = { doc };
    const deps: CollabSessionDeps = {
        createLink: net.create(id),
        roundId: ROUND.id,
        appVersion: "1.0.0",
        settings: on,
        doc: () => state.doc,
        apply: (incoming) => {
            const result = merge(state.doc, incoming);
            state.doc = result.doc;
            return result.dropped;
        },
        ...extra,
    };
    return { state, deps };
}

const sessions: CollabSession[] = [];
async function start(deps: CollabSessionDeps): Promise<CollabSession> {
    const session = await startCollabSession(deps);
    if (!session) throw new Error("session did not start");
    sessions.push(session);
    return session;
}

afterEach(async () => {
    await Promise.all(sessions.splice(0).map((session) => session.stop()));
});

describe("startCollabSession", () => {
    it("binds nothing while the master switch is off", async () => {
        const net = createMemoryNet();
        const { deps } = side(net, HOST, seedDoc(ROUND), { settings: () => ({ ...on(), enabled: false }) });
        expect(await startCollabSession(deps)).toBeNull();
        expect(net.calls).toEqual([]);
    });

    it("admits a ticketed guest with the host's role and syncs the host's document", async () => {
        const net = createMemoryNet();
        const host = side(net, HOST, seedDoc(ROUND), { displayName: "Host" });
        const hostSession = await start(host.deps);
        const ticket = await hostSession.share("viewer");
        expect(ticket.role).toBe("viewer");

        const roles: string[] = [];
        const guest = side(net, GUEST, { ...seedDoc({ ...ROUND, sheets: [] }) }, {
            dial: [HOST],
            ticket: encodeTicket(ticket),
            onRoleChanged: (role) => roles.push(role),
        });
        const guestSession = await start(guest.deps);
        await settle();

        expect(guestSession.role()).toBe("viewer");
        expect(roles).toEqual(["viewer"]);
        expect(guestSession.peers()).toEqual([expect.objectContaining({ endpointId: HOST, name: "Host" })]);
        expect(hostSession.peers()).toEqual([expect.objectContaining({ endpointId: GUEST, role: "viewer" })]);
        expect(Object.keys(guest.state.doc.sheets)).toEqual(Object.keys(host.state.doc.sheets));
    });

    it("spends the ticket's secret on the first guest", async () => {
        const net = createMemoryNet();
        const hostSession = await start(side(net, HOST, seedDoc(ROUND)).deps);
        const ticket = encodeTicket(await hostSession.share("editor"));

        await start(side(net, FIRST, seedDoc(ROUND), { dial: [HOST], ticket }).deps);
        const pending: string[][] = [];
        const second = await start(
            side(net, SECOND, seedDoc(ROUND), {
                dial: [HOST],
                ticket,
                onPendingChanged: (peers) => pending.push(peers.map((peer) => peer.endpointId)),
            }).deps,
        );
        await settle();

        expect(hostSession.peers().map((peer) => peer.endpointId)).toEqual([FIRST]);
        expect(second.peers()).toEqual([]);
        // The refused guest keeps trying in the background, flagged unreachable.
        expect(second.reconnecting()).toBe(true);
        expect(second.pending()).toEqual([{ endpointId: HOST, unreachable: true }]);
        expect(pending.at(-1)).toEqual([HOST]);
    });

    it("refuses a guest whose ticket is for nothing, without a session to hold it", async () => {
        const net = createMemoryNet();
        const hostSession = await start(side(net, HOST, seedDoc(ROUND)).deps);
        const guest = await start(side(net, GUEST, seedDoc(ROUND), { dial: [HOST] }).deps);
        await settle();
        expect(hostSession.peers()).toEqual([]);
        expect(guest.peers()).toEqual([]);
    });

    it("relays presence and cursors to the other side", async () => {
        const net = createMemoryNet();
        const hostSession = await start(side(net, HOST, seedDoc(ROUND)).deps);
        const ticket = encodeTicket(await hostSession.share("editor"));
        const guestSession = await start(
            side(net, GUEST, seedDoc(ROUND), { dial: [HOST], ticket, editing: () => true }).deps,
        );
        await settle();

        guestSession.setPresence({ sheetId: "s1", col: modelCol(0), row: 0 });
        await settle();
        expect(getPresences()).toEqual([expect.objectContaining({ endpointId: GUEST, sheetId: "s1", editing: true })]);

        guestSession.setPresence(null);
        guestSession.setCursor(null);
        await settle();
        expect(getPresences()).toEqual([]);
    });

    it("tells a peer it was saved as a contact", async () => {
        const net = createMemoryNet();
        const saved: string[] = [];
        const hostSession = await start(side(net, HOST, seedDoc(ROUND), { displayName: "Host" }).deps);
        const ticket = encodeTicket(await hostSession.share("editor"));
        await start(
            side(net, GUEST, seedDoc(ROUND), {
                dial: [HOST],
                ticket,
                onContact: (peer) => saved.push(`${peer.endpointId === HOST ? "host" : "other"}:${peer.name}`),
            }).deps,
        );
        await settle();

        hostSession.announceContact(GUEST);
        hostSession.announceContact(NOBODY);
        await settle();
        expect(saved).toEqual(["host:Host"]);
    });

    it("drops a disconnected peer for good", async () => {
        const net = createMemoryNet();
        const peers: number[] = [];
        const hostSession = await start(
            side(net, HOST, seedDoc(ROUND), { onPeersChanged: (list) => peers.push(list.length) }).deps,
        );
        const ticket = encodeTicket(await hostSession.share("editor"));
        const guestSession = await start(side(net, GUEST, seedDoc(ROUND), { dial: [HOST], ticket }).deps);
        await settle();
        expect(hostSession.peers()).toHaveLength(1);

        hostSession.disconnect(GUEST);
        await settle();
        expect(hostSession.peers()).toEqual([]);
        expect(guestSession.peers()).toEqual([]);
        // A peer that said goodbye is not redialled.
        expect(guestSession.reconnecting()).toBe(false);
        expect(peers.at(-1)).toBe(0);
    });

    it("needs a relay before it can mint a relayed ticket", async () => {
        const net = createMemoryNet();
        const hostSession = await start(
            side(net, HOST, seedDoc(ROUND), { settings: () => ({ ...on(), relay: true }) }).deps,
        );
        const ticket = await hostSession.share("editor");
        expect(ticket.relay).toBe(true);
        expect(ticket.relayUrl).toContain(HOST);
    });

    it("stops cleanly, saying goodbye to every peer", async () => {
        const net = createMemoryNet();
        const hostSession = await start(side(net, HOST, seedDoc(ROUND)).deps);
        const ticket = encodeTicket(await hostSession.share("editor"));
        const guestSession = await start(side(net, GUEST, seedDoc(ROUND), { dial: [HOST], ticket }).deps);
        await settle();

        await guestSession.stop();
        await settle();
        expect(hostSession.peers()).toEqual([]);
        expect(guestSession.peers()).toEqual([]);
    });
});
