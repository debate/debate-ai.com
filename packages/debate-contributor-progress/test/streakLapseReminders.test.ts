import { beforeEach, describe, expect, it } from "vitest";
import {
  getPersistedStreakLapseReminderInfo,
  isStreakLapseReminderEnabled,
  listStreakLapseReminderContributorIds,
  setStreakLapseReminderEnabled,
} from "../src/state/streakLapseReminders";
import { saveDailyMissionResult } from "../src/state/dailyMissionResults";
import { applyPersistedStreakFreeze } from "../src/state/streakFreezes";

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

describe("listStreakLapseReminderContributorIds / isStreakLapseReminderEnabled", () => {
  it("returns nothing when no one has opted in", () => {
    expect(listStreakLapseReminderContributorIds()).toEqual([]);
    expect(isStreakLapseReminderEnabled("alice")).toBe(false);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("streakLapseReminders", "{not json");
    expect(listStreakLapseReminderContributorIds()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("streakLapseReminders", JSON.stringify({ not: "an array" }));
    expect(listStreakLapseReminderContributorIds()).toEqual([]);
  });
});

describe("setStreakLapseReminderEnabled", () => {
  it("opts a contributor in", () => {
    setStreakLapseReminderEnabled("alice", true);
    expect(isStreakLapseReminderEnabled("alice")).toBe(true);
    expect(listStreakLapseReminderContributorIds()).toEqual(["alice"]);
  });

  it("does not duplicate an already-enabled contributor", () => {
    setStreakLapseReminderEnabled("alice", true);
    setStreakLapseReminderEnabled("alice", true);
    expect(listStreakLapseReminderContributorIds()).toEqual(["alice"]);
  });

  it("opts a contributor back out", () => {
    setStreakLapseReminderEnabled("alice", true);
    setStreakLapseReminderEnabled("alice", false);
    expect(isStreakLapseReminderEnabled("alice")).toBe(false);
    expect(listStreakLapseReminderContributorIds()).toEqual([]);
  });

  it("is a no-op to disable a contributor who was never enabled", () => {
    setStreakLapseReminderEnabled("alice", false);
    expect(listStreakLapseReminderContributorIds()).toEqual([]);
  });

  it("keeps different contributors' opt-ins independent", () => {
    setStreakLapseReminderEnabled("alice", true);
    setStreakLapseReminderEnabled("bob", true);
    setStreakLapseReminderEnabled("alice", false);

    expect(isStreakLapseReminderEnabled("alice")).toBe(false);
    expect(isStreakLapseReminderEnabled("bob")).toBe(true);
  });
});

describe("getPersistedStreakLapseReminderInfo", () => {
  it("reports disabled with no risk when a contributor has no history and hasn't opted in", () => {
    expect(getPersistedStreakLapseReminderInfo("alice", "2026-08-10")).toEqual({
      enabled: false,
      riskLength: null,
    });
  });

  it("reports the at-risk streak length once opted in with an in-progress streak", () => {
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-08", isComplete: true });
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-09", isComplete: true });
    setStreakLapseReminderEnabled("alice", true);

    expect(getPersistedStreakLapseReminderInfo("alice", "2026-08-10")).toEqual({
      enabled: true,
      riskLength: 2,
    });
  });

  it("reports no risk once today's mission is complete, even when opted in", () => {
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-09", isComplete: true });
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-10", isComplete: true });
    setStreakLapseReminderEnabled("alice", true);

    expect(getPersistedStreakLapseReminderInfo("alice", "2026-08-10").riskLength).toBeNull();
  });

  it("bridges streak freezes into the at-risk length, matching the roster's own freeze-bridged streak", () => {
    // alice completed 08-07 and 08-09, missed 08-08, then spent a grace day
    // on the gap — her freeze-bridged streak is 3, and the banner must say
    // 3, not the raw unfrozen 1.
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-07", isComplete: true });
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-09", isComplete: true });
    applyPersistedStreakFreeze("alice", "2026-08-08", "2026-08-09");
    setStreakLapseReminderEnabled("alice", true);

    expect(getPersistedStreakLapseReminderInfo("alice", "2026-08-10")).toEqual({
      enabled: true,
      riskLength: 3,
    });
  });

  it("keeps different contributors' risk independent", () => {
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-09", isComplete: true });
    saveDailyMissionResult({ contributorId: "bob", dayKey: "2026-08-09", isComplete: false });
    setStreakLapseReminderEnabled("alice", true);
    setStreakLapseReminderEnabled("bob", true);

    expect(getPersistedStreakLapseReminderInfo("alice", "2026-08-10").riskLength).toBe(1);
    expect(getPersistedStreakLapseReminderInfo("bob", "2026-08-10").riskLength).toBeNull();
  });
});
