import { describe, expect, it } from "vitest";
import {
  buildContributorStats,
  buildLeaderboard,
  groupContributionsByContributor,
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
});
