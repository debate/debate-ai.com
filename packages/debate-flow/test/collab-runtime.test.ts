// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
    toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
    startCollabSession: vi.fn(),
    startInviteListener: vi.fn(),
    hostPairing: vi.fn(),
    redeemCode: vi.fn(),
    joinRound: vi.fn(),
    persistReplica: vi.fn(async () => {}),
    createPeerLinkFor: vi.fn(),
    announceInvite: vi.fn(),
    desktop: { value: true },
}));

vi.mock("sonner", () => ({ toast: m.toast }));
vi.mock("../src/lib/collab/session", () => ({ startCollabSession: m.startCollabSession }));
vi.mock("../src/lib/collab/inviteListener", () => ({ startInviteListener: m.startInviteListener }));
vi.mock("../src/lib/collab/pairing", () => ({ hostPairing: m.hostPairing, redeemCode: m.redeemCode }));
vi.mock("../src/lib/collab/join", () => ({ joinRound: m.joinRound }));
vi.mock("../src/lib/collab/persist", () => ({ persistReplica: m.persistReplica }));
vi.mock("../src/lib/collab/inbox", () => ({ announceInvite: m.announceInvite }));
vi.mock("../src/lib/collab/machineName", () => ({ broadcastName: async () => "Laptop" }));
vi.mock("../src/lib/collab/peerLink", async (orig) => ({
    ...(await orig<object>()),
    createPeerLinkFor: m.createPeerLinkFor,
}));
vi.mock("../src/lib/update/adapter", () => ({
    isDesktop: () => m.desktop.value,
    getCurrentVersion: async () => "9.9.9",
}));

import { seedDoc } from "../src/lib/collab/doc";
import { markJoined, forgetJoined } from "../src/lib/collab/joined";
import { getReplica, seedReplica } from "../src/lib/collab/replica";
import { forgetRoundPeers, knownRoundPeers, rememberRoundPeers } from "../src/lib/collab/roundPeers";
import {
    applyRemoteDoc,
    currentSession,
    disconnectPeer,
    endSession,
    inviteContact,
    joinByCode,
    notifyLocalChange,
    resumeJoined,
    resumeSession,
    saveContact,
    shutdownCollab,
    startForRound,
    startPairing,
    syncInviteWatch,
} from "../src/lib/collab/runtime";
import type { CollabPeer, CollabSessionDeps } from "../src/lib/collab/session";
import { makeFlowRound, type FlowRound } from "../src/lib/model/flow";
import { useCollabStore } from "../src/lib/store/useCollabStore";
import { useFlowStore } from "../src/lib/store/useFlowStore";

const PEER = "b".repeat(64);
const ME = "a".repeat(64);

function fakeSession(roundId: string, deps: CollabSessionDeps) {
    let peers: CollabPeer[] = [];
    const s = {
        endpointId: ME,
        roundId,
        deps,
        peers: () => peers,
        setPeers(next: CollabPeer[]) {
            peers = next;
            deps.onPeersChanged?.(next);
        },
        pending: () => [],
        role: vi.fn(() => "editor" as const),
        pairing: vi.fn(() => ({ newCode: vi.fn(async () => "CODE1234") })),
        share: vi.fn(async (role: string) => ({ endpointId: ME, roundId, role, relay: false, secret: "x".repeat(32) })),
        invite: vi.fn(async () => {}),
        announceContact: vi.fn(),
        disconnect: vi.fn((id: string) => {
            peers = peers.filter((p) => p.endpointId !== id);
        }),
        reconnecting: vi.fn(() => false),
        notifyLocalChange: vi.fn(),
        setPresence: vi.fn(),
        setCursor: vi.fn(),
        stop: vi.fn(async () => {}),
    };
    return s;
}

type Fake = ReturnType<typeof fakeSession>;
let last: Fake | null = null;

const initialFlow = useFlowStore.getState();

function openRound(path = "/flows/Finals.ebb"): FlowRound {
    const round = makeFlowRound();
    useFlowStore.getState().loadRound(round, { docPath: path });
    return round;
}

beforeEach(async () => {
    vi.clearAllMocks();
    m.desktop.value = true;
    useFlowStore.setState(initialFlow, true);
    useFlowStore.setState({ collabEnabled: true, collabRelayEnabled: true, collabListenEnabled: false, contacts: {} });
    useCollabStore.getState().reset();
    useCollabStore.setState({ endpointId: null });
    forgetRoundPeers();
    forgetJoined();
    m.startCollabSession.mockImplementation(async (deps: CollabSessionDeps) => {
        last = fakeSession(deps.roundId, deps);
        return last;
    });
    m.startInviteListener.mockImplementation(async () => ({
        endpointId: "listener-id",
        relay: useFlowStore.getState().collabRelayEnabled,
        stop: vi.fn(async () => {}),
    }));
});

afterEach(async () => {
    await shutdownCollab();
    last = null;
});

describe("startForRound", () => {
    it("is gated on desktop and the master switch", async () => {
        const round = openRound();
        m.desktop.value = false;
        expect(await startForRound(round)).toBeNull();
        m.desktop.value = true;
        useFlowStore.setState({ collabEnabled: false });
        expect(await startForRound(round)).toBeNull();
        expect(m.startCollabSession).not.toHaveBeenCalled();
    });

    it("starts a session wired to the store and reuses it for the same round", async () => {
        const round = openRound();
        const s = await startForRound(round, [PEER]);
        expect(s).toBe(last);
        expect(currentSession()).toBe(s);
        const deps = m.startCollabSession.mock.calls[0][0] as CollabSessionDeps;
        expect(deps).toMatchObject({ roundId: round.id, roundLabel: "Finals", appVersion: "9.9.9", displayName: "Laptop", dial: [PEER] });
        expect(useCollabStore.getState().endpointId).toBe(ME);
        expect(knownRoundPeers(round.id)).toEqual([PEER]);
        expect(await startForRound(round)).toBe(s);
        expect(m.startCollabSession).toHaveBeenCalledTimes(1);

        // Local edits reach the session through the replica listener.
        notifyLocalChange();
        expect(last!.notifyLocalChange).toHaveBeenCalled();
        useFlowStore.getState().renameSheet(round.sheets[1].id, "x");
        expect(last!.notifyLocalChange).toHaveBeenCalledTimes(2);
        expect(deps.doc()).toBe(getReplica());
    });

    it("publishes peers, offers to save strangers and refreshes saved relays", async () => {
        const round = openRound();
        useFlowStore.setState({ contacts: { [PEER]: { name: "Sam", relay: "https://old.example" } } as never });
        await startForRound(round);
        const other = "c".repeat(64);
        last!.setPeers([
            { endpointId: PEER, role: "editor", connectionType: "relayed", relayUrl: "https://new.example" },
            { endpointId: other, role: "viewer", connectionType: "direct", name: "Pat" },
        ]);
        const st = useCollabStore.getState();
        expect(st.status).toBe("connected");
        expect(st.peers.map((p) => p.name)).toEqual(["Sam", "Pat"]);
        expect(useFlowStore.getState().contacts[PEER]).toMatchObject({ relay: "https://new.example" });
        expect(m.toast).toHaveBeenCalledWith("Save Pat as a partner?", expect.objectContaining({ id: `collab-save-${other}` }));
        // Offered once per name.
        last!.setPeers(last!.peers());
        expect(m.toast).toHaveBeenCalledTimes(1);
        // Clicking Save stores the contact and tells the peer.
        const opts = m.toast.mock.calls[0][1] as { action: { onClick: () => void } };
        opts.action.onClick();
        expect(useFlowStore.getState().contacts[other]).toMatchObject({ name: "Pat" });
        expect(last!.announceContact).toHaveBeenCalledWith(other);

        last!.setPeers([]);
        expect(useCollabStore.getState().status).toBe("connecting");
        last!.reconnecting.mockReturnValue(true);
        last!.setPeers([]);
        expect(useCollabStore.getState().status).toBe("reconnecting");

        last!.deps.onPendingChanged?.([{ endpointId: PEER, unreachable: true }]);
        expect(useCollabStore.getState().pending).toEqual([{ endpointId: PEER, name: "Sam", unreachable: true }]);
        last!.deps.onRoleChanged?.("viewer");
        expect(useCollabStore.getState().selfRole).toBe("viewer");
    });

    it("saves back a peer that saved this side", async () => {
        const round = openRound();
        await startForRound(round);
        last!.deps.onContact?.({ endpointId: PEER, name: "Sam", relayUrl: "https://r.example" });
        expect(useFlowStore.getState().contacts[PEER]).toMatchObject({ name: "Sam", relay: "https://r.example" });
        expect(m.toast).toHaveBeenCalledWith("Sam saved you as a partner", expect.anything());
        // Already saved: only a changed relay is written.
        last!.deps.onContact?.({ endpointId: PEER, name: "Other", relayUrl: "https://r2.example" });
        expect(useFlowStore.getState().contacts[PEER]).toMatchObject({ name: "Sam", relay: "https://r2.example" });
        last!.deps.onContact?.({ endpointId: PEER, name: "Other" });
        expect(useFlowStore.getState().contacts[PEER].name).toBe("Sam");
    });

    it("resets and rethrows when the session fails to start", async () => {
        const round = openRound();
        m.startCollabSession.mockRejectedValueOnce(new Error("bind failed"));
        await expect(startForRound(round)).rejects.toThrow("bind failed");
        expect(currentSession()).toBeNull();
        expect(useCollabStore.getState().status).toBe("off");
    });

    it("handles a null session and the switch flipping mid-start", async () => {
        const round = openRound();
        m.startCollabSession.mockResolvedValueOnce(null);
        expect(await startForRound(round)).toBeNull();
        expect(useCollabStore.getState().status).toBe("off");

        m.startCollabSession.mockImplementationOnce(async (deps: CollabSessionDeps) => {
            useFlowStore.setState({ collabEnabled: false });
            last = fakeSession(deps.roundId, deps);
            return last;
        });
        expect(await startForRound(round)).toBeNull();
        expect(last!.stop).toHaveBeenCalled();
    });

    it("ends the old session when another round starts", async () => {
        const a = openRound();
        await startForRound(a);
        const first = last!;
        const b = openRound("/flows/Other.ebb");
        await startForRound(b);
        expect(first.stop).toHaveBeenCalled();
        expect(currentSession()?.roundId).toBe(b.id);
    });
});

describe("applyRemoteDoc", () => {
    it("merges into the replica and the store", async () => {
        const round = openRound();
        const incoming = seedDoc({ ...round, sheets: round.sheets.map((s) => ({ ...s, title: "Remote" })) });
        expect(applyRemoteDoc(round, incoming)).toEqual([]);
        expect(useFlowStore.getState().round).not.toBeNull();
    });

    it("returns nothing without a replica", () => {
        const round = makeFlowRound();
        useFlowStore.getState().closeRound();
        expect(applyRemoteDoc(round, seedDoc(round))).toEqual([]);
    });
});

describe("resumeSession and resumeJoined", () => {
    it("stays offline unless listening or joined, and with no remembered peers", async () => {
        const round = openRound();
        expect(await resumeSession(round)).toBeNull();
        markJoined(round.id);
        expect(await resumeSession(round)).toBeNull();
        rememberRoundPeers(round.id, [PEER]);
        const s = await resumeSession(round);
        expect(s?.roundId).toBe(round.id);
        expect(m.startCollabSession.mock.calls[0][0].dial).toEqual([PEER]);
    });

    it("resumeJoined only acts on the open path and reports failures", async () => {
        const round = openRound("/flows/J.ebb");
        await resumeJoined("/other.ebb");
        expect(m.startCollabSession).not.toHaveBeenCalled();
        useFlowStore.setState({ collabListenEnabled: true });
        rememberRoundPeers(round.id, [PEER]);
        m.startCollabSession.mockRejectedValueOnce(new Error("nope"));
        await resumeJoined("/flows/J.ebb");
        expect(m.toast.error).toHaveBeenCalledWith("nope");
    });
});

describe("startPairing", () => {
    it("tries new codes until one goes on the air", async () => {
        const round = openRound();
        m.hostPairing
            .mockRejectedValueOnce(new Error("relay down"))
            .mockImplementationOnce(async (deps: { mintTicket: () => Promise<string>; onGuest: (g: object) => void; once: boolean }) => {
                expect(deps.once).toBe(true);
                expect(await deps.mintTicket()).toMatch(/^ebb1:/);
                deps.onGuest({ endpointId: PEER, relayUrl: "https://g.example" });
                deps.onGuest({ endpointId: PEER });
                return { endpointId: "pair", stop: async () => {} };
            });
        const hosted = await startPairing(round, "editor");
        expect(hosted?.code).toBe("CODE1234");
        expect(m.hostPairing).toHaveBeenCalledTimes(2);
        expect(m.hostPairing.mock.calls[0][0]).toMatchObject({ displayName: "Laptop", roundLabel: "Finals" });
    });

    it("throws the last error after three failures and is gated", async () => {
        const round = openRound();
        m.hostPairing.mockRejectedValue(new Error("relay down"));
        await expect(startPairing(round, "viewer")).rejects.toThrow("relay down");
        expect(m.hostPairing).toHaveBeenCalledTimes(3);
        m.hostPairing.mockRejectedValue("not an error");
        await expect(startPairing(round, "viewer")).rejects.toThrow(/Could not put a code/);
        useFlowStore.setState({ collabEnabled: false });
        expect(await startPairing(round, "viewer")).toBeNull();
    });
});

describe("joinByCode", () => {
    it("redeems the code and joins with the ticket, stopping the link", async () => {
        const stop = vi.fn(async () => {});
        m.createPeerLinkFor.mockResolvedValue({ stop });
        m.redeemCode.mockResolvedValue({ ticket: "ebb1:t" });
        m.joinRound.mockResolvedValue({ path: "/p.ebb", created: true });
        await expect(joinByCode("ABCD")).resolves.toEqual({ path: "/p.ebb", created: true });
        expect(m.redeemCode.mock.calls[0][0]).toMatchObject({ code: "ABCD", displayName: "Laptop" });
        expect(m.joinRound.mock.calls[0][0]).toMatchObject({ ticket: "ebb1:t", appVersion: "9.9.9" });
        expect(stop).toHaveBeenCalled();

        m.redeemCode.mockRejectedValueOnce(new Error("no answer"));
        await expect(joinByCode("ABCD")).rejects.toThrow("no answer");
        expect(stop).toHaveBeenCalledTimes(2);

        useFlowStore.setState({ collabEnabled: false });
        expect(await joinByCode("ABCD")).toBeNull();
    });
});

describe("peers and contacts", () => {
    it("disconnects a peer and persists the cut", async () => {
        const round = openRound();
        await disconnectPeer(PEER);
        await startForRound(round);
        last!.setPeers([{ endpointId: PEER, role: "editor", connectionType: "direct" }]);
        await disconnectPeer(PEER);
        expect(last!.disconnect).toHaveBeenCalledWith(PEER);
        expect(useCollabStore.getState().peers).toEqual([]);
        expect(m.persistReplica).toHaveBeenCalled();
    });

    it("invites a contact, starting a session if needed", async () => {
        const round = openRound();
        await inviteContact(round, PEER, "viewer");
        expect(m.startCollabSession.mock.calls[0][0].dial).toEqual([PEER]);
        expect(last!.invite).not.toHaveBeenCalled();
        await inviteContact(round, "c".repeat(64), "editor");
        expect(last!.invite).toHaveBeenCalledWith("c".repeat(64), "editor");
        last!.setPeers([{ endpointId: PEER, role: "viewer", connectionType: "direct" }]);
        await inviteContact(round, PEER, "viewer");
        expect(last!.invite).toHaveBeenCalledTimes(1);

        await endSession();
        useFlowStore.setState({ collabEnabled: false });
        await expect(inviteContact(round, PEER, "editor")).rejects.toThrow(/Turn on shared editing/);
    });

    it("saves a contact without a session", () => {
        saveContact(PEER, { name: "Sam" });
        expect(useFlowStore.getState().contacts[PEER]).toMatchObject({ name: "Sam" });
    });
});

describe("endSession and the invite watch", () => {
    it("ends quietly even when the transport throws", async () => {
        const round = openRound();
        await startForRound(round);
        last!.stop.mockRejectedValueOnce(new Error("shell gone"));
        await endSession();
        expect(currentSession()).toBeNull();
        expect(useCollabStore.getState().status).toBe("off");
    });

    it("binds a listener when listening and releases it for a session", async () => {
        useFlowStore.setState({ collabListenEnabled: true });
        await syncInviteWatch();
        expect(m.startInviteListener).toHaveBeenCalledTimes(1);
        expect(useCollabStore.getState().endpointId).toBe("listener-id");
        const listener = await m.startInviteListener.mock.results[0].value;
        const deps = m.startInviteListener.mock.calls[0][0];
        expect(deps.openRoundId()).toBeNull();
        deps.onInvite({ endpointId: PEER });
        expect(m.announceInvite).toHaveBeenCalled();

        // A relay change rebinds.
        useFlowStore.setState({ collabRelayEnabled: false });
        await syncInviteWatch();
        expect(listener.stop).toHaveBeenCalled();
        expect(m.startInviteListener).toHaveBeenCalledTimes(2);

        // A session takes the endpoint; ending it binds again.
        const round = openRound();
        await startForRound(round);
        await endSession();
        expect(m.startInviteListener).toHaveBeenCalledTimes(3);

        // Turning listening off drops it.
        useFlowStore.setState({ collabListenEnabled: false });
        await syncInviteWatch();
        const third = await m.startInviteListener.mock.results[2].value;
        expect(third.stop).toHaveBeenCalled();
    });

    it("survives a listener that will not bind", async () => {
        useFlowStore.setState({ collabListenEnabled: true });
        m.startInviteListener.mockRejectedValueOnce(new Error("bind"));
        await syncInviteWatch();
        expect(m.startInviteListener).toHaveBeenCalledTimes(1);
        expect(useCollabStore.getState().endpointId).toBeNull();
    });

    it("drops the replica listener on shutdown", async () => {
        const round = openRound();
        seedReplica(round);
        await startForRound(round);
        const s = last!;
        await shutdownCollab();
        expect(s.stop).toHaveBeenCalled();
        notifyLocalChange();
        expect(s.notifyLocalChange).not.toHaveBeenCalled();
    });
});
