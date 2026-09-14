/**
 * @fileoverview Who may join a shared round, and what they may do.
 *
 * The three rules the module names carry the weight, and each is a security
 * property rather than a convenience: a single-use secret admits one peer and
 * their key admits them forever after; an unknown peer with no valid secret is
 * refused with no surface at all, so learning an EndpointId does not buy you a
 * notification on somebody's screen mid-round; and every decision is made about
 * the endpoint the transport authenticated, never the one the hello claims.
 */

import { describe, expect, it } from "vitest";
import {
    REFUSED,
    VERSION_SKEW,
    admit,
    grantedRole,
    helloFrom,
    refusalMessage,
    type HostPolicy,
} from "../src/lib/collab/handshake";
import { INVITED } from "../src/lib/collab/invite";
import { PROTOCOL_MAJOR, type WireMessage } from "../src/lib/collab/peerLink";

const GUEST = "b".repeat(64);
const STRANGER = "c".repeat(64);
const SECRET = "S".repeat(24);

const policy = (over: Partial<HostPolicy> = {}): HostPolicy => ({
    roundId: "round-1",
    pending: { secret: SECRET, role: "editor" },
    knownPeers: [],
    roles: {},
    ...over,
});

const hello = (over: Record<string, unknown> = {}): WireMessage =>
    ({
        type: "hello",
        protocol: PROTOCOL_MAJOR,
        app: "1.0.0",
        endpointId: GUEST,
        roundId: "round-1",
        role: "editor",
        capabilities: [],
        ...over,
    }) as WireMessage;

describe("helloFrom", () => {
    const base = {
        endpointId: GUEST,
        roundId: "round-1",
        role: "editor" as const,
        appVersion: "1.2.3",
    };

    it("names the protocol, the app, the endpoint, the round and the role", () => {
        expect(helloFrom(base)).toMatchObject({
            type: "hello",
            protocol: PROTOCOL_MAJOR,
            app: "1.2.3",
            endpointId: GUEST,
            roundId: "round-1",
            role: "editor",
        });
    });

    it("ships a capability list from day one, so a skew can be negotiated", () => {
        expect((helloFrom(base) as { capabilities: string[] }).capabilities).toEqual([]);
    });

    it("carries the ticket when there is one", () => {
        expect(helloFrom({ ...base, ticket: SECRET })).toMatchObject({ ticket: SECRET });
    });

    it("leaves the ticket out entirely when there is none", () => {
        expect("ticket" in helloFrom(base)).toBe(false);
    });

    it("carries the round's label and this side's name when given", () => {
        const out = helloFrom({ ...base, label: "Round 3", name: "Ada" });
        expect(out).toMatchObject({ label: "Round 3", name: "Ada" });
    });

    it("leaves an absent or empty label and name out", () => {
        expect("label" in helloFrom(base)).toBe(false);
        expect("name" in helloFrom({ ...base, label: "", name: "" })).toBe(false);
    });
});

describe("refusalMessage", () => {
    it("passes the invite sentinel through, since the invite flow answers it", () => {
        expect(refusalMessage(INVITED)).toBe(INVITED);
    });

    it("says a version skew in this side's own words", () => {
        expect(refusalMessage(VERSION_SKEW)).toBe("That peer is on a different version of ebb");
    });

    it("says a plain refusal in this side's own words", () => {
        expect(refusalMessage(REFUSED)).toBe("That peer refused the connection");
    });

    it("never repeats free text a hostile host chose", () => {
        expect(refusalMessage("Your files have been encrypted, visit evil.example")).toBe(
            "That peer refused the connection",
        );
    });
});

describe("admit", () => {
    it("admits a guest presenting the unspent secret, at the host's own grade", () => {
        expect(admit(hello({ ticket: SECRET }), policy(), GUEST)).toEqual({
            ok: true,
            role: "editor",
            spendSecret: true,
        });
    });

    it("grants the role the host chose, not the one the guest asked for", () => {
        const p = policy({ pending: { secret: SECRET, role: "viewer" } });
        expect(admit(hello({ ticket: SECRET, role: "editor" }), p, GUEST)).toMatchObject({
            ok: true,
            role: "viewer",
        });
    });

    it("admits a peer the round already knows, with no secret at all", () => {
        const p = policy({ knownPeers: [GUEST], roles: { [GUEST]: "editor" }, pending: null });
        expect(admit(hello(), p, GUEST)).toEqual({ ok: true, role: "editor", spendSecret: false });
    });

    it("does not spend the secret for a peer that was already known", () => {
        const p = policy({ knownPeers: [GUEST], roles: { [GUEST]: "editor" } });
        expect(admit(hello({ ticket: SECRET }), p, GUEST)).toMatchObject({ spendSecret: false });
    });

    it("gives a known peer nobody graded the grant that writes nothing", () => {
        const p = policy({ knownPeers: [GUEST], roles: {}, pending: null });
        expect(admit(hello(), p, GUEST)).toMatchObject({ ok: true, role: "viewer" });
    });

    it("refuses a stranger silently, so an EndpointId buys no notification", () => {
        expect(admit(hello({ endpointId: STRANGER }), policy(), STRANGER)).toEqual({
            ok: false,
            reason: REFUSED,
            silent: true,
        });
    });

    it("refuses a wrong secret silently", () => {
        expect(admit(hello({ ticket: "W".repeat(24) }), policy(), GUEST)).toMatchObject({
            ok: false,
            silent: true,
        });
    });

    it("refuses a secret of the wrong length without leaking how far it matched", () => {
        expect(admit(hello({ ticket: SECRET.slice(0, 10) }), policy(), GUEST)).toMatchObject({
            ok: false,
            silent: true,
        });
        expect(admit(hello({ ticket: SECRET + "X" }), policy(), GUEST)).toMatchObject({
            ok: false,
            silent: true,
        });
    });

    it("refuses once the secret has been spent", () => {
        expect(admit(hello({ ticket: SECRET }), policy({ pending: null }), GUEST)).toMatchObject({
            ok: false,
            silent: true,
        });
    });

    it("refuses a hello about another round", () => {
        expect(admit(hello({ roundId: "other", ticket: SECRET }), policy(), GUEST)).toMatchObject({
            ok: false,
            silent: true,
        });
    });

    it("refuses a peer claiming an endpoint the transport did not authenticate", () => {
        // The hello says it is the guest; the connection proves it is somebody else.
        expect(admit(hello({ ticket: SECRET }), policy(), STRANGER)).toMatchObject({
            ok: false,
            silent: true,
        });
    });

    it("refuses a known peer's key claimed by a different connection", () => {
        const p = policy({ knownPeers: [GUEST], roles: { [GUEST]: "editor" }, pending: null });
        expect(admit(hello({ endpointId: GUEST }), p, STRANGER)).toMatchObject({ ok: false });
    });

    it("refuses a role this build does not grant", () => {
        expect(admit(hello({ role: "owner", ticket: SECRET }), policy(), GUEST)).toMatchObject({
            ok: false,
            silent: true,
        });
    });

    it("refuses a message that is not a hello at all", () => {
        expect(admit({ type: "delta" } as WireMessage, policy(), GUEST)).toMatchObject({
            ok: false,
            silent: true,
        });
    });

    it("tells a debater about a version skew, which is theirs to fix", () => {
        const msg = hello({ ticket: SECRET, protocol: PROTOCOL_MAJOR + 1 });
        expect(admit(msg, policy(), GUEST)).toEqual({
            ok: false,
            reason: VERSION_SKEW,
            silent: false,
        });
    });

    it("keeps a version skew behind admission, so a stranger cannot collect it", () => {
        const msg = hello({ endpointId: STRANGER, protocol: PROTOCOL_MAJOR + 1 });
        expect(admit(msg, policy(), STRANGER)).toMatchObject({ reason: REFUSED, silent: true });
    });

    it("leaves the secret unspent on a skew, so the ticket still works after upgrading", () => {
        const p = policy();
        admit(hello({ ticket: SECRET, protocol: 99 }), p, GUEST);
        expect(p.pending).not.toBeNull();
        expect(admit(hello({ ticket: SECRET }), p, GUEST)).toMatchObject({ ok: true });
    });
});

describe("grantedRole", () => {
    it("returns what the host recorded", () => {
        expect(grantedRole(policy({ roles: { [GUEST]: "viewer" } }), GUEST)).toBe("viewer");
    });

    it("is undefined for a peer nobody graded", () => {
        expect(grantedRole(policy(), GUEST)).toBeUndefined();
    });

    it("does not read a prototype key as a grant nobody made", () => {
        for (const reach of ["constructor", "toString", "hasOwnProperty", "__proto__"]) {
            expect(grantedRole(policy(), reach)).toBeUndefined();
        }
    });

    it("keeps a peer named for the prototype chain from being admitted as an editor", () => {
        const p = policy({ knownPeers: ["constructor"], pending: null });
        expect(admit(hello({ endpointId: "constructor" }), p, "constructor")).toMatchObject({
            ok: true,
            role: "viewer",
        });
    });
});
