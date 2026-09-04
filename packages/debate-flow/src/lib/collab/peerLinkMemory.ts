/**
 * The in-process transport the suite runs against.
 *
 * It records every call it is asked to make. That is what turns the opt-in
 * claim into a fact: with the master switch off the recorder stays empty, so
 * no endpoint was bound, no peer was dialled, no discovery record was
 * published, and no relay was contacted.
 *
 * It also narrows every line the way the desktop adapter does, because a
 * validator the suite never reaches is one that can be weakened without a
 * single test noticing. A message this drops is a message the shipping
 * transport would have dropped too.
 */

import {
    parseWireMessage,
    type PairingPort,
    type PeerConn,
    type PeerLink,
    type PeerLinkConfig,
    type WireMessage,
} from "./peerLink";

/**
 * The pairing half of a link that never pairs, for a double built around one
 * other behaviour. Spread in rather than repeated, so the port growing a
 * method does not mean editing every stand-in in the suite.
 */
export const noPairing: PairingPort = {
    newCode: () => Promise.reject(new Error("this link does not pair")),
    pairHost: () => Promise.reject(new Error("this link does not pair")),
    pairDial: () => Promise.reject(new Error("this link does not pair")),
    pairStop: async () => {},
};

export interface MemoryCall {
    op:
        | "create"
        | "endpointId"
        | "relayUrl"
        | "listen"
        | "dial"
        | "stop"
        | "newCode"
        | "pairHost"
        | "pairDial"
        | "pairStop";
    /** For a dial, the endpoint reached out to; otherwise the local one. */
    endpointId?: string;
    /** For a dial, the relay it was told to look on, if it was told one. */
    relayUrl?: string | null;
    config?: PeerLinkConfig;
}

/**
 * The relay an endpoint on this net is homed on. Not a server anyone can
 * reach: `.invalid` never resolves, so a test that leaks one into a real dial
 * fails rather than wanders onto the network.
 */
export function memoryRelay(endpointId: string): string {
    return `https://relay.invalid/${endpointId}`;
}

/**
 * The name a code goes by on this net.
 *
 * Not a derivation. The real one is an HKDF in the shell and lives in exactly
 * one place; what a handshake needs from it is only that the two sides reach
 * the same name from the same code, which this gives with nothing to drift.
 */
export function memoryPairId(code: string): string {
    return `pair-${code.replace(/[-\s]/g, "").toUpperCase()}`;
}

/** Crockford base32, as the shell mints a code from. */
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export interface MemoryNet {
    /** Every call made through this net, in order. */
    calls: MemoryCall[];
    /** A link factory for one endpoint, in the shape a session expects. */
    create(endpointId: string): (config: PeerLinkConfig) => Promise<PeerLink>;
    reset(): void;
}

interface Endpoint {
    config: PeerLinkConfig;
    onPeer: ((peer: PeerConn) => void) | null;
}

type Side = "dialler" | "listener";

/** The two ends of one connection, wired to each other. */
function connect(
    diallerId: string,
    listenerId: string,
    relayed: boolean,
): { dialler: PeerConn; listener: PeerConn } {
    const listeners: Record<Side, ((m: WireMessage) => void)[]> = { dialler: [], listener: [] };
    const closers: Record<Side, (() => void)[]> = { dialler: [], listener: [] };
    let open = true;

    function side(self: Side, id: string): PeerConn {
        const other: Side = self === "dialler" ? "listener" : "dialler";
        return {
            id,
            connectionType: () => (relayed ? "relayed" : "direct"),
            // Where the far side is homed, which is what a link learns from a
            // connection and a saved contact keeps. A direct peer is in the
            // room and has no relay to report.
            relayUrl: () => (relayed ? memoryRelay(id) : null),
            send(msg) {
                if (!open) return;
                // A real link carries bytes: it serializes, and a line that
                // does not conform to its variant never reaches a listener.
                const parsed = parseWireMessage(JSON.parse(JSON.stringify(msg)));
                if (!parsed) return;
                for (const cb of listeners[other]) cb(parsed);
            },
            onMessage(cb) {
                listeners[self].push(cb);
            },
            onClose(cb) {
                closers[self].push(cb);
            },
            close() {
                if (!open) return;
                open = false;
                for (const cb of [...closers.dialler, ...closers.listener]) cb();
            },
        };
    }

    // Each handle names the far side, which is what a peer list displays.
    return { dialler: side("dialler", listenerId), listener: side("listener", diallerId) };
}

export function createMemoryNet(): MemoryNet {
    const endpoints = new Map<string, Endpoint>();
    const calls: MemoryCall[] = [];

    return {
        calls,
        reset() {
            endpoints.clear();
            calls.length = 0;
        },
        create(endpointId) {
            return async (config) => {
                calls.push({ op: "create", endpointId, config });
                endpoints.set(endpointId, { config, onPeer: null });
                /** The one code this link has on the air, if it has one. */
                let pairId: string | null = null;

                /**
                 * The far side hears about the connection after this call has
                 * handed the dialler back, because that is when the shipping
                 * transport hears about one: an accepted connection reaches
                 * the webview as an event, long after the dialler returned. A
                 * listener that answered synchronously - by refusing, say -
                 * would reach a dialler with no handlers attached yet, which
                 * on a real link cannot happen.
                 */
                async function dial(target: string) {
                    const far = endpoints.get(target);
                    if (!far?.onPeer) throw new Error(`no peer listening at ${target}`);
                    const { dialler, listener } = connect(
                        endpointId,
                        target,
                        config.relay && far.config.relay,
                    );
                    const announce = far.onPeer;
                    queueMicrotask(() => announce(listener));
                    return dialler;
                }

                return {
                    async endpointId() {
                        calls.push({ op: "endpointId", endpointId });
                        return endpointId;
                    },
                    async relayUrl() {
                        calls.push({ op: "relayUrl", endpointId });
                        // A link that will not use a relay has none to name,
                        // which is what puts no relay in its ticket.
                        return config.relay ? memoryRelay(endpointId) : "";
                    },
                    async listen(onPeer) {
                        calls.push({ op: "listen", endpointId });
                        const self = endpoints.get(endpointId);
                        if (self) self.onPeer = onPeer;
                    },
                    async dial(target, relayUrl) {
                        calls.push({ op: "dial", endpointId: target, relayUrl: relayUrl ?? null });
                        return dial(target);
                    },
                    async newCode() {
                        calls.push({ op: "newCode", endpointId });
                        let code = "";
                        for (let i = 0; i < 8; i++) {
                            code += CODE_ALPHABET[Math.floor(Math.random() * 32)];
                        }
                        return code;
                    },
                    async pairHost(code, onPeer) {
                        calls.push({ op: "pairHost", endpointId });
                        // One code on the air at a time, as the shell holds
                        // one pairing endpoint at a time.
                        if (pairId) endpoints.delete(pairId);
                        pairId = memoryPairId(code);
                        endpoints.set(pairId, { config, onPeer });
                        return pairId;
                    },
                    async pairDial(code) {
                        const target = memoryPairId(code);
                        calls.push({ op: "pairDial", endpointId: target, relayUrl: null });
                        return dial(target);
                    },
                    async pairStop() {
                        calls.push({ op: "pairStop", endpointId });
                        if (pairId) endpoints.delete(pairId);
                        pairId = null;
                    },
                    async stop() {
                        calls.push({ op: "stop", endpointId });
                        if (pairId) endpoints.delete(pairId);
                        pairId = null;
                        endpoints.delete(endpointId);
                    },
                };
            };
        },
    };
}
