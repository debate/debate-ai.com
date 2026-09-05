import { beforeEach, describe, expect, it } from "vitest";
import {
  getPendingTaskVerification,
  listPendingTaskVerifications,
  markRoutedTaskAwaitingVerification,
  removePendingTaskVerification,
} from "../src/state/pendingTaskVerifications";
import { getContributorAvailability, saveContributorAvailability } from "../src/state/contributorAvailability";
import { getRoutedTaskQueue, saveRoutedTaskQueue, type RoutedTaskQueueRecord } from "../src/state/routedTaskQueues";
import type { ContributorAvailability, ResearchTask, RoutingResult } from "debate-research-evidence/src/lib/research-task-routing";

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

const ALICE_PROFILE: ContributorAvailability = {
  contributorId: "alice",
  skillLevel: "advanced",
  activeTaskCount: 2,
  maxConcurrentTasks: 5,
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listPendingTaskVerifications", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listPendingTaskVerifications()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("pendingTaskVerifications", "{not json");
    expect(listPendingTaskVerifications()).toEqual([]);
  });
});

describe("markRoutedTaskAwaitingVerification", () => {
  it("removes the assignment from the active queue, decrements activeTaskCount, and stores a pending record", () => {
    saveRoutedTaskQueue(AI_QUEUE);
    saveContributorAvailability(ALICE_PROFILE);

    const assignment = markRoutedTaskAwaitingVerification("topic-ai", "Solvency", "2026-01-05T00:00:00Z");

    expect(assignment).toEqual({ task: SOLVENCY_TASK, contributorId: "alice" });
    expect(getRoutedTaskQueue("topic-ai")).toMatchObject({
      topicId: "topic-ai",
      result: { assignments: [{ task: IMPACTS_TASK, contributorId: "alice" }], unassignedTasks: [] },
    });
    expect(getContributorAvailability("alice")?.activeTaskCount).toBe(1);
    expect(listPendingTaskVerifications()).toEqual([
      {
        topicId: "topic-ai",
        assignment: { task: SOLVENCY_TASK, contributorId: "alice" },
        markedDoneAt: "2026-01-05T00:00:00Z",
      },
    ]);
  });

  it("returns undefined and stores nothing when the topic has no persisted queue", () => {
    expect(markRoutedTaskAwaitingVerification("missing-topic", "Solvency", "2026-01-05T00:00:00Z")).toBeUndefined();
    expect(listPendingTaskVerifications()).toEqual([]);
  });

  it("returns undefined and stores nothing when no assignment matches that argBlock", () => {
    saveRoutedTaskQueue(AI_QUEUE);
    expect(markRoutedTaskAwaitingVerification("topic-ai", "Nonexistent", "2026-01-05T00:00:00Z")).toBeUndefined();
    expect(listPendingTaskVerifications()).toEqual([]);
  });

  it("appends multiple pending records across calls rather than overwriting", () => {
    saveRoutedTaskQueue(AI_QUEUE);
    markRoutedTaskAwaitingVerification("topic-ai", "Solvency", "2026-01-05T00:00:00Z");
    markRoutedTaskAwaitingVerification("topic-ai", "Impacts", "2026-01-06T00:00:00Z");

    expect(listPendingTaskVerifications()).toHaveLength(2);
  });
});

describe("getPendingTaskVerification", () => {
  it("finds the matching record by topicId and argBlock", () => {
    saveRoutedTaskQueue(AI_QUEUE);
    markRoutedTaskAwaitingVerification("topic-ai", "Solvency", "2026-01-05T00:00:00Z");

    expect(getPendingTaskVerification("topic-ai", "Solvency")).toEqual({
      topicId: "topic-ai",
      assignment: { task: SOLVENCY_TASK, contributorId: "alice" },
      markedDoneAt: "2026-01-05T00:00:00Z",
    });
  });

  it("returns undefined when no record matches", () => {
    expect(getPendingTaskVerification("topic-ai", "Solvency")).toBeUndefined();
  });
});

describe("removePendingTaskVerification", () => {
  it("removes only the matching record", () => {
    saveRoutedTaskQueue(AI_QUEUE);
    markRoutedTaskAwaitingVerification("topic-ai", "Solvency", "2026-01-05T00:00:00Z");
    markRoutedTaskAwaitingVerification("topic-ai", "Impacts", "2026-01-06T00:00:00Z");

    removePendingTaskVerification("topic-ai", "Solvency");

    expect(listPendingTaskVerifications()).toEqual([
      {
        topicId: "topic-ai",
        assignment: { task: IMPACTS_TASK, contributorId: "alice" },
        markedDoneAt: "2026-01-06T00:00:00Z",
      },
    ]);
  });

  it("is a no-op when nothing matches", () => {
    saveRoutedTaskQueue(AI_QUEUE);
    markRoutedTaskAwaitingVerification("topic-ai", "Solvency", "2026-01-05T00:00:00Z");

    removePendingTaskVerification("topic-ai", "Nonexistent");

    expect(listPendingTaskVerifications()).toHaveLength(1);
  });
});
