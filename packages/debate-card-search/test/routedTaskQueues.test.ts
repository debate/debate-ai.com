import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteRoutedTaskQueue,
  getRoutedTaskQueue,
  listRoutedTaskQueues,
  saveRoutedTaskQueue,
  type RoutedTaskQueueRecord,
} from "../src/state/routedTaskQueues";
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

const AT_RESULT: RoutingResult = {
  assignments: [{ task: SOLVENCY_TASK, contributorId: "alice" }],
  unassignedTasks: [IMPACTS_TASK],
};

const AT_QUEUE: RoutedTaskQueueRecord = { topicId: "topic-ai", result: AT_RESULT };
const OTHER_QUEUE: RoutedTaskQueueRecord = {
  topicId: "topic-space",
  result: { assignments: [], unassignedTasks: [] },
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listRoutedTaskQueues", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listRoutedTaskQueues()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("routedTaskQueues", "{not json");
    expect(listRoutedTaskQueues()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("routedTaskQueues", JSON.stringify({ not: "an array" }));
    expect(listRoutedTaskQueues()).toEqual([]);
  });

  it("lists every saved queue", () => {
    saveRoutedTaskQueue(AT_QUEUE);
    saveRoutedTaskQueue(OTHER_QUEUE);
    expect(listRoutedTaskQueues()).toEqual([AT_QUEUE, OTHER_QUEUE]);
  });
});

describe("getRoutedTaskQueue", () => {
  it("finds a saved queue by topicId", () => {
    saveRoutedTaskQueue(AT_QUEUE);
    expect(getRoutedTaskQueue("topic-ai")).toEqual(AT_QUEUE);
  });

  it("returns undefined for a topicId that isn't stored", () => {
    expect(getRoutedTaskQueue("missing")).toBeUndefined();
  });
});

describe("saveRoutedTaskQueue", () => {
  it("upserts — saving an existing topicId overwrites rather than duplicating it", () => {
    saveRoutedTaskQueue(AT_QUEUE);
    const rerouted: RoutedTaskQueueRecord = {
      topicId: "topic-ai",
      result: { assignments: [{ task: IMPACTS_TASK, contributorId: "bob" }], unassignedTasks: [] },
    };
    saveRoutedTaskQueue(rerouted);

    expect(listRoutedTaskQueues()).toEqual([rerouted]);
    expect(getRoutedTaskQueue("topic-ai")).toEqual(rerouted);
  });
});

describe("deleteRoutedTaskQueue", () => {
  it("removes a stored queue by topicId", () => {
    saveRoutedTaskQueue(AT_QUEUE);
    saveRoutedTaskQueue(OTHER_QUEUE);
    deleteRoutedTaskQueue("topic-ai");

    expect(listRoutedTaskQueues()).toEqual([OTHER_QUEUE]);
    expect(getRoutedTaskQueue("topic-ai")).toBeUndefined();
  });

  it("is a no-op when the topicId isn't stored", () => {
    saveRoutedTaskQueue(OTHER_QUEUE);
    deleteRoutedTaskQueue("missing");
    expect(listRoutedTaskQueues()).toEqual([OTHER_QUEUE]);
  });
});
