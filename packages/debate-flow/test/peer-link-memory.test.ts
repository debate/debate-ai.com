import { describe, expect, it } from "vitest";
import {
    createMemoryNet,
    memoryPairId,
    memoryRelay,
    noPairing,
} from "../src/lib/collab/peerLinkMemory";
import type { PeerConn, WireMessage } from "../src/lib/collab/peerLink";

const direct = { discovery: "off", relay: false } as const;
const relayed = { discovery: "off", relay: true } as const;

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("memory helpers", () => {
    it("names relays on an unresolvable host and normalizes codes", () => {
        expect(memoryRelay("abc")).toBe("https://relay.invalid/abc");
        expect(memoryPairId("ab-cd ef")).toBe("pair-ABCDEF");
    });

    it("noPairing refuses every pairing call", async () => {
        await expect(noPairing.newCode()).rejects.toThrow(/does not pair/);
        await expect(noPairing.pairHost("x", () => {})).rejects.toThrow();
        await expect(noPairing.pairDial("x")).rejects.toThrow();
        await expect(noPairing.pairStop()).resolves.toBeUndefined();
    });
});

describe("createMemoryNet", () => {
    it("connects a dialler to a listener and carries valid messages", async () => {
        const net = createMemoryNet();
        const a = await net.create("A")(direct);
        const b = await net.create("B")(direct);

        let incoming: PeerConn | null = null;
        await b.listen((peer) => {
            incoming = peer;
        });
        const out = await a.dial("B");
        await tick();
        expect(incoming).not.toBeNull();
        const listener = incoming as unknown as PeerConn;

        expect(out.id).toBe("B");
        expect(listener.id).toBe("A");
        expect(out.connectionType()).toBe("direct");
        expect(out.relayUrl()).toBeNull();

        const got: WireMessage[] = [];
        listener.onMessage((m) => got.push(m));
        out.send({ type: "contact", name: "Alice" } as WireMessage);
        // A malformed line is dropped the way the real transport drops it.
        out.send({ type: "bogus" } as unknown as WireMessage);
        expect(got).toEqual([{ type: "contact", name: "Alice" }]);

        let closed = 0;
        out.onClose(() => closed++);
        listener.onClose(() => closed++);
        listener.close();
        listener.close();
        expect(closed).toBe(2);
        out.send({ type: "contact" } as WireMessage);
        expect(got).toHaveLength(1);

        expect(await a.endpointId()).toBe("A");
        expect(await a.relayUrl()).toBe("");
        expect(net.calls.map((c) => c.op)).toEqual([
            "create",
            "create",
            "listen",
            "dial",
            "endpointId",
            "relayUrl",
        ]);
    });

    it("reports a relayed connection only when both sides allow relays", async () => {
        const net = createMemoryNet();
        const a = await net.create("A")(relayed);
        const b = await net.create("B")(relayed);
        await b.listen(() => {});
        const conn = await a.dial("B", memoryRelay("B"));
        expect(conn.connectionType()).toBe("relayed");
        expect(conn.relayUrl()).toBe(memoryRelay("B"));
        expect(await a.relayUrl()).toBe(memoryRelay("A"));
        expect(net.calls.find((c) => c.op === "dial")?.relayUrl).toBe(memoryRelay("B"));
    });

    it("refuses to dial an endpoint nobody is listening on", async () => {
        const net = createMemoryNet();
        const a = await net.create("A")(direct);
        await net.create("B")(direct);
        await expect(a.dial("B")).rejects.toThrow(/no peer listening/);
        await expect(a.dial("C")).rejects.toThrow(/no peer listening/);
    });

    it("pairs by code and withdraws the code on stop", async () => {
        const net = createMemoryNet();
        const host = await net.create("H")(direct);
        const guest = await net.create("G")(direct);

        const code = await host.newCode();
        expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);

        const peers: PeerConn[] = [];
        await host.pairHost("OLD1", () => {});
        const pairId = await host.pairHost(code, (p) => peers.push(p));
        expect(pairId).toBe(memoryPairId(code));
        // The replaced code is no longer on the air.
        await expect(guest.pairDial("OLD1")).rejects.toThrow();

        await guest.pairDial(code);
        await tick();
        expect(peers).toHaveLength(1);

        await host.pairStop();
        await expect(guest.pairDial(code)).rejects.toThrow();

        await host.pairHost(code, () => {});
        await host.stop();
        await expect(guest.pairDial(code)).rejects.toThrow();
    });

    it("forgets everything on reset", async () => {
        const net = createMemoryNet();
        const a = await net.create("A")(direct);
        const b = await net.create("B")(direct);
        await b.listen(() => {});
        net.reset();
        expect(net.calls).toEqual([]);
        await expect(a.dial("B")).rejects.toThrow();
    });
});
