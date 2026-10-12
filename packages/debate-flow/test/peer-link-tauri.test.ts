import { describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
    invoke: vi.fn(),
    open: vi.fn(),
    save: vi.fn(),
    reveal: vi.fn(async () => {}),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: m.invoke }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: m.open, save: m.save }));
vi.mock("@tauri-apps/plugin-opener", () => ({ revealItemInDir: m.reveal }));

import type { PeerConn, WireMessage } from "../src/lib/collab/peerLink";
import { createPeerLink, type TauriBridge } from "../src/lib/collab/peerLinkTauri";
import { createFlowFs } from "../src/lib/persistence/flowFsTauri";

const tick = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
};

function fakeShell() {
    const handlers = new Map<string, (p: unknown) => void>();
    const unlistened: string[] = [];
    const calls: [string, Record<string, unknown>][] = [];
    const answers: Record<string, unknown> = {
        collab_start: "my-id",
        collab_relay_url: "https://relay.example",
        collab_pair_code: "CODE",
        collab_pair_start: "pair-id",
        collab_pair_target: { endpointId: "host", relayUrl: "https://r" },
        collab_dial: { connId: "c-dial", connectionType: "direct", relayUrl: "" },
    };
    const failing = new Set<string>();
    const shell: TauriBridge = {
        invoke: vi.fn(async (cmd: string, args: Record<string, unknown>) => {
            calls.push([cmd, args]);
            if (failing.has(cmd)) throw new Error(cmd);
            return answers[cmd];
        }),
        listen: vi.fn(async (event: string, cb: (p: unknown) => void) => {
            handlers.set(event, cb);
            return () => unlistened.push(event);
        }),
    };
    return {
        shell,
        calls,
        answers,
        failing,
        unlistened,
        emit: (event: string, payload: unknown) => handlers.get(event)?.(payload),
    };
}

describe("createPeerLink (tauri)", () => {
    it("starts the endpoint and answers the simple queries", async () => {
        const s = fakeShell();
        const link = await createPeerLink({ discovery: "mdns", relay: true }, s.shell);
        expect(s.calls[0]).toEqual(["collab_start", { relay: true, mdns: true }]);
        expect(await link.endpointId()).toBe("my-id");
        expect(await link.relayUrl()).toBe("https://relay.example");
        expect(await link.newCode()).toBe("CODE");
    });

    it("hands accepted peers to the listener and routes their messages", async () => {
        const s = fakeShell();
        const link = await createPeerLink({ discovery: "off", relay: false }, s.shell);
        const peers: PeerConn[] = [];
        await link.listen((c) => peers.push(c));
        s.emit("collab:peer", null);
        s.emit("collab:peer", { connId: 1 });
        s.emit("collab:peer", { connId: "c1", endpointId: "far", connectionType: "relayed", relayUrl: "https://x" });
        s.emit("collab:peer", { connId: "c1", endpointId: "far" });
        expect(peers).toHaveLength(1);
        const conn = peers[0];
        expect(conn.id).toBe("far");
        expect(conn.connectionType()).toBe("relayed");
        expect(conn.relayUrl()).toBe("https://x");

        const got: WireMessage[] = [];
        conn.onMessage((msg) => got.push(msg));
        s.emit("collab:message", { connId: "c1", payload: JSON.stringify({ type: "bye" }) });
        s.emit("collab:message", { connId: "c1", payload: "{not json" });
        s.emit("collab:message", { connId: "c1", payload: JSON.stringify({ type: "nope" }) });
        s.emit("collab:message", { connId: "other", payload: JSON.stringify({ type: "bye" }) });
        s.emit("collab:message", null);
        expect(got).toEqual([{ type: "bye" }]);

        conn.send({ type: "bye" });
        await tick();
        expect(s.calls).toContainEqual(["collab_send", { connId: "c1", payload: '{"type":"bye"}' }]);

        let closed = 0;
        conn.onClose(() => closed++);
        s.emit("collab:closed", { connId: 5 });
        s.emit("collab:closed", "x");
        s.emit("collab:closed", { connId: "c1" });
        s.emit("collab:closed", { connId: "c1" });
        expect(closed).toBe(1);
        conn.send({ type: "bye" });
        await tick();
        expect(s.calls.filter(([c]) => c === "collab_send")).toHaveLength(1);
    });

    it("claims before sending, and drops a connection whose claim or send fails", async () => {
        const s = fakeShell();
        const link = await createPeerLink({ discovery: "off", relay: false }, s.shell);
        const peers: PeerConn[] = [];
        await link.listen((c) => peers.push(c));
        s.emit("collab:peer", { connId: "c1", endpointId: "a", connectionType: "direct" });
        const conn = peers[0];
        expect(conn.relayUrl()).toBeNull();
        expect(conn.connectionType()).toBe("direct");
        conn.claim!();
        conn.claim!();
        conn.send({ type: "bye" });
        await tick();
        const order = s.calls.map(([c]) => c).filter((c) => c === "collab_claim" || c === "collab_send");
        expect(order).toEqual(["collab_claim", "collab_send"]);
        conn.close();
        conn.close();
        await tick();
        expect(s.calls.filter(([c]) => c === "collab_close")).toHaveLength(1);

        s.failing.add("collab_claim");
        s.emit("collab:peer", { connId: "c2", endpointId: "b", connectionType: "direct" });
        let closed = false;
        peers[1].onClose(() => (closed = true));
        peers[1].claim!();
        await tick();
        expect(closed).toBe(true);

        s.failing.add("collab_send");
        s.emit("collab:peer", { connId: "c3", endpointId: "c", connectionType: "direct" });
        let closed3 = false;
        peers[2].onClose(() => (closed3 = true));
        peers[2].send({ type: "bye" });
        await tick();
        expect(closed3).toBe(true);
    });

    it("dials, pairs and stops", async () => {
        const s = fakeShell();
        const link = await createPeerLink({ discovery: "off", relay: true }, s.shell);
        const out = await link.dial("target", "https://r");
        expect(s.calls).toContainEqual(["collab_dial", { endpointId: "target", relayUrl: "https://r" }]);
        expect(out.id).toBe("target");
        expect(out.relayUrl()).toBeNull();
        s.answers.collab_dial = { connId: "c-2", connectionType: "relayed", relayUrl: "https://there" };
        expect((await link.dial("t2")).relayUrl()).toBe("https://there");

        const pairPeers: PeerConn[] = [];
        expect(await link.pairHost("CODE", (c) => pairPeers.push(c))).toBe("pair-id");
        s.emit("collab:pair", { connId: "p1", endpointId: "guest", connectionType: "direct" });
        s.emit("collab:pair", { connId: "p1", endpointId: "guest", connectionType: "direct" });
        s.emit("collab:pair", {});
        expect(pairPeers.map((p) => p.id)).toEqual(["guest"]);
        await link.pairStop();
        expect(s.calls).toContainEqual(["collab_pair_stop", {}]);

        s.answers.collab_dial = { connId: "c-3", connectionType: "direct" };
        const paired = await link.pairDial("CODE");
        expect(paired.id).toBe("host");
        expect(s.calls).toContainEqual(["collab_pair_target", { code: "CODE" }]);

        s.failing.add("collab_pair_start");
        await expect(link.pairHost("X", () => {})).rejects.toThrow();

        s.failing.add("collab_pair_stop");
        await link.stop();
        await link.stop();
        expect(s.unlistened).toHaveLength(4);
        expect(s.calls.filter(([c]) => c === "collab_stop")).toHaveLength(1);
    });
});

describe("flowFsTauri", () => {
    it("maps every call onto the shell", async () => {
        const fs = createFlowFs();
        m.invoke.mockResolvedValue("ok");
        await fs.locations();
        expect(m.invoke).toHaveBeenLastCalledWith("flow_paths");
        await fs.createFlow("/d", "n.ebb", "t");
        expect(m.invoke).toHaveBeenLastCalledWith("create_flow_file", { dir: "/d", name: "n.ebb", contents: "t" });
        await fs.readFlow("/p");
        expect(m.invoke).toHaveBeenLastCalledWith("read_flow_file", { path: "/p" });
        await fs.writeFlow("/p", "t");
        expect(m.invoke).toHaveBeenLastCalledWith("write_flow_file", { path: "/p", contents: "t", expectedMtimeMs: null });
        await fs.writeFlow("/p", "t", 5);
        expect(m.invoke).toHaveBeenLastCalledWith("write_flow_file", { path: "/p", contents: "t", expectedMtimeMs: 5 });
        await fs.readRecents();
        expect(m.invoke).toHaveBeenLastCalledWith("read_recents");
        await fs.writeRecents("r");
        expect(m.invoke).toHaveBeenLastCalledWith("write_recents", { contents: "r" });
        await fs.reveal("/p");
        expect(m.reveal).toHaveBeenCalledWith("/p");
    });

    it("normalizes picker answers", async () => {
        const fs = createFlowFs();
        m.open.mockResolvedValueOnce("/a.ebb").mockResolvedValueOnce(["x"]).mockResolvedValueOnce("/dir").mockResolvedValueOnce(null);
        expect(await fs.pickOpenPath()).toBe("/a.ebb");
        expect(await fs.pickOpenPath()).toBeNull();
        expect(await fs.pickDirectory()).toBe("/dir");
        expect(await fs.pickDirectory()).toBeNull();
        m.save.mockResolvedValueOnce(null).mockResolvedValueOnce("/x").mockResolvedValueOnce("/y.EBB");
        expect(await fs.pickSavePath("s.ebb")).toBeNull();
        expect(await fs.pickSavePath("s.ebb")).toBe("/x.ebb");
        expect(await fs.pickSavePath("s.ebb")).toBe("/y.EBB");
    });
});
