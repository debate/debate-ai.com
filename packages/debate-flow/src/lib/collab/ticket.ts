/**
 * The one-time authorization a host hands a guest.
 *
 * A ticket carries the host's EndpointId, where that host can be reached, the
 * round it opens, the role it grants, a single-use secret, and whether the
 * host will accept a relayed link. The secret admits the first peer that
 * presents it and is then spent; that peer authenticates by EndpointId from
 * then on, which is what makes every later reconnect silent.
 *
 * It is base64url of JSON behind a named prefix rather than a bespoke binary
 * format: a debater can see what they pasted, a support question can be
 * answered by eye, and a later format can be told apart by its prefix.
 */

import { isEndpointId, isRelayUrl } from "./contacts";
import { isRole, type Role } from "./types";

export const TICKET_PREFIX = "ebb1:";

/** Long enough that guessing is not a strategy: 62^24 is about 143 bits. */
const SECRET_LENGTH = 24;
const SECRET_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
/** Any round id this build mints is far shorter; a longer one is a payload. */
const MAX_ROUND_ID = 128;

export interface Ticket {
    endpointId: string;
    roundId: string;
    role: Role;
    secret: string;
    /** Whether the host will accept a relayed link for this session. */
    relay: boolean;
    /**
     * The relay the host is homed on, when it has one.
     *
     * An EndpointId names the host and does not route to them: the only lookup
     * this build runs is mDNS, which answers across a room and no further, so
     * without this a ticket sent to a partner on another network is a name the
     * guest can never send a packet to. It is a relay and not an address on
     * purpose - the host's own IPs are the host's to disclose, and a first
     * packet over the relay is enough for the two sides to find each other
     * directly from there.
     *
     * Absent when the host is running with relaying off, which is a round
     * shareable across the room and not across the country.
     */
    relayUrl?: string;
}

function randomSecret(): string {
    const bytes = new Uint8Array(SECRET_LENGTH);
    crypto.getRandomValues(bytes);
    let out = "";
    for (const b of bytes) out += SECRET_ALPHABET[b % SECRET_ALPHABET.length];
    return out;
}

export function mintTicket(
    input: {
        endpointId: string;
        roundId: string;
        role: Role;
        relay: boolean;
        relayUrl?: string;
    },
    random: () => string = randomSecret,
): Ticket {
    // Dropped rather than carried empty: the host has no relay to name, and a
    // blank field in a pasted ticket reads as a broken one.
    const { relayUrl, ...rest } = input;
    return relayUrl ? { ...rest, relayUrl, secret: random() } : { ...rest, secret: random() };
}

export function encodeTicket(ticket: Ticket): string {
    const b64 = btoa(JSON.stringify(ticket))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    return TICKET_PREFIX + b64;
}

/**
 * The ticket, or null for everything that cannot be fully trusted. The next
 * thing that happens to a parsed ticket is a dial, so a field this build would
 * have to guess at is a refusal rather than a default.
 */
export function parseTicket(text: string): Ticket | null {
    const trimmed = text.trim();
    if (!trimmed.startsWith(TICKET_PREFIX)) return null;
    const b64 = trimmed.slice(TICKET_PREFIX.length).replace(/-/g, "+").replace(/_/g, "/");

    let raw: unknown;
    try {
        raw = JSON.parse(atob(b64));
    } catch {
        return null;
    }
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;

    const t = raw as Partial<Ticket>;
    // The endpoint is a dial target the moment this returns, and a ticket is
    // pasted from wherever the debater found it. Anything iroh could not have
    // issued is a string somebody wrote, not a peer.
    if (typeof t.endpointId !== "string" || !isEndpointId(t.endpointId)) return null;
    if (typeof t.roundId !== "string" || t.roundId === "") return null;
    if (t.roundId.length > MAX_ROUND_ID) return null;
    if (!isRole(t.role)) return null;
    if (typeof t.secret !== "string" || t.secret.length !== SECRET_LENGTH) return null;

    // Where the host says it can be found. A hint and not a permission, so a
    // ticket without one still opens the round for a guest in the same room;
    // https alone because that is what an iroh relay is, and anything else is
    // a scheme somebody chose for this app to fetch.
    const relayUrl = isRelayUrl(t.relayUrl) ? t.relayUrl : undefined;

    const ticket: Ticket = {
        endpointId: t.endpointId,
        roundId: t.roundId,
        role: t.role,
        secret: t.secret,
        // A ticket that does not say gets the answer that reaches no relay.
        relay: t.relay === true,
    };
    return relayUrl ? { ...ticket, relayUrl } : ticket;
}
