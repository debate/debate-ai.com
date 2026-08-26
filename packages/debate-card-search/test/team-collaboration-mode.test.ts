import { describe, expect, it } from "vitest";
import {
  assignSprintNote,
  buildSprintNoteAnnouncementText,
  buildTopicSprint,
  buildTopicSprintSummaryText,
  createSprintNote,
  getNotesAssignedTo,
  getNotesForTopic,
  getOpenFollowUps,
  sortNotesByCreatedAt,
  updateSprintNoteStatus,
  type SprintNote,
} from "../src/lib/team-collaboration-mode";
import type { QuestContribution, QuestTemplate } from "../src/lib/daily-quests";
import type { ContributorAvailability } from "../src/lib/research-task-routing";
import type { TrackedTopicAssignment } from "../src/lib/research-progress";
import { buildTopicCoverageReport, type CoverageCardSummary, type TrackedArgument } from "../src/lib/topic-coverage";

const NOW = Date.parse("2026-08-10T00:00:00Z");

describe("createSprintNote", () => {
  it("creates an open note, trimming text and omitting assignedToId when absent", () => {
    const note = createSprintNote({
      id: "note-1",
      topic: "Immigration",
      authorId: "alice",
      text: "  Need a frontline on States CP  ",
      createdAt: NOW,
    });

    expect(note).toEqual({
      id: "note-1",
      topic: "Immigration",
      authorId: "alice",
      text: "Need a frontline on States CP",
      status: "open",
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it("includes assignedToId when supplied", () => {
    const note = createSprintNote({
      id: "note-2",
      topic: "Immigration",
      authorId: "alice",
      text: "Assigned note",
      createdAt: NOW,
      assignedToId: "bob",
    });
    expect(note.assignedToId).toBe("bob");
  });

  it("clamps overly long text to 1000 characters", () => {
    const note = createSprintNote({
      id: "note-3",
      topic: "Immigration",
      authorId: "alice",
      text: "x".repeat(1200),
      createdAt: NOW,
    });
    expect(note.text).toHaveLength(1000);
  });

  it("throws when topic is blank", () => {
    expect(() =>
      createSprintNote({ id: "n", topic: "  ", authorId: "alice", text: "hi", createdAt: NOW }),
    ).toThrow("createSprintNote: topic is required");
  });

  it("throws when authorId is blank", () => {
    expect(() =>
      createSprintNote({ id: "n", topic: "Immigration", authorId: " ", text: "hi", createdAt: NOW }),
    ).toThrow("createSprintNote: authorId is required");
  });

  it("throws when text is blank", () => {
    expect(() =>
      createSprintNote({ id: "n", topic: "Immigration", authorId: "alice", text: "   ", createdAt: NOW }),
    ).toThrow("createSprintNote: text is required");
  });
});

describe("updateSprintNoteStatus", () => {
  it("returns a copy with the new status and bumped updatedAt", () => {
    const note = createSprintNote({ id: "n", topic: "Immigration", authorId: "alice", text: "hi", createdAt: NOW });
    const updated = updateSprintNoteStatus(note, "needs-follow-up", NOW + 1000);
    expect(updated).toEqual({ ...note, status: "needs-follow-up", updatedAt: NOW + 1000 });
    expect(note.status).toBe("open");
  });
});

describe("assignSprintNote", () => {
  it("assigns a note to a teammate", () => {
    const note = createSprintNote({ id: "n", topic: "Immigration", authorId: "alice", text: "hi", createdAt: NOW });
    const assigned = assignSprintNote(note, "bob", NOW + 1000);
    expect(assigned.assignedToId).toBe("bob");
    expect(assigned.updatedAt).toBe(NOW + 1000);
  });

  it("unassigns a note when passed null", () => {
    const note = createSprintNote({
      id: "n",
      topic: "Immigration",
      authorId: "alice",
      text: "hi",
      createdAt: NOW,
      assignedToId: "bob",
    });
    const unassigned = assignSprintNote(note, null, NOW + 1000);
    expect(unassigned.assignedToId).toBeUndefined();
    expect("assignedToId" in unassigned).toBe(false);
  });
});

const noteA: SprintNote = createSprintNote({
  id: "a",
  topic: "Immigration",
  authorId: "alice",
  text: "first",
  createdAt: NOW + 2000,
});
const noteB: SprintNote = createSprintNote({
  id: "b",
  topic: "Immigration",
  authorId: "bob",
  text: "second",
  createdAt: NOW,
  assignedToId: "carol",
});
const noteC: SprintNote = updateSprintNoteStatus(
  createSprintNote({ id: "c", topic: "Healthcare", authorId: "carol", text: "third", createdAt: NOW + 1000 }),
  "needs-follow-up",
  NOW + 1000,
);

describe("sortNotesByCreatedAt", () => {
  it("sorts ascending without mutating the input", () => {
    const input = [noteA, noteB, noteC];
    const sorted = sortNotesByCreatedAt(input);
    expect(sorted.map((note) => note.id)).toEqual(["b", "c", "a"]);
    expect(input.map((note) => note.id)).toEqual(["a", "b", "c"]);
  });
});

describe("getNotesForTopic", () => {
  it("filters to one topic, oldest first", () => {
    expect(getNotesForTopic([noteA, noteB, noteC], "Immigration").map((note) => note.id)).toEqual(["b", "a"]);
  });

  it("returns an empty array when no notes match", () => {
    expect(getNotesForTopic([noteA], "Healthcare")).toEqual([]);
  });
});

describe("getNotesAssignedTo", () => {
  it("filters to notes assigned to one teammate", () => {
    expect(getNotesAssignedTo([noteA, noteB, noteC], "carol").map((note) => note.id)).toEqual(["b"]);
  });
});

describe("getOpenFollowUps", () => {
  it("filters to needs-follow-up notes, oldest first", () => {
    expect(getOpenFollowUps([noteA, noteB, noteC]).map((note) => note.id)).toEqual(["c"]);
  });

  it("returns an empty array when nothing needs follow-up", () => {
    expect(getOpenFollowUps([noteA, noteB])).toEqual([]);
  });
});

describe("buildSprintNoteAnnouncementText", () => {
  it("names the author, topic, and full note text when it's short", () => {
    expect(buildSprintNoteAnnouncementText(noteA)).toBe(
      `${noteA.authorId} logged a "${noteA.topic}" prep note: ${noteA.text}`,
    );
  });

  it("truncates a long note's text with an ellipsis", () => {
    const longNote: SprintNote = {
      ...noteA,
      text: "x".repeat(200),
    };
    const announcement = buildSprintNoteAnnouncementText(longNote);
    expect(announcement).toBe(`${longNote.authorId} logged a "${longNote.topic}" prep note: ${"x".repeat(140)}…`);
    expect(announcement.length).toBeLessThan(longNote.text.length);
  });
});

const trackedArguments: TrackedArgument[] = [
  { argBlock: "Warming DA", category: "DA" },
  { argBlock: "States CP", category: "CP" },
];

const warmingCards: CoverageCardSummary[] = [
  { id: "warming-1", argBlock: "Warming DA", wordCount: 250 },
  { id: "warming-2", argBlock: "Warming DA", wordCount: 250 },
  { id: "warming-3", argBlock: "Warming DA", wordCount: 250 },
];

const coverageReport = buildTopicCoverageReport(trackedArguments, warmingCards);

const quests: QuestTemplate[] = [
  { id: "find-cards", description: "Find 1 solvency card", target: { kind: "card" }, targetCount: 1 },
];

const contributions: QuestContribution[] = [
  {
    id: "c1",
    contributorId: "alice",
    kind: "card",
    likes: 1,
    saves: 0,
    qualitySignals: [0.8],
    reviewerEndorsements: [],
    submittedAt: NOW,
  },
];

const advancedAmy: ContributorAvailability = {
  contributorId: "advanced-amy",
  skillLevel: "advanced",
  activeTaskCount: 0,
  maxConcurrentTasks: 5,
};

const assignments: TrackedTopicAssignment[] = [
  {
    topic: "Immigration",
    assignment: { task: { argBlock: "States CP", category: "CP", level: "thin", requiredSkill: "novice" }, contributorId: "alice" },
  },
];

describe("buildTopicSprint", () => {
  it("composes the quest board, routing, progress board, and this topic's notes", () => {
    const sprint = buildTopicSprint({
      topic: "Immigration",
      quests,
      contributions,
      now: NOW,
      coverageReport,
      contributors: [advancedAmy],
      assignments,
      notes: [noteA, noteB, noteC],
    });

    expect(sprint.topic).toBe("Immigration");
    expect(sprint.questBoard).toHaveLength(1);
    expect(sprint.questBoard[0].completedCount).toBe(1);
    expect(sprint.routing.assignments.map((a) => a.task.argBlock)).toEqual(["States CP"]);
    expect(sprint.progressBoard.map((p) => p.contributorId)).toEqual(["alice"]);
    expect(sprint.notes.map((note) => note.id)).toEqual(["b", "a"]);
  });

  it("returns no notes for a topic with none", () => {
    const sprint = buildTopicSprint({
      topic: "Trade",
      quests: [],
      contributions: [],
      now: NOW,
      coverageReport,
      contributors: [],
      assignments: [],
      notes: [noteA, noteB, noteC],
    });
    expect(sprint.notes).toEqual([]);
  });
});

describe("buildTopicSprintSummaryText", () => {
  it("renders topic, quest, routing, contributor, and follow-up lines", () => {
    const sprint = buildTopicSprint({
      topic: "Immigration",
      quests,
      contributions,
      now: NOW,
      coverageReport,
      contributors: [advancedAmy],
      assignments,
      notes: [noteA, noteB, noteC],
    });

    const text = buildTopicSprintSummaryText(sprint);
    const lines = text.split("\n");
    expect(lines[0]).toBe("Immigration sprint");
    expect(lines).toContain("1/1 quests complete today");
    expect(lines).toContain("advanced-amy: States CP (missing)");
    expect(lines).toContain("1 contributor active");
    expect(lines).toContain("0 notes need follow-up");
  });

  it("pluralizes contributor/note counts correctly", () => {
    const sprint = buildTopicSprint({
      topic: "Healthcare",
      quests: [],
      contributions: [],
      now: NOW,
      coverageReport,
      contributors: [],
      assignments: [],
      notes: [noteC],
    });

    const text = buildTopicSprintSummaryText(sprint);
    expect(text).toContain("0 contributors active");
    expect(text).toContain("1 note needs follow-up");
  });
});
