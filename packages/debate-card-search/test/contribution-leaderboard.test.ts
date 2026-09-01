import { describe, expect, it } from "vitest";
import {
  buildContributorStats,
  buildLeaderboard,
  filterContributionsByRange,
  groupContributionsByContributor,
  isWithinLeaderboardRange,
  type AttributedContribution,
} from "../src/lib/contribution-leaderboard";

const strongCard: AttributedContribution = {
  id: "strong-card",
  contributorId: "alice",
  kind: "card",
  likes: 2,
  saves: 1,
  qualitySignals: [0.9, 0.95],
  reviewerEndorsements: [{ reviewerWeight: 1 }, { reviewerWeight: 0.9 }],
};

const weakSummary: AttributedContribution = {
  id: "weak-summary",
  contributorId: "alice",
  kind: "summary",
  likes: 0,
  saves: 0,
  qualitySignals: [0.2],
  reviewerEndorsements: [],
};

const viralHighlight: AttributedContribution = {
  id: "viral-highlight",
  contributorId: "bob",
  kind: "highlight",
  likes: 500,
  saves: 500,
  qualitySignals: [0.1],
  reviewerEndorsements: [],
};

describe("groupContributionsByContributor", () => {
  it("groups contributions by contributorId, preserving order within a group", () => {
    const grouped = groupContributionsByContributor([strongCard, viralHighlight, weakSummary]);
    expect(Array.from(grouped.keys())).toEqual(["alice", "bob"]);
    expect(grouped.get("alice")?.map((c) => c.id)).toEqual(["strong-card", "weak-summary"]);
    expect(grouped.get("bob")?.map((c) => c.id)).toEqual(["viral-highlight"]);
  });

  it("returns an empty map for an empty contribution list", () => {
    expect(groupContributionsByContributor([]).size).toBe(0);
  });
});

describe("buildContributorStats", () => {
  it("aggregates a contributor's contributions into totals and an average", () => {
    const stats = buildContributorStats("alice", [strongCard, weakSummary]);
    expect(stats.contributorId).toBe("alice");
    expect(stats.contributionCount).toBe(2);
    expect(stats.totalHelpfulnessScore).toBeCloseTo(
      stats.averageHelpfulnessScore * 2,
      5,
    );
    expect(stats.bestContributionId).toBe("strong-card");
  });

  it("counts popularity-only outliers within the contributor's contributions", () => {
    const stats = buildContributorStats("bob", [viralHighlight]);
    expect(stats.popularityOnlyOutlierCount).toBe(1);
  });

  it("breaks a best-contribution tie by id for a deterministic result", () => {
    const tiedA: AttributedContribution = { ...weakSummary, id: "b", contributorId: "carol" };
    const tiedB: AttributedContribution = { ...weakSummary, id: "a", contributorId: "carol" };
    const stats = buildContributorStats("carol", [tiedA, tiedB]);
    expect(stats.bestContributionId).toBe("a");
  });

  it("throws for a contributor with no contributions", () => {
    expect(() => buildContributorStats("nobody", [])).toThrow();
  });

  it("defaults completedTaskCount to 0 and accepts a supplied value", () => {
    expect(buildContributorStats("alice", [strongCard]).completedTaskCount).toBe(0);
    expect(buildContributorStats("alice", [strongCard], undefined, 4).completedTaskCount).toBe(4);
  });
});

describe("buildLeaderboard", () => {
  it("ranks contributors with more numerous, well-received contributions above a single viral hit", () => {
    const leaderboard = buildLeaderboard([strongCard, weakSummary, viralHighlight]);
    expect(leaderboard.map((s) => s.contributorId)).toEqual(["alice", "bob"]);
  });

  it("breaks ties by contributorId for a stable, deterministic order", () => {
    const zed: AttributedContribution = { ...weakSummary, id: "zed-card", contributorId: "zed" };
    const amy: AttributedContribution = { ...weakSummary, id: "amy-card", contributorId: "amy" };
    const leaderboard = buildLeaderboard([zed, amy]);
    expect(leaderboard.map((s) => s.contributorId)).toEqual(["amy", "zed"]);
  });

  it("returns an empty leaderboard for an empty contribution list", () => {
    expect(buildLeaderboard([])).toEqual([]);
  });

  it("honors custom weights when aggregating", () => {
    const popularityOnly = buildLeaderboard([viralHighlight], {
      popularity: 1,
      quality: 0,
      reviewer: 0,
    });
    expect(popularityOnly[0].totalHelpfulnessScore).toBe(100);
  });

  it("defaults completedTaskCount to 0 when no completed-task counts are supplied", () => {
    const leaderboard = buildLeaderboard([strongCard]);
    expect(leaderboard[0].completedTaskCount).toBe(0);
  });

  it("folds a supplied completedTaskCounts map into a contributor's row", () => {
    const leaderboard = buildLeaderboard([strongCard, viralHighlight], undefined, new Map([["alice", 3]]));
    const alice = leaderboard.find((s) => s.contributorId === "alice");
    const bob = leaderboard.find((s) => s.contributorId === "bob");
    expect(alice?.completedTaskCount).toBe(3);
    expect(bob?.completedTaskCount).toBe(0);
  });

  it("includes a task-only contributor who has completed tasks but no scored contribution", () => {
    const leaderboard = buildLeaderboard([strongCard], undefined, new Map([["dave", 5]]));
    const dave = leaderboard.find((s) => s.contributorId === "dave");
    expect(dave).toEqual({
      contributorId: "dave",
      contributionCount: 0,
      totalHelpfulnessScore: 0,
      averageHelpfulnessScore: 0,
      bestContributionId: "",
      bestHelpfulnessScore: 0,
      popularityOnlyOutlierCount: 0,
      completedTaskCount: 5,
    });
  });

  it("omits a contributor from completedTaskCounts with a zero count and no contributions", () => {
    const leaderboard = buildLeaderboard([strongCard], undefined, new Map([["ghost", 0]]));
    expect(leaderboard.some((s) => s.contributorId === "ghost")).toBe(false);
  });
});

const NOW = new Date("2026-02-01T00:00:00Z").getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

describe("isWithinLeaderboardRange", () => {
  it("always returns true for all-time, regardless of timestamp", () => {
    expect(isWithinLeaderboardRange(0, "all-time", NOW)).toBe(true);
    expect(isWithinLeaderboardRange(NOW - 1000 * DAY_MS, "all-time", NOW)).toBe(true);
  });

  it("returns false for NaN timestamps under a dated range", () => {
    expect(isWithinLeaderboardRange(Number.NaN, "weekly", NOW)).toBe(false);
  });

  it("includes a timestamp exactly at the weekly boundary and excludes one just past it", () => {
    expect(isWithinLeaderboardRange(NOW - 7 * DAY_MS, "weekly", NOW)).toBe(true);
    expect(isWithinLeaderboardRange(NOW - 7 * DAY_MS - 1, "weekly", NOW)).toBe(false);
  });

  it("excludes a future timestamp under a dated range", () => {
    expect(isWithinLeaderboardRange(NOW + DAY_MS, "weekly", NOW)).toBe(false);
  });

  it("includes a timestamp within 30 days under monthly but excludes it under weekly", () => {
    const twentyDaysAgo = NOW - 20 * DAY_MS;
    expect(isWithinLeaderboardRange(twentyDaysAgo, "weekly", NOW)).toBe(false);
    expect(isWithinLeaderboardRange(twentyDaysAgo, "monthly", NOW)).toBe(true);
  });
});

describe("filterContributionsByRange", () => {
  const recent: AttributedContribution = { ...strongCard, submittedAt: NOW - 2 * DAY_MS };
  const stale: AttributedContribution = { ...weakSummary, submittedAt: NOW - 60 * DAY_MS };
  const undated: AttributedContribution = { ...viralHighlight };

  it("returns every contribution unchanged for all-time, including undated ones", () => {
    expect(filterContributionsByRange([recent, stale, undated], "all-time", NOW)).toEqual([recent, stale, undated]);
  });

  it("keeps only contributions within the weekly window", () => {
    expect(filterContributionsByRange([recent, stale, undated], "weekly", NOW)).toEqual([recent]);
  });

  it("keeps a contribution within the monthly window but excludes an older one", () => {
    const midAge: AttributedContribution = { ...strongCard, id: "mid-age", submittedAt: NOW - 20 * DAY_MS };
    expect(filterContributionsByRange([midAge, stale], "monthly", NOW)).toEqual([midAge]);
  });

  it("excludes a contribution with no submittedAt from weekly and monthly ranges", () => {
    expect(filterContributionsByRange([undated], "weekly", NOW)).toEqual([]);
    expect(filterContributionsByRange([undated], "monthly", NOW)).toEqual([]);
  });

  it("returns an empty list for an empty input regardless of range", () => {
    expect(filterContributionsByRange([], "weekly", NOW)).toEqual([]);
  });
});
