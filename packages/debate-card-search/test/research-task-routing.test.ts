import { describe, expect, it } from "vitest";
import {
  buildRoutingResult,
  buildRoutingSummaryText,
  buildTaskQueue,
  routeTasks,
  type ContributorAvailability,
  type ResearchTask,
} from "../src/lib/research-task-routing";
import { buildTopicCoverageReport, type CoverageCardSummary, type TrackedArgument } from "../src/lib/topic-coverage";

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

describe("buildTaskQueue", () => {
  it("builds a task per under-covered argument, missing before thin, tagged with the required skill", () => {
    const report = buildTopicCoverageReport(trackedArguments, [...warmingCards, ...statesCards]);
    const queue = buildTaskQueue(report);

    expect(queue.map((task) => task.argBlock)).toEqual(["Case NEG", "States CP"]);
    expect(queue[0].level).toBe("missing");
    expect(queue[0].requiredSkill).toBe("intermediate");
    expect(queue[1].level).toBe("thin");
    expect(queue[1].requiredSkill).toBe("novice");
  });

  it("returns an empty queue once every tracked argument is covered", () => {
    const report = buildTopicCoverageReport([{ argBlock: "Warming DA" }], warmingCards);
    expect(buildTaskQueue(report)).toEqual([]);
  });
});

const missingTask: ResearchTask = {
  argBlock: "Case NEG",
  category: "Case",
  level: "missing",
  requiredSkill: "intermediate",
};

const thinTask: ResearchTask = {
  argBlock: "States CP",
  category: "CP",
  level: "thin",
  requiredSkill: "novice",
};

describe("routeTasks", () => {
  it("assigns a task only to a contributor who meets its required skill level", () => {
    const novice: ContributorAvailability = {
      contributorId: "novice-nick",
      skillLevel: "novice",
      activeTaskCount: 0,
      maxConcurrentTasks: 2,
    };
    const advanced: ContributorAvailability = {
      contributorId: "advanced-amy",
      skillLevel: "advanced",
      activeTaskCount: 0,
      maxConcurrentTasks: 2,
    };

    const result = routeTasks([missingTask], [novice, advanced]);
    expect(result.assignments).toEqual([{ task: missingTask, contributorId: "advanced-amy" }]);
    expect(result.unassignedTasks).toEqual([]);
  });

  it("routes to the least-loaded eligible contributor, tie-broken by contributorId", () => {
    const busy: ContributorAvailability = {
      contributorId: "busy-bob",
      skillLevel: "advanced",
      activeTaskCount: 3,
      maxConcurrentTasks: 5,
    };
    const free: ContributorAvailability = {
      contributorId: "free-fay",
      skillLevel: "advanced",
      activeTaskCount: 0,
      maxConcurrentTasks: 5,
    };

    const result = routeTasks([missingTask], [busy, free]);
    expect(result.assignments[0].contributorId).toBe("free-fay");
  });

  it("updates a contributor's load within the same routing call, spreading later tasks across the team", () => {
    const amy: ContributorAvailability = {
      contributorId: "amy",
      skillLevel: "advanced",
      activeTaskCount: 0,
      maxConcurrentTasks: 5,
    };
    const zed: ContributorAvailability = {
      contributorId: "zed",
      skillLevel: "advanced",
      activeTaskCount: 0,
      maxConcurrentTasks: 5,
    };

    const result = routeTasks([missingTask, thinTask], [amy, zed]);
    const assignedTo = result.assignments.map((assignment) => assignment.contributorId);
    expect(assignedTo).toEqual(["amy", "zed"]);
  });

  it("leaves a task unassigned when no contributor has spare capacity", () => {
    const full: ContributorAvailability = {
      contributorId: "full-frank",
      skillLevel: "advanced",
      activeTaskCount: 2,
      maxConcurrentTasks: 2,
    };

    const result = routeTasks([missingTask], [full]);
    expect(result.assignments).toEqual([]);
    expect(result.unassignedTasks).toEqual([missingTask]);
  });

  it("leaves a task unassigned when there are no contributors at all", () => {
    const result = routeTasks([missingTask], []);
    expect(result.unassignedTasks).toEqual([missingTask]);
  });

  it("returns an empty result for an empty task queue", () => {
    const someone: ContributorAvailability = {
      contributorId: "someone",
      skillLevel: "advanced",
      activeTaskCount: 0,
      maxConcurrentTasks: 2,
    };
    expect(routeTasks([], [someone])).toEqual({ assignments: [], unassignedTasks: [] });
  });
});

describe("buildRoutingResult", () => {
  it("builds the queue from a coverage report and routes it in one call", () => {
    const report = buildTopicCoverageReport(trackedArguments, [...warmingCards, ...statesCards]);
    const advanced: ContributorAvailability = {
      contributorId: "advanced-amy",
      skillLevel: "advanced",
      activeTaskCount: 0,
      maxConcurrentTasks: 5,
    };

    const result = buildRoutingResult(report, [advanced]);
    expect(result.assignments.map((assignment) => assignment.task.argBlock)).toEqual(["Case NEG", "States CP"]);
  });
});

describe("buildRoutingSummaryText", () => {
  it("renders one line per assignment plus an unassigned-count line", () => {
    const text = buildRoutingSummaryText({
      assignments: [{ task: missingTask, contributorId: "advanced-amy" }],
      unassignedTasks: [thinTask],
    });

    expect(text).toBe("advanced-amy: Case NEG (missing)\n1 task unassigned — no eligible contributor available");
  });

  it("omits the unassigned line when every task was routed", () => {
    const text = buildRoutingSummaryText({
      assignments: [{ task: missingTask, contributorId: "advanced-amy" }],
      unassignedTasks: [],
    });

    expect(text).toBe("advanced-amy: Case NEG (missing)");
  });

  it("renders an empty string when there is nothing to report", () => {
    expect(buildRoutingSummaryText({ assignments: [], unassignedTasks: [] })).toBe("");
  });
});
