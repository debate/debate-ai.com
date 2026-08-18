import { describe, expect, it } from "vitest";
import {
  DEFAULT_REVISION_REWARD_WEIGHTS,
  STALE_EVIDENCE_THRESHOLD_YEARS,
  buildContributorRevisionStats,
  buildRevisionIncentiveLeaderboard,
  buildRevisionRewardText,
  computeEvidenceStaleness,
  evaluateRevision,
  groupRevisionsByContributor,
  type CardRevision,
  type CardSnapshot,
} from "../src/lib/revision-incentives";

function snapshot(overrides: Partial<CardSnapshot> = {}): CardSnapshot {
  return {
    qualitySignals: [0.3, 0.3],
    citationCompleteness: 0.4,
    evidenceYear: 2018,
    wordCount: 200,
    ...overrides,
  };
}

const weakCardImprovedRevision: CardRevision = {
  cardId: "card-1",
  contributorId: "alice",
  before: snapshot({ qualitySignals: [0.2, 0.2] }),
  after: snapshot({ qualitySignals: [0.9, 0.9] }),
};

const citationOnlyRevision: CardRevision = {
  cardId: "card-2",
  contributorId: "alice",
  before: snapshot({ qualitySignals: [0.8, 0.8], citationCompleteness: 0.4 }),
  after: snapshot({ qualitySignals: [0.8, 0.8], citationCompleteness: 0.7 }),
};

const evidenceRefreshRevision: CardRevision = {
  cardId: "card-3",
  contributorId: "bob",
  before: snapshot({ qualitySignals: [0.8, 0.8], evidenceYear: 2015 }),
  after: snapshot({ qualitySignals: [0.8, 0.8], evidenceYear: 2024 }),
};

const noOpRevision: CardRevision = {
  cardId: "card-4",
  contributorId: "bob",
  before: snapshot(),
  after: snapshot(),
};

describe("evaluateRevision", () => {
  it("awards doubled quality points and flags a weak-card improvement", () => {
    const evaluation = evaluateRevision(weakCardImprovedRevision);
    expect(evaluation.wasWeakCard).toBe(true);
    expect(evaluation.qualityScoreBefore).toBeLessThan(50);
    expect(evaluation.qualityDelta).toBeGreaterThan(0);
    expect(evaluation.rewardPoints).toBeCloseTo(
      evaluation.qualityDelta * DEFAULT_REVISION_REWARD_WEIGHTS.qualityPoint * 2,
      5,
    );
    expect(evaluation.isRewardedImprovement).toBe(true);
  });

  it("awards single-weighted quality points when the card wasn't weak beforehand", () => {
    const notWeak: CardRevision = {
      cardId: "card-5",
      contributorId: "carol",
      before: snapshot({ qualitySignals: [0.6, 0.6] }),
      after: snapshot({ qualitySignals: [0.9, 0.9] }),
    };
    const evaluation = evaluateRevision(notWeak);
    expect(evaluation.wasWeakCard).toBe(false);
    expect(evaluation.rewardPoints).toBeCloseTo(evaluation.qualityDelta * DEFAULT_REVISION_REWARD_WEIGHTS.qualityPoint, 5);
  });

  it("flags citation strengthening at or above the delta threshold and awards the flat bonus", () => {
    const evaluation = evaluateRevision(citationOnlyRevision);
    expect(evaluation.citationStrengthened).toBe(true);
    expect(evaluation.evidenceRefreshed).toBe(false);
    expect(evaluation.rewardPoints).toBe(DEFAULT_REVISION_REWARD_WEIGHTS.citationStrengthenedBonus);
  });

  it("does not flag citation strengthening below the delta threshold", () => {
    const smallBump: CardRevision = {
      cardId: "card-6",
      contributorId: "dan",
      before: snapshot({ qualitySignals: [0.8, 0.8], citationCompleteness: 0.4 }),
      after: snapshot({ qualitySignals: [0.8, 0.8], citationCompleteness: 0.5 }),
    };
    const evaluation = evaluateRevision(smallBump);
    expect(evaluation.citationStrengthened).toBe(false);
    expect(evaluation.rewardPoints).toBe(0);
    expect(evaluation.isRewardedImprovement).toBe(false);
  });

  it("flags an evidence refresh when the cited year moves forward and awards the flat bonus", () => {
    const evaluation = evaluateRevision(evidenceRefreshRevision);
    expect(evaluation.evidenceRefreshed).toBe(true);
    expect(evaluation.rewardPoints).toBe(DEFAULT_REVISION_REWARD_WEIGHTS.evidenceRefreshedBonus);
  });

  it("does not flag an evidence refresh when the cited year moves backward or stays the same", () => {
    const stale: CardRevision = {
      cardId: "card-7",
      contributorId: "erin",
      before: snapshot({ qualitySignals: [0.8, 0.8], evidenceYear: 2020 }),
      after: snapshot({ qualitySignals: [0.8, 0.8], evidenceYear: 2020 }),
    };
    expect(evaluateRevision(stale).evidenceRefreshed).toBe(false);
  });

  it("stacks quality, citation, and evidence bonuses together", () => {
    const everything: CardRevision = {
      cardId: "card-8",
      contributorId: "frank",
      before: snapshot({ qualitySignals: [0.2, 0.2], citationCompleteness: 0.3, evidenceYear: 2010 }),
      after: snapshot({ qualitySignals: [0.9, 0.9], citationCompleteness: 0.8, evidenceYear: 2024 }),
    };
    const evaluation = evaluateRevision(everything);
    expect(evaluation.citationStrengthened).toBe(true);
    expect(evaluation.evidenceRefreshed).toBe(true);
    expect(evaluation.wasWeakCard).toBe(true);
    expect(evaluation.rewardPoints).toBeCloseTo(
      evaluation.qualityDelta * DEFAULT_REVISION_REWARD_WEIGHTS.qualityPoint * 2 +
        DEFAULT_REVISION_REWARD_WEIGHTS.citationStrengthenedBonus +
        DEFAULT_REVISION_REWARD_WEIGHTS.evidenceRefreshedBonus,
      5,
    );
  });

  it("earns nothing for a no-op revision", () => {
    const evaluation = evaluateRevision(noOpRevision);
    expect(evaluation.rewardPoints).toBe(0);
    expect(evaluation.isRewardedImprovement).toBe(false);
  });

  it("honors custom weights", () => {
    const evaluation = evaluateRevision(evidenceRefreshRevision, {
      qualityPoint: 1,
      weakCardBonusMultiplier: 3,
      citationStrengthenedBonus: 8,
      evidenceRefreshedBonus: 100,
    });
    expect(evaluation.rewardPoints).toBe(100);
  });
});

describe("groupRevisionsByContributor", () => {
  it("groups revisions by contributorId, preserving order within a group", () => {
    const grouped = groupRevisionsByContributor([evidenceRefreshRevision, noOpRevision, weakCardImprovedRevision]);
    expect(Array.from(grouped.keys())).toEqual(["bob", "alice"]);
    expect(grouped.get("bob")?.map((r) => r.cardId)).toEqual(["card-3", "card-4"]);
  });

  it("returns an empty map for an empty revision list", () => {
    expect(groupRevisionsByContributor([]).size).toBe(0);
  });
});

describe("buildContributorRevisionStats", () => {
  it("aggregates a contributor's revision count, rewards, and weak-card improvements", () => {
    const stats = buildContributorRevisionStats("alice", [weakCardImprovedRevision, citationOnlyRevision]);
    expect(stats.revisionCount).toBe(2);
    expect(stats.rewardedRevisionCount).toBe(2);
    expect(stats.weakCardsImprovedCount).toBe(1);
    expect(stats.totalRewardPoints).toBeGreaterThan(0);
  });

  it("counts an unrewarded revision without counting it as rewarded", () => {
    const stats = buildContributorRevisionStats("bob", [evidenceRefreshRevision, noOpRevision]);
    expect(stats.revisionCount).toBe(2);
    expect(stats.rewardedRevisionCount).toBe(1);
    expect(stats.totalRewardPoints).toBe(DEFAULT_REVISION_REWARD_WEIGHTS.evidenceRefreshedBonus);
  });

  it("throws for an empty revision list", () => {
    expect(() => buildContributorRevisionStats("nobody", [])).toThrow(/no revisions/);
  });
});

describe("buildRevisionIncentiveLeaderboard", () => {
  it("ranks contributors by total reward points descending", () => {
    const leaderboard = buildRevisionIncentiveLeaderboard([
      weakCardImprovedRevision,
      citationOnlyRevision,
      evidenceRefreshRevision,
      noOpRevision,
    ]);
    expect(leaderboard.map((s) => s.contributorId)).toEqual(["alice", "bob"]);
    expect(leaderboard[0].totalRewardPoints).toBeGreaterThan(leaderboard[1].totalRewardPoints);
  });

  it("breaks a tie by contributorId", () => {
    const tiedA: CardRevision = { ...evidenceRefreshRevision, cardId: "tie-a", contributorId: "zeta" };
    const tiedB: CardRevision = { ...evidenceRefreshRevision, cardId: "tie-b", contributorId: "alpha" };
    const leaderboard = buildRevisionIncentiveLeaderboard([tiedA, tiedB]);
    expect(leaderboard.map((s) => s.contributorId)).toEqual(["alpha", "zeta"]);
  });

  it("returns an empty leaderboard for an empty revision list", () => {
    expect(buildRevisionIncentiveLeaderboard([])).toEqual([]);
  });
});

describe("buildRevisionRewardText", () => {
  it("renders a reward line naming every reason a revision earned points", () => {
    const evaluation = evaluateRevision({
      cardId: "card-9",
      contributorId: "grace",
      before: snapshot({ qualitySignals: [0.2, 0.2], citationCompleteness: 0.3, evidenceYear: 2010 }),
      after: snapshot({ qualitySignals: [0.9, 0.9], citationCompleteness: 0.8, evidenceYear: 2024 }),
    });
    const text = buildRevisionRewardText(evaluation);
    expect(text).toContain("grace earned");
    expect(text).toContain("weak card bonus");
    expect(text).toContain("citation strengthened");
    expect(text).toContain("evidence refreshed");
  });

  it("renders a no-reward line when nothing meaningful improved", () => {
    const evaluation = evaluateRevision(noOpRevision);
    expect(buildRevisionRewardText(evaluation)).toBe(
      'No reward earned revising card "card-4" — no meaningful quality, citation, or evidence improvement detected.',
    );
  });
});

describe("computeEvidenceStaleness", () => {
  it("flags evidence stale once its age reaches the threshold", () => {
    const signal = computeEvidenceStaleness(2020, 2020 + STALE_EVIDENCE_THRESHOLD_YEARS);
    expect(signal.ageYears).toBe(STALE_EVIDENCE_THRESHOLD_YEARS);
    expect(signal.isStale).toBe(true);
  });

  it("does not flag evidence stale just below the threshold", () => {
    const signal = computeEvidenceStaleness(2020, 2020 + STALE_EVIDENCE_THRESHOLD_YEARS - 1);
    expect(signal.isStale).toBe(false);
  });

  it("treats an unknown (0) evidence year as stale, with a null age", () => {
    const signal = computeEvidenceStaleness(0, 2026);
    expect(signal.ageYears).toBeNull();
    expect(signal.isStale).toBe(true);
  });

  it("does not flag a current-year citation as stale", () => {
    const signal = computeEvidenceStaleness(2026, 2026);
    expect(signal.ageYears).toBe(0);
    expect(signal.isStale).toBe(false);
  });

  it("clamps a future-dated citation's age to zero rather than going negative", () => {
    const signal = computeEvidenceStaleness(2030, 2026);
    expect(signal.ageYears).toBe(0);
    expect(signal.isStale).toBe(false);
  });
});
