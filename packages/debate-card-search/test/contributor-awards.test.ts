import { describe, expect, it } from "vitest";
import type { AttributedContribution } from "../src/lib/contribution-leaderboard";
import {
  DEFAULT_AWARD_CATEGORY_LABELS,
  buildAwardsAnnouncementText,
  buildCategoryLeaderboard,
  buildContributorAwardsHallOfFame,
  buildTopContributorAwards,
  canNominatePeer,
  canSecondNomination,
  groupContributionsByKind,
  tallyNominationsByKind,
  type ContributorAward,
  type PeerNomination,
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

describe("buildContributorAwardsHallOfFame", () => {
  const day1: ContributorAward[] = [
    { kind: "card", label: "Best Evidence Finder", contributorId: "alice", contributionCount: 1, totalHelpfulnessScore: 5 },
    { kind: "summary", label: "Best Explainer", contributorId: "carol", contributionCount: 1, totalHelpfulnessScore: 3 },
  ];
  const day2: ContributorAward[] = [
    { kind: "card", label: "Best Evidence Finder", contributorId: "alice", contributionCount: 1, totalHelpfulnessScore: 4 },
    { kind: "refutation", label: "Best Refutation", contributorId: "eve", contributionCount: 1, totalHelpfulnessScore: 2 },
  ];

  it("returns an empty list for no announced awards", () => {
    expect(buildContributorAwardsHallOfFame([])).toEqual([]);
  });

  it("aggregates total wins per contributor across multiple days", () => {
    const hallOfFame = buildContributorAwardsHallOfFame([...day1, ...day2]);
    expect(hallOfFame).toEqual([
      { contributorId: "alice", totalWins: 2, winsByKind: { card: 2 } },
      { contributorId: "carol", totalWins: 1, winsByKind: { summary: 1 } },
      { contributorId: "eve", totalWins: 1, winsByKind: { refutation: 1 } },
    ]);
  });

  it("ranks by total wins descending, tie-broken by contributorId ascending", () => {
    const hallOfFame = buildContributorAwardsHallOfFame([...day1, ...day2]);
    expect(hallOfFame.map((e) => e.contributorId)).toEqual(["alice", "carol", "eve"]);
  });

  it("breaks down wins by category for a contributor who has won more than one kind", () => {
    const mixed: ContributorAward[] = [
      { kind: "card", label: "Best Evidence Finder", contributorId: "alice", contributionCount: 1, totalHelpfulnessScore: 5 },
      { kind: "summary", label: "Best Explainer", contributorId: "alice", contributionCount: 1, totalHelpfulnessScore: 5 },
    ];
    const hallOfFame = buildContributorAwardsHallOfFame(mixed);
    expect(hallOfFame).toEqual([{ contributorId: "alice", totalWins: 2, winsByKind: { card: 1, summary: 1 } }]);
  });

  it("omits a contributor who has never won rather than listing a zero-count entry", () => {
    const hallOfFame = buildContributorAwardsHallOfFame(day1);
    expect(hallOfFame.find((e) => e.contributorId === "bob")).toBeUndefined();
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

function makeNomination(overrides: Partial<PeerNomination> = {}): PeerNomination {
  return {
    id: "nom-1",
    kind: "card",
    nomineeId: "alice",
    nominatorId: "bob",
    nominatedAt: 1000,
    ...overrides,
  };
}

describe("tallyNominationsByKind", () => {
  it("counts nominations per nominee within one kind", () => {
    const tally = tallyNominationsByKind(
      [
        makeNomination({ id: "n1", nomineeId: "alice" }),
        makeNomination({ id: "n2", nomineeId: "alice" }),
        makeNomination({ id: "n3", nomineeId: "bob" }),
      ],
      "card",
    );
    expect(tally).toEqual([
      { nomineeId: "alice", count: 2, secondCount: 0, totalSupport: 2 },
      { nomineeId: "bob", count: 1, secondCount: 0, totalSupport: 1 },
    ]);
  });

  it("ignores nominations for other kinds", () => {
    const tally = tallyNominationsByKind(
      [makeNomination({ id: "n1", kind: "summary", nomineeId: "carol" })],
      "card",
    );
    expect(tally).toEqual([]);
  });

  it("sorts by count descending, tie-broken by nomineeId ascending", () => {
    const tally = tallyNominationsByKind(
      [
        makeNomination({ id: "n1", nomineeId: "zed" }),
        makeNomination({ id: "n2", nomineeId: "amy" }),
      ],
      "card",
    );
    expect(tally.map((t) => t.nomineeId)).toEqual(["amy", "zed"]);
  });

  it("returns an empty list for no nominations", () => {
    expect(tallyNominationsByKind([], "card")).toEqual([]);
  });

  it("adds every nomination's seconds into that nominee's secondCount/totalSupport", () => {
    const tally = tallyNominationsByKind(
      [
        makeNomination({ id: "n1", nomineeId: "alice", seconderIds: ["carol", "dave"] }),
        makeNomination({ id: "n2", nomineeId: "alice", seconderIds: ["erin"] }),
        makeNomination({ id: "n3", nomineeId: "bob" }),
      ],
      "card",
    );
    expect(tally).toEqual([
      { nomineeId: "alice", count: 2, secondCount: 3, totalSupport: 5 },
      { nomineeId: "bob", count: 1, secondCount: 0, totalSupport: 1 },
    ]);
  });

  it("ranks a heavily-seconded single nomination above an unseconded nominee with more raw nominations", () => {
    const tally = tallyNominationsByKind(
      [
        makeNomination({ id: "n1", nomineeId: "alice", seconderIds: ["carol", "dave", "erin"] }),
        makeNomination({ id: "n2", nomineeId: "bob" }),
        makeNomination({ id: "n3", nomineeId: "bob" }),
      ],
      "card",
    );
    expect(tally.map((t) => t.nomineeId)).toEqual(["alice", "bob"]);
    expect(tally[0].totalSupport).toBe(4);
    expect(tally[1].totalSupport).toBe(2);
  });
});

describe("canNominatePeer", () => {
  it("allows a distinct nominator/nominee pair", () => {
    expect(canNominatePeer("bob", "alice")).toBe(true);
  });

  it("rejects nominating yourself", () => {
    expect(canNominatePeer("alice", "alice")).toBe(false);
  });

  it("rejects self-nomination case-insensitively after trimming", () => {
    expect(canNominatePeer(" Alice ", "alice")).toBe(false);
  });

  it("rejects a blank nominator or nominee", () => {
    expect(canNominatePeer("", "alice")).toBe(false);
    expect(canNominatePeer("bob", "   ")).toBe(false);
  });
});

describe("canSecondNomination", () => {
  it("allows a third party to second a nomination", () => {
    expect(canSecondNomination(makeNomination(), "carol")).toBe(true);
  });

  it("rejects a blank seconder", () => {
    expect(canSecondNomination(makeNomination(), "   ")).toBe(false);
  });

  it("rejects the nomination's own nominee seconding themself", () => {
    expect(canSecondNomination(makeNomination({ nomineeId: "alice" }), "alice")).toBe(false);
    expect(canSecondNomination(makeNomination({ nomineeId: "alice" }), " Alice ")).toBe(false);
  });

  it("rejects the nomination's own nominator seconding it again", () => {
    expect(canSecondNomination(makeNomination({ nominatorId: "bob" }), "bob")).toBe(false);
    expect(canSecondNomination(makeNomination({ nominatorId: "bob" }), " Bob ")).toBe(false);
  });

  it("rejects someone who has already seconded it, case-insensitively", () => {
    const nomination = makeNomination({ seconderIds: ["carol"] });
    expect(canSecondNomination(nomination, "carol")).toBe(false);
    expect(canSecondNomination(nomination, " Carol ")).toBe(false);
  });

  it("allows a fresh seconder even when others have already seconded it", () => {
    const nomination = makeNomination({ seconderIds: ["carol"] });
    expect(canSecondNomination(nomination, "dave")).toBe(true);
  });

  it("treats a nomination with no seconderIds as never-seconded", () => {
    expect(canSecondNomination(makeNomination({ seconderIds: undefined }), "carol")).toBe(true);
  });
});
