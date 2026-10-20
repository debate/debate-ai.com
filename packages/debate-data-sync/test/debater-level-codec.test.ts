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
  const ev = (atMs: number, source = "card_cut") => ({ atMs, source, label: source, xp: 5 });
  const a = {
    totalXp: 40,
    lifetimeCounts: { card_cut: 5, drill: 1 },
    daily: { dayKey: "2026-10-20", counts: { card_cut: 2 }, completedChallengeIds: ["c1"] },
    completedMilestoneIds: ["m1"],
    recentXp: [ev(300), ev(100)],
  };
  const b = {
    totalXp: 55,
    lifetimeCounts: { card_cut: 3, flow: 4 },
    daily: { dayKey: "2026-10-20", counts: { card_cut: 1, flow: 3 }, completedChallengeIds: ["c2"] },
    completedMilestoneIds: ["m2", "m1"],
    recentXp: [ev(200), ev(100)],
  };

  it("merges per activity instead of replacing the whole record", () => {
    expect(mergeDebaterLevel(a, b)).toEqual({
      totalXp: 55,
      lifetimeCounts: { card_cut: 5, drill: 1, flow: 4 },
      daily: { dayKey: "2026-10-20", counts: { card_cut: 2, flow: 3 }, completedChallengeIds: ["c1", "c2"] },
      completedMilestoneIds: ["m1", "m2"],
      recentXp: [ev(300), ev(200), ev(100)],
    });
  });

  it("is idempotent and order-insensitive on the numbers", () => {
    const m = mergeDebaterLevel(a, b) as typeof a;
    expect(mergeDebaterLevel(m, b)).toEqual(m);
    expect(mergeDebaterLevel(b, a)).toMatchObject({ totalXp: 55, lifetimeCounts: m.lifetimeCounts });
  });

  it("keeps the newer day's tallies rather than mixing days", () => {
    const next = { ...b, daily: { dayKey: "2026-10-21", counts: { flow: 1 }, completedChallengeIds: [] } };
    expect((mergeDebaterLevel(a, next) as typeof a).daily).toEqual(next.daily);
    expect((mergeDebaterLevel(next, a) as typeof a).daily).toEqual(next.daily);
  });

  it("caps the log at 30 events and drops malformed entries and counts", () => {
    const many = { ...a, recentXp: Array.from({ length: 40 }, (_, i) => ev(i)) };
    const out = mergeDebaterLevel(many, { ...b, lifetimeCounts: { x: -1, y: "2" }, recentXp: [null, { atMs: "no" }] }) as typeof a;
    expect(out.recentXp).toHaveLength(30);
    expect(out.recentXp[0]).toEqual(ev(39));
    expect(out.lifetimeCounts).toEqual(a.lifetimeCounts);
  });

  it("falls back to the higher-XP side when one copy is malformed", () => {
    expect(mergeDebaterLevel(a, { junk: true })).toBe(a);
    expect(mergeDebaterLevel({ junk: true }, a)).toBe(a);
  });

  it("is what the collection merges and pushes", () => {
    const local = decodeDebaterLevel(a);
    const remote = decodeDebaterLevel(b);
    const merged = mergeToolRecords(collection, local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ id: DEBATER_LEVEL_RECORD_ID, lifetimeCounts: { card_cut: 5, flow: 4, drill: 1 } });
    expect(toolRecordsMissingRemotely(collection, local, remote)).toEqual(merged);
    // Once the account holds the merge, nothing is left to push.
    expect(toolRecordsMissingRemotely(collection, local, merged)).toEqual([]);
  });
});
