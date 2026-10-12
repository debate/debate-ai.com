// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/update/adapter", () => ({ isDesktop: () => true }));
vi.mock("../src/lib/collab/machineName", () => ({ broadcastName: async () => "Guest box" }));

import { seedDoc } from "../src/lib/collab/doc";
import { helloFrom } from "../src/lib/collab/handshake";
import { startInviteListener } from "../src/lib/collab/inviteListener";
import { joinRound } from "../src/lib/collab/join";
import { joinedHere, forgetJoined } from "../src/lib/collab/joined";
import { hostPairing, redeemCode, PAIR_TTL_MS } from "../src/lib/collab/pairing";
import type { WireMessage } from "../src/lib/collab/peerLink";
import { createMemoryNet, memoryRelay } from "../src/lib/collab/peerLinkMemory";
import { adoptJoinedDoc, persistReplica, recoverReplica } from "../src/lib/collab/persist";
import { getReplica, seedReplica, clearReplica } from "../src/lib/collab/replica";
import { forgetRoundPeers, knownRoundPeers, knownRoundRelays, rememberRoundPeers } from "../src/lib/collab/roundPeers";
import { startCollabSession } from "../src/lib/collab/session";
import { setSidecarFs } from "../src/lib/collab/sidecarFs";
import { encodeTicket } from "../src/lib/collab/ticket";
import { makeFlowRound, type FlowRound } from "../src/lib/model/flow";
import { serializeFlow } from "../src/lib/persistence/flowFile";
import type { FlowFs } from "../src/lib/persistence/flowFs";
import { serializeRecents } from "../src/lib/persistence/recents";
import { useFlowStore } from "../src/lib/store/useFlowStore";

const A = "a".repeat(64);
const B = "b".repeat(64);
const flush = async () => {
    for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
};

function manualClock() {
    const tasks: { fn: () => void; ms: number; live: boolean }[] = [];
    return {
        schedule(fn: () => void, ms: number) {
            const t = { fn, ms, live: true };
            tasks.push(t);
            return () => void (t.live = false);
        },
        run(ms: number) {
            for (const t of tasks.filter((t) => t.live && t.ms === ms)) {
                t.live = false;
                t.fn();
            }
        },
    };
}

function sidecars() {
    const map = new Map<string, string>();
    const fs = {
        map,
        fail: false,
        read: vi.fn(async (id: string) => {
            if (fs.fail) throw new Error("io");
            return map.get(id) ?? null;
        }),
        write: vi.fn(async (id: string, text: string) => {
            if (fs.fail) throw new Error("io");
            map.set(id, text);
        }),
    };
    return fs;
}

function flowFs(recents: string[] = [], files: Record<string, string> = {}): FlowFs {
    const store = new Map(Object.entries(files));
    return {
        locations: async () => ({ flowsDir: "/flows", home: "/h" }),
        pickOpenPath: async () => null,
        pickDirectory: async () => null,
        pickSavePath: async () => null,
        createFlow: async (dir, name, text) => {
            store.set(`${dir}/${name}`, text);
            return `${dir}/${name}`;
        },
        readFlow: async (p) => (store.has(p) ? { text: store.get(p)!, mtimeMs: 1 } : null),
        writeFlow: async () => 1,
        readRecents: async () => serializeRecents(recents.map((path, i) => ({ path, openedAt: i }))),
        writeRecents: async () => {},
        reveal: async () => {},
    };
}

const initial = useFlowStore.getState();
let side: ReturnType<typeof sidecars>;

beforeEach(() => {
    useFlowStore.setState(initial, true);
    useFlowStore.setState({ collabEnabled: true, collabRelayEnabled: true, collabListenEnabled: true });
    forgetRoundPeers();
    forgetJoined();
    clearReplica();
    side = sidecars();
    setSidecarFs(side);
});

describe("pairing", () => {
    it("hands a ticket to one guest and is then spent", async () => {
        const net = createMemoryNet();
        const clock = manualClock();
        const hostLink = await net.create(A)({ discovery: "off", relay: true });
        const guests: unknown[] = [];
        const hosted = await hostPairing({
            port: hostLink,
            code: "AB-CD",
            once: true,
            mintTicket: async () => "ebb1:ticket",
            displayName: "Host",
            roundLabel: "Finals",
            onGuest: (g) => guests.push(g),
            schedule: clock.schedule,
        });
        expect(hosted.endpointId).toBe("pair-ABCD");

        const guestLink = await net.create(B)({ discovery: "off", relay: true });
        const paired = await redeemCode({ port: guestLink, code: "abcd", displayName: "Guesty", schedule: clock.schedule });
        expect(paired).toEqual({ ticket: "ebb1:ticket", hostName: "Host", roundLabel: "Finals" });
        await flush();
        expect(guests).toEqual([{ endpointId: B, name: "Guesty", relayUrl: memoryRelay(B) }]);

        // Spent: a second guest is hung up on.
        const third = await net.create("c".repeat(64))({ discovery: "off", relay: false });
        await expect(redeemCode({ port: third, code: "ABCD", schedule: clock.schedule })).rejects.toThrow(/did not answer/);

        await hosted.stop();
        await hosted.stop();
        await expect(redeemCode({ port: third, code: "ABCD" })).rejects.toThrow();
    });

    it("expires and refuses after stop, and closes a silent dialler", async () => {
        const net = createMemoryNet();
        const clock = manualClock();
        const hostLink = await net.create(A)({ discovery: "off", relay: false });
        const hosted = await hostPairing({
            port: hostLink,
            code: "WXYZ",
            once: false,
            mintTicket: async () => "ebb1:t",
            onGuest: () => {},
            schedule: clock.schedule,
        });
        const raw = await net.create(B)({ discovery: "off", relay: false });
        const conn = await raw.pairDial("WXYZ");
        let closed = false;
        conn.onClose(() => (closed = true));
        await flush();
        clock.run(10_000);
        expect(closed).toBe(true);

        // A viewer code serves more than one guest.
        const g1 = await net.create("c".repeat(64))({ discovery: "off", relay: false });
        await expect(redeemCode({ port: g1, code: "WXYZ", schedule: clock.schedule })).resolves.toEqual({ ticket: "ebb1:t" });
        const g2 = await net.create("d".repeat(64))({ discovery: "off", relay: false });
        await expect(redeemCode({ port: g2, code: "WXYZ", schedule: clock.schedule })).resolves.toEqual({ ticket: "ebb1:t" });

        clock.run(PAIR_TTL_MS);
        await flush();
        const g3 = await net.create("e".repeat(64))({ discovery: "off", relay: false });
        await expect(redeemCode({ port: g3, code: "WXYZ", schedule: clock.schedule })).rejects.toThrow();
        await hosted.stop();
    });

    it("closes the guest when minting fails, and a redeem times out", async () => {
        const net = createMemoryNet();
        const clock = manualClock();
        const hostLink = await net.create(A)({ discovery: "off", relay: false });
        await hostPairing({
            port: hostLink,
            code: "FAIL",
            once: true,
            mintTicket: async () => {
                throw new Error("no relay");
            },
            onGuest: () => {},
            schedule: clock.schedule,
        });
        const g = await net.create(B)({ discovery: "off", relay: false });
        await expect(redeemCode({ port: g, code: "FAIL", schedule: clock.schedule })).rejects.toThrow(/did not answer/);

        // A host that never answers: the guest's own deadline refuses.
        const mute = await net.create("c".repeat(64))({ discovery: "off", relay: false });
        await mute.pairHost("MUTE", () => {});
        const g2 = await net.create("d".repeat(64))({ discovery: "off", relay: false });
        const pending = redeemCode({ port: g2, code: "MUTE", schedule: clock.schedule });
        await flush();
        clock.run(10_000);
        await expect(pending).rejects.toThrow(/did not answer/);
    });
});

describe("joinRound", () => {
    async function host(net: ReturnType<typeof createMemoryNet>, round: FlowRound) {
        const doc = seedDoc(round);
        const session = await startCollabSession({
            createLink: net.create(A),
            roundId: round.id,
            appVersion: "1",
            settings: () => ({ enabled: true, relay: true, listen: false }),
            doc: () => doc,
            apply: () => [],
        });
        return session!;
    }

    it("is gated and rejects a bad ticket", async () => {
        const net = createMemoryNet();
        await expect(joinRound({ ticket: "garbage", createLink: net.create(B), appVersion: "1" })).rejects.toThrow(/ticket/);
        await expect(joinRound({ createLink: net.create(B), appVersion: "1" })).rejects.toThrow(/ticket/);
        useFlowStore.setState({ collabEnabled: false });
        expect(await joinRound({ ticket: "x", createLink: net.create(B), appVersion: "1" })).toBeNull();
    });

    it("joins by ticket and files the round as a new flow", async () => {
        const net = createMemoryNet();
        const round = makeFlowRound();
        round.sheets[1].data = [["hello"]];
        const s = await host(net, round);
        const ticket = encodeTicket(await s.share("editor"));
        const result = await joinRound({ ticket, createLink: net.create(B), appVersion: "1", fs: flowFs() });
        expect(result).toMatchObject({ roundId: round.id, hostEndpointId: A, created: true });
        expect(result!.path).toMatch(/^\/flows\//);
        expect(joinedHere(round.id)).toBe(true);
        expect(knownRoundPeers(round.id)).toContain(A);
        expect(knownRoundRelays(round.id)).toMatchObject({ [A]: memoryRelay(A) });
        expect(side.map.has(round.id)).toBe(true);
        await s.stop();
    });

    it("asks before rejoining a round already on disk", async () => {
        const net = createMemoryNet();
        const round = makeFlowRound();
        const s = await host(net, round);
        const files = { "/flows/mine.ebb": serializeFlow(round), "/flows/bad.ebb": "{nope" };
        const fs = flowFs(["/flows/missing.ebb", "/flows/bad.ebb", "/flows/mine.ebb"], files);
        const confirm = vi.fn(async () => false);
        const no = await joinRound({ ticket: encodeTicket(await s.share("editor")), createLink: net.create(B), appVersion: "1", fs, confirmRejoin: confirm });
        expect(no).toBeNull();
        expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ endpointId: A }));

        const yes = await joinRound({
            ticket: encodeTicket(await s.share("viewer")),
            createLink: net.create(B),
            appVersion: "1",
            fs,
            confirmRejoin: async () => true,
        });
        expect(yes).toEqual({ roundId: round.id, hostEndpointId: A, path: "/flows/mine.ebb", created: false });
        await s.stop();
    });

    it("surfaces a refusal from the host", async () => {
        const net = createMemoryNet();
        const round = makeFlowRound();
        const link = await net.create(A)({ discovery: "off", relay: false });
        await link.listen((conn) => {
            conn.onMessage(() => conn.send({ type: "helloAck", ok: false, reason: "version" } as WireMessage));
        });
        await expect(
            joinRound({ invite: { endpointId: A, roundId: round.id }, createLink: net.create(B), appVersion: "1", fs: flowFs() }),
        ).rejects.toThrow("version");

        const net2 = createMemoryNet();
        const link2 = await net2.create(A)({ discovery: "off", relay: false });
        await link2.listen((conn) => conn.onMessage(() => conn.close()));
        await expect(
            joinRound({ invite: { endpointId: A, roundId: round.id }, createLink: net2.create(B), appVersion: "1", fs: flowFs() }),
        ).rejects.toThrow(/hung up/);
    });
});

describe("inviteListener", () => {
    it("is off unless enabled and listening", async () => {
        const net = createMemoryNet();
        const deps = { createLink: net.create(A), contacts: () => ({}), openRoundId: () => null, onInvite: vi.fn() };
        expect(await startInviteListener({ ...deps, settings: () => ({ enabled: true, relay: true, listen: false }) })).toBeNull();
    });

    it("turns a contact's hello into a notice and ignores strangers", async () => {
        const net = createMemoryNet();
        const clock = manualClock();
        const onInvite = vi.fn();
        const listener = await startInviteListener({
            createLink: net.create(A),
            contacts: () => ({ [B]: { name: "Bee" } }) as never,
            openRoundId: () => "open-round",
            onInvite,
            schedule: clock.schedule,
        });
        expect(listener).toMatchObject({ endpointId: A, relay: true });

        const dialler = await net.create(B)({ discovery: "off", relay: false });
        const conn = await dialler.dial(A);
        const got: WireMessage[] = [];
        conn.onMessage((msg) => got.push(msg));
        await flush();
        conn.send(helloFrom({ endpointId: B, roundId: "their-round", role: "editor", appVersion: "1", label: "Semis" }));
        expect(onInvite).toHaveBeenCalledWith({ endpointId: B, roundId: "their-round", label: "Semis" });
        expect(got).toEqual([{ type: "helloAck", ok: false, reason: "invited" }]);

        // A stranger gets nothing, and the deadline closes them.
        const stranger = await net.create("c".repeat(64))({ discovery: "off", relay: false });
        const sc = await stranger.dial(A);
        let closed = false;
        sc.onClose(() => (closed = true));
        await flush();
        sc.send(helloFrom({ endpointId: "c".repeat(64), roundId: "r", role: "editor", appVersion: "1" }));
        expect(onInvite).toHaveBeenCalledTimes(1);
        clock.run(10_000);
        expect(closed).toBe(true);
        await listener!.stop();
    });
});

describe("persist", () => {
    it("recovers a replica from a matching sidecar and persists it back", async () => {
        const round = makeFlowRound();
        const text = serializeFlow(round);
        seedReplica(round);
        rememberRoundPeers(round.id, [B]);
        await persistReplica(round, text);
        expect(side.map.has(round.id)).toBe(true);

        forgetRoundPeers();
        clearReplica();
        expect(await recoverReplica(round, text)).toEqual([B]);
        expect(getReplica()?.roundId).toBe(round.id);
    });

    it("seeds fresh when collab is off or the sidecar fails", async () => {
        const round = makeFlowRound();
        useFlowStore.setState({ collabEnabled: false });
        expect(await recoverReplica(round, "x")).toEqual([]);
        expect(getReplica()?.roundId).toBe(round.id);
        await persistReplica(round, "x");
        expect(side.write).not.toHaveBeenCalled();

        useFlowStore.setState({ collabEnabled: true });
        side.fail = true;
        expect(await recoverReplica(round, "x")).toEqual([]);
        await persistReplica(round, serializeFlow(round));
        await adoptJoinedDoc(seedDoc(round), "x", [B]);
        side.fail = false;
        // Another round's replica is not written.
        await persistReplica(makeFlowRound(), "x");
        expect(side.map.size).toBe(0);
        await adoptJoinedDoc(seedDoc(round), "x", [B]);
        expect(side.map.has(round.id)).toBe(true);
    });
});
