/**
 * @fileoverview The replica made durable.
 *
 * The sidecar is an optimization that can never be a source of corruption, so
 * every reason it cannot be trusted returns the same null and the round
 * re-seeds from its file instead. The version gate is the sharpest of those:
 * an older file names its read-only members somewhere else or not at all, so
 * parsing one would come back with every peer promoted to editor. That is why
 * an unknown version costs a re-seed rather than being read leniently.
 */

import { describe, expect, it } from "vitest";
import { seedDoc } from "../src/lib/collab/doc";
import { SIDECAR_VERSION, parseSidecar, serializeSidecar } from "../src/lib/collab/sidecar";
import { emptyScouting, type FlowRound } from "../src/lib/model/flow";

const A = "a".repeat(64);
const B = "b".repeat(64);

const round = (): FlowRound =>
    ({
        id: "r1",
        createdAt: 0,
        updatedAt: 0,
        event: "policy",
        firstSide: "aff",
        scouting: emptyScouting(),
        sheets: [],
    }) as FlowRound;

const input = (over: Partial<Parameters<typeof serializeSidecar>[0]> = {}) => ({
    roundId: "r1",
    flowHash: "deadbeef",
    peers: [A, B],
    viewers: [B],
    relays: { [A]: "https://relay.example" },
    doc: seedDoc(round()),
    ...over,
});

/** A sidecar string carrying whatever payload. */
const raw = (payload: unknown) => JSON.stringify(payload);

describe("serializeSidecar", () => {
    it("stamps the file with this build's version", () => {
        expect(JSON.parse(serializeSidecar(input())).version).toBe(SIDECAR_VERSION);
    });

    it("carries the round, the hash, the members, the grades and the relays", () => {
        const parsed = JSON.parse(serializeSidecar(input()));
        expect(parsed).toMatchObject({
            roundId: "r1",
            flowHash: "deadbeef",
            peers: [A, B],
            viewers: [B],
            relays: { [A]: "https://relay.example" },
        });
    });

    it("carries the document itself", () => {
        expect(JSON.parse(serializeSidecar(input())).doc.roundId).toBe("r1");
    });
});

describe("parseSidecar recovery", () => {
    it("round-trips a sidecar", () => {
        const written = serializeSidecar(input());
        expect(parseSidecar(written, "r1", "deadbeef")).toEqual({
            version: SIDECAR_VERSION,
            ...input(),
        });
    });

    it("recovers the document, which is the point of the file", () => {
        const written = serializeSidecar(input());
        const doc = parseSidecar(written, "r1", "deadbeef")!.doc;
        expect(doc.roundId).toBe("r1");
        expect(doc.round.event.value).toBe("policy");
    });
});

describe("parseSidecar refusals", () => {
    const parse = (text: string | null) => parseSidecar(text, "r1", "deadbeef");

    it("refuses a missing file", () => {
        expect(parse(null)).toBeNull();
        expect(parse("")).toBeNull();
    });

    it("refuses a file that is not JSON", () => {
        expect(parse("{not json")).toBeNull();
    });

    it("refuses a payload that is not an object", () => {
        expect(parse("[]")).toBeNull();
        expect(parse("null")).toBeNull();
        expect(parse('"sidecar"')).toBeNull();
    });

    it("refuses an older version rather than promoting the peers it graded", () => {
        expect(parse(raw({ ...input(), version: SIDECAR_VERSION - 1 }))).toBeNull();
    });

    it("refuses a newer version too, so a bump costs a re-seed and never a promotion", () => {
        expect(parse(raw({ ...input(), version: SIDECAR_VERSION + 1 }))).toBeNull();
        expect(parse(raw({ ...input(), version: undefined }))).toBeNull();
    });

    it("refuses a sidecar belonging to another round", () => {
        expect(parseSidecar(serializeSidecar(input()), "other", "deadbeef")).toBeNull();
    });

    it("refuses a sidecar the file has moved on from", () => {
        expect(parseSidecar(serializeSidecar(input()), "r1", "cafebabe")).toBeNull();
    });

    it("refuses a payload carrying no usable document", () => {
        expect(parse(raw({ ...input(), doc: null }))).toBeNull();
        expect(parse(raw({ ...input(), doc: { roundId: "r1" } }))).toBeNull();
        expect(parse(raw({ ...input(), doc: { roundId: 7, round: {}, sheets: {} } }))).toBeNull();
    });
});

describe("parseSidecar salvage", () => {
    const parse = (over: Record<string, unknown>) =>
        parseSidecar(raw({ version: SIDECAR_VERSION, ...input(), ...over }), "r1", "deadbeef")!;

    it("drops a member that is not an id iroh could parse, since each is dialled", () => {
        expect(parse({ peers: [A, "not-an-endpoint", 7, null] }).peers).toEqual([A]);
    });

    it("drops a grade naming no real peer", () => {
        expect(parse({ viewers: ["nope"] }).viewers).toEqual([]);
    });

    it("reads a member list that is not a list as no members", () => {
        expect(parse({ peers: "everyone" }).peers).toEqual([]);
        expect(parse({ viewers: undefined }).viewers).toEqual([]);
    });

    it("drops a relay whose scheme this build would not dial", () => {
        expect(parse({ relays: { [A]: "http://relay.example" } }).relays).toEqual({});
        expect(parse({ relays: { [A]: "file:///etc/passwd" } }).relays).toEqual({});
    });

    it("drops a relay keyed by something that is not a peer", () => {
        expect(parse({ relays: { nope: "https://relay.example" } }).relays).toEqual({});
    });

    it("reads a relay table that is not a table as no relays", () => {
        expect(parse({ relays: [] }).relays).toEqual({});
        expect(parse({ relays: null }).relays).toEqual({});
    });

    it("reads a file that predates relays as a round reachable across the room", () => {
        expect(parse({ relays: undefined }).relays).toEqual({});
    });

    it("returns a relay table with no prototype, since a hand edit chooses its keys", () => {
        expect(Object.getPrototypeOf(parse({}).relays)).toBeNull();
    });

    it("keeps the entries it can alongside the ones it drops", () => {
        const out = parse({
            peers: [A, "junk", B],
            relays: { [A]: "https://ok.example", [B]: "ftp://no.example" },
        });
        expect(out.peers).toEqual([A, B]);
        expect(out.relays).toEqual({ [A]: "https://ok.example" });
    });

    it("stamps the result with this build's version and the round it was asked about", () => {
        const out = parse({});
        expect(out.version).toBe(SIDECAR_VERSION);
        expect(out.roundId).toBe("r1");
        expect(out.flowHash).toBe("deadbeef");
    });
});
