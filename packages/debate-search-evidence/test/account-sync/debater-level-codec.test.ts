/**
 * @fileoverview Pins the adapter that lets the debater XP/level store join the
 * account sync, and the "higher XP wins" conflict rule.
 */

import { describe, it, expect } from "vitest";
import {
  DEBATER_LEVEL_RECORD_ID,
  decodeDebaterLevel,
  encodeDebaterLevel,
  mergeDebaterLevel,
  preferHigherDebaterXp,
} from "../../src/account-sync/debater-level-codec";
import {
  findToolRecordCollection,
  isSyncableToolRecord,
  mergeToolRecords,
  toolRecordsMissingRemotely,
  type ToolRecordCollection,
} from "../../src/account-sync/toolRecordCollections";

const collection = findToolRecordCollection("debaterLevel") as ToolRecordCollection;
const state = (totalXp: number) => ({
  totalXp,
  lifetimeCounts: { card_cut: 2 },
  daily: { dayKey: "2026-10-20", counts: {}, completedChallengeIds: [] },
  completedMilestoneIds: [],
  recentXp: [],
});

describe("debater level codec", () => {
  it("wraps the stored object as one fixed-id record and back", () => {
    const records = decodeDebaterLevel(state(40));
    expect(records).toEqual([{ ...state(40), id: DEBATER_LEVEL_RECORD_ID }]);
    expect(encodeDebaterLevel(records)).toEqual(state(40));
  });

  it.each([null, undefined, [], "x", 3, {}, { totalXp: -1 }, { totalXp: "9" }, { totalXp: NaN }])(
    "treats %j as no records",
    (raw) => {
      expect(decodeDebaterLevel(raw)).toEqual([]);
    },
  );

  it("encodes nothing for records that are not the progress record", () => {
    expect(encodeDebaterLevel([])).toBeNull();
    expect(encodeDebaterLevel([{ id: "other", totalXp: 5 }, null])).toBeNull();
    expect(encodeDebaterLevel([{ id: DEBATER_LEVEL_RECORD_ID, totalXp: -2 }])).toBeNull();
  });

  it("produces a syncable record", () => {
    expect(isSyncableToolRecord(collection, decodeDebaterLevel(state(1))[0])).toBe(true);
  });
});

describe("preferHigherDebaterXp", () => {
  it("keeps the larger total, and the account on a tie", () => {
    expect(preferHigherDebaterXp(state(50), state(10))).toBe("local");
    expect(preferHigherDebaterXp(state(10), state(50))).toBe("remote");
    expect(preferHigherDebaterXp(state(10), state(10))).toBe("remote");
  });

  it("falls back to whichever side is valid", () => {
    expect(preferHigherDebaterXp(state(1), { junk: true })).toBe("local");
    expect(preferHigherDebaterXp({ junk: true }, state(1))).toBe("remote");
  });
});

describe("debaterLevel merge", () => {
  const local = decodeDebaterLevel(state(90));
  const remote = decodeDebaterLevel(state(30));

  it("keeps higher local XP and pushes it up", () => {
    expect(mergeToolRecords(collection, local, remote)).toEqual(local);
    expect(toolRecordsMissingRemotely(collection, local, remote)).toEqual(local);
  });

  it("adopts higher remote XP and pushes nothing", () => {
    expect(mergeToolRecords(collection, remote, local)).toEqual(local);
    expect(toolRecordsMissingRemotely(collection, remote, local)).toEqual([]);
  });
});

describe("mergeDebaterLevel", () => {
  const ev = (atMs: number, source: string) => ({ atMs, source, label: source, xp: 5 });
  const full = (over: Record<string, unknown>) => ({ ...state(0), ...over });

  it("takes per-kind maximum counts, the larger total and unions milestones", () => {
    const a = full({ totalXp: 80, lifetimeCounts: { card_cut: 5, drill: 1 }, completedMilestoneIds: ["m1"] });
    const b = full({ totalXp: 60, lifetimeCounts: { card_cut: 2, flow: 4 }, completedMilestoneIds: ["m2"] });
    expect(mergeDebaterLevel(a, b)).toMatchObject({
      totalXp: 80,
      lifetimeCounts: { card_cut: 5, drill: 1, flow: 4 },
      completedMilestoneIds: ["m1", "m2"],
    });
  });

  it("merges today's tally on the same day and takes the later day otherwise", () => {
    const day = (dayKey: string, counts: Record<string, number>, ids: string[]) =>
      full({ daily: { dayKey, counts, completedChallengeIds: ids } });
    expect(mergeDebaterLevel(day("2026-10-20", { card_cut: 1 }, ["c1"]), day("2026-10-20", { card_cut: 3, flow: 1 }, ["c2"])))
      .toMatchObject({ daily: { dayKey: "2026-10-20", counts: { card_cut: 3, flow: 1 }, completedChallengeIds: ["c1", "c2"] } });
    expect(mergeDebaterLevel(day("2026-10-19", { card_cut: 9 }, ["c1"]), day("2026-10-20", { flow: 1 }, [])))
      .toMatchObject({ daily: { dayKey: "2026-10-20", counts: { flow: 1 }, completedChallengeIds: [] } });
  });

  it("unions the XP log newest first, de-duplicated and capped at 30", () => {
    const a = full({ recentXp: [ev(3, "x"), ev(1, "y")] });
    const b = full({ recentXp: [ev(2, "z"), ev(1, "y")] });
    expect((mergeDebaterLevel(a, b) as { recentXp: { atMs: number }[] }).recentXp.map((e) => e.atMs)).toEqual([3, 2, 1]);
    const many = full({ recentXp: Array.from({ length: 40 }, (_, i) => ev(i, "k")) });
    expect((mergeDebaterLevel(many, a) as { recentXp: unknown[] }).recentXp).toHaveLength(30);
  });

  describe("per-device ledger", () => {
    const tally = (xp: number, counts: Record<string, number> = {}) => ({ xp, counts });
    const withLedger = (devices: Record<string, ReturnType<typeof tally>>, base = tally(100, { card_cut: 10 })) => {
      const xp = base.xp + Object.values(devices).reduce((n, d) => n + d.xp, 0);
      return full({ totalXp: xp, lifetimeCounts: { card_cut: 10 }, ledger: { base, devices } });
    };

    it("adds work done on two devices instead of keeping the larger total", () => {
      const a = withLedger({ A: tally(10, { card_cut: 2 }) });
      const b = withLedger({ B: tally(5, { card_cut: 1, flow: 3 }) });
      expect(mergeDebaterLevel(a, b)).toMatchObject({
        totalXp: 115,
        lifetimeCounts: { card_cut: 13, flow: 3 },
        ledger: { devices: { A: tally(10, { card_cut: 2 }), B: tally(5, { card_cut: 1, flow: 3 }) } },
      });
    });

    describe("today's counts", () => {
      const dayTally = (xp: number, dayKey: string, counts: Record<string, number>) => ({ xp, counts: {}, daily: { dayKey, counts } });
      const onDay = (dayKey: string, dailyCounts: Record<string, number>, devices: Record<string, unknown>, base: unknown = tally(0)) =>
        full({ daily: { dayKey, counts: dailyCounts, completedChallengeIds: [] }, ledger: { base, devices } });

      it("adds today's per-device counts instead of keeping the larger side", () => {
        const a = onDay("2026-10-20", { card_cut: 2 }, { A: dayTally(0, "2026-10-20", { card_cut: 2 }) });
        const b = onDay("2026-10-20", { card_cut: 3, flow: 1 }, { B: dayTally(0, "2026-10-20", { card_cut: 3, flow: 1 }) });
        const merged = mergeDebaterLevel(a, b);
        expect(merged).toMatchObject({ daily: { counts: { card_cut: 5, flow: 1 } } });
        expect(mergeDebaterLevel(merged, b)).toMatchObject({ daily: { counts: { card_cut: 5, flow: 1 } } });
        expect(mergeDebaterLevel(b, merged)).toMatchObject({ daily: { counts: { card_cut: 5, flow: 1 } } });
      });

      it("counts the pre-ledger snapshot once and ignores entries from another day", () => {
        const base = { xp: 0, counts: {}, daily: { dayKey: "2026-10-20", counts: { card_cut: 4 } } };
        const a = onDay("2026-10-20", { card_cut: 5 }, { A: dayTally(0, "2026-10-20", { card_cut: 1 }) }, base);
        const b = onDay("2026-10-20", { card_cut: 6 }, { B: dayTally(0, "2026-10-20", { card_cut: 2 }), C: dayTally(0, "2026-10-19", { card_cut: 9 }) }, base);
        expect(mergeDebaterLevel(a, b)).toMatchObject({ daily: { counts: { card_cut: 7 } } });
      });

      it("keeps the later day's entry when the same device is seen on two days", () => {
        const old = onDay("2026-10-20", { flow: 1 }, { A: dayTally(0, "2026-10-20", { flow: 1 }) });
        const next = onDay("2026-10-21", { flow: 1 }, { A: dayTally(0, "2026-10-21", { flow: 1 }) });
        expect(mergeDebaterLevel(old, next)).toMatchObject({
          daily: { dayKey: "2026-10-21", counts: { flow: 1 } },
          ledger: { devices: { A: { daily: { dayKey: "2026-10-21" } } } },
        });
      });

      it("falls back to the larger side when entries carry no per-day tally", () => {
        const a = onDay("2026-10-20", { card_cut: 2 }, { A: tally(0) });
        const b = onDay("2026-10-20", { card_cut: 3 }, { B: tally(0) });
        expect(mergeDebaterLevel(a, b)).toMatchObject({ daily: { counts: { card_cut: 3 } } });
      });
    });

    it("is idempotent: merging a copy with its own earlier state never double-counts", () => {
      const old = withLedger({ A: tally(10, { card_cut: 2 }) });
      const grown = withLedger({ A: tally(25, { card_cut: 5 }), B: tally(5) });
      const merged = mergeDebaterLevel(old, grown) as { totalXp: number };
      expect(merged.totalXp).toBe(130);
      expect(mergeDebaterLevel(merged, grown)).toMatchObject({ totalXp: 130 });
      expect(mergeDebaterLevel(grown, merged)).toMatchObject({ totalXp: 130 });
    });

    it("never goes below the larger legacy total when only one side has a ledger", () => {
      const legacy = state(500);
      expect(mergeDebaterLevel(withLedger({ A: tally(10) }), legacy)).toMatchObject({ totalXp: 500 });
      expect(mergeDebaterLevel(legacy, withLedger({ A: tally(10) }))).toMatchObject({ totalXp: 500, ledger: { base: tally(100, { card_cut: 10 }) } });
    });

    it("ignores a malformed ledger", () => {
      const bad = full({ totalXp: 40, ledger: { base: "x", devices: [] } });
      expect(mergeDebaterLevel(bad, state(10))).toMatchObject({ totalXp: 40 });
      expect(mergeDebaterLevel(bad, state(10))).not.toHaveProperty("ledger");
    });
  });

  it("falls back to the valid side and ignores malformed fields", () => {
    expect(mergeDebaterLevel({ junk: true }, state(4))).toEqual(state(4));
    expect(mergeDebaterLevel(state(4), null)).toEqual(state(4));
    const odd = full({ totalXp: 5, lifetimeCounts: { card_cut: "x", drill: -1, flow: 2 }, recentXp: "no", completedMilestoneIds: [1, "m"] });
    expect(mergeDebaterLevel(odd, state(1))).toMatchObject({
      lifetimeCounts: { card_cut: 2, flow: 2 },
      recentXp: [],
      completedMilestoneIds: ["m"],
    });
  });

  it("combines activity from both devices through the sync merge and pushes the result", () => {
    const l = decodeDebaterLevel(full({ totalXp: 50, lifetimeCounts: { card_cut: 4 } }));
    const r = decodeDebaterLevel(full({ totalXp: 70, lifetimeCounts: { flow: 6 } }));
    const merged = mergeToolRecords(collection, l, r)[0];
    expect(merged).toMatchObject({ id: DEBATER_LEVEL_RECORD_ID, totalXp: 70, lifetimeCounts: { card_cut: 4, flow: 6 } });
    expect(toolRecordsMissingRemotely(collection, l, r)).toEqual([merged]);
  });
});

describe("mergeDebaterLevel per-event ledger", () => {
  const DAY = Date.UTC(2026, 9, 20, 12);
  const act = (id: string, source: string, count: number, xp: number, atMs = DAY) => ({
    id, atMs, source, count, xp, label: source,
  });
  const device = (totalXp: number, cardCut: number, events: unknown[], daily = cardCut) => ({
    ...state(0),
    totalXp,
    lifetimeCounts: { card_cut: cardCut },
    daily: { dayKey: "2026-10-20", counts: { card_cut: daily }, completedChallengeIds: [] },
    recentXp: events,
  });
  const shared = act("e0", "card_cut", 2, 10, DAY - 1000);

  it("adds activity done on both devices instead of taking the larger count", () => {
    const a = device(20, 3, [act("a1", "card_cut", 1, 10), shared]);
    const b = device(30, 4, [act("b1", "card_cut", 2, 20), shared]);
    expect(mergeDebaterLevel(a, b)).toMatchObject({
      totalXp: 40,
      lifetimeCounts: { card_cut: 5 },
      daily: { counts: { card_cut: 5 } },
    });
  });

  it("is commutative and idempotent", () => {
    const a = device(20, 3, [act("a1", "card_cut", 1, 10), shared]);
    const b = device(30, 4, [act("b1", "card_cut", 2, 20), shared]);
    const ab = mergeDebaterLevel(a, b) as ReturnType<typeof device>;
    const ba = mergeDebaterLevel(b, a) as ReturnType<typeof device>;
    expect(ab.totalXp).toBe(ba.totalXp);
    expect(ab.lifetimeCounts).toEqual(ba.lifetimeCounts);
    expect(mergeDebaterLevel(ab, ba)).toMatchObject({ totalXp: 40, lifetimeCounts: { card_cut: 5 } });
    expect(mergeDebaterLevel(ab, b)).toMatchObject({ totalXp: 40, lifetimeCounts: { card_cut: 5 } });
  });

  it("does not count a shared event twice", () => {
    const a = device(10, 2, [shared]);
    expect(mergeDebaterLevel(a, structuredClone(a))).toMatchObject({ totalXp: 10, lifetimeCounts: { card_cut: 2 } });
  });

  it("ignores events older than a full log, which may already be in its totals", () => {
    const log = (prefix: string, from: number) =>
      Array.from({ length: 30 }, (_, i) => act(`${prefix}${i}`, "card_cut", 1, 1, DAY + from + i));
    const old = device(100, 50, log("o", 0));
    const recent = device(200, 120, log("r", 100));
    // Without the guard `recent` would also gain the 30 older events (230 / 150).
    expect(mergeDebaterLevel(old, recent)).toMatchObject({ totalXp: 200, lifetimeCounts: { card_cut: 120 } });
    expect(mergeDebaterLevel(recent, old)).toMatchObject({ totalXp: 200, lifetimeCounts: { card_cut: 120 } });
  });

  it("does not pay a milestone bonus twice", () => {
    const bonus = (id: string) => ({ id, atMs: DAY, source: "m1", label: "m1", xp: 50 });
    const a = { ...device(60, 1, [bonus("a1:m1")]), completedMilestoneIds: ["m1"] };
    const b = { ...device(60, 1, [bonus("b1:m1")]), completedMilestoneIds: ["m1"] };
    expect(mergeDebaterLevel(a, b)).toMatchObject({ totalXp: 60, completedMilestoneIds: ["m1"] });
  });

  it("falls back to the larger value when events have no ids", () => {
    const legacy = (xp: number, n: number) =>
      device(xp, n, [{ atMs: DAY, source: "card_cut", label: "c", xp: 10, count: 1 }]);
    expect(mergeDebaterLevel(legacy(20, 3), legacy(30, 4))).toMatchObject({ totalXp: 30, lifetimeCounts: { card_cut: 4 } });
  });

  describe("per-device daily counts in the ledger", () => {
    const tally = (xp: number, n: number, dayKey = "2026-10-20") => ({
      xp,
      counts: { card_cut: n },
      daily: { dayKey, counts: { card_cut: n } },
    });
    const withLedger = (devices: Record<string, unknown>, daily: number) => ({
      ...device(10, daily, []),
      ledger: { base: { xp: 0, counts: {}, daily: { dayKey: "2026-10-20", counts: {} } }, devices },
    });

    it("adds today's counts earned on two devices", () => {
      const a = withLedger({ a: tally(10, 2) }, 2);
      const b = withLedger({ b: tally(10, 3) }, 3);
      expect(mergeDebaterLevel(a, b)).toMatchObject({ daily: { dayKey: "2026-10-20", counts: { card_cut: 5 } } });
      expect(mergeDebaterLevel(b, a)).toMatchObject({ daily: { dayKey: "2026-10-20", counts: { card_cut: 5 } } });
    });

    it("does not add a device's counts from an earlier day", () => {
      const a = withLedger({ a: tally(10, 2, "2026-10-19") }, 0);
      const b = withLedger({ b: tally(10, 3) }, 3);
      expect(mergeDebaterLevel(a, b)).toMatchObject({ daily: { counts: { card_cut: 3 } } });
    });

    it("is idempotent when both sides hold the same ledger", () => {
      const a = withLedger({ a: tally(10, 2) }, 2);
      expect(mergeDebaterLevel(a, structuredClone(a))).toMatchObject({ daily: { counts: { card_cut: 2 } } });
    });

    it("keeps working with ledger entries that predate daily tallies", () => {
      const old = withLedger({ a: { xp: 10, counts: { card_cut: 2 } } }, 2);
      expect(mergeDebaterLevel(old, withLedger({ b: tally(10, 3) }, 3))).toMatchObject({
        daily: { counts: { card_cut: 3 } },
      });
    });
  });
});
