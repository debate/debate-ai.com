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
  const entry = (xp: number, counts: Record<string, number>) => ({ xp, counts });
  const withLedger = (base: ReturnType<typeof entry>, devices: Record<string, ReturnType<typeof entry>>) => ({
    ...state(0),
    ledger: { base, devices },
    totalXp: base.xp + Object.values(devices).reduce((n, d) => n + d.xp, 0),
    lifetimeCounts: {},
  });

  it("adds activity earned on two devices instead of taking the larger", () => {
    const a = withLedger(entry(100, { card_cut: 10 }), { A: entry(20, { card_cut: 2 }) });
    const b = withLedger(entry(100, { card_cut: 10 }), { B: entry(15, { card_cut: 3 }) });
    expect(mergeDebaterLevel(a, b)).toMatchObject({
      totalXp: 135,
      lifetimeCounts: { card_cut: 15 },
      ledger: { base: entry(100, { card_cut: 10 }), devices: { A: entry(20, { card_cut: 2 }), B: entry(15, { card_cut: 3 }) } },
    });
  });

  it("does not double-count the same device seen from both copies", () => {
    const old = withLedger(entry(0, {}), { A: entry(10, { flow: 1 }) });
    const newer = withLedger(entry(0, {}), { A: entry(30, { flow: 3 }) });
    expect(mergeDebaterLevel(old, newer)).toMatchObject({ totalXp: 30, lifetimeCounts: { flow: 3 } });
    expect(mergeDebaterLevel(newer, old)).toMatchObject({ totalXp: 30, lifetimeCounts: { flow: 3 } });
  });

  it("treats a copy without a ledger as base only", () => {
    const legacy = { ...state(0), totalXp: 80, lifetimeCounts: { card_cut: 8 } };
    const ledgered = withLedger(entry(50, { card_cut: 5 }), { A: entry(10, { card_cut: 1 }) });
    expect(mergeDebaterLevel(ledgered, legacy)).toMatchObject({ totalXp: 90, lifetimeCounts: { card_cut: 9 } });
  });

  it("ignores malformed ledger entries", () => {
    const odd = { ...state(5), ledger: { base: { xp: "x" }, devices: { A: { xp: -3, counts: { flow: "y" } }, B: null } } };
    expect(mergeDebaterLevel(odd, state(1))).toMatchObject({ totalXp: 1, lifetimeCounts: { card_cut: 2 } });
  });
});
