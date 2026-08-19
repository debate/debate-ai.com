import { beforeEach, describe, expect, it } from "vitest";
import {
  buildPersistedLeaderboardWithCompletedTasks,
  buildPersistedResearchProgressBoard,
  completeAndRecordResearchTask,
  listCompletedTaskHistory,
  listTrackedAssignmentsForTopic,
} from "../src/state/researchProgress";
import { getRoutedTaskQueue, saveRoutedTaskQueue, type RoutedTaskQueueRecord } from "../src/state/routedTaskQueues";
import { saveContribution } from "../src/state/contributions";
import type { AttributedContribution } from "../src/lib/contribution-leaderboard";
import type { ResearchTask, RoutingResult } from "../src/lib/research-task-routing";

/** Minimal in-memory `localStorage` mock — this package's Vitest environment is `node`, with no DOM. */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const SOLVENCY_TASK: ResearchTask = { argBlock: "Solvency", level: "missing", requiredSkill: "intermediate" };
const IMPACTS_TASK: ResearchTask = { argBlock: "Impacts", level: "thin", requiredSkill: "novice" };

const AI_RESULT: RoutingResult = {
  assignments: [
    { task: SOLVENCY_TASK, contributorId: "alice" },
    { task: IMPACTS_TASK, contributorId: "alice" },
  ],
  unassignedTasks: [],
};
const AI_QUEUE: RoutedTaskQueueRecord = { topicId: "topic-ai", result: AI_RESULT };

const ALICE_CARD: AttributedContribution = {
  id: "card-1",
  kind: "card",
  contributorId: "alice",
  likes: 3,
  saves: 1,
  qualitySignals: [0.8],
  reviewerEndorsements: [],
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listCompletedTaskHistory", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listCompletedTaskHistory()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("completedResearchTasks", "{not json");
    expect(listCompletedTaskHistory()).toEqual([]);
  });
});

describe("completeAndRecordResearchTask", () => {
  it("removes the assignment from the active queue and records a completion history entry", () => {
    saveRoutedTaskQueue(AI_QUEUE);

    const completed = completeAndRecordResearchTask("topic-ai", "Solvency", "2026-01-05T00:00:00Z");

    expect(completed).toEqual({ task: SOLVENCY_TASK, contributorId: "alice" });
    expect(getRoutedTaskQueue("topic-ai")).toEqual({
      topicId: "topic-ai",
      result: { assignments: [{ task: IMPACTS_TASK, contributorId: "alice" }], unassignedTasks: [] },
    });
    expect(listCompletedTaskHistory()).toEqual([
      {
        topic: "topic-ai",
        assignment: { task: SOLVENCY_TASK, contributorId: "alice" },
        completedAt: "2026-01-05T00:00:00Z",
      },
    ]);
  });

  it("returns undefined and records nothing when the topic has no persisted queue", () => {
    expect(completeAndRecordResearchTask("missing-topic", "Solvency", "2026-01-05T00:00:00Z")).toBeUndefined();
    expect(listCompletedTaskHistory()).toEqual([]);
  });

  it("returns undefined and records nothing when no assignment matches that argBlock", () => {
    saveRoutedTaskQueue(AI_QUEUE);
    expect(completeAndRecordResearchTask("topic-ai", "Nonexistent", "2026-01-05T00:00:00Z")).toBeUndefined();
    expect(listCompletedTaskHistory()).toEqual([]);
  });

  it("appends multiple completions across calls rather than overwriting", () => {
    saveRoutedTaskQueue(AI_QUEUE);
    completeAndRecordResearchTask("topic-ai", "Solvency", "2026-01-05T00:00:00Z");
    completeAndRecordResearchTask("topic-ai", "Impacts", "2026-01-06T00:00:00Z");

    expect(listCompletedTaskHistory()).toHaveLength(2);
  });
});

describe("buildPersistedResearchProgressBoard", () => {
  it("returns an empty board when nothing is stored", () => {
    expect(buildPersistedResearchProgressBoard()).toEqual([]);
  });

  it("combines a contributor's persisted contributions with their completed and still-active tasks", () => {
    saveContribution(ALICE_CARD);
    saveRoutedTaskQueue(AI_QUEUE);
    completeAndRecordResearchTask("topic-ai", "Solvency", "2026-01-05T00:00:00Z");

    const board = buildPersistedResearchProgressBoard();

    expect(board).toHaveLength(1);
    const alice = board[0];
    expect(alice.contributorId).toBe("alice");
    expect(alice.contributionStats?.contributionCount).toBe(1);
    expect(alice.totalAssignedTasks).toBe(2);
    expect(alice.totalCompletedTasks).toBe(1);
    expect(alice.topics).toEqual([
      { topic: "topic-ai", assignedTaskCount: 2, completedTaskCount: 1, completionRate: 0.5 },
    ]);
  });

  it("includes a contributor with only a routed (still-active) assignment and no scored contributions", () => {
    saveRoutedTaskQueue(AI_QUEUE);

    const board = buildPersistedResearchProgressBoard();

    expect(board).toHaveLength(1);
    expect(board[0].contributorId).toBe("alice");
    expect(board[0].contributionStats).toBeNull();
    expect(board[0].totalAssignedTasks).toBe(2);
    expect(board[0].totalCompletedTasks).toBe(0);
  });

  it("includes a contributor with only scored contributions and no routed assignments", () => {
    saveContribution(ALICE_CARD);

    const board = buildPersistedResearchProgressBoard();

    expect(board).toHaveLength(1);
    expect(board[0].contributorId).toBe("alice");
    expect(board[0].contributionStats?.contributionCount).toBe(1);
    expect(board[0].totalAssignedTasks).toBe(0);
    expect(board[0].topics).toEqual([]);
  });
});

describe("listTrackedAssignmentsForTopic", () => {
  const BALLOT_TASK: ResearchTask = { argBlock: "Ballot", level: "missing", requiredSkill: "novice" };
  const BALLOT_RESULT: RoutingResult = {
    assignments: [{ task: BALLOT_TASK, contributorId: "carol" }],
    unassignedTasks: [],
  };
  const BALLOT_QUEUE: RoutedTaskQueueRecord = { topicId: "topic-ballot", result: BALLOT_RESULT };

  it("returns an empty list for a topic with nothing routed or completed", () => {
    expect(listTrackedAssignmentsForTopic("topic-ai")).toEqual([]);
  });

  it("combines this topic's completed history with its still-active queue, excluding other topics", () => {
    saveRoutedTaskQueue(AI_QUEUE);
    saveRoutedTaskQueue(BALLOT_QUEUE);
    completeAndRecordResearchTask("topic-ai", "Solvency", "2026-01-05T00:00:00Z");

    expect(listTrackedAssignmentsForTopic("topic-ai")).toEqual([
      {
        topic: "topic-ai",
        assignment: { task: SOLVENCY_TASK, contributorId: "alice" },
        completedAt: "2026-01-05T00:00:00Z",
      },
      { topic: "topic-ai", assignment: { task: IMPACTS_TASK, contributorId: "alice" } },
    ]);
  });

  it("doesn't include another topic's completed or active assignments", () => {
    saveRoutedTaskQueue(AI_QUEUE);
    saveRoutedTaskQueue(BALLOT_QUEUE);
    completeAndRecordResearchTask("topic-ballot", "Ballot", "2026-01-05T00:00:00Z");

    expect(listTrackedAssignmentsForTopic("topic-ai")).toEqual([
      { topic: "topic-ai", assignment: { task: SOLVENCY_TASK, contributorId: "alice" } },
      { topic: "topic-ai", assignment: { task: IMPACTS_TASK, contributorId: "alice" } },
    ]);
  });
});

describe("buildPersistedLeaderboardWithCompletedTasks", () => {
  it("returns an empty leaderboard when nothing is stored", () => {
    expect(buildPersistedLeaderboardWithCompletedTasks()).toEqual([]);
  });

  it("folds a contributor's persisted completed-task count into their leaderboard row", () => {
    saveContribution(ALICE_CARD);
    saveRoutedTaskQueue(AI_QUEUE);
    completeAndRecordResearchTask("topic-ai", "Solvency", "2026-01-05T00:00:00Z");

    const leaderboard = buildPersistedLeaderboardWithCompletedTasks();

    expect(leaderboard).toHaveLength(1);
    expect(leaderboard[0].contributorId).toBe("alice");
    expect(leaderboard[0].completedTaskCount).toBe(1);
  });

  it("counts every completed task across topics for the same contributor", () => {
    saveContribution(ALICE_CARD);
    saveRoutedTaskQueue(AI_QUEUE);
    completeAndRecordResearchTask("topic-ai", "Solvency", "2026-01-05T00:00:00Z");
    completeAndRecordResearchTask("topic-ai", "Impacts", "2026-01-06T00:00:00Z");

    expect(buildPersistedLeaderboardWithCompletedTasks()[0].completedTaskCount).toBe(2);
  });

  it("includes a contributor who has completed tasks but no scored contribution", () => {
    saveRoutedTaskQueue(AI_QUEUE);
    completeAndRecordResearchTask("topic-ai", "Solvency", "2026-01-05T00:00:00Z");

    const leaderboard = buildPersistedLeaderboardWithCompletedTasks();

    expect(leaderboard).toHaveLength(1);
    expect(leaderboard[0]).toMatchObject({
      contributorId: "alice",
      contributionCount: 0,
      completedTaskCount: 1,
    });
  });
});
