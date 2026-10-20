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

describe("mergeDebaterLevel with an activity ledger", () => {
  const DAY = Date.parse("2026-10-20T12:00:00Z");
  const entry = (id: string, kind: string, over: Record<string, unknown> = {}) => ({
    id, atMs: DAY, kind, count: 1, xp: 5, bonuses: [], ...over,
  });
  const device = (totalXp: number, counts: Record<string, number>, ledger: unknown[], over: Record<string, unknown> = {}) => ({
    ...state(totalXp),
    lifetimeCounts: counts,
    daily: { dayKey: "2026-10-20", counts, completedChallengeIds: [] },
    ledger,
    ...over,
  });
  const base = [entry("b1", "card_cut")];

  it("adds activity each device recorded instead of taking the larger side", () => {
    const a = device(10, { card_cut: 2 }, [entry("a1", "card_cut"), ...base]);
    const b = device(10, { card_cut: 2 }, [entry("b2", "card_cut"), ...base]);
    const merged = mergeDebaterLevel(a, b) as ReturnType<typeof device>;
    expect(merged.totalXp).toBe(15);
    expect(merged.lifetimeCounts).toEqual({ card_cut: 3 });
    expect((merged.daily as { counts: unknown }).counts).toEqual({ card_cut: 3 });
    expect((merged.ledger as { id: string }[]).map((e) => e.id).sort()).toEqual(["a1", "b1", "b2"]);
  });

  it("is the same from either direction and idempotent", () => {
    const a = device(10, { card_cut: 2 }, [entry("a1", "card_cut"), ...base]);
    const b = device(10, { card_cut: 2 }, [entry("b2", "card_cut"), ...base]);
    const ab = mergeDebaterLevel(a, b);
    expect(mergeDebaterLevel(b, a)).toEqual(ab);
    expect(mergeDebaterLevel(ab, a)).toEqual(ab);
    expect(mergeDebaterLevel(ab, ab)).toEqual(ab);
  });

  it("pays a challenge bonus both devices earned only once", () => {
    const bonus = { id: "milestone-first-card", xp: 25, repeat: "once" };
    const a = device(30, { card_cut: 1 }, [entry("a1", "card_cut", { bonuses: [bonus] })]);
    const b = device(30, { card_cut: 1 }, [entry("b1", "card_cut", { bonuses: [bonus] })]);
    const merged = mergeDebaterLevel(a, b) as { totalXp: number; lifetimeCounts: unknown };
    expect(merged.totalXp).toBe(35); // 30 + one extra card (5), not a second 25 bonus
    expect(merged.lifetimeCounts).toEqual({ card_cut: 2 });
  });

  it("does not re-add events an already-full ledger may have evicted", () => {
    const ev = (from: number, to: number) =>
      Array.from({ length: to - from }, (_, i) => entry(`n${to - 1 - i}`, "card_cut", { atMs: DAY + (to - 1 - i) }));
    // `a` is current (newest 200 events, window n100–n299); `b` is a stale snapshot (n0–n199).
    const a = device(1500, { card_cut: 300 }, ev(100, 300));
    const b = device(1000, { card_cut: 200 }, ev(0, 200));
    // n0–n99 are older than a's window, so a has them already; adding them would give 2000.
    expect(mergeDebaterLevel(a, b)).toMatchObject({ totalXp: 1500, lifetimeCounts: { card_cut: 300 } });
    expect(mergeDebaterLevel(b, a)).toMatchObject({ totalXp: 1500, lifetimeCounts: { card_cut: 300 } });
  });

  it("keeps today's tally untouched when the days differ", () => {
    const a = device(10, { card_cut: 2 }, [entry("a1", "card_cut")]);
    const b = device(10, { card_cut: 2 }, [entry("b1", "card_cut")], {
      daily: { dayKey: "2026-10-21", counts: { flow: 1 }, completedChallengeIds: [] },
    });
    expect(mergeDebaterLevel(a, b)).toMatchObject({ daily: { dayKey: "2026-10-21", counts: { flow: 1 } } });
  });

  it("falls back to the max rule when either copy has no ledger, and ignores malformed entries", () => {
    const withLedger = device(50, { card_cut: 4 }, [entry("a1", "card_cut")]);
    const legacy = { ...state(70), lifetimeCounts: { card_cut: 2 } };
    const merged = mergeDebaterLevel(withLedger, legacy) as Record<string, unknown>;
    expect(merged).toMatchObject({ totalXp: 70, lifetimeCounts: { card_cut: 4 } });
    const junk = device(50, { card_cut: 1 }, [null, { id: 3 }, entry("ok", "card_cut", { xp: -5 })]);
    expect(mergeDebaterLevel(junk, withLedger)).toMatchObject({ totalXp: 55 });
  });
});
