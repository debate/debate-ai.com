import { describe, expect, it } from "vitest";
import type { ContributorStats } from "../src/lib/contribution-leaderboard";
import { buildTopicCoverageReport, type CoverageCardSummary, type TrackedArgument } from "../src/lib/topic-coverage";
import {
  buildRoutingResultFromContributorStats,
  deriveContributorAvailability,
  deriveContributorAvailabilityList,
  type ContributorTaskLoad,
} from "../src/lib/tiered-task-routing";

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

const noviceStats = makeStats({ contributorId: "novice-nick", contributionCount: 1, totalHelpfulnessScore: 5 });
const veteranStats = makeStats({ contributorId: "veteran-vic", contributionCount: 15, totalHelpfulnessScore: 100 });
const expertStats = makeStats({ contributorId: "expert-erin", contributionCount: 30, totalHelpfulnessScore: 300 });

describe("deriveContributorAvailability", () => {
  it("derives skillLevel from leaderboard stats via the unlock tier a contributor has reached", () => {
    const load: ContributorTaskLoad = { contributorId: "veteran-vic", activeTaskCount: 1, maxConcurrentTasks: 3 };
    const availability = deriveContributorAvailability(veteranStats, load);

    expect(availability).toEqual({
      contributorId: "veteran-vic",
      skillLevel: "intermediate",
      activeTaskCount: 1,
      maxConcurrentTasks: 3,
    });
  });

  it("derives novice for a contributor who hasn't reached apprentice yet", () => {
    const load: ContributorTaskLoad = { contributorId: "novice-nick", activeTaskCount: 0, maxConcurrentTasks: 2 };
    expect(deriveContributorAvailability(noviceStats, load).skillLevel).toBe("novice");
  });

  it("derives advanced for a contributor who has reached the expert tier", () => {
    const load: ContributorTaskLoad = { contributorId: "expert-erin", activeTaskCount: 0, maxConcurrentTasks: 5 };
    expect(deriveContributorAvailability(expertStats, load).skillLevel).toBe("advanced");
  });

  it("throws when the stats and load contributorIds don't match", () => {
    const load: ContributorTaskLoad = { contributorId: "someone-else", activeTaskCount: 0, maxConcurrentTasks: 2 };
    expect(() => deriveContributorAvailability(veteranStats, load)).toThrow(/does not match/);
  });
});

describe("deriveContributorAvailabilityList", () => {
  it("derives availability for every contributor present in both lists", () => {
    const loads: ContributorTaskLoad[] = [
      { contributorId: "novice-nick", activeTaskCount: 0, maxConcurrentTasks: 2 },
      { contributorId: "veteran-vic", activeTaskCount: 0, maxConcurrentTasks: 3 },
    ];

    const result = deriveContributorAvailabilityList([noviceStats, veteranStats], loads);
    expect(result.map((availability) => [availability.contributorId, availability.skillLevel])).toEqual([
      ["novice-nick", "novice"],
      ["veteran-vic", "intermediate"],
    ]);
  });

  it("skips a contributor with stats but no matching load entry", () => {
    const loads: ContributorTaskLoad[] = [{ contributorId: "veteran-vic", activeTaskCount: 0, maxConcurrentTasks: 3 }];
    const result = deriveContributorAvailabilityList([noviceStats, veteranStats], loads);
    expect(result.map((availability) => availability.contributorId)).toEqual(["veteran-vic"]);
  });

  it("returns an empty list when there are no contributors", () => {
    expect(deriveContributorAvailabilityList([], [])).toEqual([]);
  });
});

const trackedArguments: TrackedArgument[] = [
  { argBlock: "Warming DA", category: "DA" },
  { argBlock: "Case NEG", category: "Case" },
];

const warmingCards: CoverageCardSummary[] = [
  { id: "warming-1", argBlock: "Warming DA", wordCount: 250 },
  { id: "warming-2", argBlock: "Warming DA", wordCount: 250 },
  { id: "warming-3", argBlock: "Warming DA", wordCount: 250 },
];

describe("buildRoutingResultFromContributorStats", () => {
  it("routes the missing-argument task only to a contributor whose derived skill level qualifies", () => {
    const report = buildTopicCoverageReport(trackedArguments, warmingCards);
    const loads: ContributorTaskLoad[] = [
      { contributorId: "novice-nick", activeTaskCount: 0, maxConcurrentTasks: 2 },
      { contributorId: "veteran-vic", activeTaskCount: 0, maxConcurrentTasks: 2 },
    ];

    const result = buildRoutingResultFromContributorStats(report, [noviceStats, veteranStats], loads);

    expect(result.assignments).toEqual([{ task: result.assignments[0].task, contributorId: "veteran-vic" }]);
    expect(result.assignments[0].task.argBlock).toBe("Case NEG");
  });

  it("leaves the task unassigned when every derived skill level falls short", () => {
    const report = buildTopicCoverageReport(trackedArguments, warmingCards);
    const loads: ContributorTaskLoad[] = [{ contributorId: "novice-nick", activeTaskCount: 0, maxConcurrentTasks: 2 }];

    const result = buildRoutingResultFromContributorStats(report, [noviceStats], loads);
    expect(result.assignments).toEqual([]);
    expect(result.unassignedTasks.map((task) => task.argBlock)).toEqual(["Case NEG"]);
  });
});
