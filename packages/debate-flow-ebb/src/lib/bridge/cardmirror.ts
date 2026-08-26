/**
 * Outbound half of the cardmirror-bridge: ebb calling CardMirror.
 *
 * The Rust host owns the transport. It reads CardMirror's handshake files,
 * attaches the session token, and applies the timeout, so the renderer never
 * sees a token or a socket. Everything here is a thin, typed wrapper over
 * those commands, and every failure is a value rather than a throw.
 */

import { isDesktop } from "../update/adapter";

/** A transport failure, distinct from CardMirror answering with an error. */
export type BridgeFailure =
    | "not-registered"
    | "not-running"
    | "timeout"
    | "bad-response"
    | "unsupported";

export type BridgeCall<T> = { ok: true; value: T } | { ok: false; error: BridgeFailure };

/**
 * The types CardMirror's insert route accepts: its five outline heading
 * levels (pocket, hat, block, tag, analytic) plus plain body text. The type
 * travels with the text and CardMirror decides what to make of it; anything
 * it does not know degrades on its side, so ebb only ever sends one of these.
 */
export type CardMirrorTextType = "pocket" | "hat" | "block" | "tag" | "analytic" | "body";

const TEXT_TYPES: readonly string[] = ["pocket", "hat", "block", "tag", "analytic", "body"];

/** A text type from storage or a hand-edited config file. */
export function resolveCardMirrorTextType(value: unknown): CardMirrorTextType {
    return typeof value === "string" && TEXT_TYPES.includes(value)
        ? (value as CardMirrorTextType)
        : "analytic";
}

const FAILURES: Record<string, BridgeFailure> = {
    "not-registered": "not-registered",
    "not-running": "not-running",
    timeout: "timeout",
    "bad-response": "bad-response",
    unsupported: "unsupported",
};

async function call<T>(command: string, args?: Record<string, unknown>): Promise<BridgeCall<T>> {
    if (!isDesktop()) return { ok: false, error: "unsupported" };
    try {
        // Tauri's api package only exists inside the desktop shell; a static
        // import would drag it into the web bundle and break the export.
        const { invoke } = await import("@tauri-apps/api/core");
        return { ok: true, value: await invoke<T>(command, args) };
    } catch (err) {
        // Anything the host did not name is a malformed answer, not a lie.
        return { ok: false, error: FAILURES[String(err)] ?? "bad-response" };
    }
}

/** CardMirror's answer to a route, once the transport succeeded. */
export interface CardMirrorReply {
    ok: boolean;
    error?: string;
    /** Present on `doc-not-open`, so the user can be told what to open. */
    docTitle?: string;
    inserted?: boolean;
    /**
     * `"consent"` means the route is queued behind a consent prompt in
     * CardMirror and answered `ok: true` with nothing done yet. The user's
     * click on Allow replays the queued action, so this is never a retry
     * signal, and never a success either.
     */
    pending?: string;
}

function asReply(value: unknown): CardMirrorReply {
    const o = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    return {
        ok: o.ok === true,
        error: typeof o.error === "string" ? o.error : undefined,
        docTitle: typeof o.docTitle === "string" ? o.docTitle : undefined,
        inserted: o.inserted === true,
        pending: typeof o.pending === "string" ? o.pending : undefined,
    };
}

async function post(
    command: string,
    args: Record<string, unknown>,
): Promise<BridgeCall<CardMirrorReply>> {
    const res = await call<unknown>(command, args);
    return res.ok ? { ok: true, value: asReply(res.value) } : res;
}

/** Scroll CardMirror to the document position a cell came from. */
export function cardmirrorJump(source: string): Promise<BridgeCall<CardMirrorReply>> {
    return post("cardmirror_jump", { source });
}

/** Insert text at the cursor in CardMirror's focused document. */
export function cardmirrorInsert(
    text: string,
    role: CardMirrorTextType,
): Promise<BridgeCall<CardMirrorReply>> {
    return post("cardmirror_insert", { text, role, newParagraph: true });
}
