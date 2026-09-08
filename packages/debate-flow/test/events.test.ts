import { describe, expect, it } from "vitest";
import {
    EVENTS,
    getEvent,
    sideLabels,
    speechOrder,
    speechTerms,
    type EventId,
} from "../src/lib/format/events";

const ALL_IDS = Object.keys(EVENTS) as EventId[];

describe("getEvent", () => {
    it("returns the event a known id names", () => {
        for (const id of ALL_IDS) expect(getEvent(id).id).toBe(id);
    });

    it("falls back to policy for an unknown id", () => {
        expect(getEvent("wsdc").id).toBe("policy");
    });

    it("falls back to policy for a missing id", () => {
        expect(getEvent().id).toBe("policy");
        expect(getEvent(undefined).id).toBe("policy");
    });

    it("does not resolve prototype keys as events", () => {
        expect(getEvent("constructor").id).toBe("policy");
        expect(getEvent("__proto__").id).toBe("policy");
        expect(getEvent("toString").id).toBe("policy");
    });
});

describe("EVENTS table", () => {
    it("gives every speech a unique id within its event", () => {
        for (const event of Object.values(EVENTS)) {
            const ids = [...event.aff, ...event.neg].map((s) => s.id);
            expect(new Set(ids).size).toBe(ids.length);
        }
    });

    it("tags each side's speeches with that side", () => {
        for (const event of Object.values(EVENTS)) {
            expect(event.aff.every((s) => s.side === "aff")).toBe(true);
            expect(event.neg.every((s) => s.side === "neg")).toBe(true);
        }
    });

    it("only lets the variable-order event be flipped", () => {
        expect(EVENTS.pf.variableOrder).toBe(true);
        expect(EVENTS.policy.variableOrder).toBe(false);
        expect(EVENTS.ld.variableOrder).toBe(false);
        expect(EVENTS.parli.variableOrder).toBe(false);
    });

    it("leaves parliamentary without a cross-examination", () => {
        expect(EVENTS.parli.crossEx).toBeUndefined();
        expect(EVENTS.policy.crossEx?.periods).toHaveLength(4);
        expect(EVENTS.ld.crossEx?.periods).toHaveLength(2);
    });

    it("marks public forum crossfire as shared and the rest as directional", () => {
        expect(EVENTS.pf.crossEx?.shared).toBe(true);
        expect(EVENTS.policy.crossEx?.shared).toBeUndefined();
    });
});

describe("sideLabels", () => {
    it("defaults to aff/neg for events that do not rename their sides", () => {
        expect(sideLabels("policy")).toEqual({
            aff: { label: "Aff", speakers: ["1A", "2A"] },
            neg: { label: "Neg", speakers: ["1N", "2N"] },
        });
    });

    it("uses the event's own side naming when it has one", () => {
        expect(sideLabels("parli").aff.label).toBe("Gov");
        expect(sideLabels("parli").neg.label).toBe("Opp");
        expect(sideLabels("parli").aff.speakers).toEqual(["PM", "MG"]);
    });

    it("falls back through getEvent for an unknown id", () => {
        expect(sideLabels("nonsense").aff.label).toBe("Aff");
    });
});

describe("speechTerms", () => {
    it("joins the name and the abbreviation", () => {
        expect(speechTerms({ id: "1ac", name: "1AC", short: "1AC", side: "aff" })).toBe("1AC 1AC");
    });

    it("appends every alias so search matches the other vocabulary", () => {
        const block = EVENTS.policy.neg.find((s) => s.id === "block")!;
        expect(speechTerms(block)).toBe("Block Block 2NC 1NR");
    });

    it("keeps the parliamentary block's long-form aliases", () => {
        const block = EVENTS.parli.neg.find((s) => s.id === "block")!;
        expect(speechTerms(block)).toContain("Leader of the Opposition Rebuttal");
        expect(speechTerms(block)).toContain("1NR");
    });
});

describe("speechOrder", () => {
    it("alternates the two lists starting with the aff", () => {
        expect(speechOrder(EVENTS.policy, "aff").map((s) => s.id)).toEqual([
            "1ac",
            "1nc",
            "2ac",
            "block",
            "1ar",
            "2nr",
            "2ar",
        ]);
    });

    it("alternates starting with the neg when the neg speaks first", () => {
        expect(speechOrder(EVENTS.pf, "neg").map((s) => s.id)).toEqual([
            "nc",
            "ac",
            "nr",
            "ar",
            "ns",
            "as",
            "nf",
            "af",
        ]);
    });

    it("appends the longer list's tail once the shorter one runs out", () => {
        const order = speechOrder(EVENTS.ld, "aff").map((s) => s.id);
        expect(order).toEqual(["1ac", "1nc", "1ar", "2nr", "2ar"]);
    });

    it("keeps every speech of both sides exactly once", () => {
        for (const event of Object.values(EVENTS)) {
            for (const first of ["aff", "neg"] as const) {
                const order = speechOrder(event, first);
                expect(order).toHaveLength(event.aff.length + event.neg.length);
                expect(new Set(order.map((s) => s.id)).size).toBe(order.length);
            }
        }
    });

    it("keeps each side's own speaking order intact under either flip", () => {
        for (const event of Object.values(EVENTS)) {
            for (const first of ["aff", "neg"] as const) {
                const order = speechOrder(event, first);
                for (const side of ["aff", "neg"] as const) {
                    expect(order.filter((s) => s.side === side).map((s) => s.id)).toEqual(
                        event[side].map((s) => s.id),
                    );
                }
            }
        }
    });

    it("starts with the first-speaking side's opening speech", () => {
        expect(speechOrder(EVENTS.parli, "aff")[0].id).toBe("pm");
        expect(speechOrder(EVENTS.parli, "neg")[0].id).toBe("loc");
    });
});
