import { beforeEach, describe, expect, it } from "vitest";
import {
  buildAndPersistRoutingResult,
  buildTaskInboxView,
  completePersistedRoutedTask,
  deleteRoutedTaskQueue,
  filterTaskInboxViewByContributor,
  getRoutedTaskQueue,
  listRoutedTaskQueues,
  reassignPersistedRoutedTask,
  routePersistedTopicTasks,
  saveRoutedTaskQueue,
  type RoutedTaskQueueRecord,
} from "../src/state/routedTaskQueues";
import { getContributorAvailability, saveContributorAvailability } from "../src/state/contributorAvailability";
import { saveEvidenceLibraryEntry } from "../src/state/evidenceLibraryEntries";
import { saveTrackedArgument } from "../src/state/trackedArguments";
import type { ContributorAvailability, ResearchTask, RoutingResult } from "../src/lib/research-task-routing";
import { buildTopicCoverageReport, type CoverageCardSummary, type TrackedArgument } from "../src/lib/topic-coverage";

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

const TRACKED_ARGUMENTS: TrackedArgument[] = [
  { argBlock: "Warming DA", category: "DA" },
  { argBlock: "Case NEG", category: "Case" },
];
const WARMING_CARDS: CoverageCardSummary[] = [
  { id: "warming-1", argBlock: "Warming DA", wordCount: 250 },
  { id: "warming-2", argBlock: "Warming DA", wordCount: 250 },
  { id: "warming-3", argBlock: "Warming DA", wordCount: 250 },
];
const ADVANCED_AMY: ContributorAvailability = {
  contributorId: "advanced-amy",
  skillLevel: "advanced",
  activeTaskCount: 0,
  maxConcurrentTasks: 5,
};

describe("buildAndPersistRoutingResult", () => {
  it("routes against the persisted contributor list, saves the queue, and increments each assignee's activeTaskCount", () => {
    saveContributorAvailability(ADVANCED_AMY);
    const report = buildTopicCoverageReport(TRACKED_ARGUMENTS, WARMING_CARDS);

    const result = buildAndPersistRoutingResult(report, "topic-warming");

    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].contributorId).toBe("advanced-amy");
    expect(result.assignments[0].task.argBlock).toBe("Case NEG");
    expect(getRoutedTaskQueue("topic-warming")).toEqual({ topicId: "topic-warming", result });
    expect(getContributorAvailability("advanced-amy")).toEqual({ ...ADVANCED_AMY, activeTaskCount: 1 });
  });

  it("leaves activeTaskCount unchanged for contributors nothing was routed to", () => {
    saveContributorAvailability({ ...ADVANCED_AMY, contributorId: "idle-ivy" });
    const report = buildTopicCoverageReport([{ argBlock: "Warming DA" }], WARMING_CARDS);

    buildAndPersistRoutingResult(report, "topic-warming");

    expect(getContributorAvailability("idle-ivy")).toEqual({ ...ADVANCED_AMY, contributorId: "idle-ivy" });
  });
});

describe("routePersistedTopicTasks", () => {
  it("builds a topic's live coverage report from the persisted tracked-argument checklist + evidence library, routes it, and saves the queue", () => {
    saveContributorAvailability(ADVANCED_AMY);
    saveTrackedArgument({ id: "warming-track", topic: "topic-warming", argBlock: "Warming DA", category: "DA" });
    saveTrackedArgument({ id: "case-track", topic: "topic-warming", argBlock: "Case NEG", category: "Case" });
    for (const card of WARMING_CARDS) {
      saveEvidenceLibraryEntry({
        id: card.id,
        kind: "card",
        topic: "topic-warming",
        caseArea: "DA",
        tags: [],
        text: "body text",
        cite: "Smith 24",
        argBlock: card.argBlock,
        wordCount: card.wordCount,
      });
    }

    const result = routePersistedTopicTasks("topic-warming");

    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].contributorId).toBe("advanced-amy");
    expect(result.assignments[0].task.argBlock).toBe("Case NEG");
    expect(getRoutedTaskQueue("topic-warming")).toEqual({ topicId: "topic-warming", result });
    expect(getContributorAvailability("advanced-amy")).toEqual({ ...ADVANCED_AMY, activeTaskCount: 1 });
  });

  it("scopes the report to the requested topic — checklist entries filed under other topics don't leak in", () => {
    saveContributorAvailability(ADVANCED_AMY);
    saveTrackedArgument({ id: "other-track", topic: "topic-other", argBlock: "Unrelated", category: "DA" });

    const result = routePersistedTopicTasks("topic-warming");

    expect(result).toEqual({ assignments: [], unassignedTasks: [] });
    expect(getRoutedTaskQueue("topic-warming")).toEqual({ topicId: "topic-warming", result });
  });
});

describe("completePersistedRoutedTask", () => {
  it("removes the matching assignment from the stored queue and decrements the contributor's activeTaskCount", () => {
    saveContributorAvailability(ADVANCED_AMY);
    saveRoutedTaskQueue(AT_QUEUE);

    const completed = completePersistedRoutedTask("topic-ai", "Solvency");

    expect(completed).toEqual({ task: SOLVENCY_TASK, contributorId: "alice" });
    expect(getRoutedTaskQueue("topic-ai")).toEqual({
      topicId: "topic-ai",
      result: { assignments: [], unassignedTasks: [IMPACTS_TASK] },
    });
  });

  it("decrements the completing contributor's stored activeTaskCount", () => {
    saveContributorAvailability({ ...ADVANCED_AMY, contributorId: "alice", activeTaskCount: 2 });
    saveRoutedTaskQueue(AT_QUEUE);

    completePersistedRoutedTask("topic-ai", "Solvency");

    expect(getContributorAvailability("alice")).toEqual({
      ...ADVANCED_AMY,
      contributorId: "alice",
      activeTaskCount: 1,
    });
  });

  it("returns undefined and leaves storage untouched when the topic has no persisted queue", () => {
    expect(completePersistedRoutedTask("missing-topic", "Solvency")).toBeUndefined();
    expect(listRoutedTaskQueues()).toEqual([]);
  });

  it("returns undefined and leaves the queue untouched when no assignment matches that argBlock", () => {
    saveRoutedTaskQueue(AT_QUEUE);
    expect(completePersistedRoutedTask("topic-ai", "Nonexistent")).toBeUndefined();
    expect(getRoutedTaskQueue("topic-ai")).toEqual(AT_QUEUE);
  });
});

describe("buildTaskInboxView", () => {
  it("returns an empty list when nothing is routed", () => {
    expect(buildTaskInboxView()).toEqual([]);
  });

  it("flattens every persisted queue, tagging each assignment with its topicId and the assignee's current skill level", () => {
    saveContributorAvailability({ ...ADVANCED_AMY, contributorId: "alice" });
    saveRoutedTaskQueue(AT_QUEUE);
    saveRoutedTaskQueue(OTHER_QUEUE);

    expect(buildTaskInboxView()).toEqual([
      {
        topicId: "topic-ai",
        assignments: [
          { task: SOLVENCY_TASK, contributorId: "alice", topicId: "topic-ai", contributorSkillLevel: "advanced" },
        ],
        unassignedTasks: [IMPACTS_TASK],
      },
      { topicId: "topic-space", assignments: [], unassignedTasks: [] },
    ]);
  });

  it("omits contributorSkillLevel when the assignee's profile is no longer persisted", () => {
    saveRoutedTaskQueue(AT_QUEUE);

    const [topic] = buildTaskInboxView();
    expect(topic.assignments[0].contributorSkillLevel).toBeUndefined();
  });
});

describe("filterTaskInboxViewByContributor", () => {
  const MIXED_QUEUE: RoutedTaskQueueRecord = {
    topicId: "topic-mixed",
    result: {
      assignments: [
        { task: SOLVENCY_TASK, contributorId: "alice" },
        { task: IMPACTS_TASK, contributorId: "bob" },
      ],
      unassignedTasks: [],
    },
  };

  it("returns an empty list when nothing is routed", () => {
    expect(filterTaskInboxViewByContributor([], "alice")).toEqual([]);
  });

  it("keeps only the requested contributor's assignments within a topic", () => {
    saveRoutedTaskQueue(MIXED_QUEUE);
    const view = buildTaskInboxView();

    const filtered = filterTaskInboxViewByContributor(view, "alice");

    expect(filtered).toEqual([
      {
        topicId: "topic-mixed",
        assignments: [{ task: SOLVENCY_TASK, contributorId: "alice", topicId: "topic-mixed" }],
        unassignedTasks: [],
      },
    ]);
  });

  it("drops a topic entirely once none of its assignments match", () => {
    saveRoutedTaskQueue(AT_QUEUE);
    saveRoutedTaskQueue(OTHER_QUEUE);
    const view = buildTaskInboxView();

    expect(filterTaskInboxViewByContributor(view, "nobody")).toEqual([]);
  });

  it("clears unassignedTasks even on a topic with a matching assignment", () => {
    saveRoutedTaskQueue(AT_QUEUE);
    const view = buildTaskInboxView();

    const filtered = filterTaskInboxViewByContributor(view, "alice");

    expect(filtered[0].unassignedTasks).toEqual([]);
  });
});

describe("reassignPersistedRoutedTask", () => {
  it("moves an already-assigned task to a different contributor", () => {
    saveContributorAvailability({ ...ADVANCED_AMY, contributorId: "alice", activeTaskCount: 1 });
    saveContributorAvailability({ ...ADVANCED_AMY, contributorId: "carol", activeTaskCount: 0 });
    saveRoutedTaskQueue(AT_QUEUE);

    const reassigned = reassignPersistedRoutedTask("topic-ai", "Solvency", "carol");

    expect(reassigned).toEqual({ task: SOLVENCY_TASK, contributorId: "carol" });
    expect(getRoutedTaskQueue("topic-ai")).toEqual({
      topicId: "topic-ai",
      result: { assignments: [{ task: SOLVENCY_TASK, contributorId: "carol" }], unassignedTasks: [IMPACTS_TASK] },
    });
  });

  it("decrements the previous assignee's activeTaskCount and increments the new assignee's", () => {
    saveContributorAvailability({ ...ADVANCED_AMY, contributorId: "alice", activeTaskCount: 1 });
    saveContributorAvailability({ ...ADVANCED_AMY, contributorId: "carol", activeTaskCount: 2 });
    saveRoutedTaskQueue(AT_QUEUE);

    reassignPersistedRoutedTask("topic-ai", "Solvency", "carol");

    expect(getContributorAvailability("alice")).toEqual({ ...ADVANCED_AMY, contributorId: "alice", activeTaskCount: 0 });
    expect(getContributorAvailability("carol")).toEqual({ ...ADVANCED_AMY, contributorId: "carol", activeTaskCount: 3 });
  });

  it("assigns a previously-unassigned task, removing it from unassignedTasks", () => {
    saveRoutedTaskQueue(AT_QUEUE);

    const reassigned = reassignPersistedRoutedTask("topic-ai", "Impacts", "dana");

    expect(reassigned).toEqual({ task: IMPACTS_TASK, contributorId: "dana" });
    expect(getRoutedTaskQueue("topic-ai")).toEqual({
      topicId: "topic-ai",
      result: {
        assignments: [
          { task: SOLVENCY_TASK, contributorId: "alice" },
          { task: IMPACTS_TASK, contributorId: "dana" },
        ],
        unassignedTasks: [],
      },
    });
  });

  it("applies no skill or capacity check — an override bypasses routeTasks's own eligibility rules", () => {
    saveRoutedTaskQueue(AT_QUEUE);

    const reassigned = reassignPersistedRoutedTask("topic-ai", "Impacts", "unqualified-contributor");

    expect(reassigned).toEqual({ task: IMPACTS_TASK, contributorId: "unqualified-contributor" });
  });

  it("is a no-op that returns the existing assignment unchanged when reassigned to its current assignee", () => {
    saveContributorAvailability({ ...ADVANCED_AMY, contributorId: "alice", activeTaskCount: 1 });
    saveRoutedTaskQueue(AT_QUEUE);

    const reassigned = reassignPersistedRoutedTask("topic-ai", "Solvency", "alice");

    expect(reassigned).toEqual({ task: SOLVENCY_TASK, contributorId: "alice" });
    expect(getContributorAvailability("alice")).toEqual({ ...ADVANCED_AMY, contributorId: "alice", activeTaskCount: 1 });
    expect(getRoutedTaskQueue("topic-ai")).toEqual(AT_QUEUE);
  });

  it("returns undefined and leaves storage untouched for a blank contributor id", () => {
    saveRoutedTaskQueue(AT_QUEUE);

    expect(reassignPersistedRoutedTask("topic-ai", "Solvency", "   ")).toBeUndefined();
    expect(getRoutedTaskQueue("topic-ai")).toEqual(AT_QUEUE);
  });

  it("returns undefined when the topic has no persisted queue", () => {
    expect(reassignPersistedRoutedTask("missing-topic", "Solvency", "carol")).toBeUndefined();
    expect(listRoutedTaskQueues()).toEqual([]);
  });

  it("returns undefined and leaves the queue untouched when no assigned or unassigned task matches that argBlock", () => {
    saveRoutedTaskQueue(AT_QUEUE);

    expect(reassignPersistedRoutedTask("topic-ai", "Nonexistent", "carol")).toBeUndefined();
    expect(getRoutedTaskQueue("topic-ai")).toEqual(AT_QUEUE);
  });

  it("trims whitespace around the new contributor id", () => {
    saveRoutedTaskQueue(AT_QUEUE);

    const reassigned = reassignPersistedRoutedTask("topic-ai", "Impacts", "  dana  ");

    expect(reassigned).toEqual({ task: IMPACTS_TASK, contributorId: "dana" });
  });
});
