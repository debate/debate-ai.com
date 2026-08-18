import { describe, expect, it } from "vitest";
import {
  DEFAULT_HELPFULNESS_WEIGHTS,
  MIN_REVIEWER_CREDIBILITY,
  computeHelpfulnessBreakdown,
  computeReviewerCredibility,
  rankContributions,
  scorePopularitySignal,
  scoreQualitySignal,
  scoreReviewerSignal,
  type CommunityContribution,
} from "../src/lib/community-rating";

describe("scorePopularitySignal", () => {
  it("scores zero votes as zero", () => {
    expect(scorePopularitySignal(0, 0)).toBe(0);
  });

  it("dampens raw vote counts logarithmically", () => {
    expect(scorePopularitySignal(1, 0)).toBe(12);
    expect(scorePopularitySignal(5, 0)).toBe(32);
  });

  it("weights saves more heavily than likes", () => {
    const likeHeavy = scorePopularitySignal(10, 0);
    const saveHeavy = scorePopularitySignal(0, 10);
    expect(saveHeavy).toBeGreaterThan(likeHeavy);
  });

  it("clamps to 100 once votes saturate the dampening curve", () => {
    expect(scorePopularitySignal(500, 500)).toBe(100);
  });

  it("ignores negative inputs instead of producing a negative score", () => {
    expect(scorePopularitySignal(-5, -5)).toBe(0);
  });
});

describe("scoreQualitySignal", () => {
  it("returns 0 for a contribution with no quality signals collected yet", () => {
    expect(scoreQualitySignal([])).toBe(0);
  });

  it("averages multiple signals into a 0-100 score", () => {
    expect(scoreQualitySignal([0.5, 0.9])).toBe(70);
  });

  it("scores a maxed-out signal set as 100", () => {
    expect(scoreQualitySignal([1, 1, 1])).toBe(100);
  });
});

describe("scoreReviewerSignal", () => {
  it("returns 0 for no endorsements", () => {
    expect(scoreReviewerSignal([])).toBe(0);
  });

  it("dampens summed reviewer weight logarithmically", () => {
    expect(scoreReviewerSignal([{ reviewerWeight: 1 }])).toBe(28);
    expect(
      scoreReviewerSignal([
        { reviewerWeight: 1 },
        { reviewerWeight: 0.8 },
        { reviewerWeight: 0.9 },
      ]),
    ).toBe(52);
  });

  it("clamps negative reviewer weights to zero contribution", () => {
    expect(scoreReviewerSignal([{ reviewerWeight: -1 }])).toBe(0);
  });
});

const viral: CommunityContribution = {
  id: "viral",
  kind: "highlight",
  likes: 500,
  saves: 500,
  qualitySignals: [0.1],
  reviewerEndorsements: [],
};

const substantive: CommunityContribution = {
  id: "substantive",
  kind: "summary",
  likes: 2,
  saves: 1,
  qualitySignals: [0.9, 0.95],
  reviewerEndorsements: [{ reviewerWeight: 1 }, { reviewerWeight: 0.9 }],
};

const untouched: CommunityContribution = {
  id: "untouched",
  kind: "annotation",
  likes: 0,
  saves: 0,
  qualitySignals: [],
  reviewerEndorsements: [],
};

describe("computeHelpfulnessBreakdown", () => {
  it("flags a heavily-voted but low-quality, unreviewed contribution as a popularity-only outlier", () => {
    const breakdown = computeHelpfulnessBreakdown(viral);
    expect(breakdown.popularityScore).toBe(100);
    expect(breakdown.isPopularityOnlyOutlier).toBe(true);
    expect(breakdown.helpfulnessScore).toBe(34);
  });

  it("does not flag a lightly-voted but well-reviewed, high-quality contribution", () => {
    const breakdown = computeHelpfulnessBreakdown(substantive);
    expect(breakdown.isPopularityOnlyOutlier).toBe(false);
    expect(breakdown.helpfulnessScore).toBe(58.2);
  });

  it("scores a contribution with no signals at all as 0", () => {
    expect(computeHelpfulnessBreakdown(untouched).helpfulnessScore).toBe(0);
  });

  it("caps popularity's contribution so it alone cannot outrank strong quality and reviewer signals", () => {
    const viralScore = computeHelpfulnessBreakdown(viral).helpfulnessScore;
    const substantiveScore = computeHelpfulnessBreakdown(substantive).helpfulnessScore;
    expect(substantiveScore).toBeGreaterThan(viralScore);
  });

  it("honors custom weights", () => {
    const popularityOnly = computeHelpfulnessBreakdown(viral, {
      popularity: 1,
      quality: 0,
      reviewer: 0,
    });
    expect(popularityOnly.helpfulnessScore).toBe(popularityOnly.popularityScore);
  });

  it("defaults popularity to a 30% share, well below quality and reviewer combined", () => {
    expect(DEFAULT_HELPFULNESS_WEIGHTS.popularity).toBeLessThan(
      DEFAULT_HELPFULNESS_WEIGHTS.quality + DEFAULT_HELPFULNESS_WEIGHTS.reviewer,
    );
  });
});

describe("rankContributions", () => {
  it("ranks substantive contributions above popularity-only ones", () => {
    const ranked = rankContributions([viral, substantive, untouched]);
    expect(ranked.map((r) => r.contributionId)).toEqual([
      "substantive",
      "viral",
      "untouched",
    ]);
  });

  it("breaks ties by id for a stable, deterministic order", () => {
    const tiedA: CommunityContribution = { ...untouched, id: "b" };
    const tiedB: CommunityContribution = { ...untouched, id: "a" };
    const ranked = rankContributions([tiedA, tiedB]);
    expect(ranked.map((r) => r.contributionId)).toEqual(["a", "b"]);
  });

  it("returns an empty ranking for an empty contribution list", () => {
    expect(rankContributions([])).toEqual([]);
  });
});

describe("computeReviewerCredibility", () => {
  it("floors credibility at MIN_REVIEWER_CREDIBILITY for a reviewer with no scored contributions", () => {
    expect(computeReviewerCredibility([])).toBe(MIN_REVIEWER_CREDIBILITY);
  });

  it("dampens credibility toward the floor while contribution count is still low", () => {
    expect(computeReviewerCredibility([substantive])).toBe(0.2);
  });

  it("saturates toward the full quality-derived credibility once history is deep enough", () => {
    const history = Array.from({ length: 5 }, (_, i) => ({ ...substantive, id: `substantive-${i}` }));
    expect(computeReviewerCredibility(history)).toBe(0.62);
  });

  it("caps the history dampening factor rather than rewarding endless volume", () => {
    const fiveDeep = Array.from({ length: 5 }, (_, i) => ({ ...substantive, id: `s-${i}` }));
    const tenDeep = Array.from({ length: 10 }, (_, i) => ({ ...substantive, id: `s-${i}` }));
    expect(computeReviewerCredibility(tenDeep)).toBe(computeReviewerCredibility(fiveDeep));
  });

  it("gives a reviewer with a strong track record more credibility than one with a weak track record", () => {
    const strong = computeReviewerCredibility([substantive]);
    const weak = computeReviewerCredibility([viral]);
    expect(strong).toBeGreaterThan(weak);
  });

  it("never exceeds 1 even for a maxed-out, deep history", () => {
    const maxed: CommunityContribution = {
      id: "maxed",
      kind: "summary",
      likes: 0,
      saves: 0,
      qualitySignals: [1, 1, 1],
      reviewerEndorsements: [{ reviewerWeight: 5 }, { reviewerWeight: 5 }],
    };
    const history = Array.from({ length: 20 }, (_, i) => ({ ...maxed, id: `maxed-${i}` }));
    expect(computeReviewerCredibility(history)).toBeLessThanOrEqual(1);
  });
});
