import { beforeEach, describe, expect, it } from "vitest";
import {
  buildPersistedContributorQuestStreak,
  deleteDailyMissionResult,
  getDailyMissionResult,
  listDailyMissionResults,
  listDailyMissionResultsForContributor,
  saveDailyMissionResult,
  type DailyMissionResultRecord,
} from "../src/state/dailyMissionResults";

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

const ALICE_DAY1: DailyMissionResultRecord = { contributorId: "alice", dayKey: "2026-08-15", isComplete: true };
const ALICE_DAY2: DailyMissionResultRecord = { contributorId: "alice", dayKey: "2026-08-16", isComplete: true };
const BOB_DAY1: DailyMissionResultRecord = { contributorId: "bob", dayKey: "2026-08-15", isComplete: false };

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listDailyMissionResults", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listDailyMissionResults()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("dailyMissionResults", "{not json");
    expect(listDailyMissionResults()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("dailyMissionResults", JSON.stringify({ not: "an array" }));
    expect(listDailyMissionResults()).toEqual([]);
  });

  it("lists every saved mission result, across contributors and days", () => {
    saveDailyMissionResult(ALICE_DAY1);
    saveDailyMissionResult(BOB_DAY1);
    expect(listDailyMissionResults()).toEqual([ALICE_DAY1, BOB_DAY1]);
  });
});

describe("listDailyMissionResultsForContributor", () => {
  it("lists a contributor's history across days, excluding other contributors", () => {
    saveDailyMissionResult(ALICE_DAY1);
    saveDailyMissionResult(ALICE_DAY2);
    saveDailyMissionResult(BOB_DAY1);
    expect(listDailyMissionResultsForContributor("alice")).toEqual([ALICE_DAY1, ALICE_DAY2]);
  });

  it("returns an empty list for a contributorId with no stored history", () => {
    expect(listDailyMissionResultsForContributor("missing")).toEqual([]);
  });
});

describe("getDailyMissionResult", () => {
  it("finds a saved mission result by contributorId + dayKey", () => {
    saveDailyMissionResult(ALICE_DAY1);
    saveDailyMissionResult(BOB_DAY1);
    expect(getDailyMissionResult("alice", "2026-08-15")).toEqual(ALICE_DAY1);
    expect(getDailyMissionResult("bob", "2026-08-15")).toEqual(BOB_DAY1);
  });

  it("returns undefined for a contributorId/dayKey pair that isn't stored", () => {
    saveDailyMissionResult(ALICE_DAY1);
    expect(getDailyMissionResult("alice", "2026-08-16")).toBeUndefined();
    expect(getDailyMissionResult("missing", "2026-08-15")).toBeUndefined();
  });
});

describe("saveDailyMissionResult", () => {
  it("upserts — saving an existing contributorId+dayKey pair overwrites rather than duplicating it", () => {
    saveDailyMissionResult(ALICE_DAY1);
    const recomputed: DailyMissionResultRecord = { ...ALICE_DAY1, isComplete: false };
    saveDailyMissionResult(recomputed);

    expect(listDailyMissionResults()).toEqual([recomputed]);
    expect(getDailyMissionResult("alice", "2026-08-15")).toEqual(recomputed);
  });

  it("keeps different days for the same contributor distinct", () => {
    saveDailyMissionResult(ALICE_DAY1);
    saveDailyMissionResult(ALICE_DAY2);
    expect(listDailyMissionResults()).toHaveLength(2);
  });
});

describe("deleteDailyMissionResult", () => {
  it("removes a stored mission result by contributorId + dayKey", () => {
    saveDailyMissionResult(ALICE_DAY1);
    saveDailyMissionResult(BOB_DAY1);
    deleteDailyMissionResult("alice", "2026-08-15");

    expect(listDailyMissionResults()).toEqual([BOB_DAY1]);
    expect(getDailyMissionResult("alice", "2026-08-15")).toBeUndefined();
  });

  it("is a no-op when the contributorId/dayKey pair isn't stored", () => {
    saveDailyMissionResult(BOB_DAY1);
    deleteDailyMissionResult("alice", "2026-08-15");
    expect(listDailyMissionResults()).toEqual([BOB_DAY1]);
  });
});

describe("buildPersistedContributorQuestStreak", () => {
  it("builds a streak directly from a contributor's persisted mission-result history", () => {
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-14", isComplete: true });
    saveDailyMissionResult(ALICE_DAY1);
    saveDailyMissionResult(ALICE_DAY2);
    saveDailyMissionResult(BOB_DAY1);

    const status = buildPersistedContributorQuestStreak("alice", "2026-08-16");
    expect(status.contributorId).toBe("alice");
    expect(status.streak.currentStreak).toBe(3);
    expect(status.streak.longestStreak).toBe(3);
    expect(status.earnedBadges).toEqual(["3-Day Streak"]);
  });

  it("ignores another contributor's persisted history", () => {
    saveDailyMissionResult(ALICE_DAY1);
    saveDailyMissionResult(ALICE_DAY2);

    const status = buildPersistedContributorQuestStreak("bob", "2026-08-16");
    expect(status.streak.currentStreak).toBe(0);
    expect(status.earnedBadges).toEqual([]);
  });

  it("returns a zero streak for a contributor with no persisted history", () => {
    const status = buildPersistedContributorQuestStreak("missing", "2026-08-16");
    expect(status.streak).toEqual({ currentStreak: 0, longestStreak: 0, lastCompletedDayKey: null });
  });
});
