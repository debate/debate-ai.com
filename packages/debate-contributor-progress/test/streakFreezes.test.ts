import { beforeEach, describe, expect, it } from "vitest";
import {
  applyPersistedStreakFreeze,
  buildContributorQuestStreakWithFreezes,
  buildQuestStreakRosterWithFreezes,
  getPersistedAvailableStreakFreezes,
  listStreakFreezeDayKeysForContributor,
  listStreakFreezes,
  mergeRemoteStreakFreezeDayKeys,
} from "../src/state/streakFreezes";
import { saveDailyMissionResult } from "../src/state/dailyMissionResults";
import { MAX_STREAK_FREEZES_PER_WINDOW } from "../src/lib/gamified-quests";

/** Minimal in-memory `localStorage` mock — this package's Vitest environment is `node`, with no DOM. */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listStreakFreezes / listStreakFreezeDayKeysForContributor", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listStreakFreezes()).toEqual([]);
    expect(listStreakFreezeDayKeysForContributor("alice")).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("streakFreezes", "{not json");
    expect(listStreakFreezes()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("streakFreezes", JSON.stringify({ not: "an array" }));
    expect(listStreakFreezes()).toEqual([]);
  });
});

describe("applyPersistedStreakFreeze", () => {
  it("saves a freeze for a past, incomplete day and reports it as applied", () => {
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-08", isComplete: true });
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-09", isComplete: false });

    const result = applyPersistedStreakFreeze("alice", "2026-08-09", "2026-08-10");

    expect(result).toEqual({ applied: true, record: { contributorId: "alice", dayKey: "2026-08-09" } });
    expect(listStreakFreezeDayKeysForContributor("alice")).toEqual(["2026-08-09"]);
  });

  it("denies and does not save when the day was already completed", () => {
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-09", isComplete: true });

    const result = applyPersistedStreakFreeze("alice", "2026-08-09", "2026-08-10");

    expect(result).toEqual({ applied: false, reason: "already-complete" });
    expect(listStreakFreezeDayKeysForContributor("alice")).toEqual([]);
  });

  it("denies re-freezing an already-frozen day", () => {
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-09", isComplete: false });
    applyPersistedStreakFreeze("alice", "2026-08-09", "2026-08-10");

    const second = applyPersistedStreakFreeze("alice", "2026-08-09", "2026-08-10");

    expect(second).toEqual({ applied: false, reason: "already-frozen" });
    expect(listStreakFreezeDayKeysForContributor("alice")).toEqual(["2026-08-09"]);
  });

  it("denies once a contributor's allowance is exhausted", () => {
    for (let i = 0; i < MAX_STREAK_FREEZES_PER_WINDOW; i++) {
      const dayKey = `2026-08-0${i + 1}`;
      saveDailyMissionResult({ contributorId: "alice", dayKey, isComplete: false });
      expect(applyPersistedStreakFreeze("alice", dayKey, "2026-08-10").applied).toBe(true);
    }

    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-09", isComplete: false });
    const result = applyPersistedStreakFreeze("alice", "2026-08-09", "2026-08-10");
    expect(result).toEqual({ applied: false, reason: "no-freezes-available" });
  });

  it("keeps different contributors' freezes independent", () => {
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-09", isComplete: false });
    saveDailyMissionResult({ contributorId: "bob", dayKey: "2026-08-09", isComplete: false });

    applyPersistedStreakFreeze("alice", "2026-08-09", "2026-08-10");

    expect(listStreakFreezeDayKeysForContributor("alice")).toEqual(["2026-08-09"]);
    expect(listStreakFreezeDayKeysForContributor("bob")).toEqual([]);
  });
});

describe("mergeRemoteStreakFreezeDayKeys", () => {
  it("adds remote dayKeys not already present locally and reports a change", () => {
    const changed = mergeRemoteStreakFreezeDayKeys("alice", ["2026-08-09", "2026-08-15"]);
    expect(changed).toBe(true);
    expect(listStreakFreezeDayKeysForContributor("alice").sort()).toEqual(["2026-08-09", "2026-08-15"]);
  });

  it("is a no-op reporting no change when every remote dayKey is already local", () => {
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-09", isComplete: false });
    applyPersistedStreakFreeze("alice", "2026-08-09", "2026-08-10");

    const changed = mergeRemoteStreakFreezeDayKeys("alice", ["2026-08-09"]);
    expect(changed).toBe(false);
    expect(listStreakFreezeDayKeysForContributor("alice")).toEqual(["2026-08-09"]);
  });

  it("only adds the dayKeys not already present, without duplicating overlapping ones", () => {
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-09", isComplete: false });
    applyPersistedStreakFreeze("alice", "2026-08-09", "2026-08-10");

    const changed = mergeRemoteStreakFreezeDayKeys("alice", ["2026-08-09", "2026-08-20"]);
    expect(changed).toBe(true);
    expect(listStreakFreezeDayKeysForContributor("alice").sort()).toEqual(["2026-08-09", "2026-08-20"]);
  });

  it("bypasses validation — a remote dayKey merges in even if it wouldn't pass canApplyStreakFreeze locally", () => {
    // No mission-result history at all for alice, which `applyPersistedStreakFreeze`
    // would deny — merging still succeeds since it's replaying an
    // already-approved freeze from another device.
    const changed = mergeRemoteStreakFreezeDayKeys("alice", ["2026-08-09"]);
    expect(changed).toBe(true);
    expect(listStreakFreezeDayKeysForContributor("alice")).toEqual(["2026-08-09"]);
  });

  it("keeps different contributors' freezes independent", () => {
    mergeRemoteStreakFreezeDayKeys("alice", ["2026-08-09"]);
    expect(listStreakFreezeDayKeysForContributor("bob")).toEqual([]);
  });

  it("is a no-op for an empty remote list", () => {
    expect(mergeRemoteStreakFreezeDayKeys("alice", [])).toBe(false);
    expect(listStreakFreezeDayKeysForContributor("alice")).toEqual([]);
  });
});

describe("getPersistedAvailableStreakFreezes", () => {
  it("returns the full allowance for a contributor with no used freezes", () => {
    expect(getPersistedAvailableStreakFreezes("alice", "2026-08-10")).toBe(MAX_STREAK_FREEZES_PER_WINDOW);
  });

  it("reflects freezes already spent", () => {
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-09", isComplete: false });
    applyPersistedStreakFreeze("alice", "2026-08-09", "2026-08-10");
    expect(getPersistedAvailableStreakFreezes("alice", "2026-08-10")).toBe(MAX_STREAK_FREEZES_PER_WINDOW - 1);
  });
});

describe("buildContributorQuestStreakWithFreezes", () => {
  it("bridges a gap day using a persisted freeze", () => {
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-08", isComplete: true });
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-09", isComplete: false });
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-10", isComplete: true });
    applyPersistedStreakFreeze("alice", "2026-08-09", "2026-08-10");

    const status = buildContributorQuestStreakWithFreezes("alice", "2026-08-10");
    expect(status.streak.currentStreak).toBe(3);
  });

  it("matches the un-frozen streak when a contributor has no freezes", () => {
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-09", isComplete: false });
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-10", isComplete: true });

    const status = buildContributorQuestStreakWithFreezes("alice", "2026-08-10");
    expect(status.streak.currentStreak).toBe(1);
  });
});

describe("buildQuestStreakRosterWithFreezes", () => {
  it("returns an empty roster when nothing is stored", () => {
    expect(buildQuestStreakRosterWithFreezes("2026-08-10")).toEqual([]);
  });

  it("includes a contributor who only has a freeze record, with no other mission-result history changed", () => {
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-08", isComplete: true });
    saveDailyMissionResult({ contributorId: "bob", dayKey: "2026-08-08", isComplete: true });

    const roster = buildQuestStreakRosterWithFreezes("2026-08-10");
    expect(roster.map((s) => s.contributorId)).toEqual(["alice", "bob"]);
  });

  it("reflects each contributor's own applied freezes in the roster, sorted by contributorId", () => {
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-08", isComplete: true });
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-09", isComplete: false });
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-10", isComplete: true });
    applyPersistedStreakFreeze("alice", "2026-08-09", "2026-08-10");

    saveDailyMissionResult({ contributorId: "bob", dayKey: "2026-08-10", isComplete: true });

    const roster = buildQuestStreakRosterWithFreezes("2026-08-10");
    expect(roster[0].contributorId).toBe("alice");
    expect(roster[0].streak.currentStreak).toBe(3);
    expect(roster[1].contributorId).toBe("bob");
    expect(roster[1].streak.currentStreak).toBe(1);
  });
});
