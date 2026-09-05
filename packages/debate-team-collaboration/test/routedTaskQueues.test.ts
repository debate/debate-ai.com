import { beforeEach, describe, expect, it } from "vitest";
import {
  adoptRoutedTaskQueue,
  buildAndPersistRoutingResult,
  buildTaskInboxView,
  buildTeamCapacityView,
  completePersistedRoutedTask,
  deleteRoutedTaskQueue,
  filterTaskInboxViewByContributor,
  getRoutedTaskQueue,
  listRoutedTaskQueues,
  planRoutedTaskQueueMerge,
  reassignPersistedRoutedTask,
  resolveRoutedTaskQueueConflict,
  routePersistedTopicTasks,
  saveRoutedTaskQueue,
  setPersistedRoutedTaskPriority,
  type RoutedTaskQueueRecord,
} from "../src/state/routedTaskQueues";
import { getContributorAvailability, saveContributorAvailability } from "../src/state/contributorAvailability";
import { saveEvidenceLibraryEntry } from "debate-research-evidence/src/state/evidenceLibraryEntries";
import { saveTrackedArgument } from "debate-research-evidence/src/state/trackedArguments";
import type { ContributorAvailability, ResearchTask, RoutingResult } from "debate-research-evidence/src/lib/research-task-routing";
import { buildTopicCoverageReport, type CoverageCardSummary, type TrackedArgument } from "debate-research-evidence/src/lib/topic-coverage";

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
    expect(listRoutedTaskQueues()).toMatchObject([AT_QUEUE, OTHER_QUEUE]);
  });
});

describe("getRoutedTaskQueue", () => {
  it("finds a saved queue by topicId", () => {
    saveRoutedTaskQueue(AT_QUEUE);
    expect(getRoutedTaskQueue("topic-ai")).toMatchObject(AT_QUEUE);
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

    expect(listRoutedTaskQueues()).toMatchObject([rerouted]);
    expect(getRoutedTaskQueue("topic-ai")).toMatchObject(rerouted);
  });

  it("stamps updatedAt with the current time on every save", () => {
    const before = Date.now();
    saveRoutedTaskQueue(AT_QUEUE);
    const after = Date.now();

    const updatedAt = getRoutedTaskQueue("topic-ai")?.updatedAt;
    expect(updatedAt).toEqual(expect.any(Number));
    expect(updatedAt).toBeGreaterThanOrEqual(before);
    expect(updatedAt).toBeLessThanOrEqual(after);
  });

  it("refreshes updatedAt on a later save to the same topicId", async () => {
    saveRoutedTaskQueue(AT_QUEUE);
    const firstUpdatedAt = getRoutedTaskQueue("topic-ai")?.updatedAt;

    await new Promise((resolve) => setTimeout(resolve, 2));
    saveRoutedTaskQueue({ ...AT_QUEUE, result: { assignments: [], unassignedTasks: [] } });

    const secondUpdatedAt = getRoutedTaskQueue("topic-ai")?.updatedAt;
    expect(secondUpdatedAt).toEqual(expect.any(Number));
    expect(secondUpdatedAt).toBeGreaterThan(firstUpdatedAt!);
  });
});

describe("adoptRoutedTaskQueue", () => {
  it("stores a record with its own updatedAt preserved as-is, unlike saveRoutedTaskQueue", () => {
    const synced: RoutedTaskQueueRecord = { ...AT_QUEUE, updatedAt: 12345 };
    adoptRoutedTaskQueue(synced);

    expect(getRoutedTaskQueue("topic-ai")).toEqual(synced);
  });

  it("overwrites any existing local record for the same topicId", () => {
    saveRoutedTaskQueue(AT_QUEUE);
    const remote: RoutedTaskQueueRecord = {
      topicId: "topic-ai",
      result: { assignments: [], unassignedTasks: [] },
      updatedAt: 999,
    };

    adoptRoutedTaskQueue(remote);

    const stored = listRoutedTaskQueues();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toEqual(remote);
  });
});

describe("resolveRoutedTaskQueueConflict", () => {
  it("picks remote when remote's updatedAt is newer", () => {
    const local: RoutedTaskQueueRecord = { ...AT_QUEUE, updatedAt: 100 };
    const remote: RoutedTaskQueueRecord = { ...AT_QUEUE, updatedAt: 200 };
    expect(resolveRoutedTaskQueueConflict(local, remote)).toBe("remote");
  });

  it("picks local when local's updatedAt is newer", () => {
    const local: RoutedTaskQueueRecord = { ...AT_QUEUE, updatedAt: 200 };
    const remote: RoutedTaskQueueRecord = { ...AT_QUEUE, updatedAt: 100 };
    expect(resolveRoutedTaskQueueConflict(local, remote)).toBe("local");
  });

  it("returns none when both sides have the exact same updatedAt", () => {
    const local: RoutedTaskQueueRecord = { ...AT_QUEUE, updatedAt: 150 };
    const remote: RoutedTaskQueueRecord = { ...AT_QUEUE, updatedAt: 150 };
    expect(resolveRoutedTaskQueueConflict(local, remote)).toBe("none");
  });

  it("returns none when neither side has an updatedAt", () => {
    const local: RoutedTaskQueueRecord = { ...AT_QUEUE };
    const remote: RoutedTaskQueueRecord = { ...AT_QUEUE };
    expect(resolveRoutedTaskQueueConflict(local, remote)).toBe("none");
  });

  it("picks remote when only remote has an updatedAt", () => {
    const local: RoutedTaskQueueRecord = { ...AT_QUEUE };
    const remote: RoutedTaskQueueRecord = { ...AT_QUEUE, updatedAt: 100 };
    expect(resolveRoutedTaskQueueConflict(local, remote)).toBe("remote");
  });

  it("picks local when only local has an updatedAt", () => {
    const local: RoutedTaskQueueRecord = { ...AT_QUEUE, updatedAt: 100 };
    const remote: RoutedTaskQueueRecord = { ...AT_QUEUE };
    expect(resolveRoutedTaskQueueConflict(local, remote)).toBe("local");
  });
});

describe("planRoutedTaskQueueMerge", () => {
  it("adopts a remote record with no local counterpart", () => {
    const plan = planRoutedTaskQueueMerge([], [AT_QUEUE]);
    expect(plan.adopt).toEqual([AT_QUEUE]);
    expect(plan.pushLocal).toEqual([]);
  });

  it("pushes a local-only record to the account", () => {
    const plan = planRoutedTaskQueueMerge([AT_QUEUE], []);
    expect(plan.adopt).toEqual([]);
    expect(plan.pushLocal).toEqual([AT_QUEUE]);
  });

  it("adopts the remote copy when it's newer for a shared topicId", () => {
    const local: RoutedTaskQueueRecord = { ...AT_QUEUE, updatedAt: 100 };
    const remote: RoutedTaskQueueRecord = {
      ...AT_QUEUE,
      result: { assignments: [], unassignedTasks: [] },
      updatedAt: 200,
    };
    const plan = planRoutedTaskQueueMerge([local], [remote]);
    expect(plan.adopt).toEqual([remote]);
    expect(plan.pushLocal).toEqual([]);
  });

  it("pushes the local copy when it's newer for a shared topicId", () => {
    const local: RoutedTaskQueueRecord = { ...AT_QUEUE, updatedAt: 200 };
    const remote: RoutedTaskQueueRecord = {
      ...AT_QUEUE,
      result: { assignments: [], unassignedTasks: [] },
      updatedAt: 100,
    };
    const plan = planRoutedTaskQueueMerge([local], [remote]);
    expect(plan.adopt).toEqual([]);
    expect(plan.pushLocal).toEqual([local]);
  });

  it("does nothing for a shared topicId with no resolvable conflict", () => {
    const local: RoutedTaskQueueRecord = { ...AT_QUEUE };
    const remote: RoutedTaskQueueRecord = { ...AT_QUEUE };
    const plan = planRoutedTaskQueueMerge([local], [remote]);
    expect(plan.adopt).toEqual([]);
    expect(plan.pushLocal).toEqual([]);
  });

  it("handles a mix of new-to-each-side and shared topicIds in one pass", () => {
    const sharedLocal: RoutedTaskQueueRecord = {
      topicId: "shared",
      result: { assignments: [], unassignedTasks: [] },
      updatedAt: 100,
    };
    const sharedRemote: RoutedTaskQueueRecord = {
      topicId: "shared",
      result: { assignments: [], unassignedTasks: [] },
      updatedAt: 200,
    };
    const localOnly: RoutedTaskQueueRecord = {
      topicId: "local-only",
      result: { assignments: [], unassignedTasks: [] },
    };
    const remoteOnly: RoutedTaskQueueRecord = {
      topicId: "remote-only",
      result: { assignments: [], unassignedTasks: [] },
    };

    const plan = planRoutedTaskQueueMerge([sharedLocal, localOnly], [sharedRemote, remoteOnly]);

    expect(plan.adopt).toEqual([sharedRemote, remoteOnly]);
    expect(plan.pushLocal).toEqual([localOnly]);
  });
});

describe("deleteRoutedTaskQueue", () => {
  it("removes a stored queue by topicId", () => {
    saveRoutedTaskQueue(AT_QUEUE);
    saveRoutedTaskQueue(OTHER_QUEUE);
    deleteRoutedTaskQueue("topic-ai");

    expect(listRoutedTaskQueues()).toMatchObject([OTHER_QUEUE]);
    expect(getRoutedTaskQueue("topic-ai")).toBeUndefined();
  });

  it("is a no-op when the topicId isn't stored", () => {
    saveRoutedTaskQueue(OTHER_QUEUE);
    deleteRoutedTaskQueue("missing");
    expect(listRoutedTaskQueues()).toMatchObject([OTHER_QUEUE]);
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
    expect(getRoutedTaskQueue("topic-warming")).toMatchObject({ topicId: "topic-warming", result });
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
    expect(getRoutedTaskQueue("topic-warming")).toMatchObject({ topicId: "topic-warming", result });
    expect(getContributorAvailability("advanced-amy")).toEqual({ ...ADVANCED_AMY, activeTaskCount: 1 });
  });

  it("scopes the report to the requested topic — checklist entries filed under other topics don't leak in", () => {
    saveContributorAvailability(ADVANCED_AMY);
    saveTrackedArgument({ id: "other-track", topic: "topic-other", argBlock: "Unrelated", category: "DA" });

    const result = routePersistedTopicTasks("topic-warming");

    expect(result).toEqual({ assignments: [], unassignedTasks: [] });
    expect(getRoutedTaskQueue("topic-warming")).toMatchObject({ topicId: "topic-warming", result });
  });
});

describe("completePersistedRoutedTask", () => {
  it("removes the matching assignment from the stored queue and decrements the contributor's activeTaskCount", () => {
    saveContributorAvailability(ADVANCED_AMY);
    saveRoutedTaskQueue(AT_QUEUE);

    const completed = completePersistedRoutedTask("topic-ai", "Solvency");

    expect(completed).toEqual({ task: SOLVENCY_TASK, contributorId: "alice" });
    expect(getRoutedTaskQueue("topic-ai")).toMatchObject({
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
    expect(getRoutedTaskQueue("topic-ai")).toMatchObject(AT_QUEUE);
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

  it("sorts a topic's assignments high-priority first, preserving routing order within each tier", () => {
    saveRoutedTaskQueue({
      topicId: "topic-mixed",
      result: {
        assignments: [
          { task: SOLVENCY_TASK, contributorId: "alice" },
          { task: IMPACTS_TASK, contributorId: "bob", priority: "high" },
        ],
        unassignedTasks: [],
      },
    });

    const [topic] = buildTaskInboxView();
    expect(topic.assignments.map((assignment) => assignment.contributorId)).toEqual(["bob", "alice"]);
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
    expect(getRoutedTaskQueue("topic-ai")).toMatchObject({
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
    expect(getRoutedTaskQueue("topic-ai")).toMatchObject({
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
    expect(getRoutedTaskQueue("topic-ai")).toMatchObject(AT_QUEUE);
  });

  it("returns undefined and leaves storage untouched for a blank contributor id", () => {
    saveRoutedTaskQueue(AT_QUEUE);

    expect(reassignPersistedRoutedTask("topic-ai", "Solvency", "   ")).toBeUndefined();
    expect(getRoutedTaskQueue("topic-ai")).toMatchObject(AT_QUEUE);
  });

  it("returns undefined when the topic has no persisted queue", () => {
    expect(reassignPersistedRoutedTask("missing-topic", "Solvency", "carol")).toBeUndefined();
    expect(listRoutedTaskQueues()).toEqual([]);
  });

  it("returns undefined and leaves the queue untouched when no assigned or unassigned task matches that argBlock", () => {
    saveRoutedTaskQueue(AT_QUEUE);

    expect(reassignPersistedRoutedTask("topic-ai", "Nonexistent", "carol")).toBeUndefined();
    expect(getRoutedTaskQueue("topic-ai")).toMatchObject(AT_QUEUE);
  });

  it("trims whitespace around the new contributor id", () => {
    saveRoutedTaskQueue(AT_QUEUE);

    const reassigned = reassignPersistedRoutedTask("topic-ai", "Impacts", "  dana  ");

    expect(reassigned).toEqual({ task: IMPACTS_TASK, contributorId: "dana" });
  });
});

describe("setPersistedRoutedTaskPriority", () => {
  it("flags an assigned task high priority and saves it", () => {
    saveRoutedTaskQueue(AT_QUEUE);

    const updated = setPersistedRoutedTaskPriority("topic-ai", "Solvency", "high");

    expect(updated).toEqual({ task: SOLVENCY_TASK, contributorId: "alice", priority: "high" });
    expect(getRoutedTaskQueue("topic-ai")).toMatchObject({
      topicId: "topic-ai",
      result: {
        assignments: [{ task: SOLVENCY_TASK, contributorId: "alice", priority: "high" }],
        unassignedTasks: [IMPACTS_TASK],
      },
    });
  });

  it("unflags a high-priority task back to normal, omitting the priority key", () => {
    saveRoutedTaskQueue({
      topicId: "topic-ai",
      result: {
        assignments: [{ task: SOLVENCY_TASK, contributorId: "alice", priority: "high" }],
        unassignedTasks: [],
      },
    });

    const updated = setPersistedRoutedTaskPriority("topic-ai", "Solvency", "normal");

    expect(updated).toEqual({ task: SOLVENCY_TASK, contributorId: "alice" });
    expect(updated).not.toHaveProperty("priority");
  });

  it("returns undefined and leaves storage untouched when the topic has no persisted queue", () => {
    expect(setPersistedRoutedTaskPriority("missing-topic", "Solvency", "high")).toBeUndefined();
    expect(listRoutedTaskQueues()).toEqual([]);
  });

  it("returns undefined and leaves the queue untouched when no assignment matches that argBlock", () => {
    saveRoutedTaskQueue(AT_QUEUE);

    expect(setPersistedRoutedTaskPriority("topic-ai", "Nonexistent", "high")).toBeUndefined();
    expect(getRoutedTaskQueue("topic-ai")).toMatchObject(AT_QUEUE);
  });

  it("does not flag an unassigned task — only matches assignments, not unassignedTasks", () => {
    saveRoutedTaskQueue(AT_QUEUE);

    expect(setPersistedRoutedTaskPriority("topic-ai", "Impacts", "high")).toBeUndefined();
    expect(getRoutedTaskQueue("topic-ai")).toMatchObject(AT_QUEUE);
  });
});

describe("buildTeamCapacityView", () => {
  it("returns an empty list when nothing is routed", () => {
    expect(buildTeamCapacityView()).toEqual([]);
  });

  it("tallies a contributor's load across every topic they're assigned in", () => {
    saveRoutedTaskQueue(AT_QUEUE); // alice: Solvency (topic-ai)
    saveRoutedTaskQueue({
      topicId: "topic-space",
      result: { assignments: [{ task: IMPACTS_TASK, contributorId: "alice" }], unassignedTasks: [] },
    });

    const [row] = buildTeamCapacityView();

    expect(row.contributorId).toBe("alice");
    expect(row.activeTaskCount).toBe(2);
    expect(row.topicCounts).toEqual([
      { topicId: "topic-ai", count: 1 },
      { topicId: "topic-space", count: 1 },
    ]);
  });

  it("counts a contributor with no persisted availability profile — works off arbitrary typed ids", () => {
    saveRoutedTaskQueue(AT_QUEUE);

    const [row] = buildTeamCapacityView();

    expect(row).toEqual({
      contributorId: "alice",
      activeTaskCount: 1,
      topicCounts: [{ topicId: "topic-ai", count: 1 }],
      isOverloaded: false,
    });
  });

  it("enriches a row with skillLevel/maxConcurrentTasks when a profile is persisted", () => {
    saveContributorAvailability({ ...ADVANCED_AMY, contributorId: "alice", activeTaskCount: 1 });
    saveRoutedTaskQueue(AT_QUEUE);

    const [row] = buildTeamCapacityView();

    expect(row.skillLevel).toBe("advanced");
    expect(row.maxConcurrentTasks).toBe(5);
  });

  it("flags a contributor overloaded once their routed load meets their maxConcurrentTasks", () => {
    saveContributorAvailability({ ...ADVANCED_AMY, contributorId: "alice", maxConcurrentTasks: 1 });
    saveRoutedTaskQueue(AT_QUEUE);

    const [row] = buildTeamCapacityView();

    expect(row.isOverloaded).toBe(true);
  });

  it("never flags a contributor with no persisted profile as overloaded — there's no limit to compare against", () => {
    saveRoutedTaskQueue(AT_QUEUE);

    const [row] = buildTeamCapacityView();

    expect(row.isOverloaded).toBe(false);
  });

  it("omits a contributor with a persisted profile but nothing currently routed", () => {
    saveContributorAvailability({ ...ADVANCED_AMY, contributorId: "idle-ivy" });
    saveRoutedTaskQueue(AT_QUEUE);

    const rows = buildTeamCapacityView();

    expect(rows.map((row) => row.contributorId)).not.toContain("idle-ivy");
  });

  it("sorts rows busiest-first, tie-broken by contributorId", () => {
    saveRoutedTaskQueue({
      topicId: "topic-mixed",
      result: {
        assignments: [
          { task: SOLVENCY_TASK, contributorId: "bob" },
          { task: IMPACTS_TASK, contributorId: "alice" },
        ],
        unassignedTasks: [],
      },
    });
    saveRoutedTaskQueue({
      topicId: "topic-space",
      result: { assignments: [{ task: IMPACTS_TASK, contributorId: "bob" }], unassignedTasks: [] },
    });

    const rows = buildTeamCapacityView();

    expect(rows.map((row) => row.contributorId)).toEqual(["bob", "alice"]);
  });

  it("does not count unassignedTasks toward any contributor's load", () => {
    saveRoutedTaskQueue(AT_QUEUE); // Impacts sits unassigned

    const rows = buildTeamCapacityView();

    expect(rows).toHaveLength(1);
    expect(rows[0].contributorId).toBe("alice");
  });
});
