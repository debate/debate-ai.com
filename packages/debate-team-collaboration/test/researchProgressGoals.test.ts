import { beforeEach, describe, expect, it } from "vitest";
import {
  clearGoalForContributor,
  getGoalForContributor,
  getPersistedGoalProgressForContributor,
  InvalidGoalTargetError,
  listResearchProgressGoals,
  setGoalForContributor,
} from "../src/state/researchProgressGoals";
import { completeAndRecordResearchTask } from "../src/state/researchProgress";
import { saveRoutedTaskQueue, type RoutedTaskQueueRecord } from "../src/state/routedTaskQueues";
import type { ResearchTask, RoutingResult } from "debate-research-evidence/src/lib/research-task-routing";

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

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("getGoalForContributor / listResearchProgressGoals", () => {
  it("returns undefined/empty when no one has set a goal", () => {
    expect(getGoalForContributor("alice")).toBeUndefined();
    expect(listResearchProgressGoals()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("researchProgressGoals", "{not json");
    expect(listResearchProgressGoals()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("researchProgressGoals", JSON.stringify({ not: "an array" }));
    expect(listResearchProgressGoals()).toEqual([]);
  });
});

describe("setGoalForContributor", () => {
  it("persists a goal that can be read back", () => {
    setGoalForContributor({ contributorId: "alice", targetCompletedTaskCount: 5 });
    expect(getGoalForContributor("alice")).toEqual({ contributorId: "alice", targetCompletedTaskCount: 5 });
  });

  it("replaces an existing goal for the same contributor rather than adding a second one", () => {
    setGoalForContributor({ contributorId: "alice", targetCompletedTaskCount: 5 });
    setGoalForContributor({ contributorId: "alice", targetCompletedTaskCount: 10, topic: "Immigration" });

    expect(listResearchProgressGoals()).toEqual([
      { contributorId: "alice", targetCompletedTaskCount: 10, topic: "Immigration" },
    ]);
  });

  it("keeps different contributors' goals independent", () => {
    setGoalForContributor({ contributorId: "alice", targetCompletedTaskCount: 5 });
    setGoalForContributor({ contributorId: "bob", targetCompletedTaskCount: 3 });

    expect(getGoalForContributor("alice")?.targetCompletedTaskCount).toBe(5);
    expect(getGoalForContributor("bob")?.targetCompletedTaskCount).toBe(3);
  });

  it("throws InvalidGoalTargetError and leaves the store untouched for a non-positive target", () => {
    expect(() => setGoalForContributor({ contributorId: "alice", targetCompletedTaskCount: 0 })).toThrow(
      InvalidGoalTargetError,
    );
    expect(() => setGoalForContributor({ contributorId: "alice", targetCompletedTaskCount: -2 })).toThrow(
      InvalidGoalTargetError,
    );
    expect(listResearchProgressGoals()).toEqual([]);
  });
});

describe("clearGoalForContributor", () => {
  it("removes a contributor's goal", () => {
    setGoalForContributor({ contributorId: "alice", targetCompletedTaskCount: 5 });
    clearGoalForContributor("alice");
    expect(getGoalForContributor("alice")).toBeUndefined();
  });

  it("is a no-op for a contributor with no goal", () => {
    clearGoalForContributor("alice");
    expect(listResearchProgressGoals()).toEqual([]);
  });

  it("leaves other contributors' goals untouched", () => {
    setGoalForContributor({ contributorId: "alice", targetCompletedTaskCount: 5 });
    setGoalForContributor({ contributorId: "bob", targetCompletedTaskCount: 3 });
    clearGoalForContributor("alice");

    expect(getGoalForContributor("alice")).toBeUndefined();
    expect(getGoalForContributor("bob")?.targetCompletedTaskCount).toBe(3);
  });
});

describe("getPersistedGoalProgressForContributor", () => {
  it("returns undefined when the contributor has no goal", () => {
    expect(getPersistedGoalProgressForContributor("alice")).toBeUndefined();
  });

  it("resolves an overall goal against the real persisted board", () => {
    saveRoutedTaskQueue(AI_QUEUE);
    completeAndRecordResearchTask("topic-ai", "Solvency", "2026-01-05T00:00:00Z");
    setGoalForContributor({ contributorId: "alice", targetCompletedTaskCount: 2 });

    const progress = getPersistedGoalProgressForContributor("alice");
    expect(progress?.currentCompletedTaskCount).toBe(1);
    expect(progress?.progressRatio).toBe(0.5);
    expect(progress?.isComplete).toBe(false);
  });

  it("resolves a topic-scoped goal against that topic's completed count", () => {
    saveRoutedTaskQueue(AI_QUEUE);
    completeAndRecordResearchTask("topic-ai", "Solvency", "2026-01-05T00:00:00Z");
    completeAndRecordResearchTask("topic-ai", "Impacts", "2026-01-06T00:00:00Z");
    setGoalForContributor({ contributorId: "alice", targetCompletedTaskCount: 2, topic: "topic-ai" });

    const progress = getPersistedGoalProgressForContributor("alice");
    expect(progress?.currentCompletedTaskCount).toBe(2);
    expect(progress?.isComplete).toBe(true);
  });

  it("returns 0 progress for a contributor with a goal but no board row at all yet", () => {
    setGoalForContributor({ contributorId: "alice", targetCompletedTaskCount: 3 });
    const progress = getPersistedGoalProgressForContributor("alice");
    expect(progress?.currentCompletedTaskCount).toBe(0);
    expect(progress?.remainingTaskCount).toBe(3);
  });

  it("updates once the board changes, without re-setting the goal", () => {
    setGoalForContributor({ contributorId: "alice", targetCompletedTaskCount: 1 });
    expect(getPersistedGoalProgressForContributor("alice")?.isComplete).toBe(false);

    saveRoutedTaskQueue(AI_QUEUE);
    completeAndRecordResearchTask("topic-ai", "Solvency", "2026-01-05T00:00:00Z");

    expect(getPersistedGoalProgressForContributor("alice")?.isComplete).toBe(true);
  });
});
