/**
 * Who may join, and what they are allowed to do.
 *
 * Three rules carry the weight. A single-use secret admits the first peer that
 * presents it, and that peer's EndpointId admits it forever after, which is
 * what turns every later reconnect into no interaction at all. An unknown peer
 * with no valid secret is refused with no UI whatsoever: otherwise anyone who
 * learns your EndpointId can put notifications on your screen mid-round. And
 * every one of those decisions is made about the endpoint the transport
 * authenticated, never the one the hello claims to come from.
 */

import { INVITED } from "./invite";
import { PROTOCOL_MAJOR, type WireMessage } from "./peerLink";
import { isRole, type Role } from "./types";

export interface HostPolicy {
    /** The only round this host will talk about. */
    roundId: string;
    /**
     * The unspent ticket, and what it grants. The role is the host's to give:
     * a viewer's ticket admits a viewer however the guest introduces itself.
     */
    pending: { secret: string; role: Role } | null;
    /** Peers already admitted once, which need no secret again. */
    knownPeers: string[];
    /**
     * What an already-known peer was admitted as. Absent means read-only: the
     * round's record of membership is durable and a grant is not, so the
     * direction a missing grade resolves in is inward.
     */
    roles: Record<string, Role>;
}

/**
 * Every refusal that crosses the wire, and no free text.
 *
 * The far side chooses this string, and a dialler that repeated it would be
 * putting a hostile host's words on a debater's screen. A closed set is what
 * lets the dialler tell a version skew from a plain no while saying it in its
 * own words.
 */
export type RefusalCode = typeof INVITED | typeof REFUSED | typeof VERSION_SKEW;

export const REFUSED = "refused";
export const VERSION_SKEW = "version";

export type Admission =
    | { ok: true; role: Role; spendSecret: boolean }
    /** `silent` suppresses every surface, down to a chip flicker. */
    | { ok: false; reason: RefusalCode; silent: boolean };

/**
 * A refusal in this side's own words. Only the invite sentinel travels
 * intact, because the invite flow answers it rather than showing it.
 */
export function refusalMessage(reason: string): string {
    if (reason === INVITED) return INVITED;
    if (reason === VERSION_SKEW) return "That peer is on a different version of ebb";
    return "That peer refused the connection";
}

export function helloFrom(input: {
    endpointId: string;
    roundId: string;
    role: Role;
    appVersion: string;
    ticket?: string;
    /** What this side calls the round, so an invite can name it. */
    label?: string;
    /** What this side calls itself, so a peer has something to save. */
    name?: string;
}): WireMessage {
    const hello: Extract<WireMessage, { type: "hello" }> = {
        type: "hello",
        protocol: PROTOCOL_MAJOR,
        app: input.appVersion,
        endpointId: input.endpointId,
        roundId: input.roundId,
        role: input.role,
        // Shipped from day one so the first real skew can be negotiated
        // instead of refused.
        capabilities: [],
    };
    if (input.label) hello.label = input.label;
    if (input.name) hello.name = input.name;
    return input.ticket ? { ...hello, ticket: input.ticket } : hello;
}

/**
 * Compares without leaking how far the match got. A wrong guess should tell an
 * attacker nothing beyond "wrong", which is the standard the loopback bridge
 * is already held to.
 */
function secretMatches(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

const SILENT: Admission = { ok: false, reason: REFUSED, silent: true };

/**
 * What this host granted a peer, or nothing at all.
 *
 * An EndpointId arrives off the wire and a plain index walks the prototype
 * chain, so `constructor` and `toString` answer with a function that is neither
 * a role nor absent - which reads as a grant nobody made and fails open.
 */
export function grantedRole(policy: HostPolicy, peer: string): Role | undefined {
    return Object.prototype.hasOwnProperty.call(policy.roles, peer)
        ? policy.roles[peer]
        : undefined;
}

/**
 * `remoteId` is the endpoint the transport authenticated: iroh proved the far
 * side holds that key before a byte of this message existed. `msg.endpointId`
 * is a string the far side typed. They must agree, or the peer is claiming to
 * be somebody else and every later decision - who is admitted, whose name the
 * chip shows, whose reasoning a note is filed under - would be about the
 * wrong person.
 */
export function admit(msg: WireMessage, policy: HostPolicy, remoteId: string): Admission {
    if (msg.type !== "hello") return SILENT;
    if (!isRole(msg.role)) return SILENT;
    if (msg.roundId !== policy.roundId) return SILENT;
    if (msg.endpointId !== remoteId) return SILENT;

    let granted: Admission;
    if (policy.knownPeers.includes(remoteId)) {
        // A peer the round remembers and nobody graded gets the narrower
        // grant. Every path that admits one records what it granted, so this
        // is the backstop for a key that reached the list some other way,
        // where the safe answer is the role that writes nothing.
        granted = { ok: true, role: grantedRole(policy, remoteId) ?? "viewer", spendSecret: false };
    } else if (policy.pending && msg.ticket && secretMatches(msg.ticket, policy.pending.secret)) {
        // The role the host granted, never the one the guest asked for.
        granted = { ok: true, role: policy.pending.role, spendSecret: true };
    } else {
        return SILENT;
    }

    // A version skew is the one refusal a debater is told about, because the
    // fix is theirs to make. It comes last: this build's version is something
    // a caller earns by proving it belongs on this round, not something a
    // stranger collects by dialling and saying any number at all. The secret
    // stays unspent, so the same ticket still works once they upgrade.
    if (msg.protocol !== PROTOCOL_MAJOR) {
        return { ok: false, reason: VERSION_SKEW, silent: false };
    }
    return granted;
}
