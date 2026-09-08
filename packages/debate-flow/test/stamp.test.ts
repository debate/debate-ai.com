import { describe, expect, it } from "vitest";
import { ORIGIN_STAMP, compareStamps, createClock, type Stamp } from "../src/lib/collab/stamp";

const stamp = (ms: number, counter = 0, actor = "a"): Stamp => ({ ms, counter, actor });

describe("compareStamps", () => {
    it("orders by wall time first", () => {
        expect(compareStamps(stamp(1), stamp(2))).toBeLessThan(0);
        expect(compareStamps(stamp(3), stamp(2))).toBeGreaterThan(0);
    });

    it("breaks a wall-time tie by the counter", () => {
        expect(compareStamps(stamp(5, 1), stamp(5, 2))).toBeLessThan(0);
    });

    it("breaks a counter tie by the writing peer, making the order total", () => {
        expect(compareStamps(stamp(5, 1, "a"), stamp(5, 1, "b"))).toBeLessThan(0);
        expect(compareStamps(stamp(5, 1, "b"), stamp(5, 1, "a"))).toBeGreaterThan(0);
        expect(compareStamps(stamp(5, 1, "a"), stamp(5, 1, "a"))).toBe(0);
    });

    it("sorts the origin below every real write", () => {
        expect(compareStamps(ORIGIN_STAMP, stamp(1))).toBeLessThan(0);
    });

    it("sorts a wall time no clock produced at the origin rather than above everything", () => {
        const bogus = { ms: NaN, counter: 0, actor: "z" };
        expect(compareStamps(bogus, stamp(1))).toBeLessThan(0);
        expect(compareStamps({ ms: 1.5, counter: 0, actor: "z" }, stamp(1))).toBeLessThan(0);
    });

    it("sorts a counter no clock produced at the origin", () => {
        const bogus = stamp(5, Number.MAX_SAFE_INTEGER);
        expect(compareStamps(bogus, stamp(5, 1))).toBeLessThan(0);
        expect(compareStamps(stamp(5, -1), stamp(5, 1))).toBeLessThan(0);
        expect(compareStamps(stamp(5, NaN), stamp(5, 1))).toBeLessThan(0);
    });

    it("is a consistent total order over a mixed batch", () => {
        const stamps = [stamp(2, 0, "b"), stamp(1, 5, "a"), stamp(2, 0, "a"), stamp(2, 1, "a")];
        const sorted = [...stamps].sort(compareStamps);
        expect(sorted).toEqual([
            stamp(1, 5, "a"),
            stamp(2, 0, "a"),
            stamp(2, 0, "b"),
            stamp(2, 1, "a"),
        ]);
    });
});

describe("createClock", () => {
    it("stamps every write with its own actor", () => {
        const clock = createClock("peer-1", () => 100);
        expect(clock.tick().actor).toBe("peer-1");
    });

    it("adopts the wall clock when it advances, resetting the counter", () => {
        let now = 100;
        const clock = createClock("a", () => now);
        clock.tick();
        now = 200;
        expect(clock.tick()).toEqual({ ms: 200, counter: 0, actor: "a" });
    });

    it("counts writes inside one millisecond", () => {
        const clock = createClock("a", () => 100);
        expect(clock.tick().counter).toBe(0);
        expect(clock.tick().counter).toBe(1);
        expect(clock.tick().counter).toBe(2);
    });

    it("never goes backwards when the wall clock does", () => {
        let now = 500;
        const clock = createClock("a", () => now);
        const first = clock.tick();
        now = 100;
        const second = clock.tick();
        expect(compareStamps(first, second)).toBeLessThan(0);
        expect(second.ms).toBe(500);
    });

    it("never repeats a stamp under a stalled clock", () => {
        const clock = createClock("a", () => 42);
        const seen = new Set<string>();
        for (let i = 0; i < 100; i++) {
            const s = clock.tick();
            const key = `${s.ms}|${s.counter}`;
            expect(seen.has(key)).toBe(false);
            seen.add(key);
        }
    });

    it("rises strictly, write after write", () => {
        let now = 0;
        const clock = createClock("a", () => now);
        let prev = clock.tick();
        for (let i = 0; i < 50; i++) {
            if (i % 3 === 0) now += 1;
            const next = clock.tick();
            expect(compareStamps(prev, next)).toBeLessThan(0);
            prev = next;
        }
    });

    it("raises past a partner's later wall time", () => {
        const clock = createClock("a", () => 100);
        clock.observe({ ms: 900, counter: 3, actor: "b" });
        expect(clock.tick()).toEqual({ ms: 900, counter: 4, actor: "a" });
    });

    it("raises its counter past a partner's within the same millisecond", () => {
        const clock = createClock("a", () => 100);
        clock.tick();
        clock.observe({ ms: 100, counter: 9, actor: "b" });
        expect(clock.tick()).toEqual({ ms: 100, counter: 10, actor: "a" });
    });

    it("ignores a partner's earlier stamp", () => {
        const clock = createClock("a", () => 500);
        clock.tick();
        clock.observe({ ms: 5, counter: 0, actor: "b" });
        expect(clock.tick().ms).toBe(500);
    });

    it("ignores a wall time no clock produces", () => {
        const clock = createClock("a", () => 100);
        clock.observe({ ms: Number.NaN, counter: 0, actor: "b" });
        clock.observe({ ms: -5, counter: 0, actor: "b" });
        clock.observe({ ms: 1e30, counter: 0, actor: "b" });
        expect(clock.tick().ms).toBe(100);
    });

    it("clamps a counter no clock produced but keeps the stamp's wall time", () => {
        const clock = createClock("a", () => 100);
        clock.observe({ ms: 800, counter: Number.MAX_SAFE_INTEGER, actor: "b" });
        const next = clock.tick();
        expect(next.ms).toBe(800);
        expect(next.counter).toBe(1);
    });

    it("stays above a far-future stamp so the debater can still type over that cell", () => {
        const clock = createClock("a", () => 100);
        const remote = { ms: 10_000, counter: 7, actor: "b" };
        clock.observe(remote);
        expect(compareStamps(remote, clock.tick())).toBeLessThan(0);
    });

    it("defaults to the real wall clock", () => {
        const before = Date.now();
        const s = createClock("a").tick();
        expect(s.ms).toBeGreaterThanOrEqual(before);
    });
});
