/**
 * The transport ebb's peers talk over.
 *
 * One port, two adapters: iroh in the desktop shell, and an in-process map for
 * the test suite. Everything above this line - the session, presence, the
 * merge - is written against the port, which is what lets convergence be
 * proven without opening a socket. This mirrors the FlowFs port and
 * flowFsMemory.
 */

import type { ModelCol } from "../grid/colSpace";
import { isDesktop } from "../update/adapter";

import type { Stamp } from "./stamp";
import { isRole, type CollabDoc, type Role } from "./types";

/** Bumped only for a change an older build cannot read. */
export const PROTOCOL_MAJOR = 1;

/**
 * How long a connection may stay open without greeting. Wide enough for a relay
 * to carry the first line across a bad hotel network, and short enough that a
 * stranger who dials in a loop holds a bounded number of slots. It lives beside
 * the protocol because both sides of it - a session and the idle listener - hold
 * a link to a peer that has not spoken yet, and neither owns the other.
 */
export const HANDSHAKE_MS = 10_000;

/** A grid slot a peer is on. */
export interface CellRef {
    sheetId: string;
    col: ModelCol;
    row: number;
}

export type WireMessage =
    | {
          type: "hello";
          protocol: number;
          app: string;
          endpointId: string;
          roundId: string;
          role: Role;
          capabilities: string[];
          /** What the dialler calls this round, for an invite's corner message. */
          label?: string;
          /**
           * What the dialler calls themselves. A suggestion the far side may
           * show and may save; a name a contact already carries wins over it,
           * because that one is the receiver's own word for this peer.
           */
          name?: string;
          /** Present only on the first join, and spent when it is accepted. */
          ticket?: string;
      }
    /**
     * The host answers with its own name, so naming works in both directions,
     * and with the role it granted, which is the only way the guest learns it:
     * a guest asks to be a partner and is admitted as whatever the ticket that
     * let it in says. An ack with no role is an older host, and partner is
     * what every one of those granted.
     */
    | { type: "helloAck"; ok: true; name?: string; role?: Role }
    | { type: "helloAck"; ok: false; reason: string }
    | { type: "state"; doc: CollabDoc }
    | { type: "delta"; doc: CollabDoc }
    /** Per-actor highest stamp seen, so the far side can replay what was lost. */
    | { type: "vector"; seen: Record<string, Stamp> }
    /** The cell an editor is open on, which claims it. */
    | { type: "presence"; cell: CellRef | null }
    /**
     * The cell a cursor is resting on, which claims nothing. Separate from
     * `presence` so a build that predates it drops the message rather than
     * reading a parked cursor as a claim and refusing its own debater's
     * keystrokes.
     */
    | { type: "cursor"; cell: CellRef | null }
    /**
     * The sender has saved this side as a partner, so this side saves them
     * back and the pair is reachable in both directions. Carries the name the
     * sender goes by, which is a suggestion: a name the receiver already saved
     * is the receiver's own word and wins.
     */
    | { type: "contact"; name?: string }
    /**
     * A guest redeeming a pairing code, on the temporary endpoint that code
     * names. It carries a name and nothing else: the guest's EndpointId and
     * its relay are what the connection itself proves, and an address a peer
     * reports about itself is one it could have made up.
     */
    | { type: "pairHello"; name?: string }
    /**
     * The host's answer: the ticket that opens the round, and who is offering
     * it. Everything after this is the protocol that already exists.
     */
    | { type: "pairAck"; ticket: string; name?: string; roundLabel?: string }
    | { type: "bye" };

/**
 * A field long enough for any round name or display name a debater types, and
 * short enough that a peer cannot use one as somewhere to put a payload.
 */
const MAX_FIELD = 256;

type Hello = Extract<WireMessage, { type: "hello" }>;
type HelloAck = Extract<WireMessage, { type: "helloAck" }>;
type DocMessage = Extract<WireMessage, { type: "state" | "delta" }>;
type VectorMessage = Extract<WireMessage, { type: "vector" }>;
type PositionMessage = Extract<WireMessage, { type: "presence" | "cursor" }>;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isField(value: unknown): value is string {
    return typeof value === "string" && value.length <= MAX_FIELD;
}

function isOptionalField(value: unknown): value is string | undefined {
    return value === undefined || isField(value);
}

/** A non-negative integer, which is what a protocol major and an index both are. */
function isCount(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * A stamp a clock could have produced. `NaN`, `Infinity` and 2^53 are all
 * `typeof "number"`, and every one of them either wins the total order below
 * forever or pins the local clock where a later write cannot climb past it.
 */
function isStamp(value: unknown): value is Stamp {
    return (
        isRecord(value) &&
        Number.isSafeInteger(value.ms) &&
        (value.ms as number) >= 0 &&
        Number.isSafeInteger(value.counter) &&
        (value.counter as number) >= 0 &&
        isField(value.actor)
    );
}

/**
 * A cell a peer claims, and nothing that only looks like one. The column is
 * checked as a plain count and named a model column by the predicate alone: a
 * peer speaks in cells, so what arrives is a model column whatever this side's
 * alignment happens to be.
 */
export function isCellRef(value: unknown): value is CellRef {
    return isRecord(value) && isField(value.sheetId) && isCount(value.col) && isCount(value.row);
}

function isHello(m: Record<string, unknown>): m is Hello {
    return (
        m.type === "hello" &&
        isCount(m.protocol) &&
        isField(m.app) &&
        isField(m.endpointId) &&
        isField(m.roundId) &&
        isRole(m.role) &&
        Array.isArray(m.capabilities) &&
        m.capabilities.every(isField) &&
        isOptionalField(m.ticket) &&
        isOptionalField(m.label) &&
        isOptionalField(m.name)
    );
}

function isHelloAck(m: Record<string, unknown>): m is HelloAck {
    if (m.type !== "helloAck") return false;
    if (m.ok === true) return isOptionalField(m.name) && (m.role === undefined || isRole(m.role));
    return m.ok === false && isField(m.reason);
}

/**
 * `JSON.parse` makes `__proto__` an own enumerable key, so a peer's map key
 * survives `Object.entries` and reaches a bracket assignment on a plain object
 * literal. `[[Set]]` finds `Object.prototype`'s accessor there and swaps that
 * record's own prototype: the entry is then invisible to every reader of the
 * map, and the next read of a real field on it throws. No map in a document has
 * a use for the name.
 */
function isCleanMap(value: unknown): value is Record<string, unknown> {
    return isRecord(value) && !Object.hasOwn(value, "__proto__");
}

/**
 * The characters one replicated value may carry.
 *
 * Set past anything the debater's own writing reaches, because refusing a value
 * refuses the whole document message it rides in, and every later delta carries
 * that value again: `deltaSince` ships any register the far side has not
 * acknowledged, and the far side never acknowledges a message it dropped. So a
 * cap a debater's own content can reach ends shared editing for the round in
 * that direction, silently and for good. A flow cell is a line of a speech and
 * a debater pastes a whole card into one; a decision is prose a judge writes at
 * length. A megabyte is orders past either, and still a quarter of the 4 MiB
 * line the shell reads at all, which is the bound that holds a message.
 *
 * Deliberately not sized to the smallest share a sheet's grid is projected
 * under. A value too long for that share costs its own row off the bottom of
 * the sheet, which is a clamp the next projection undoes once the round has
 * room again; a refusal here is neither reported nor recoverable.
 */
const MAX_VALUE = 1024 * 1024;

/**
 * A value the file can carry: short enough for the budget the projection spends
 * on it, and shallow enough to write at all. `JSON.parse` accepts nesting far
 * past what `JSON.stringify` will walk, and every writer below this line is a
 * stringify - the flow file, the sidecar, the next delta - so a value that
 * cannot be written back out is refused here rather than thrown in the save
 * path.
 */
function fits(value: unknown): boolean {
    try {
        return (JSON.stringify(value) ?? "").length <= MAX_VALUE;
    } catch {
        return false;
    }
}

/**
 * A register the merge and the projection each dereference the moment a
 * document lands: `mergeRegisters` compares its stamp and the projection writes
 * its value into the file whole. Checked for shape rather than for a stamp a
 * clock could have produced, because the order is deliberately written to
 * survive a count it does not recognize.
 */
function isRegister(value: unknown): boolean {
    return isRecord(value) && isRecord(value.stamp) && fits(value.value);
}

/**
 * A cell as every reader of one already assumes it is.
 *
 * `vectorOf` walks both stamps the moment a document lands, `firstDelete`
 * compares `deleted` against the local cell's, `mergeSheet` trims `text` to
 * name a burial, and the projection reads `meta` before it checks it and then
 * writes it to the file whole. A cell that is missing one of them is admitted
 * into the replica, kept in the sidecar, and throws in every later projection
 * or merge of that round: a denial the restart meant to clear it carries back
 * in. An absent `deleted` is the quiet one - it reads as neither alive nor
 * deleted, so the cell projects nowhere until the next delete throws on it.
 */
function isCell(value: unknown): boolean {
    return (
        isRecord(value) &&
        isRecord(value.textStamp) &&
        isRecord(value.metaStamp) &&
        (value.deleted === null || isRecord(value.deleted)) &&
        (value.text === null || typeof value.text === "string") &&
        isCleanMap(value.meta) &&
        fits(value.text) &&
        fits(value.meta)
    );
}

/**
 * A document as the merge, the vector and the projection all read it. The merge
 * is written to survive a register it does not recognize, but the vector walks
 * `round`, `sheets` and every sheet's own maps the moment the message lands and
 * throws when one of them is absent or carries a prototype key. A sheet's own
 * `deleted` is the same shape as a cell's and is read the same way: absent, it
 * takes the debater's sheet out of every projection of the round and out of the
 * file the autosave writes next.
 */
function isDocMessage(m: Record<string, unknown>): m is DocMessage {
    if (m.type !== "state" && m.type !== "delta") return false;
    const doc = m.doc;
    if (!isRecord(doc) || typeof doc.roundId !== "string") return false;
    if (!isCleanMap(doc.round) || !isCleanMap(doc.sheets)) return false;
    if (!Object.values(doc.round).every(isRegister)) return false;
    return Object.values(doc.sheets).every(
        (sheet) =>
            isRecord(sheet) &&
            (sheet.deleted === null || isRecord(sheet.deleted)) &&
            isCleanMap(sheet.fields) &&
            isCleanMap(sheet.cells) &&
            Object.values(sheet.fields).every(isRegister) &&
            Object.values(sheet.cells).every(isCell),
    );
}

function isVector(m: Record<string, unknown>): m is VectorMessage {
    return m.type === "vector" && isRecord(m.seen) && Object.values(m.seen).every(isStamp);
}

function isPosition(m: Record<string, unknown>): m is PositionMessage {
    return (m.type === "presence" || m.type === "cursor") && (m.cell === null || isCellRef(m.cell));
}

/**
 * A ticket is base64url of JSON behind a prefix. Far longer than any other
 * field here, and still bounded: what arrives on this channel is handed to a
 * parser and then to a dial.
 */
const MAX_TICKET = 4096;

function isPairAck(m: Record<string, unknown>): boolean {
    return (
        typeof m.ticket === "string" &&
        m.ticket.length > 0 &&
        m.ticket.length <= MAX_TICKET &&
        isOptionalField(m.name) &&
        isOptionalField(m.roundLabel)
    );
}

/**
 * The message a peer sent, or null for anything that does not conform to its
 * variant.
 *
 * Everything above the transport dereferences these fields without asking: a
 * `state` carrying no document throws where the vector is taken, and a `hello`
 * whose ticket is an array throws inside the secret comparison. A peer chooses
 * every byte of what it sends, so the shape is established at the edge and a
 * message that is not one is dropped rather than acted on.
 */
export function parseWireMessage(raw: unknown): WireMessage | null {
    if (!isRecord(raw)) return null;
    switch (raw.type) {
        case "hello":
            return isHello(raw) ? raw : null;
        case "helloAck":
            return isHelloAck(raw) ? raw : null;
        case "state":
        case "delta":
            return isDocMessage(raw) ? raw : null;
        case "vector":
            return isVector(raw) ? raw : null;
        case "presence":
        case "cursor":
            return isPosition(raw) ? raw : null;
        case "contact":
            // Rebuilt rather than passed through, so nothing else a sender put
            // on the object survives into a message the app treats as one.
            return isOptionalField(raw.name)
                ? { type: "contact", ...(raw.name === undefined ? {} : { name: raw.name }) }
                : null;
        case "pairHello":
            return isOptionalField(raw.name)
                ? { type: "pairHello", ...(raw.name === undefined ? {} : { name: raw.name }) }
                : null;
        case "pairAck":
            return isPairAck(raw)
                ? {
                      type: "pairAck",
                      ticket: raw.ticket as string,
                      ...(raw.name === undefined ? {} : { name: raw.name as string }),
                      ...(raw.roundLabel === undefined
                          ? {}
                          : { roundLabel: raw.roundLabel as string }),
                  }
                : null;
        case "bye":
            return { type: "bye" };
        default:
            return null;
    }
}

export interface PeerLinkConfig {
    /**
     * DNS discovery is not an option here. An idle ebb publishes nothing about
     * itself anywhere; mDNS reaches the machine across the room and nothing
     * further.
     */
    discovery: "off" | "mdns";
    /** Follows the Allow relay setting. Off restricts a session to direct links. */
    relay: boolean;
}

export interface PeerConn {
    /** The far side's EndpointId. */
    id: string;
    connectionType(): "direct" | "relayed";
    /**
     * The relay the far side is homed on, when the transport could say. The
     * one piece of addressing that outlives the connection: an EndpointId
     * names a peer and does not route to them, and the only lookup this build
     * runs is mDNS, which answers across a room and no further. Saved with a
     * contact, it is what makes the same partner reachable from a hotel.
     */
    relayUrl(): string | null;
    /**
     * Takes an accepted connection for this window, which is what admitting
     * its peer means.
     *
     * Every window hears every accepted connection, because the round one
     * belongs to arrives in its hello and the shell reads no further than the
     * bytes. A window that is not hosting that round answers with a refusal
     * and hangs up, so writing cannot be what decides ownership: whichever
     * handler ran first would win, and a refusal would take a guest away from
     * the window admitting them. Only admission claims.
     *
     * Absent on a transport with no shell in front of it, where a connection
     * has exactly one window and nothing to take it from.
     */
    claim?(): void;
    send(msg: WireMessage): void;
    onMessage(cb: (msg: WireMessage) => void): void;
    onClose(cb: () => void): void;
    close(): void;
}

export interface PeerLink {
    endpointId(): Promise<string>;
    /**
     * Where this endpoint can be reached from another network, for the ticket
     * that carries it. Empty for every reason there is nothing to say:
     * relaying is off, no relay answered, or the transport has no such notion.
     */
    relayUrl(): Promise<string>;
    listen(onPeer: (peer: PeerConn) => void): Promise<void>;
    /**
     * The relay is where to send the first packet and never a permission to
     * talk: no secret rides along, because a ticket is spent in the hello,
     * above this line, and a credential here would tell a reader the dial
     * itself was authorized. Omitted, the dial reaches whatever mDNS and the
     * transport's own address book can find, which is one room.
     */
    dial(endpointId: string, relayUrl?: string | null): Promise<PeerConn>;
    /**
     * A fresh pairing code. Minted where the alphabet lives, which is the same
     * place the derivation does: two implementations of one derivation drift,
     * and a code this side would not accept back is one a partner cannot use.
     */
    newCode(): Promise<string>;
    /**
     * Binds the temporary endpoint a code names and answers on it, handing
     * back that endpoint's id. A second call replaces the first: one code is
     * on the air at a time.
     */
    pairHost(code: string, onPeer: (peer: PeerConn) => void): Promise<string>;
    /**
     * Dials the endpoint a code names, from this link's own endpoint. The code
     * is the whole address, so nothing else is passed and nothing is looked up.
     */
    pairDial(code: string): Promise<PeerConn>;
    /** Takes the pairing endpoint off the air. A no-op when there is none. */
    pairStop(): Promise<void>;
    stop(): Promise<void>;
}

/** Anything that can hand back a link for a configuration. */
export type PeerLinkFactory = (config: PeerLinkConfig) => Promise<PeerLink>;

/**
 * The pairing half of a link, for code that has been handed a transport and
 * has no business re-deciding where it came from.
 */
export type PairingPort = Pick<PeerLink, "newCode" | "pairHost" | "pairDial" | "pairStop">;

/**
 * The transport for a session: iroh, in the desktop shell, and nowhere else.
 * Resolved per call rather than cached, because a session binds an endpoint
 * and stopping it must actually release it.
 *
 * There is no web answer to this and there should not be one. Shared editing
 * is an iroh endpoint, which a browser cannot bind; a stand-in that satisfied
 * the port would mint tickets nobody can redeem and report a session to a
 * debater who has none. `collabLive()` is what keeps this from being called
 * off the desktop, and the throw is what says so if that ever slips.
 */
export async function createPeerLinkFor(config: PeerLinkConfig): Promise<PeerLink> {
    if (!isDesktop()) throw new Error("Shared editing needs the desktop app");
    // Dynamic so the web bundle never pulls in Tauri's JS API, matching how
    // every other desktop touchpoint is gated.
    const mod = await import("./peerLinkTauri");
    return mod.createPeerLink(config);
}
