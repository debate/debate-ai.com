import { describe, expect, it } from "vitest";
import {
    addContact,
    contactName,
    contactOf,
    isEndpointId,
    isKnown,
    isRelayUrl,
    removeContact,
    resolveContacts,
    type Contacts,
} from "../src/lib/collab/contacts";

const ID_A = "a".repeat(64);
const ID_B = "b3".repeat(32);
const ID_B32 = "abcdefghijklmnopqrstuvwxyz234567abcdefghijklmnopqrst";

describe("isEndpointId", () => {
    it("accepts the 64-character hex form an endpoint prints", () => {
        expect(isEndpointId(ID_A)).toBe(true);
        expect(isEndpointId(ID_A.toUpperCase())).toBe(true);
    });

    it("accepts the 52-character base32 form iroh also takes", () => {
        expect(isEndpointId(ID_B32)).toBe(true);
    });

    it("rejects the wrong length", () => {
        expect(isEndpointId("a".repeat(63))).toBe(false);
        expect(isEndpointId("a".repeat(65))).toBe(false);
        expect(isEndpointId("")).toBe(false);
    });

    it("rejects characters outside either alphabet", () => {
        expect(isEndpointId("g".repeat(64))).toBe(false);
        expect(isEndpointId("1".repeat(52))).toBe(false);
    });

    it("rejects the prototype keys a stranger might name", () => {
        expect(isEndpointId("__proto__")).toBe(false);
        expect(isEndpointId("constructor")).toBe(false);
    });
});

describe("isRelayUrl", () => {
    it("accepts an https relay, which is what an iroh relay is", () => {
        expect(isRelayUrl("https://relay.example.com")).toBe(true);
    });

    it("rejects a scheme somebody chose for the app to fetch", () => {
        expect(isRelayUrl("http://relay.example.com")).toBe(false);
        expect(isRelayUrl("file:///etc/passwd")).toBe(false);
        expect(isRelayUrl("javascript:alert(1)")).toBe(false);
    });

    it("rejects an address long enough to be a payload", () => {
        expect(isRelayUrl(`https://${"a".repeat(300)}`)).toBe(false);
    });

    it("rejects a non-string", () => {
        expect(isRelayUrl(null)).toBe(false);
        expect(isRelayUrl(42)).toBe(false);
    });
});

describe("resolveContacts", () => {
    it("keeps a well-formed entry", () => {
        const out = resolveContacts({ [ID_A]: { name: "Ada", relay: "https://r.example" } });
        expect(out[ID_A]).toEqual({ name: "Ada", relay: "https://r.example" });
    });

    it("keeps a contact typed in by hand, with no relay recorded", () => {
        expect(resolveContacts({ [ID_A]: { name: "Ada" } })[ID_A]).toEqual({ name: "Ada" });
    });

    it("drops a relay the build would not dial, keeping the contact", () => {
        const out = resolveContacts({ [ID_A]: { name: "Ada", relay: "http://r.example" } });
        expect(out[ID_A]).toEqual({ name: "Ada" });
    });

    it("drops a key that is not shaped like an endpoint", () => {
        expect(resolveContacts({ ada: { name: "Ada" } })).toEqual({});
    });

    it("drops an entry with no usable name", () => {
        expect(resolveContacts({ [ID_A]: { name: "  " } })).toEqual({});
        expect(resolveContacts({ [ID_A]: { name: 7 } })).toEqual({});
        expect(resolveContacts({ [ID_A]: {} })).toEqual({});
    });

    it("drops an entry that is not an object", () => {
        expect(resolveContacts({ [ID_A]: "Ada" })).toEqual({});
        expect(resolveContacts({ [ID_A]: null })).toEqual({});
    });

    it("degrades a table that is not one to empty", () => {
        expect(resolveContacts(null)).toEqual({});
        expect(resolveContacts([])).toEqual({});
        expect(resolveContacts("contacts")).toEqual({});
        expect(resolveContacts(undefined)).toEqual({});
    });

    it("returns a table with no prototype, whatever the file said", () => {
        const out = resolveContacts({ [ID_A]: { name: "Ada" } });
        expect(Object.getPrototypeOf(out)).toBeNull();
        expect((out as Record<string, unknown>).toString).toBeUndefined();
    });

    it("keeps every well-formed entry of a table", () => {
        const out = resolveContacts({
            [ID_A]: { name: "Ada" },
            [ID_B]: { name: "Grace" },
            nope: { name: "Mallory" },
        });
        expect(Object.keys(out).sort()).toEqual([ID_A, ID_B].sort());
    });
});

describe("addContact and removeContact", () => {
    const base: Contacts = { [ID_A]: { name: "Ada" } };

    it("adds a contact without touching the table it was given", () => {
        const next = addContact(base, ID_B, { name: "Grace" });
        expect(next[ID_B]).toEqual({ name: "Grace" });
        expect(base[ID_B]).toBeUndefined();
    });

    it("replaces a contact already saved under that id", () => {
        expect(addContact(base, ID_A, { name: "Ada L" })[ID_A]).toEqual({ name: "Ada L" });
    });

    it("removes a contact without touching the table it was given", () => {
        const next = removeContact(base, ID_A);
        expect(next[ID_A]).toBeUndefined();
        expect(base[ID_A]).toEqual({ name: "Ada" });
    });

    it("hands the same table back when there is nothing to remove", () => {
        expect(removeContact(base, ID_B)).toBe(base);
    });
});

describe("contactOf", () => {
    const contacts: Contacts = { [ID_A]: { name: "Ada" } };

    it("finds a saved partner", () => {
        expect(contactOf(contacts, ID_A)).toEqual({ name: "Ada" });
    });

    it("is undefined for a stranger", () => {
        expect(contactOf(contacts, ID_B)).toBeUndefined();
    });

    it("does not read a prototype key as a saved partner", () => {
        for (const reach of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
            expect(contactOf(contacts, reach)).toBeUndefined();
            expect(isKnown(contacts, reach)).toBe(false);
        }
    });
});

describe("contactName", () => {
    const contacts: Contacts = { [ID_A]: { name: "Ada" } };

    it("prefers the name the receiver saved", () => {
        expect(contactName(contacts, ID_A, "Mallory")).toBe("Ada");
    });

    it("falls back to the name the peer broadcast", () => {
        expect(contactName(contacts, ID_B, "Grace")).toBe("Grace");
    });

    it("falls back to a short id when the peer broadcast nothing usable", () => {
        expect(contactName(contacts, ID_B)).toBe(ID_B.slice(0, 8));
        expect(contactName(contacts, ID_B, "   ")).toBe(ID_B.slice(0, 8));
    });

    it("does not let a stranger naming a prototype key borrow a name", () => {
        expect(contactName(contacts, "constructor", "Mallory")).toBe("Mallory");
    });
});

describe("isKnown", () => {
    it("reports whether a peer has been shared with before", () => {
        const contacts: Contacts = { [ID_A]: { name: "Ada" } };
        expect(isKnown(contacts, ID_A)).toBe(true);
        expect(isKnown(contacts, ID_B)).toBe(false);
    });
});
