/**
 * The desktop adapter: the PeerLink port over the shell's collab commands.
 *
 * The shell carries bytes and nothing else. Everything about what the peers
 * say lives above this line and is proven against the in-memory transport, so
 * this module's whole job is to keep connection ids straight and to turn each
 * line of JSON back into a wire message.
 */

import { listenHere } from "../windowEvents";

import {
    parseWireMessage,
    type PeerConn,
    type PeerLink,
    type PeerLinkConfig,
    type WireMessage,
} from "./peerLink";

/** The slice of Tauri this needs, injected so the suite can drive it. */
export interface TauriBridge {
    invoke(cmd: string, args: Record<string, unknown>): Promise<unknown>;
    listen(event: string, cb: (payload: unknown) => void): Promise<() => void>;
}

type ConnectionKind = "direct" | "relayed";

interface PeerPayload {
    connId: string;
    endpointId: string;
    connectionType: ConnectionKind;
    /** Where the shell observed this peer to be homed, when it could say. */
    relayUrl: string | null;
}

function asPeer(payload: unknown): PeerPayload | null {
    if (payload === null || typeof payload !== "object") return null;
    const p = payload as Partial<PeerPayload>;
    if (typeof p.connId !== "string" || typeof p.endpointId !== "string") return null;
    return {
        connId: p.connId,
        endpointId: p.endpointId,
        // Anything the shell did not call direct is disclosed as relayed.
        connectionType: p.connectionType === "direct" ? "direct" : "relayed",
        // "" is how the shell says it has none, and an empty hint saved
        // against a contact would be dialled forever.
        relayUrl: typeof p.relayUrl === "string" && p.relayUrl !== "" ? p.relayUrl : null,
    };
}

function asMessage(payload: unknown): { connId: string; msg: WireMessage } | null {
    if (payload === null || typeof payload !== "object") return null;
    const p = payload as { connId?: unknown; payload?: unknown };
    if (typeof p.connId !== "string" || typeof p.payload !== "string") return null;
    let raw: unknown;
    try {
        raw = JSON.parse(p.payload);
    } catch {
        return null;
    }
    // A line that does not conform to its variant is a peer speaking a
    // language this build does not know, or one probing for a field the
    // protocol dereferences without asking. Dropping it beats tearing the link
    // down, and beats letting it reach the handshake.
    const msg = parseWireMessage(raw);
    return msg ? { connId: p.connId, msg } : null;
}

async function defaultBridge(): Promise<TauriBridge> {
    // Dynamic so the browser bundle never pulls in Tauri's JS API, matching
    // how every other desktop touchpoint is gated.
    const core = await import("@tauri-apps/api/core");
    return {
        invoke: (cmd, args) => core.invoke(cmd, args),
        // A session belongs to the window that started it. `listenHere` is what
        // keeps a second window from seeing this one's traffic, or adopting an
        // inbound peer that dialled it.
        listen: (name, cb) => listenHere(name, cb),
    };
}

interface Held {
    conn: PeerConn;
    kind: ConnectionKind;
    relay: string | null;
    onMessage: ((m: WireMessage) => void)[];
    onClose: (() => void)[];
    open: boolean;
    /**
     * The claim this window has in flight, which every write queues behind.
     *
     * The shell refuses a write to a connection another window owns, and the
     * ack admitting a peer goes out the moment the claim does. Two invokes are
     * two IPC requests and nothing orders them, so the ack could reach the
     * shell before the claim and be refused as somebody else's. Null once
     * there is nothing to wait for, so an ordinary send still reaches the
     * shell in the same turn.
     */
    claiming: Promise<unknown> | null;
}

export async function createPeerLink(
    config: PeerLinkConfig,
    bridge?: TauriBridge,
): Promise<PeerLink> {
    const shell = bridge ?? (await defaultBridge());

    const endpointId = (await shell.invoke("collab_start", {
        relay: config.relay,
        mdns: config.discovery === "mdns",
    })) as string;

    const held = new Map<string, Held>();
    let onPeer: ((conn: PeerConn) => void) | null = null;
    /** Where a peer arriving on the pairing endpoint goes. */
    let onPairPeer: ((conn: PeerConn) => void) | null = null;
    const unlisten: (() => void)[] = [];
    /** This link's one hold on the shell's endpoint, spent exactly once. */
    let stopped = false;

    /**
     * Forgets a connection the shell no longer holds, and tells whoever was
     * using it. The shell is the authority: once it has dropped a connection
     * nothing can be sent over it again, so this is a close in every sense but
     * the one command it does not need to issue.
     */
    function dropConn(connId: string): void {
        const entry = held.get(connId);
        if (!entry?.open) return;
        entry.open = false;
        held.delete(connId);
        for (const cb of entry.onClose) cb();
    }

    function makeConn(
        connId: string,
        remote: string,
        kind: ConnectionKind,
        relay: string | null,
    ): PeerConn {
        const entry: Held = {
            open: true,
            kind,
            relay,
            onMessage: [],
            onClose: [],
            claiming: null,
            conn: {
                id: remote,
                connectionType: () => entry.kind,
                relayUrl: () => entry.relay,
                claim() {
                    if (!entry.open || entry.claiming) return;
                    // A claim the shell refuses means another window admitted
                    // this peer first, so the connection is theirs and this
                    // side has nothing left to say on it. Dropping it is the
                    // same answer a refused send gets, for the same reason.
                    entry.claiming = shell.invoke("collab_claim", { connId });
                    void entry.claiming.catch(() => dropConn(connId));
                },
                send(msg) {
                    if (!entry.open) return;
                    const write = () =>
                        shell.invoke("collab_send", { connId, payload: JSON.stringify(msg) });
                    // The shell refuses a send for one reason: it is not
                    // holding this connection. A peer that quit and an endpoint
                    // that stopped both land here, neither is retryable, and a
                    // peer going away is ordinary. So the link is dropped
                    // rather than left claiming to be up, and nothing about it
                    // reaches the debater as an error.
                    void (entry.claiming ? entry.claiming.then(write) : write()).catch(() =>
                        dropConn(connId),
                    );
                },
                onMessage(cb) {
                    entry.onMessage.push(cb);
                },
                onClose(cb) {
                    entry.onClose.push(cb);
                },
                close() {
                    if (!entry.open) return;
                    entry.open = false;
                    const hangUp = () => shell.invoke("collab_close", { connId });
                    // Behind the claim for the reason a write is: the shell
                    // refuses a hang-up from a window that does not own the
                    // connection, and a close that overtook this window's own
                    // claim would be refused as somebody else's. Already gone
                    // on the shell's side is the ordinary way a close races a
                    // peer that hung up first, so nothing is made of either.
                    void (entry.claiming ? entry.claiming.then(hangUp) : hangUp()).catch(() => {});
                    held.delete(connId);
                    for (const cb of entry.onClose) cb();
                },
            },
        };
        held.set(connId, entry);
        return entry.conn;
    }

    unlisten.push(
        await shell.listen("collab:peer", (payload) => {
            const peer = asPeer(payload);
            if (!peer) return;
            // Only an inbound connection is announced. A dial reports its own
            // path in its return value, so nothing here can race it.
            if (held.has(peer.connId)) return;
            onPeer?.(makeConn(peer.connId, peer.endpointId, peer.connectionType, peer.relayUrl));
        }),
    );

    unlisten.push(
        await shell.listen("collab:message", (payload) => {
            const parsed = asMessage(payload);
            if (!parsed) return;
            const entry = held.get(parsed.connId);
            if (!entry) return;
            for (const cb of entry.onMessage) cb(parsed.msg);
        }),
    );

    unlisten.push(
        await shell.listen("collab:closed", (payload) => {
            if (payload === null || typeof payload !== "object") return;
            const p = payload as { connId?: unknown };
            if (typeof p.connId !== "string") return;
            dropConn(p.connId);
        }),
    );

    unlisten.push(
        await shell.listen("collab:pair", (payload) => {
            const peer = asPeer(payload);
            if (!peer) return;
            if (held.has(peer.connId)) return;
            // Its own channel, so a guest redeeming a code never reaches the
            // session's listener, which would read one as a peer arriving with
            // no hello and hang up on it.
            onPairPeer?.(
                makeConn(peer.connId, peer.endpointId, peer.connectionType, peer.relayUrl),
            );
        }),
    );

    async function dial(target: string, relayUrl?: string | null): Promise<PeerConn> {
        const result = (await shell.invoke("collab_dial", {
            endpointId: target,
            relayUrl: relayUrl ?? null,
        })) as {
            connId: string;
            connectionType: ConnectionKind;
            relayUrl?: string | null;
        };
        return makeConn(
            result.connId,
            target,
            result.connectionType,
            typeof result.relayUrl === "string" && result.relayUrl !== "" ? result.relayUrl : null,
        );
    }

    return {
        async endpointId() {
            return endpointId;
        },

        async relayUrl() {
            // Asked of the shell rather than held from the bind: a relay is
            // contacted after the socket is up, so an answer taken at bind
            // time would be empty for the first seconds of every session -
            // which are exactly the seconds a debater spends clicking Share.
            return (await shell.invoke("collab_relay_url", {})) as string;
        },

        async listen(cb) {
            onPeer = cb;
        },

        dial,

        async newCode() {
            return (await shell.invoke("collab_pair_code", {})) as string;
        },

        async pairHost(code, cb) {
            // Set before the bind, because the shell can announce a guest the
            // moment the endpoint is up and a handler assigned afterwards
            // would miss the one this code exists for.
            onPairPeer = cb;
            try {
                return (await shell.invoke("collab_pair_start", { code })) as string;
            } catch (err) {
                onPairPeer = null;
                throw err;
            }
        },

        async pairDial(code) {
            // The code is the whole address: the shell derives the endpoint
            // and the relay from it, and the dial is the ordinary one.
            const target = (await shell.invoke("collab_pair_target", { code })) as {
                endpointId: string;
                relayUrl: string;
            };
            return dial(target.endpointId, target.relayUrl);
        },

        async pairStop() {
            onPairPeer = null;
            await shell.invoke("collab_pair_stop", {});
        },

        async stop() {
            // Once, whatever the caller does. The shell refcounts the endpoint
            // so two links can share one bind, and a second stop from this
            // link would spend a hold it does not have and pull the endpoint
            // out from under the other one.
            if (stopped) return;
            stopped = true;
            for (const un of unlisten) un();
            unlisten.length = 0;
            onPeer = null;
            // A link that goes takes its code off the air with it, or the
            // pairing endpoint stays bound with nothing left to answer for.
            onPairPeer = null;
            await shell.invoke("collab_pair_stop", {}).catch(() => {});
            for (const entry of held.values()) entry.open = false;
            held.clear();
            await shell.invoke("collab_stop", {});
        },
    };
}
