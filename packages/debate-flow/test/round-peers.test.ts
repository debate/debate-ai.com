/**
 * @fileoverview The peers a round has been shared with, kept per round.
 *
 * Per round rather than for whichever round was touched last: the comment
 * records that a single slot let a join write over the open round's record,
 * and the open round's next autosave put the loss in its sidecar. So the
 * isolation between rounds is checked directly, alongside the grade rules —
 * a replace that says nothing about grades would promote every viewer, and a
 * forget has to outlive the next reopen or the cut lasts one session.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
    forgetRoundPeer,
    forgetRoundPeers,
    knownRoundPeers,
    knownRoundRelays,
    knownRoundViewers,
    rememberRoundPeers,
    rememberRoundRelay,
    rememberRoundRole,
    setRoundPeers,
} from "../src/lib/collab/roundPeers";

const A = "a".repeat(64);
const B = "b".repeat(64);
const C = "c".repeat(64);

beforeEach(forgetRoundPeers);

describe("a round nothing has been recorded about", () => {
    it("knows no peers, viewers or relays, which is what a fresh open is", () => {
        expect(knownRoundPeers("r1")).toEqual([]);
        expect(knownRoundViewers("r1")).toEqual([]);
        expect(knownRoundRelays("r1")).toEqual({});
    });
});

describe("rememberRoundPeers", () => {
    it("adds peers to the round's set", () => {
        rememberRoundPeers("r1", [A, B]);
        expect(knownRoundPeers("r1").sort()).toEqual([A, B].sort());
    });

    it("does not add a peer twice", () => {
        rememberRoundPeers("r1", [A]);
        rememberRoundPeers("r1", [A, B]);
        expect(knownRoundPeers("r1")).toHaveLength(2);
    });

    it("reaches no other round's set", () => {
        rememberRoundPeers("r1", [A]);
        rememberRoundPeers("r2", [B]);
        expect(knownRoundPeers("r1")).toEqual([A]);
        expect(knownRoundPeers("r2")).toEqual([B]);
    });

    it("hands back a copy, so a caller cannot edit the record in place", () => {
        rememberRoundPeers("r1", [A]);
        knownRoundPeers("r1").push(B);
        expect(knownRoundPeers("r1")).toEqual([A]);
    });
});

describe("rememberRoundRole", () => {
    it("records a viewer as a member and as read-only", () => {
        rememberRoundRole("r1", A, "viewer");
        expect(knownRoundPeers("r1")).toEqual([A]);
        expect(knownRoundViewers("r1")).toEqual([A]);
    });

    it("records an editor as a member and not read-only", () => {
        rememberRoundRole("r1", A, "editor");
        expect(knownRoundPeers("r1")).toEqual([A]);
        expect(knownRoundViewers("r1")).toEqual([]);
    });

    it("lets a later wider grant clear the read-only mark", () => {
        rememberRoundRole("r1", A, "viewer");
        rememberRoundRole("r1", A, "editor");
        expect(knownRoundViewers("r1")).toEqual([]);
        expect(knownRoundPeers("r1")).toEqual([A]);
    });

    it("lets a later narrower grant re-apply it", () => {
        rememberRoundRole("r1", A, "editor");
        rememberRoundRole("r1", A, "viewer");
        expect(knownRoundViewers("r1")).toEqual([A]);
    });

    it("does not mark the same peer read-only twice", () => {
        rememberRoundRole("r1", A, "viewer");
        rememberRoundRole("r1", A, "viewer");
        expect(knownRoundViewers("r1")).toHaveLength(1);
    });

    it("keeps the two lists from disagreeing about who belongs", () => {
        rememberRoundRole("r1", A, "viewer");
        expect(knownRoundViewers("r1").every((p) => knownRoundPeers("r1").includes(p))).toBe(true);
    });

    it("grades one round without touching another", () => {
        rememberRoundRole("r1", A, "viewer");
        rememberRoundRole("r2", A, "editor");
        expect(knownRoundViewers("r1")).toEqual([A]);
        expect(knownRoundViewers("r2")).toEqual([]);
    });
});

describe("setRoundPeers", () => {
    it("replaces a round's whole set, for a round opened off its sidecar", () => {
        rememberRoundPeers("r1", [A]);
        setRoundPeers("r1", [B, C], []);
        expect(knownRoundPeers("r1").sort()).toEqual([B, C].sort());
    });

    it("names the grades rather than defaulting them", () => {
        setRoundPeers("r1", [A, B], [B]);
        expect(knownRoundViewers("r1")).toEqual([B]);
    });

    it("promotes nobody it was not told to: an unnamed viewer is dropped as one", () => {
        rememberRoundRole("r1", A, "viewer");
        setRoundPeers("r1", [A], [A]);
        expect(knownRoundViewers("r1")).toEqual([A]);
    });

    it("drops a duplicate the sidecar carried", () => {
        setRoundPeers("r1", [A, A, B], [B, B]);
        expect(knownRoundPeers("r1")).toHaveLength(2);
        expect(knownRoundViewers("r1")).toHaveLength(1);
    });

    it("takes the relays the sidecar recorded", () => {
        setRoundPeers("r1", [A], [], { [A]: "https://relay.example" });
        expect(knownRoundRelays("r1")).toEqual({ [A]: "https://relay.example" });
    });

    it("records no relays when the sidecar named none", () => {
        setRoundPeers("r1", [A], []);
        expect(knownRoundRelays("r1")).toEqual({});
    });

    it("copies the relay map, so a caller cannot edit the record in place", () => {
        const relays = { [A]: "https://relay.example" };
        setRoundPeers("r1", [A], [], relays);
        relays[A] = "https://elsewhere.example";
        expect(knownRoundRelays("r1")[A]).toBe("https://relay.example");
    });
});

describe("rememberRoundRelay", () => {
    it("records where a peer was reached, so the next open dials an address", () => {
        rememberRoundRelay("r1", A, "https://relay.example");
        expect(knownRoundRelays("r1")).toEqual({ [A]: "https://relay.example" });
    });

    it("overwrites, since a peer that moved networks is at the newer one", () => {
        rememberRoundRelay("r1", A, "https://old.example");
        rememberRoundRelay("r1", A, "https://new.example");
        expect(knownRoundRelays("r1")[A]).toBe("https://new.example");
    });

    it("keeps each peer's relay apart", () => {
        rememberRoundRelay("r1", A, "https://one.example");
        rememberRoundRelay("r1", B, "https://two.example");
        expect(knownRoundRelays("r1")).toEqual({
            [A]: "https://one.example",
            [B]: "https://two.example",
        });
    });

    it("keeps each round's relays apart", () => {
        rememberRoundRelay("r1", A, "https://one.example");
        rememberRoundRelay("r2", A, "https://two.example");
        expect(knownRoundRelays("r1")[A]).toBe("https://one.example");
    });

    it("hands back a copy of the map", () => {
        rememberRoundRelay("r1", A, "https://one.example");
        knownRoundRelays("r1")[B] = "https://injected.example";
        expect(knownRoundRelays("r1")[B]).toBeUndefined();
    });
});

describe("forgetRoundPeer", () => {
    it("drops the peer from the round's membership and its grades", () => {
        rememberRoundRole("r1", A, "viewer");
        rememberRoundRole("r1", B, "editor");
        forgetRoundPeer("r1", A);
        expect(knownRoundPeers("r1")).toEqual([B]);
        expect(knownRoundViewers("r1")).toEqual([]);
    });

    it("leaves the other rounds alone", () => {
        rememberRoundPeers("r1", [A]);
        rememberRoundPeers("r2", [A]);
        forgetRoundPeer("r1", A);
        expect(knownRoundPeers("r2")).toEqual([A]);
    });

    it("is a no-op for a peer or a round it does not hold", () => {
        rememberRoundPeers("r1", [A]);
        expect(() => forgetRoundPeer("r1", C)).not.toThrow();
        expect(() => forgetRoundPeer("nope", A)).not.toThrow();
        expect(knownRoundPeers("r1")).toEqual([A]);
    });

    it("keeps the cut peer out when the round is re-recorded from a sidecar", () => {
        rememberRoundRole("r1", A, "editor");
        forgetRoundPeer("r1", A);
        // Membership drives the re-dial, so a cut peer is not in it.
        expect(knownRoundPeers("r1")).toEqual([]);
    });
});

describe("forgetRoundPeers", () => {
    it("drops every round's set, for a debater back at the start screen", () => {
        rememberRoundRole("r1", A, "viewer");
        rememberRoundRelay("r2", B, "https://relay.example");
        forgetRoundPeers();
        expect(knownRoundPeers("r1")).toEqual([]);
        expect(knownRoundViewers("r1")).toEqual([]);
        expect(knownRoundRelays("r2")).toEqual({});
    });
});
