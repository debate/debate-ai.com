import { describe, expect, it } from "vitest";
import type { AttributedContribution } from "../src/lib/contribution-leaderboard";
import {
  DEFAULT_AWARD_CATEGORY_LABELS,
  buildAwardsAnnouncementText,
  buildCategoryLeaderboard,
  buildTopContributorAwards,
  groupContributionsByKind,
} from "../src/lib/contributor-awards";

const aliceCard: AttributedContribution = {
  id: "alice-card",
  contributorId: "alice",
  kind: "card",
  likes: 5,
  saves: 3,
  qualitySignals: [0.9, 0.95],
  reviewerEndorsements: [{ reviewerWeight: 1 }],
};

const bobCard: AttributedContribution = {
  id: "bob-card",
  contributorId: "bob",
  kind: "card",
  likes: 0,
  saves: 0,
  qualitySignals: [0.2],
  reviewerEndorsements: [],
};

const carolSummary: AttributedContribution = {
  id: "carol-summary",
  contributorId: "carol",
  kind: "summary",
  likes: 2,
  saves: 2,
  qualitySignals: [0.8],
  reviewerEndorsements: [{ reviewerWeight: 0.7 }],
};

const daveOriginalArgument: AttributedContribution = {
  id: "dave-original-argument",
  contributorId: "dave",
  kind: "original-argument",
  likes: 4,
  saves: 1,
  qualitySignals: [0.85],
  reviewerEndorsements: [{ reviewerWeight: 0.6 }],
};

const eveRefutation: AttributedContribution = {
  id: "eve-refutation",
  contributorId: "eve",
  kind: "refutation",
  likes: 1,
  saves: 1,
  qualitySignals: [0.6],
  reviewerEndorsements: [],
};

describe("groupContributionsByKind", () => {
  it("groups contributions by kind, preserving order within a group", () => {
    const grouped = groupContributionsByKind([aliceCard, carolSummary, bobCard]);
    expect(Array.from(grouped.keys())).toEqual(["card", "summary"]);
    expect(grouped.get("card")?.map((c) => c.id)).toEqual(["alice-card", "bob-card"]);
    expect(grouped.get("summary")?.map((c) => c.id)).toEqual(["carol-summary"]);
  });

  it("returns an empty map for an empty contribution list", () => {
    expect(groupContributionsByKind([]).size).toBe(0);
  });
});

describe("buildCategoryLeaderboard", () => {
  it("ranks contributors within a single kind by helpfulness score", () => {
    const leaderboard = buildCategoryLeaderboard([aliceCard, bobCard]);
    expect(leaderboard.map((s) => s.contributorId)).toEqual(["alice", "bob"]);
  });
});

describe("buildTopContributorAwards", () => {
  it("selects the top contributor per kind present in the contributions", () => {
    const awards = buildTopContributorAwards([aliceCard, bobCard, carolSummary]);
    expect(awards).toEqual([
      {
        kind: "card",
        label: DEFAULT_AWARD_CATEGORY_LABELS.card,
        contributorId: "alice",
        contributionCount: 1,
        totalHelpfulnessScore: expect.any(Number),
      },
      {
        kind: "summary",
        label: DEFAULT_AWARD_CATEGORY_LABELS.summary,
        contributorId: "carol",
        contributionCount: 1,
        totalHelpfulnessScore: expect.any(Number),
      },
    ]);
  });

  it("omits kinds with no contributions rather than producing a winnerless award", () => {
    const awards = buildTopContributorAwards([carolSummary]);
    expect(awards).toHaveLength(1);
    expect(awards[0].kind).toBe("summary");
  });

  it("returns categories in stable kind order regardless of input order", () => {
    const awards = buildTopContributorAwards([
      eveRefutation,
      carolSummary,
      daveOriginalArgument,
      aliceCard,
    ]);
    expect(awards.map((a) => a.kind)).toEqual(["card", "summary", "original-argument", "refutation"]);
  });

  it("selects a winner for the original-argument and refutation kinds", () => {
    const awards = buildTopContributorAwards([daveOriginalArgument, eveRefutation]);
    expect(awards).toEqual([
      {
        kind: "original-argument",
        label: DEFAULT_AWARD_CATEGORY_LABELS["original-argument"],
        contributorId: "dave",
        contributionCount: 1,
        totalHelpfulnessScore: expect.any(Number),
      },
      {
        kind: "refutation",
        label: DEFAULT_AWARD_CATEGORY_LABELS.refutation,
        contributorId: "eve",
        contributionCount: 1,
        totalHelpfulnessScore: expect.any(Number),
      },
    ]);
  });

  it("returns an empty list for an empty contribution list", () => {
    expect(buildTopContributorAwards([])).toEqual([]);
  });

  it("honors caller-supplied category labels", () => {
    const awards = buildTopContributorAwards([aliceCard], {
      ...DEFAULT_AWARD_CATEGORY_LABELS,
      card: "Card Champion",
    });
    expect(awards[0].label).toBe("Card Champion");
  });

  it("breaks a within-kind winner tie by contributorId, per buildLeaderboard", () => {
    const tiedA: AttributedContribution = { ...bobCard, id: "z-card", contributorId: "zed" };
    const tiedB: AttributedContribution = { ...bobCard, id: "a-card", contributorId: "amy" };
    const awards = buildTopContributorAwards([tiedA, tiedB]);
    expect(awards[0].contributorId).toBe("amy");
  });
});

describe("buildAwardsAnnouncementText", () => {
  it("renders one line per award", () => {
    const awards = buildTopContributorAwards([aliceCard, carolSummary]);
    const text = buildAwardsAnnouncementText(awards);
    const lines = text.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("Best Evidence Finder");
    expect(lines[0]).toContain("alice");
    expect(lines[1]).toContain("Best Explainer");
    expect(lines[1]).toContain("carol");
  });

  it("pluralizes contribution count correctly", () => {
    const awards = buildTopContributorAwards([aliceCard, bobCard]);
    const text = buildAwardsAnnouncementText(awards);
    expect(text).toContain("1 contribution,");
  });

  it("returns a fallback message for an empty award list", () => {
    expect(buildAwardsAnnouncementText([])).toBe("No awards to announce yet.");
  });
});
