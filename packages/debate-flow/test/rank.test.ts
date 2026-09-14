import { describe, expect, it } from "vitest";
import { isRank, rankBetween, seedRank } from "../src/lib/collab/rank";

describe("seedRank", () => {
    it("is a pure function of the row index, so two peers seed identically", () => {
        expect(seedRank(0)).toBe(seedRank(0));
        expect(seedRank(41)).toBe(seedRank(41));
    });

    it("sorts ascending as a plain string", () => {
        const ranks = Array.from({ length: 200 }, (_, i) => seedRank(i));
        expect([...ranks].sort()).toEqual(ranks);
    });

    it("keeps a fixed width, so string order matches row order past 62 rows", () => {
        const widths = new Set(Array.from({ length: 500 }, (_, i) => seedRank(i).length));
        expect(widths).toEqual(new Set([6]));
    });

    it("never ends in the zero digit, the invariant subdivision relies on", () => {
        for (let i = 0; i < 500; i++) expect(seedRank(i).endsWith("0")).toBe(false);
    });

    it("leaves room between neighbours for later inserts", () => {
        const a = seedRank(3);
        const b = seedRank(4);
        const mid = rankBetween(a, b);
        expect(mid > a).toBe(true);
        expect(mid < b).toBe(true);
    });

    it("throws rather than wrapping around at overflow", () => {
        expect(() => seedRank(Number.MAX_SAFE_INTEGER)).toThrow(/overflow/);
    });
});

describe("rankBetween", () => {
    it("lands strictly between two neighbours", () => {
        const mid = rankBetween("100001", "100003");
        expect(mid > "100001").toBe(true);
        expect(mid < "100003").toBe(true);
    });

    it("lands above a floor with open sky above it", () => {
        expect(rankBetween("100001", null) > "100001").toBe(true);
    });

    it("lands below a ceiling with open sky below it", () => {
        const r = rankBetween(null, "100001");
        expect(r < "100001").toBe(true);
    });

    it("hands back a first rank for an empty column", () => {
        const r = rankBetween(null, null);
        expect(typeof r).toBe("string");
        expect(r.length).toBeGreaterThan(0);
    });

    it("always finds room, however many times a position is subdivided", () => {
        let low = seedRank(0);
        const high = seedRank(1);
        for (let i = 0; i < 200; i++) {
            const next = rankBetween(low, high);
            expect(next > low).toBe(true);
            expect(next < high).toBe(true);
            low = next;
        }
    });

    it("keeps every rank it makes orderable", () => {
        let low = seedRank(5);
        const high = seedRank(6);
        for (let i = 0; i < 100; i++) {
            low = rankBetween(low, high);
            expect(isRank(low)).toBe(true);
        }
    });

    it("finds room between two ranks one digit apart", () => {
        const mid = rankBetween("1", "2");
        expect(mid > "1").toBe(true);
        expect(mid < "2").toBe(true);
    });

    it("refuses a floor that is not below its ceiling", () => {
        expect(() => rankBetween("100003", "100001")).toThrow(/not below/);
        expect(() => rankBetween("100001", "100001")).toThrow(/not below/);
    });

    it("refuses a neighbour ending in the zero digit", () => {
        expect(() => rankBetween("100010", "100033")).toThrow(/zero digit/);
        expect(() => rankBetween("100001", "100030")).toThrow(/zero digit/);
    });

    it("grows slowly: a hundred nested inserts stay far under the ceiling", () => {
        let low = seedRank(0);
        const high = seedRank(1);
        for (let i = 0; i < 100; i++) low = rankBetween(low, high);
        expect(low.length).toBeLessThan(60);
    });
});

describe("isRank", () => {
    it("accepts a seeded rank", () => {
        expect(isRank(seedRank(0))).toBe(true);
    });

    it("rejects a rank ending in the zero digit, which refuses every later insert", () => {
        expect(isRank("100010")).toBe(false);
    });

    it("rejects anything outside the base-62 alphabet", () => {
        expect(isRank("10-001")).toBe(false);
        expect(isRank("abc!")).toBe(false);
        expect(isRank("")).toBe(false);
    });

    it("rejects a rank too long for this build to order", () => {
        expect(isRank("1".repeat(1024))).toBe(true);
        expect(isRank("1".repeat(1025))).toBe(false);
    });

    it("rejects a non-string a peer put on the wire", () => {
        expect(isRank(1)).toBe(false);
        expect(isRank(null)).toBe(false);
        expect(isRank(undefined)).toBe(false);
        expect(isRank({})).toBe(false);
    });
});
