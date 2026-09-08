import { beforeEach, describe, expect, it } from "vitest";
import {
  buildPersistedTopicSprint,
  readPersistedTopicSprintInputs,
} from "../src/state/topicSprints";
import { saveQuestTemplate } from "../src/state/dailyQuests";
import { saveContribution } from "debate-research-evidence/src/state/contributions";
import { saveTrackedArgument, type TrackedArgumentRecord } from "debate-research-evidence/src/state/trackedArguments";
import { saveEvidenceLibraryEntry } from "debate-research-evidence/src/state/evidenceLibraryEntries";
import { saveContributorAvailability } from "../src/state/contributorAvailability";
import { saveRoutedTaskQueue, type RoutedTaskQueueRecord } from "../src/state/routedTaskQueues";
import { completeAndRecordResearchTask } from "../src/state/researchProgress";
import { saveSprintNote } from "../src/state/sprintNotes";
import type { AttributedContribution } from "debate-research-evidence/src/lib/contribution-leaderboard";
import type { QuestTemplate } from "../src/lib/daily-quests";
import type { ContributorAvailability, ResearchTask, RoutingResult } from "debate-research-evidence/src/lib/research-task-routing";
import type { EvidenceLibraryEntry } from "debate-research-evidence/src/lib/shared-evidence-library";
import type { SprintNote } from "../src/lib/team-collaboration-mode";

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

const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);

const QUEST: QuestTemplate = {
  id: "q1",
  description: "Cut 2 warming cards",
  target: { kind: "card" },
  targetCount: 2,
};

const TIMED_CONTRIBUTION: AttributedContribution & { submittedAt: number } = {
  id: "c1",
  contributorId: "alice",
  kind: "card",
  likes: 12,
  saves: 4,
  qualitySignals: [0.9],
  reviewerEndorsements: [],
  submittedAt: NOW,
};

const UNTIMED_CONTRIBUTION: AttributedContribution = {
  id: "c2",
  contributorId: "bob",
  kind: "card",
  likes: 1,
  saves: 0,
  qualitySignals: [],
  reviewerEndorsements: [],
};

const TRACKED_ARGUMENT: TrackedArgumentRecord = {
  id: "ta1",
  topic: "Climate",
  argBlock: "Warming DA",
  category: "DA",
};

const EVIDENCE_ENTRY: EvidenceLibraryEntry = {
  id: "e1",
  topic: "Climate",
  caseArea: "DA",
  tags: [],
  argBlock: "Warming DA",
  wordCount: 50,
  kind: "card",
  text: "warming impact card",
  cite: "Smith 24",
};

const CONTRIBUTOR: ContributorAvailability = {
  contributorId: "alice",
  skillLevel: "intermediate",
  activeTaskCount: 0,
  maxConcurrentTasks: 3,
};

const CLIMATE_TASK: ResearchTask = { argBlock: "Solvency", level: "missing", requiredSkill: "novice" };
const OTHER_TASK: ResearchTask = { argBlock: "Topicality", level: "missing", requiredSkill: "novice" };
const CLIMATE_RESULT: RoutingResult = {
  assignments: [{ task: CLIMATE_TASK, contributorId: "alice" }],
  unassignedTasks: [],
};
const OTHER_RESULT: RoutingResult = {
  assignments: [{ task: OTHER_TASK, contributorId: "alice" }],
  unassignedTasks: [],
};
const CLIMATE_QUEUE: RoutedTaskQueueRecord = { topicId: "Climate", result: CLIMATE_RESULT };
const OTHER_QUEUE: RoutedTaskQueueRecord = { topicId: "Other", result: OTHER_RESULT };

const CLIMATE_NOTE: SprintNote = {
  id: "note-1",
  topic: "Climate",
  authorId: "alice",
  text: "Need an updated warming impact card",
  status: "needs-follow-up",
  createdAt: 100,
  updatedAt: 100,
};
const OTHER_NOTE: SprintNote = { ...CLIMATE_NOTE, id: "note-2", topic: "Other" };

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("readPersistedTopicSprintInputs", () => {
  it("returns empty inputs and an empty coverage report when nothing is stored", () => {
    expect(readPersistedTopicSprintInputs("Climate")).toEqual({
      quests: [],
      contributions: [],
      coverageReport: { tracked: [], untracked: [] },
      contributors: [],
      assignments: [],
      notes: [],
    });
  });

  it("reads every persisted quest template", () => {
    saveQuestTemplate(QUEST);
    expect(readPersistedTopicSprintInputs("Climate").quests).toEqual([QUEST]);
  });

  it("includes only contributions that carry a submittedAt timestamp", () => {
    saveContribution(TIMED_CONTRIBUTION);
    saveContribution(UNTIMED_CONTRIBUTION);

    const inputs = readPersistedTopicSprintInputs("Climate");
    expect(inputs.contributions).toEqual([TIMED_CONTRIBUTION]);
  });

  it("builds the topic's live coverage report from its tracked checklist and evidence entries", () => {
    saveTrackedArgument(TRACKED_ARGUMENT);
    saveEvidenceLibraryEntry(EVIDENCE_ENTRY);

    const report = readPersistedTopicSprintInputs("Climate").coverageReport;
    expect(report.tracked).toHaveLength(1);
    expect(report.tracked[0].argBlock).toBe("Warming DA");
  });

  it("reads every persisted contributor availability profile", () => {
    saveContributorAvailability(CONTRIBUTOR);
    expect(readPersistedTopicSprintInputs("Climate").contributors).toEqual([CONTRIBUTOR]);
  });

  it("scopes assignments to the given topic, combining completed and still-active tasks", () => {
    saveRoutedTaskQueue(CLIMATE_QUEUE);
    saveRoutedTaskQueue(OTHER_QUEUE);
    saveContributorAvailability(CONTRIBUTOR);
    completeAndRecordResearchTask("Other", "Topicality", "2026-01-05T00:00:00Z");

    const assignments = readPersistedTopicSprintInputs("Climate").assignments;
    expect(assignments).toEqual([{ topic: "Climate", assignment: { task: CLIMATE_TASK, contributorId: "alice" } }]);
  });

  it("reads every persisted sprint note across topics (buildTopicSprint narrows it down later)", () => {
    saveSprintNote(CLIMATE_NOTE);
    saveSprintNote(OTHER_NOTE);
    expect(readPersistedTopicSprintInputs("Climate").notes).toEqual([CLIMATE_NOTE, OTHER_NOTE]);
  });
});

describe("buildPersistedTopicSprint", () => {
  it("builds an empty sprint for a topic with nothing persisted", () => {
    const sprint = buildPersistedTopicSprint("Climate", NOW);
    expect(sprint).toEqual({
      topic: "Climate",
      questBoard: [],
      routing: { assignments: [], unassignedTasks: [] },
      progressBoard: [],
      notes: [],
    });
  });

  it("composes real persisted quests, contributions, routing, progress and notes for one topic", () => {
    saveQuestTemplate(QUEST);
    saveContribution(TIMED_CONTRIBUTION);
    saveTrackedArgument(TRACKED_ARGUMENT);
    saveEvidenceLibraryEntry(EVIDENCE_ENTRY);
    saveContributorAvailability(CONTRIBUTOR);
    saveRoutedTaskQueue(CLIMATE_QUEUE);
    saveRoutedTaskQueue(OTHER_QUEUE);
    saveSprintNote(CLIMATE_NOTE);
    saveSprintNote(OTHER_NOTE);

    const sprint = buildPersistedTopicSprint("Climate", NOW);

    expect(sprint.topic).toBe("Climate");
    expect(sprint.questBoard).toEqual([
      {
        questId: "q1",
        description: "Cut 2 warming cards",
        targetCount: 2,
        completedCount: 1,
        remainingCount: 1,
        isComplete: false,
        difficulty: "medium",
        points: 10,
      },
    ]);
    // `sprint.routing` is a fresh re-route of the topic's *current* coverage
    // gaps against current contributor availability (`buildTopicSprint`
    // always recomputes it from `coverageReport`/`contributors` — it isn't a
    // readback of the persisted routed queue), so it reflects the thin
    // "Warming DA" gap the tracked checklist + evidence entry above create,
    // not `CLIMATE_QUEUE`'s already-routed "Solvency" task.
    expect(sprint.routing.assignments).toEqual([
      { task: { argBlock: "Warming DA", category: "DA", level: "thin", requiredSkill: "novice" }, contributorId: "alice" },
    ]);
    // The progress board, by contrast, is built from `assignments` — the
    // topic's real persisted routed/completed tasks (CLIMATE_QUEUE's
    // "Solvency" assignment) — not the live re-route above.
    expect(sprint.progressBoard).toHaveLength(1);
    expect(sprint.progressBoard[0].contributorId).toBe("alice");
    expect(sprint.progressBoard[0].totalAssignedTasks).toBe(1);
    expect(sprint.notes).toEqual([CLIMATE_NOTE]);
  });
});
