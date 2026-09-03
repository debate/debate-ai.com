import { describe, expect, it } from "vitest";
import {
  buildContributorProgress,
  buildProgressSummaryText,
  buildResearchProgressBoard,
  buildResearchProgressReportText,
  buildTeamTopicComparison,
  buildTopicProgress,
  groupAssignmentsByContributor,
  researchProgressReportFilename,
  type TrackedTopicAssignment,
} from "../src/lib/research-progress";
import type { AttributedContribution } from "../src/lib/contribution-leaderboard";
import type { ResearchTask } from "../src/lib/research-task-routing";

const warmingTask: ResearchTask = { argBlock: "Warming DA", category: "DA", level: "missing", requiredSkill: "intermediate" };
const statesTask: ResearchTask = { argBlock: "States CP", category: "CP", level: "thin", requiredSkill: "novice" };
const courtsTask: ResearchTask = { argBlock: "Courts CP", category: "CP", level: "missing", requiredSkill: "intermediate" };

const aliceWarming: TrackedTopicAssignment = {
  topic: "Immigration",
  assignment: { task: warmingTask, contributorId: "alice" },
  completedAt: "2026-01-05T00:00:00Z",
};
const aliceStates: TrackedTopicAssignment = {
  topic: "Immigration",
  assignment: { task: statesTask, contributorId: "alice" },
};
const aliceCourts: TrackedTopicAssignment = {
  topic: "Healthcare",
  assignment: { task: courtsTask, contributorId: "alice" },
  completedAt: "2026-01-06T00:00:00Z",
};
const bobStates: TrackedTopicAssignment = {
  topic: "Immigration",
  assignment: { task: statesTask, contributorId: "bob" },
};

const aliceCard: AttributedContribution = {
  id: "alice-card",
  contributorId: "alice",
  kind: "card",
  likes: 2,
  saves: 1,
  qualitySignals: [0.9, 0.9],
  reviewerEndorsements: [{ reviewerWeight: 1 }],
};

const carolCard: AttributedContribution = {
  id: "carol-card",
  contributorId: "carol",
  kind: "card",
  likes: 1,
  saves: 0,
  qualitySignals: [0.7],
  reviewerEndorsements: [],
};

const aliceSummary: AttributedContribution = {
  id: "alice-summary",
  contributorId: "alice",
  kind: "summary",
  likes: 1,
  saves: 1,
  qualitySignals: [0.8],
  reviewerEndorsements: [],
};

describe("groupAssignmentsByContributor", () => {
  it("groups topic-tagged assignments by contributorId, preserving order within a group", () => {
    const grouped = groupAssignmentsByContributor([aliceWarming, bobStates, aliceStates]);
    expect(Array.from(grouped.keys())).toEqual(["alice", "bob"]);
    expect(grouped.get("alice")?.map((t) => t.assignment.task.argBlock)).toEqual(["Warming DA", "States CP"]);
    expect(grouped.get("bob")?.map((t) => t.assignment.task.argBlock)).toEqual(["States CP"]);
  });

  it("returns an empty map for an empty assignment list", () => {
    expect(groupAssignmentsByContributor([]).size).toBe(0);
  });
});

describe("buildTopicProgress", () => {
  it("computes assigned/completed counts and a completion rate for one topic", () => {
    const progress = buildTopicProgress("Immigration", [aliceWarming, aliceStates]);
    expect(progress).toEqual({
      topic: "Immigration",
      assignedTaskCount: 2,
      completedTaskCount: 1,
      completionRate: 0.5,
    });
  });

  it("returns a zero completion rate rather than dividing by zero when nothing is assigned", () => {
    expect(buildTopicProgress("Immigration", []).completionRate).toBe(0);
  });

  it("reports full completion when every assignment has a completedAt", () => {
    const progress = buildTopicProgress("Healthcare", [aliceCourts]);
    expect(progress.completionRate).toBe(1);
  });
});

describe("buildContributorProgress", () => {
  it("combines contribution stats and per-topic task progress for one contributor", () => {
    const progress = buildContributorProgress("alice", [aliceCard], [aliceWarming, aliceStates, aliceCourts]);

    expect(progress.contributorId).toBe("alice");
    expect(progress.contributionStats?.contributionCount).toBe(1);
    expect(progress.topics.map((t) => t.topic)).toEqual(["Healthcare", "Immigration"]);
    expect(progress.totalAssignedTasks).toBe(3);
    expect(progress.totalCompletedTasks).toBe(2);
    expect(progress.overallCompletionRate).toBeCloseTo(0.67, 5);
  });

  it("returns a null contributionStats for a contributor with no scored contributions", () => {
    const progress = buildContributorProgress("bob", [], [bobStates]);
    expect(progress.contributionStats).toBeNull();
    expect(progress.totalAssignedTasks).toBe(1);
  });

  it("returns empty topics and zero task totals for a contributor with only contributions", () => {
    const progress = buildContributorProgress("alice", [aliceCard], []);
    expect(progress.topics).toEqual([]);
    expect(progress.totalAssignedTasks).toBe(0);
    expect(progress.overallCompletionRate).toBe(0);
  });
});

describe("buildResearchProgressBoard", () => {
  it("includes every contributor found in either contributions or assignments, sorted by contributorId", () => {
    const board = buildResearchProgressBoard([aliceCard], [aliceWarming, bobStates]);
    expect(board.map((p) => p.contributorId)).toEqual(["alice", "bob"]);
    expect(board[1].contributionStats).toBeNull();
  });

  it("returns an empty board for empty inputs", () => {
    expect(buildResearchProgressBoard([], [])).toEqual([]);
  });

  it("gives a contributor with contributions but no assignments an empty topics list rather than throwing", () => {
    const board = buildResearchProgressBoard([aliceCard, carolCard], [aliceWarming]);
    const carol = board.find((p) => p.contributorId === "carol");
    expect(carol?.topics).toEqual([]);
    expect(carol?.totalAssignedTasks).toBe(0);
    expect(carol?.contributionStats?.contributionCount).toBe(1);
  });
});

describe("buildProgressSummaryText", () => {
  it("renders contribution and task-completion parts for a fully populated contributor", () => {
    const progress = buildContributorProgress("alice", [aliceCard], [aliceWarming, aliceStates]);
    const text = buildProgressSummaryText(progress);
    expect(text).toContain("alice:");
    expect(text).toContain("1 contribution");
    expect(text).toContain("1/2 tasks complete (50%)");
  });

  it("renders fallback phrases when a contributor has neither contributions nor tasks", () => {
    const progress = buildContributorProgress("carol", [], []);
    const text = buildProgressSummaryText(progress);
    expect(text).toBe("carol: no scored contributions; no assigned tasks");
  });

  it("pluralizes the contribution count for a contributor with more than one contribution", () => {
    const progress = buildContributorProgress("alice", [aliceCard, aliceSummary], []);
    const text = buildProgressSummaryText(progress);
    expect(text).toContain("2 contributions");
  });
});

describe("buildResearchProgressReportText", () => {
  it("returns a placeholder message for an empty roster", () => {
    const text = buildResearchProgressReportText([]);
    expect(text).toBe("Research Progress Report\n\nNo contributors have any recorded progress yet.");
  });

  it("renders a summary line and per-topic breakdown for each contributor", () => {
    const board = buildResearchProgressBoard([aliceCard], [aliceWarming, aliceStates, aliceCourts]);
    const text = buildResearchProgressReportText(board);

    expect(text).toContain("Research Progress Report");
    expect(text).toContain("alice: 1 contribution");
    expect(text).toContain("Immigration: 1/2 (50%)");
    expect(text).toContain("Healthcare: 1/1 (100%)");
  });

  it("renders a 'no topic assignments' line for a contributor with contributions but no assignments", () => {
    const board = buildResearchProgressBoard([aliceCard], []);
    const text = buildResearchProgressReportText(board);
    expect(text).toContain("No topic assignments");
  });

  it("separates multiple contributors' sections with a blank line", () => {
    const board = buildResearchProgressBoard([aliceCard], [aliceWarming, bobStates]);
    const text = buildResearchProgressReportText(board);
    const [, body] = text.split("\n\n");
    expect(body).toContain("alice:");
    expect(text.split("\n\n").some((section) => section.startsWith("bob:"))).toBe(true);
  });
});

describe("researchProgressReportFilename", () => {
  it("returns a fixed filename", () => {
    expect(researchProgressReportFilename()).toBe("research-progress-report.txt");
  });
});

describe("buildTeamTopicComparison", () => {
  it("rolls each topic's task counts up across every contributor with an assignment in it", () => {
    const board = buildResearchProgressBoard([aliceCard], [aliceWarming, aliceStates, aliceCourts, bobStates]);
    const comparison = buildTeamTopicComparison(board);

    expect(comparison).toEqual([
      { topic: "Immigration", contributorCount: 2, assignedTaskCount: 3, completedTaskCount: 1, completionRate: 0.33 },
      { topic: "Healthcare", contributorCount: 1, assignedTaskCount: 1, completedTaskCount: 1, completionRate: 1 },
    ]);
  });

  it("sorts the least-covered topic (lowest completion rate) first", () => {
    const board = buildResearchProgressBoard([], [aliceStates, aliceCourts]);
    const comparison = buildTeamTopicComparison(board);
    expect(comparison.map((c) => c.topic)).toEqual(["Immigration", "Healthcare"]);
  });

  it("tie-breaks equal completion rates alphabetically by topic", () => {
    const board = buildResearchProgressBoard([], [aliceWarming, aliceCourts]);
    const comparison = buildTeamTopicComparison(board);
    expect(comparison.map((c) => c.topic)).toEqual(["Healthcare", "Immigration"]);
  });

  it("returns an empty list for a roster with no topic assignments", () => {
    const board = buildResearchProgressBoard([aliceCard], []);
    expect(buildTeamTopicComparison(board)).toEqual([]);
  });

  it("excludes a topic's own contributor from another topic's contributorCount", () => {
    const board = buildResearchProgressBoard([], [aliceWarming, aliceCourts, bobStates]);
    const comparison = buildTeamTopicComparison(board);
    const healthcare = comparison.find((c) => c.topic === "Healthcare");
    expect(healthcare?.contributorCount).toBe(1);
  });
});
