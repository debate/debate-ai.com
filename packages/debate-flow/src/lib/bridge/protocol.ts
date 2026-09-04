/**
 * The wire shapes ebb exchanges with CardMirror over the cardmirror-bridge
 * loopback HTTP bridge.
 *
 * The Rust host only carries JSON: it authenticates the caller, hands the
 * parsed body here, and writes back whatever `BridgeReply` this layer
 * produces. Every request arrives from another process, so nothing is
 * trusted; the parsers below are the only door into the grid.
 */

/** One node CardMirror extracted, as its plugin serializes it. */
export interface FlowItem {
    /** CardMirror's node kind. An unknown kind writes as plain text. */
    kind: string;
    text: string;
    /** CardMirror's opaque provenance token, handed back verbatim to jump. */
    token: string;
    /** Stable equality key CardMirror mints, matched by the reveal route. */
    key: string;
}

export interface FlowRequest {
    mode: "column" | "cell";
    docTitle: string;
    items: FlowItem[];
    /** Empty cells to leave below the send, from CardMirror's plugin setting. */
    space: number;
}

export interface RevealRequest {
    keys: string[];
    docTitle: string;
}

/** An HTTP status and the JSON body to send with it. */
export interface BridgeReply {
    status: number;
    body: unknown;
}

export const BAD_REQUEST: BridgeReply = { status: 400, body: { ok: false, error: "bad-request" } };

/** Reply for a failure ebb can explain, which is not an HTTP-level fault. */
export function bridgeError(error: string): BridgeReply {
    return { status: 200, body: { ok: false, error } };
}

const str = (value: unknown): string => (typeof value === "string" ? value : "");

/** The most empty cells a send may ask for below itself. */
const MAX_SPACE = 10;

/** A usable empty-cell count off the wire: whole and in range, else none. */
function space(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value)) return 0;
    return Math.min(MAX_SPACE, Math.max(0, Math.round(value)));
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

/** Null when the body is not a usable `/flow` request. */
export function parseFlowRequest(body: unknown): FlowRequest | null {
    const o = asRecord(body);
    if (!o || !Array.isArray(o.items)) return null;
    const items: FlowItem[] = [];
    for (const raw of o.items) {
        const item = asRecord(raw);
        const text = item ? str(item.text) : "";
        // An item with no text has nothing to write and no cell to hang its
        // provenance on, so it is dropped rather than failing the whole send.
        if (!text) continue;
        items.push({
            kind: str(item?.kind) || "analytic",
            text,
            token: str(item?.source),
            key: str(item?.key),
        });
    }
    if (items.length === 0) return null;
    return {
        mode: o.mode === "cell" ? "cell" : "column",
        docTitle: str(o.docTitle),
        items,
        space: space(o.space),
    };
}

/** Null when the body is not a usable `/reveal` request. */
export function parseRevealRequest(body: unknown): RevealRequest | null {
    const o = asRecord(body);
    if (!o || !Array.isArray(o.keys)) return null;
    const keys = o.keys.filter((k): k is string => typeof k === "string" && k.length > 0);
    if (keys.length === 0) return null;
    return { keys, docTitle: str(o.docTitle) };
}
