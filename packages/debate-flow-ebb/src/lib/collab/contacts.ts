/**
 * The peers a debater has shared with before.
 *
 * A contact exists so nobody retypes a key to reach a partner twice: entries
 * are saved with one click after a session, or added by hand from an
 * EndpointId a partner sent, and an EndpointId is stable per install, so the
 * same partner is reachable the next time with no ticket at all.
 *
 * A contact is a partner and nothing narrower. What that partner may do is a
 * property of the round they are invited to, chosen at the invitation and
 * recorded beside the round, so the same person can be writing one flow and
 * reading another. A grade here would be one global row frozen at the first
 * save, and two debaters who each saved the other differently would disagree
 * about what the pair is.
 *
 * The table is keyed by EndpointId and lives in the config file, which is
 * hand-editable and synced between machines. So parsing is total: anything
 * unrecognizable degrades to absent rather than to a half-valid contact.
 */

export interface Contact {
    name: string;
    /**
     * Where this peer was last found. An EndpointId names them and does not
     * route to them, and the only lookup this build runs is mDNS, so without
     * this a saved partner is dialable across the room and nowhere else.
     * Absent for a contact typed in by hand, and for one saved before this
     * was recorded, both of which are reachable in the room as they were.
     */
    relay?: string;
}

/** EndpointId to contact. */
export type Contacts = Record<string, Contact>;

/** How much of an EndpointId is worth showing when there is no name. */
const SHORT_ID = 8;

/** No relay this build reaches is anywhere near this; a longer one is a payload. */
const MAX_RELAY_URL = 256;

/**
 * What iroh will parse back into a key: 64 characters of hex, which is what
 * an endpoint prints, or the 52-character base32 form it also accepts. Only
 * shape is checked here; whether those bytes decompress to a real point is
 * the transport's answer, not a form's.
 */
export function isEndpointId(value: string): boolean {
    return /^[0-9a-f]{64}$/i.test(value) || /^[a-z2-7]{52}$/i.test(value);
}

/**
 * A relay URL this build would dial: https, because that is what an iroh
 * relay is and anything else is a scheme somebody chose for this app to
 * fetch, and short enough that it is an address rather than a payload. No
 * relay this build reaches is anywhere near the cap.
 */
export function isRelayUrl(value: unknown): value is string {
    return (
        typeof value === "string" && value.length <= MAX_RELAY_URL && value.startsWith("https://")
    );
}

/** A contact table from whatever the config file held. */
export function resolveContacts(raw: unknown): Contacts {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {};
    // Null-prototyped, because the keys come from a file the user can hand-edit
    // and every lookup below this line is by an id a peer chose. Nothing on
    // Object.prototype can be reached through it, whatever the file said.
    const out = Object.create(null) as Contacts;
    for (const [endpointId, value] of Object.entries(raw as Record<string, unknown>)) {
        // A key that is not shaped like an EndpointId can never match the peer
        // the transport authenticated, so it is a typo at best and a reach at
        // "__proto__" at worst.
        if (!isEndpointId(endpointId)) continue;
        if (value === null || typeof value !== "object") continue;
        const entry = value as Partial<Contact>;
        if (typeof entry.name !== "string" || entry.name.trim() === "") continue;
        // A dial target, so a scheme somebody chose by hand is not one: an
        // iroh relay is https. Dropped rather than refused, because it is
        // where this contact is and not whether they may be reached at all.
        const relay = isRelayUrl(entry.relay) ? entry.relay : undefined;
        out[endpointId] = relay ? { name: entry.name, relay } : { name: entry.name };
    }
    return out;
}

export function addContact(contacts: Contacts, endpointId: string, contact: Contact): Contacts {
    return { ...contacts, [endpointId]: contact };
}

export function removeContact(contacts: Contacts, endpointId: string): Contacts {
    if (!(endpointId in contacts)) return contacts;
    const { [endpointId]: _gone, ...rest } = contacts;
    return rest;
}

/**
 * The contact saved under this id, if there is one.
 *
 * An EndpointId arrives off the wire, and `in` and a plain index both walk the
 * prototype chain: `constructor` and `__proto__` are on every object, so a
 * stranger naming one would read as a saved partner and earn everything a
 * saved partner gets, starting with a message on the debater's screen.
 */
export function contactOf(contacts: Contacts, endpointId: string): Contact | undefined {
    return Object.prototype.hasOwnProperty.call(contacts, endpointId)
        ? contacts[endpointId]
        : undefined;
}

/**
 * What to call this peer on screen: the name the receiver saved, then the one
 * the peer broadcast, then the short id. A saved name wins because it is the
 * receiver's own word for this peer, and a peer cannot rename themselves out
 * from under it mid-round.
 */
export function contactName(contacts: Contacts, endpointId: string, broadcast?: string): string {
    return (
        contactOf(contacts, endpointId)?.name ??
        (broadcast?.trim() || endpointId.slice(0, SHORT_ID))
    );
}

export function isKnown(contacts: Contacts, endpointId: string): boolean {
    return contactOf(contacts, endpointId) !== undefined;
}
