import { beforeEach, describe, expect, it } from "vitest";
import type { AttributedContribution, ContributorStats } from "../src/lib/contribution-leaderboard";
import type { DailyMissionResult } from "../src/lib/gamified-quests";
import {
  buildContributorUnlockStatusWithStreak,
  buildContributorUnlockStatusWithStreakFromStore,
  buildUnlockStatusRoster,
  buildUnlockStatusWithStreakText,
} from "../src/lib/unlock-streak-status";
import { saveContribution } from "../src/state/contributions";
import { saveDailyMissionResult } from "../src/state/dailyMissionResults";

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

function makeStats(overrides: Partial<ContributorStats> & { contributorId: string }): ContributorStats {
  return {
    contributionCount: 0,
    totalHelpfulnessScore: 0,
    averageHelpfulnessScore: 0,
    bestContributionId: "none",
    bestHelpfulnessScore: 0,
    popularityOnlyOutlierCount: 0,
    completedTaskCount: 0,
    ...overrides,
  };
}

function day(dayKey: string, isComplete: boolean): DailyMissionResult {
  return { dayKey, isComplete };
}

const veteranStats = makeStats({ contributorId: "veteran-vic", contributionCount: 15, totalHelpfulnessScore: 100 });

describe("buildContributorUnlockStatusWithStreak", () => {
  it("merges tier badges with streak badges earned as of the given day", () => {
    const missionResults = [
      day("2026-08-08", true),
      day("2026-08-09", true),
      day("2026-08-10", true),
    ];

    const status = buildContributorUnlockStatusWithStreak(veteranStats, missionResults, "2026-08-10");

    expect(status.tier).toBe("veteran");
    expect(status.unlockedSkillLevel).toBe("intermediate");
    expect(status.streak.currentStreak).toBe(3);
    expect(status.streakBadges).toEqual(["3-Day Streak"]);
    expect(status.badges).toEqual(["Rising Researcher", "Seasoned Contributor", "3-Day Streak"]);
  });

  it("still returns a correct tier-only status when the streak is broken", () => {
    const missionResults = [day("2026-08-08", true), day("2026-08-10", false)];

    const status = buildContributorUnlockStatusWithStreak(veteranStats, missionResults, "2026-08-10");

    expect(status.streak.currentStreak).toBe(0);
    expect(status.streakBadges).toEqual([]);
    expect(status.badges).toEqual(["Rising Researcher", "Seasoned Contributor"]);
  });

  it("returns no badges at all for a novice contributor with no streak", () => {
    const noviceStats = makeStats({ contributorId: "novice-nick" });
    const status = buildContributorUnlockStatusWithStreak(noviceStats, [], "2026-08-10");

    expect(status.tier).toBe("novice");
    expect(status.badges).toEqual([]);
    expect(status.streakBadges).toEqual([]);
    expect(status.streak.currentStreak).toBe(0);
  });
});

describe("buildUnlockStatusWithStreakText", () => {
  it("composes the tier line and streak line via each source slice's own text builder", () => {
    const missionResults = [day("2026-08-09", true), day("2026-08-10", true)];
    const status = buildContributorUnlockStatusWithStreak(veteranStats, missionResults, "2026-08-10");

    const text = buildUnlockStatusWithStreakText(status);

    expect(text).toContain("veteran-vic: veteran tier");
    expect(text).toContain("veteran-vic: 2-day streak");
  });
});

function contribution(id: string, contributorId: string): AttributedContribution {
  return {
    id,
    contributorId,
    kind: "card",
    likes: 0,
    saves: 0,
    qualitySignals: [1],
    reviewerEndorsements: [{ reviewerWeight: 1 }],
  };
}

describe("buildContributorUnlockStatusWithStreakFromStore", () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
  });

  it("derives tier and badges directly from a contributor's persisted contributions", () => {
    for (let i = 0; i < 5; i++) {
      saveContribution(contribution(`alice-${i}`, "alice"));
    }

    const status = buildContributorUnlockStatusWithStreakFromStore("alice", "2026-08-16");

    expect(status.contributorId).toBe("alice");
    expect(status.tier).toBe("apprentice");
    expect(status.badges).toEqual(["Rising Researcher"]);
  });

  it("also folds in the contributor's persisted mission-result streak", () => {
    for (let i = 0; i < 5; i++) {
      saveContribution(contribution(`bob-${i}`, "bob"));
    }
    saveDailyMissionResult({ contributorId: "bob", dayKey: "2026-08-15", isComplete: true });
    saveDailyMissionResult({ contributorId: "bob", dayKey: "2026-08-16", isComplete: true });

    const status = buildContributorUnlockStatusWithStreakFromStore("bob", "2026-08-16");

    expect(status.streak.currentStreak).toBe(2);
    expect(status.tier).toBe("apprentice");
  });

  it("returns an all-zero novice status for a contributor with no persisted contributions", () => {
    const status = buildContributorUnlockStatusWithStreakFromStore("nobody", "2026-08-16");

    expect(status.tier).toBe("novice");
    expect(status.unlockedSkillLevel).toBe("novice");
    expect(status.badges).toEqual([]);
    expect(status.streak.currentStreak).toBe(0);
  });

  it("ignores another contributor's persisted contributions and mission results", () => {
    for (let i = 0; i < 5; i++) {
      saveContribution(contribution(`carol-${i}`, "carol"));
    }
    saveDailyMissionResult({ contributorId: "carol", dayKey: "2026-08-16", isComplete: true });

    const status = buildContributorUnlockStatusWithStreakFromStore("dave", "2026-08-16");

    expect(status.tier).toBe("novice");
    expect(status.streak.currentStreak).toBe(0);
  });
});

describe("buildUnlockStatusRoster", () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
  });

  it("returns an empty roster when no contributions are persisted", () => {
    expect(buildUnlockStatusRoster("2026-08-16")).toEqual([]);
  });

  it("builds every contributor's unlock+streak status, sorted alphabetically by contributorId", () => {
    for (let i = 0; i < 5; i++) {
      saveContribution(contribution(`bob-${i}`, "bob"));
    }
    for (let i = 0; i < 1; i++) {
      saveContribution(contribution(`alice-${i}`, "alice"));
    }
    saveDailyMissionResult({ contributorId: "bob", dayKey: "2026-08-16", isComplete: true });

    const roster = buildUnlockStatusRoster("2026-08-16");

    expect(roster.map((status) => status.contributorId)).toEqual(["alice", "bob"]);
    expect(roster[0].tier).toBe("novice");
    expect(roster[1].tier).toBe("apprentice");
    expect(roster[1].streak.currentStreak).toBe(1);
  });

  it("keeps each contributor's data isolated in the roster", () => {
    for (let i = 0; i < 5; i++) {
      saveContribution(contribution(`carol-${i}`, "carol"));
    }
    saveContribution(contribution("dave-0", "dave"));
    saveDailyMissionResult({ contributorId: "carol", dayKey: "2026-08-16", isComplete: true });

    const roster = buildUnlockStatusRoster("2026-08-16");
    const dave = roster.find((status) => status.contributorId === "dave");

    expect(dave?.streak.currentStreak).toBe(0);
    expect(dave?.tier).toBe("novice");
  });
});
