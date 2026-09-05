import { describe, expect, it } from "vitest";
import {
  DEFAULT_COVERAGE_THRESHOLDS,
  buildTopicCoverageReport,
  buildTopicCoverageSummaryText,
  computeArgumentCoverage,
  computeCoverageCounts,
  getUnderCoveredArguments,
  groupCardsByArgument,
  type CoverageCardSummary,
  type TrackedArgument,
} from "../src/lib/topic-coverage";

const trackedArguments: TrackedArgument[] = [
  { argBlock: "Warming DA", category: "DA" },
  { argBlock: "States CP", category: "CP" },
  { argBlock: "Case NEG", category: "Case" },
];

const warmingCards: CoverageCardSummary[] = [
  { id: "warming-1", argBlock: "Warming DA", wordCount: 250 },
  { id: "warming-2", argBlock: "Warming DA", wordCount: 250 },
  { id: "warming-3", argBlock: "Warming DA", wordCount: 250 },
];

const statesCards: CoverageCardSummary[] = [{ id: "states-1", argBlock: "States CP", wordCount: 100 }];

const surpriseCards: CoverageCardSummary[] = [{ id: "surprise-1", argBlock: "Politics DA", wordCount: 400 }];

describe("groupCardsByArgument", () => {
  it("groups cards by argBlock, preserving order within a group", () => {
    const grouped = groupCardsByArgument([...warmingCards, ...statesCards]);
    expect(Array.from(grouped.keys())).toEqual(["Warming DA", "States CP"]);
    expect(grouped.get("Warming DA")?.map((c) => c.id)).toEqual(["warming-1", "warming-2", "warming-3"]);
  });

  it("returns an empty map for an empty card list", () => {
    expect(groupCardsByArgument([]).size).toBe(0);
  });
});

describe("computeArgumentCoverage", () => {
  it("classifies an argument with no cards as missing", () => {
    const coverage = computeArgumentCoverage({ argBlock: "Case NEG" }, []);
    expect(coverage.level).toBe("missing");
    expect(coverage.cardCount).toBe(0);
    expect(coverage.totalWordCount).toBe(0);
  });

  it("classifies an argument below the card/word thresholds as thin", () => {
    const coverage = computeArgumentCoverage({ argBlock: "States CP" }, statesCards);
    expect(coverage.level).toBe("thin");
    expect(coverage.cardCount).toBe(1);
  });

  it("classifies an argument meeting both thresholds as covered", () => {
    const coverage = computeArgumentCoverage({ argBlock: "Warming DA" }, warmingCards);
    expect(coverage.level).toBe("covered");
    expect(coverage.totalWordCount).toBe(750);
  });

  it("stays thin when card count is met but word count falls short", () => {
    const shortCards: CoverageCardSummary[] = [
      { id: "a", argBlock: "X", wordCount: 10 },
      { id: "b", argBlock: "X", wordCount: 10 },
      { id: "c", argBlock: "X", wordCount: 10 },
    ];
    const coverage = computeArgumentCoverage({ argBlock: "X" }, shortCards);
    expect(coverage.cardCount).toBe(3);
    expect(coverage.cardCount).toBeGreaterThanOrEqual(DEFAULT_COVERAGE_THRESHOLDS.minCards);
    expect(coverage.level).toBe("thin");
  });

  it("honors custom thresholds", () => {
    const coverage = computeArgumentCoverage({ argBlock: "States CP" }, statesCards, {
      minCards: 1,
      minTotalWords: 50,
    });
    expect(coverage.level).toBe("covered");
  });
});

describe("buildTopicCoverageReport", () => {
  it("reports every tracked argument even when zero cards were submitted", () => {
    const report = buildTopicCoverageReport(trackedArguments, [...warmingCards, ...statesCards]);
    expect(report.tracked.map((a) => a.argBlock)).toEqual(["Case NEG", "States CP", "Warming DA"]);
    expect(report.tracked.find((a) => a.argBlock === "Case NEG")?.level).toBe("missing");
  });

  it("separates cards filed under an untracked argument block", () => {
    const report = buildTopicCoverageReport(trackedArguments, [...warmingCards, ...surpriseCards]);
    expect(report.untracked.map((a) => a.argBlock)).toEqual(["Politics DA"]);
    expect(report.tracked.some((a) => a.argBlock === "Politics DA")).toBe(false);
  });

  it("returns all-missing tracked coverage and no untracked entries for an empty card list", () => {
    const report = buildTopicCoverageReport(trackedArguments, []);
    expect(report.tracked.every((a) => a.level === "missing")).toBe(true);
    expect(report.untracked).toEqual([]);
  });
});

describe("getUnderCoveredArguments", () => {
  it("excludes covered arguments and sorts missing before thin", () => {
    const report = buildTopicCoverageReport(trackedArguments, [...warmingCards, ...statesCards]);
    const underCovered = getUnderCoveredArguments(report);
    expect(underCovered.map((a) => a.argBlock)).toEqual(["Case NEG", "States CP"]);
    expect(underCovered[0].level).toBe("missing");
    expect(underCovered[1].level).toBe("thin");
  });

  it("returns an empty list once every tracked argument is covered", () => {
    const report = buildTopicCoverageReport(
      [{ argBlock: "Warming DA" }],
      warmingCards,
    );
    expect(getUnderCoveredArguments(report)).toEqual([]);
  });

  it("breaks a same-level tie by fewest cards, then argBlock", () => {
    const report = buildTopicCoverageReport(
      [{ argBlock: "Zeta" }, { argBlock: "Alpha" }],
      [
        { id: "z1", argBlock: "Zeta", wordCount: 10 },
        { id: "a1", argBlock: "Alpha", wordCount: 10 },
      ],
    );
    const underCovered = getUnderCoveredArguments(report);
    expect(underCovered.map((a) => a.argBlock)).toEqual(["Alpha", "Zeta"]);
  });
});

describe("buildTopicCoverageSummaryText", () => {
  it("summarizes covered/thin/missing counts", () => {
    const report = buildTopicCoverageReport(trackedArguments, [...warmingCards, ...statesCards]);
    expect(buildTopicCoverageSummaryText(report)).toBe("1/3 arguments covered, 1 thin, 1 missing");
  });

  it("mentions untracked blocks with submitted cards when present", () => {
    const report = buildTopicCoverageReport(trackedArguments, [...warmingCards, ...surpriseCards]);
    expect(buildTopicCoverageSummaryText(report)).toBe(
      "1/3 arguments covered, 0 thin, 2 missing (plus 1 untracked block with submitted cards)",
    );
  });
});

describe("computeCoverageCounts", () => {
  it("tallies missing/thin/covered/total from a mixed report", () => {
    const report = buildTopicCoverageReport(trackedArguments, [...warmingCards, ...statesCards]);
    expect(computeCoverageCounts(report)).toEqual({ missing: 1, thin: 1, covered: 1, total: 3 });
  });

  it("ignores untracked argument blocks", () => {
    const report = buildTopicCoverageReport(trackedArguments, [...warmingCards, ...surpriseCards]);
    expect(computeCoverageCounts(report)).toEqual({ missing: 2, thin: 0, covered: 1, total: 3 });
  });

  it("returns all-zero counts for an empty checklist", () => {
    const report = buildTopicCoverageReport([], []);
    expect(computeCoverageCounts(report)).toEqual({ missing: 0, thin: 0, covered: 0, total: 0 });
  });

  it("counts every tracked argument as covered once each clears the thresholds", () => {
    const report = buildTopicCoverageReport([{ argBlock: "Warming DA" }], warmingCards);
    expect(computeCoverageCounts(report)).toEqual({ missing: 0, thin: 0, covered: 1, total: 1 });
  });
});
