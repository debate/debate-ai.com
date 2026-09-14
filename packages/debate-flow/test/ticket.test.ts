import { describe, expect, it } from "vitest";
import {
    TICKET_PREFIX,
    encodeTicket,
    mintTicket,
    parseTicket,
    type Ticket,
} from "../src/lib/collab/ticket";

const ID = "a".repeat(64);
const SECRET = "S".repeat(24);

const ticket = (over: Partial<Ticket> = {}): Ticket => ({
    endpointId: ID,
    roundId: "round-1",
    role: "editor",
    secret: SECRET,
    relay: true,
    ...over,
});

/** A ticket string carrying whatever payload, past the prefix. */
const encodeRaw = (payload: unknown) =>
    TICKET_PREFIX +
    btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

describe("mintTicket", () => {
    it("carries the host, the round, the role and the relay answer", () => {
        const t = mintTicket({ endpointId: ID, roundId: "r1", role: "viewer", relay: false });
        expect(t).toMatchObject({ endpointId: ID, roundId: "r1", role: "viewer", relay: false });
    });

    it("mints a secret of the length the parser demands", () => {
        expect(mintTicket({ endpointId: ID, roundId: "r1", role: "editor", relay: true }).secret)
            .toHaveLength(24);
    });

    it("mints a different secret each time, so guessing is not a strategy", () => {
        const secrets = new Set(
            Array.from({ length: 50 }, () =>
                mintTicket({ endpointId: ID, roundId: "r1", role: "editor", relay: true }).secret,
            ),
        );
        expect(secrets.size).toBe(50);
    });

    it("mints a secret out of the alphabet alone", () => {
        for (let i = 0; i < 20; i++) {
            const t = mintTicket({ endpointId: ID, roundId: "r1", role: "editor", relay: true });
            expect(t.secret).toMatch(/^[0-9A-Za-z]{24}$/);
        }
    });

    it("carries the host's relay when it has one", () => {
        const t = mintTicket({
            endpointId: ID,
            roundId: "r1",
            role: "editor",
            relay: true,
            relayUrl: "https://relay.example",
        });
        expect(t.relayUrl).toBe("https://relay.example");
    });

    it("drops the relay field entirely rather than carrying it empty", () => {
        const t = mintTicket({ endpointId: ID, roundId: "r1", role: "editor", relay: false });
        expect("relayUrl" in t).toBe(false);
        const blank = mintTicket({
            endpointId: ID,
            roundId: "r1",
            role: "editor",
            relay: false,
            relayUrl: "",
        });
        expect("relayUrl" in blank).toBe(false);
    });

    it("takes an injected source of randomness, for a reproducible ticket", () => {
        const t = mintTicket(
            { endpointId: ID, roundId: "r1", role: "editor", relay: true },
            () => SECRET,
        );
        expect(t.secret).toBe(SECRET);
    });
});

describe("encodeTicket and parseTicket", () => {
    it("round-trips a ticket", () => {
        const t = ticket();
        expect(parseTicket(encodeTicket(t))).toEqual(t);
    });

    it("round-trips a ticket carrying a relay", () => {
        const t = ticket({ relayUrl: "https://relay.example" });
        expect(parseTicket(encodeTicket(t))).toEqual(t);
    });

    it("round-trips a viewer ticket", () => {
        const t = ticket({ role: "viewer" });
        expect(parseTicket(encodeTicket(t))!.role).toBe("viewer");
    });

    it("names its format, so a later one can be told apart", () => {
        expect(encodeTicket(ticket()).startsWith(TICKET_PREFIX)).toBe(true);
    });

    it("encodes url-safely, so a ticket survives being pasted into a link", () => {
        const encoded = encodeTicket(ticket({ roundId: "round/with+chars" }));
        expect(encoded.slice(TICKET_PREFIX.length)).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(parseTicket(encoded)!.roundId).toBe("round/with+chars");
    });

    it("tolerates whitespace around a pasted ticket", () => {
        expect(parseTicket(`  ${encodeTicket(ticket())}\n`)).toEqual(ticket());
    });
});

describe("parseTicket refusals", () => {
    it("refuses text that is not a ticket", () => {
        expect(parseTicket("")).toBeNull();
        expect(parseTicket("hello")).toBeNull();
        expect(parseTicket("https://debate-ai.com/join")).toBeNull();
    });

    it("refuses a ticket of another format", () => {
        expect(parseTicket("ebb2:" + encodeTicket(ticket()).slice(TICKET_PREFIX.length))).toBeNull();
    });

    it("refuses a payload that is not base64, or not JSON", () => {
        expect(parseTicket(TICKET_PREFIX + "!!!!")).toBeNull();
        expect(parseTicket(TICKET_PREFIX + btoa("not json"))).toBeNull();
    });

    it("refuses a payload that is not an object", () => {
        expect(parseTicket(encodeRaw([ticket()]))).toBeNull();
        expect(parseTicket(encodeRaw("ticket"))).toBeNull();
        expect(parseTicket(encodeRaw(null))).toBeNull();
    });

    it("refuses an endpoint iroh could not have issued, since it is dialed next", () => {
        expect(parseTicket(encodeRaw(ticket({ endpointId: "not-an-endpoint" })))).toBeNull();
        expect(parseTicket(encodeRaw(ticket({ endpointId: "" })))).toBeNull();
        expect(parseTicket(encodeRaw({ ...ticket(), endpointId: 7 }))).toBeNull();
    });

    it("refuses a ticket naming no round", () => {
        expect(parseTicket(encodeRaw(ticket({ roundId: "" })))).toBeNull();
        expect(parseTicket(encodeRaw({ ...ticket(), roundId: 7 }))).toBeNull();
    });

    it("refuses a round id long enough to be a payload", () => {
        expect(parseTicket(encodeRaw(ticket({ roundId: "r".repeat(128) })))).not.toBeNull();
        expect(parseTicket(encodeRaw(ticket({ roundId: "r".repeat(129) })))).toBeNull();
    });

    it("refuses a role this build does not grant", () => {
        expect(parseTicket(encodeRaw(ticket({ role: "owner" as never })))).toBeNull();
        expect(parseTicket(encodeRaw({ ...ticket(), role: undefined }))).toBeNull();
    });

    it("refuses a secret of the wrong length", () => {
        expect(parseTicket(encodeRaw(ticket({ secret: "short" })))).toBeNull();
        expect(parseTicket(encodeRaw(ticket({ secret: "S".repeat(25) })))).toBeNull();
        expect(parseTicket(encodeRaw({ ...ticket(), secret: 7 }))).toBeNull();
    });
});

describe("parseTicket defaults", () => {
    it("reads a missing relay answer as the one that reaches no relay", () => {
        const { relay: _drop, ...rest } = ticket();
        expect(parseTicket(encodeRaw(rest))!.relay).toBe(false);
    });

    it("reads anything but a true relay answer as false", () => {
        expect(parseTicket(encodeRaw(ticket({ relay: "yes" as never })))!.relay).toBe(false);
        expect(parseTicket(encodeRaw(ticket({ relay: 1 as never })))!.relay).toBe(false);
    });

    it("drops a relay address this build would not dial, keeping the ticket", () => {
        const parsed = parseTicket(encodeRaw(ticket({ relayUrl: "http://relay.example" })));
        expect(parsed).not.toBeNull();
        expect("relayUrl" in parsed!).toBe(false);
    });

    it("still opens a round for a ticket with no relay named at all", () => {
        expect(parseTicket(encodeRaw(ticket()))).not.toBeNull();
    });

    it("keeps no field the payload carried beyond the ones it names", () => {
        const parsed = parseTicket(encodeRaw({ ...ticket(), extra: "payload" }));
        expect(Object.keys(parsed!).sort()).toEqual([
            "endpointId",
            "relay",
            "role",
            "roundId",
            "secret",
        ]);
    });
});
