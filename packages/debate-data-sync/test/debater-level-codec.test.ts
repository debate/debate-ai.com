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
} from "../src/state/debater-level-codec";
import {
  findToolRecordCollection,
  isSyncableToolRecord,
  mergeToolRecords,
  toolRecordsMissingRemotely,
  type ToolRecordCollection,
} from "../src/state/toolRecordCollections";

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

describe("mergeDebaterLevel with a per-device ledger", () => {
  const entry = (xp: number, counts: Record<string, number>, day = "2026-10-20", dayCounts: Record<string, number> = counts) => ({
    xp, counts, day, dayCounts,
  });
  const withLedger = (ledger: Record<string, unknown>, over: Record<string, unknown> = {}) => ({
    ...state(0),
    totalXp: 0,
    ledger,
    ...over,
  });

  it("adds activity done on two devices instead of taking the larger side", () => {
    const base = entry(100, { card_cut: 10 }, "2026-10-19", {});
    const a = withLedger({ base, laptop: entry(25, { card_cut: 5 }) }, { totalXp: 125 });
    const b = withLedger({ base, phone: entry(15, { card_cut: 3 }) }, { totalXp: 115 });
    expect(mergeDebaterLevel(a, b)).toMatchObject({
      totalXp: 140,
      lifetimeCounts: { card_cut: 18 },
      daily: { dayKey: "2026-10-20", counts: { card_cut: 8 } },
    });
  });

  it("is idempotent and commutative, so re-syncing never double-counts", () => {
    const a = withLedger({ base: entry(10, { card_cut: 2 }), x: entry(20, { card_cut: 4 }) }, { totalXp: 30 });
    const b = withLedger({ base: entry(10, { card_cut: 2 }), y: entry(5, { card_cut: 1 }) }, { totalXp: 15 });
    const ab = mergeDebaterLevel(a, b) as { totalXp: number; ledger: unknown };
    const ba = mergeDebaterLevel(b, a) as { totalXp: number; ledger: unknown };
    expect(ab.totalXp).toBe(35);
    expect(ba.totalXp).toBe(35);
    expect(ab.ledger).toEqual(ba.ledger);
    expect((mergeDebaterLevel(ab, a) as { totalXp: number }).totalXp).toBe(35);
  });

  it("keeps the larger copy of one device's entry", () => {
    const a = withLedger({ d: entry(10, { card_cut: 2 }) }, { totalXp: 10 });
    const b = withLedger({ d: entry(30, { card_cut: 6 }) }, { totalXp: 30 });
    expect(mergeDebaterLevel(a, b)).toMatchObject({ totalXp: 30, lifetimeCounts: { card_cut: 6 } });
  });

  it("drops an earlier day's tally from the daily counts", () => {
    const a = withLedger({ d: entry(10, { card_cut: 2 }, "2026-10-19") }, { totalXp: 10 });
    const b = withLedger({ e: entry(5, { card_cut: 1 }, "2026-10-20") }, { totalXp: 5 });
    expect(mergeDebaterLevel(a, b)).toMatchObject({
      lifetimeCounts: { card_cut: 3 },
      daily: { dayKey: "2026-10-20", counts: { card_cut: 1 } },
    });
  });

  it("folds a pre-ledger copy in as the shared base without doubling it", () => {
    const legacy = { ...state(100), lifetimeCounts: { card_cut: 10 } };
    const upgraded = withLedger(
      { base: entry(100, { card_cut: 10 }, "2026-10-20", {}), phone: entry(15, { card_cut: 3 }) },
      { totalXp: 115 },
    );
    expect(mergeDebaterLevel(legacy, upgraded)).toMatchObject({ totalXp: 115, lifetimeCounts: { card_cut: 13 } });
  });

  it("ignores malformed ledger entries", () => {
    const a = withLedger({ bad: { xp: -1 }, d: entry(10, { card_cut: 2 }) }, { totalXp: 10 });
    expect(mergeDebaterLevel(a, state(4))).toMatchObject({ totalXp: 14 }); // 10 from "d" + the pre-ledger 4 as base
  });
});
