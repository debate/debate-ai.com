import { describe, expect, it } from "vitest";
import { deltaSince, emptyVector, isEmptyDelta, vectorOf, type Vector } from "../src/lib/collab/delta";
import { seedDoc, seedSheet } from "../src/lib/collab/doc";
import { merge } from "../src/lib/collab/merge";
import { seedRank } from "../src/lib/collab/rank";
import { ORIGIN_STAMP, type Stamp } from "../src/lib/collab/stamp";
import { cellKey, type CollabDoc } from "../src/lib/collab/types";
import { emptyScouting, type FlowRound, type FlowSheet } from "../src/lib/model/flow";

const at = (ms: number, actor: string): Stamp => ({ ms, counter: 0, actor });

const sheet = (over: Partial<FlowSheet> = {}): FlowSheet => ({
    id: "s1",
    title: "1.",
    group: "aff",
    order: 0,
    kind: "flow",
    data: [["a"]],
    meta: {},
    ...over,
});

const round = (sheets: FlowSheet[] = [sheet()]): FlowRound =>
    ({
        id: "r1",
        createdAt: 0,
        updatedAt: 0,
        event: "policy",
        firstSide: "aff",
        scouting: emptyScouting(),
        sheets,
    }) as FlowRound;

const key0 = cellKey(0, seedRank(0), "");

describe("vectorOf", () => {
    it("records the origin for a freshly seeded document", () => {
        expect(vectorOf(seedDoc(round()))).toEqual({ "": ORIGIN_STAMP });
    });

    it("records the highest stamp per actor", () => {
        const doc = seedDoc(round());
        doc.round.event = { value: "pf", stamp: at(5, "a") };
        doc.round.firstSide = { value: "neg", stamp: at(9, "a") };
        doc.sheets.s1.fields.title = { value: "1.", stamp: at(2, "b") };
        const seen = vectorOf(doc);
        expect(seen.a).toEqual(at(9, "a"));
        expect(seen.b).toEqual(at(2, "b"));
    });

    it("records a cell's text, decoration and delete stamps", () => {
        const doc = seedDoc(round());
        const cell = doc.sheets.s1.cells[key0];
        cell.textStamp = at(1, "t");
        cell.metaStamp = at(2, "m");
        cell.deleted = at(3, "d");
        const seen = vectorOf(doc);
        expect(Object.keys(seen).sort()).toEqual(["", "d", "m", "t"]);
    });

    it("records a sheet's delete stamp", () => {
        const doc = seedDoc(round());
        doc.sheets.s1.deleted = at(4, "z");
        expect(vectorOf(doc).z).toEqual(at(4, "z"));
    });

    it("holds a stamp from an actor named for the prototype chain", () => {
        const doc = seedDoc(round());
        const hostile = "__" + "proto" + "__";
        doc.round.event = { value: "pf", stamp: at(5, hostile) };
        const seen = vectorOf(doc);
        expect(Object.getPrototypeOf(seen)).toBeNull();
        expect(seen[hostile]).toEqual(at(5, hostile));
    });

    it("is prototypeless, so no actor name can reach an accessor", () => {
        expect(Object.getPrototypeOf(vectorOf(seedDoc(round())))).toBeNull();
    });
});

describe("emptyVector", () => {
    it("has seen the file both peers opened and nothing else", () => {
        expect(emptyVector()[""]).toEqual(ORIGIN_STAMP);
        expect(Object.keys(emptyVector())).toEqual([""]);
    });

    it("suppresses the whole seed, so a first sync between two openers costs nothing", () => {
        expect(isEmptyDelta(deltaSince(seedDoc(round()), emptyVector()))).toBe(true);
    });

    it("is prototypeless, since the sync raises it by every actor it ships", () => {
        expect(Object.getPrototypeOf(emptyVector())).toBeNull();
    });
});

describe("deltaSince", () => {
    it("ships everything to a peer that has seen nothing", () => {
        const doc = seedDoc(round());
        const delta = deltaSince(doc, Object.create(null) as Vector);
        expect(Object.keys(delta.round).length).toBeGreaterThan(0);
        expect(Object.keys(delta.sheets.s1.cells)).toEqual([key0]);
    });

    it("ships nothing to a peer already at this state", () => {
        const doc = seedDoc(round());
        expect(isEmptyDelta(deltaSince(doc, vectorOf(doc)))).toBe(true);
    });

    it("ships only the register a peer has not seen", () => {
        const doc = seedDoc(round());
        const seen = vectorOf(doc);
        doc.round.event = { value: "pf", stamp: at(5, "a") };
        const delta = deltaSince(doc, seen);
        expect(Object.keys(delta.round)).toEqual(["event"]);
        expect(delta.sheets).toEqual({});
    });

    it("ships a cell whose text is newer than the peer's vector", () => {
        const doc = seedDoc(round());
        const seen = vectorOf(doc);
        doc.sheets.s1.cells[key0] = { ...doc.sheets.s1.cells[key0], text: "b", textStamp: at(5, "a") };
        expect(Object.keys(deltaSince(doc, seen).sheets.s1.cells)).toEqual([key0]);
    });

    it("ships a cell whose decoration alone is newer", () => {
        const doc = seedDoc(round());
        const seen = vectorOf(doc);
        doc.sheets.s1.cells[key0] = {
            ...doc.sheets.s1.cells[key0],
            meta: { bold: true },
            metaStamp: at(5, "a"),
        };
        expect(Object.keys(deltaSince(doc, seen).sheets.s1.cells)).toEqual([key0]);
    });

    it("ships a cell whose delete alone is newer", () => {
        const doc = seedDoc(round());
        const seen = vectorOf(doc);
        doc.sheets.s1.cells[key0] = { ...doc.sheets.s1.cells[key0], deleted: at(5, "a") };
        expect(Object.keys(deltaSince(doc, seen).sheets.s1.cells)).toEqual([key0]);
    });

    it("ships a sheet's delete on its own", () => {
        const doc = seedDoc(round());
        const seen = vectorOf(doc);
        doc.sheets.s1 = { ...doc.sheets.s1, deleted: at(5, "a") };
        const delta = deltaSince(doc, seen);
        expect(delta.sheets.s1.deleted).toEqual(at(5, "a"));
        expect(delta.sheets.s1.cells).toEqual({});
    });

    it("does not name a sheet with nothing new in it", () => {
        const doc = seedDoc(round([sheet(), sheet({ id: "s2" })]));
        const seen = vectorOf(doc);
        doc.sheets.s2 = {
            ...doc.sheets.s2,
            fields: { ...doc.sheets.s2.fields, title: { value: "2.", stamp: at(5, "a") } },
        };
        expect(Object.keys(deltaSince(doc, seen).sheets)).toEqual(["s2"]);
    });

    it("ships a stamp from an actor the peer's vector does not name at all", () => {
        const doc = seedDoc(round());
        doc.round.event = { value: "pf", stamp: at(5, "newcomer") };
        const seen: Vector = { "": ORIGIN_STAMP };
        expect(Object.keys(deltaSince(doc, seen).round)).toEqual(["event"]);
    });

    it("does not read a peer's vector through the prototype chain", () => {
        const doc = seedDoc(round());
        doc.round.event = { value: "pf", stamp: at(5, "constructor") };
        // A plain-object vector resolves "constructor" to Object; the delta must
        // still ship the register rather than reading it as already seen.
        expect(Object.keys(deltaSince(doc, { "": ORIGIN_STAMP }).round)).toEqual(["event"]);
    });

    it("carries the round id, so the far side knows what it is merging", () => {
        expect(deltaSince(seedDoc(round()), emptyVector()).roundId).toBe("r1");
    });

    it("applying a delta brings the far side to the same state as the whole document", () => {
        const local = seedDoc(round());
        const remote: CollabDoc = seedDoc(round());
        const seen = vectorOf(remote);
        local.round.event = { value: "pf", stamp: at(5, "a") };
        local.sheets.s1.cells[key0] = { ...local.sheets.s1.cells[key0], text: "b", textStamp: at(6, "a") };

        const viaDelta = merge(remote, deltaSince(local, seen)).doc;
        const viaWhole = merge(seedDoc(round()), local).doc;
        expect(viaDelta).toEqual(viaWhole);
    });
});

describe("isEmptyDelta", () => {
    it("is true for a delta with nothing in it", () => {
        expect(isEmptyDelta({ roundId: "r", round: {}, sheets: {} })).toBe(true);
    });

    it("is false when a register or a sheet is owed", () => {
        expect(
            isEmptyDelta({ roundId: "r", round: { a: { value: 1, stamp: ORIGIN_STAMP } }, sheets: {} }),
        ).toBe(false);
        expect(
            isEmptyDelta({
                roundId: "r",
                round: {},
                sheets: { s1: seedSheet(sheet(), ORIGIN_STAMP) },
            }),
        ).toBe(false);
    });
});
