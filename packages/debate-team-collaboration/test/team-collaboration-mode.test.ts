import { describe, expect, it } from "vitest";
import {
  assignSprintNote,
  buildSprintNoteAnnouncementText,
  buildSprintRetrospective,
  buildSprintRetrospectiveText,
  buildTopicSprint,
  buildTopicSprintSummaryText,
  createSprintNote,
  createSprintSession,
  createWhiteboardNote,
  getNotesAssignedTo,
  getNotesForTopic,
  getOpenFollowUps,
  getPastSprintSessions,
  getSessionsForTopic,
  getUpcomingSprintSessions,
  getWhiteboardNotePosition,
  getWhiteboardNotesForTopic,
  moveWhiteboardNote,
  nextWhiteboardNoteColor,
  nextWhiteboardNotePosition,
  sortNotesByCreatedAt,
  sortSprintSessionsByDay,
  sprintRetrospectiveFilename,
  updateSprintNoteStatus,
  WHITEBOARD_NOTE_COLORS,
  type SprintNote,
  type SprintSession,
  type WhiteboardNote,
} from "../src/lib/team-collaboration-mode";
import type { QuestContribution, QuestTemplate } from "../src/lib/daily-quests";
import type { ContributorAvailability } from "debate-research-evidence/src/lib/research-task-routing";
import type { TrackedTopicAssignment } from "../src/lib/research-progress";
import { buildTopicCoverageReport, type CoverageCardSummary, type TrackedArgument } from "debate-research-evidence/src/lib/topic-coverage";

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

describe("buildSprintRetrospective", () => {
  it("summarizes quest, task, contributor, and note outcomes for a sprint", () => {
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

    expect(buildSprintRetrospective(sprint)).toEqual({
      topic: "Immigration",
      questsCompleted: 1,
      questsTotal: 1,
      tasksAssigned: 1,
      tasksUnassigned: 0,
      tasksCompletedByTeam: 0,
      contributorsActive: 1,
      notesTotal: 2,
      notesCovered: 0,
      notesOpen: 2,
      notesNeedFollowUp: 0,
      carriedOverFollowUps: [],
    });
  });

  it("returns all zeros and no carried-over notes for a sprint with nothing tracked", () => {
    const sprint = buildTopicSprint({
      topic: "Trade",
      quests: [],
      contributions: [],
      now: NOW,
      coverageReport,
      contributors: [],
      assignments: [],
      notes: [],
    });

    expect(buildSprintRetrospective(sprint)).toEqual({
      topic: "Trade",
      questsCompleted: 0,
      questsTotal: 0,
      tasksAssigned: 0,
      tasksUnassigned: 1,
      tasksCompletedByTeam: 0,
      contributorsActive: 0,
      notesTotal: 0,
      notesCovered: 0,
      notesOpen: 0,
      notesNeedFollowUp: 0,
      carriedOverFollowUps: [],
    });
  });

  it("counts covered notes separately from open ones", () => {
    const coveredNote = updateSprintNoteStatus(
      createSprintNote({ id: "cov", topic: "Healthcare", authorId: "dee", text: "done", createdAt: NOW }),
      "covered",
      NOW,
    );
    const sprint = buildTopicSprint({
      topic: "Healthcare",
      quests: [],
      contributions: [],
      now: NOW,
      coverageReport,
      contributors: [],
      assignments: [],
      notes: [coveredNote, noteC],
    });

    const retro = buildSprintRetrospective(sprint);
    expect(retro.notesTotal).toBe(2);
    expect(retro.notesCovered).toBe(1);
    expect(retro.notesOpen).toBe(0);
    expect(retro.notesNeedFollowUp).toBe(1);
  });

  it("caps carried-over follow-ups to 5, oldest first", () => {
    const followUpNotes: SprintNote[] = Array.from({ length: 7 }, (_, index) =>
      updateSprintNoteStatus(
        createSprintNote({
          id: `f${index}`,
          topic: "Healthcare",
          authorId: "dee",
          text: `follow-up ${index}`,
          createdAt: NOW + index * 1000,
        }),
        "needs-follow-up",
        NOW,
      ),
    );
    const sprint = buildTopicSprint({
      topic: "Healthcare",
      quests: [],
      contributions: [],
      now: NOW,
      coverageReport,
      contributors: [],
      assignments: [],
      notes: followUpNotes,
    });

    const retro = buildSprintRetrospective(sprint);
    expect(retro.notesNeedFollowUp).toBe(7);
    expect(retro.carriedOverFollowUps).toHaveLength(5);
    expect(retro.carriedOverFollowUps.map((note) => note.id)).toEqual(["f0", "f1", "f2", "f3", "f4"]);
  });
});

describe("buildSprintRetrospectiveText", () => {
  it("renders quest, task, contributor, and note lines without a carry-over section when nothing needs follow-up", () => {
    const sprint = buildTopicSprint({
      topic: "Immigration",
      quests,
      contributions,
      now: NOW,
      coverageReport,
      contributors: [advancedAmy],
      assignments,
      notes: [noteA, noteB],
    });

    const text = buildSprintRetrospectiveText(buildSprintRetrospective(sprint));
    const lines = text.split("\n");
    expect(lines[0]).toBe("Immigration — end-of-sprint retrospective");
    expect(lines).toContain("Quests: 1/1 complete");
    expect(lines).toContain("Tasks: 1 assigned, 0 unassigned, 0 completed by the team");
    expect(lines).toContain("Contributors active: 1");
    expect(lines).toContain("Notes: 2 total (0 covered, 2 open, 0 need follow-up)");
    expect(text).not.toContain("Carrying into the next sprint");
  });

  it("lists carried-over follow-ups when present", () => {
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

    const text = buildSprintRetrospectiveText(buildSprintRetrospective(sprint));
    expect(text).toContain("Carrying into the next sprint:");
    expect(text).toContain(`- ${noteC.authorId}: ${noteC.text}`);
  });
});

describe("createSprintSession", () => {
  it("creates a session, trimming the title", () => {
    const session = createSprintSession({
      id: "s1",
      topic: "Immigration",
      title: "  Kickoff meeting  ",
      scheduledDayKey: "2026-09-10",
      createdAt: NOW,
    });

    expect(session).toEqual({
      id: "s1",
      topic: "Immigration",
      title: "Kickoff meeting",
      scheduledDayKey: "2026-09-10",
      createdAt: NOW,
    });
  });

  it("clamps an overly long title to 200 characters", () => {
    const session = createSprintSession({
      id: "s1",
      topic: "Immigration",
      title: "x".repeat(300),
      scheduledDayKey: "2026-09-10",
      createdAt: NOW,
    });
    expect(session.title).toHaveLength(200);
  });

  it("throws when topic is blank", () => {
    expect(() =>
      createSprintSession({ id: "s1", topic: "  ", title: "Kickoff", scheduledDayKey: "2026-09-10", createdAt: NOW }),
    ).toThrow("createSprintSession: topic is required");
  });

  it("throws when title is blank", () => {
    expect(() =>
      createSprintSession({ id: "s1", topic: "Immigration", title: "   ", scheduledDayKey: "2026-09-10", createdAt: NOW }),
    ).toThrow("createSprintSession: title is required");
  });

  it("throws when scheduledDayKey isn't in YYYY-MM-DD format", () => {
    expect(() =>
      createSprintSession({ id: "s1", topic: "Immigration", title: "Kickoff", scheduledDayKey: "9/10/2026", createdAt: NOW }),
    ).toThrow("createSprintSession: scheduledDayKey must be in YYYY-MM-DD format");
  });
});

const sessionA: SprintSession = createSprintSession({
  id: "sa",
  topic: "Immigration",
  title: "Kickoff",
  scheduledDayKey: "2026-09-15",
  createdAt: NOW,
});
const sessionB: SprintSession = createSprintSession({
  id: "sb",
  topic: "Immigration",
  title: "Midpoint check-in",
  scheduledDayKey: "2026-09-05",
  createdAt: NOW,
});
const sessionC: SprintSession = createSprintSession({
  id: "sc",
  topic: "Healthcare",
  title: "Wrap-up",
  scheduledDayKey: "2026-09-10",
  createdAt: NOW,
});

describe("sortSprintSessionsByDay", () => {
  it("sorts ascending by scheduledDayKey without mutating the input", () => {
    const input = [sessionA, sessionB, sessionC];
    const sorted = sortSprintSessionsByDay(input);
    expect(sorted.map((session) => session.id)).toEqual(["sb", "sc", "sa"]);
    expect(input.map((session) => session.id)).toEqual(["sa", "sb", "sc"]);
  });
});

describe("getSessionsForTopic", () => {
  it("filters to one topic, soonest first", () => {
    expect(getSessionsForTopic([sessionA, sessionB, sessionC], "Immigration").map((s) => s.id)).toEqual([
      "sb",
      "sa",
    ]);
  });

  it("returns an empty array when no sessions match", () => {
    expect(getSessionsForTopic([sessionA], "Healthcare")).toEqual([]);
  });
});

describe("getUpcomingSprintSessions", () => {
  it("returns sessions scheduled today or later, soonest first", () => {
    expect(getUpcomingSprintSessions([sessionA, sessionB, sessionC], "2026-09-10").map((s) => s.id)).toEqual([
      "sc",
      "sa",
    ]);
  });

  it("returns an empty array when every session is in the past", () => {
    expect(getUpcomingSprintSessions([sessionB], "2026-09-30")).toEqual([]);
  });
});

describe("getPastSprintSessions", () => {
  it("returns sessions scheduled before today, most recently past first", () => {
    expect(getPastSprintSessions([sessionA, sessionB, sessionC], "2026-09-11").map((s) => s.id)).toEqual([
      "sc",
      "sb",
    ]);
  });

  it("returns an empty array when nothing is in the past", () => {
    expect(getPastSprintSessions([sessionA], "2026-09-01")).toEqual([]);
  });
});

describe("sprintRetrospectiveFilename", () => {
  it("slugifies the topic into a lowercase, hyphenated filename", () => {
    expect(sprintRetrospectiveFilename("Immigration")).toBe("sprint-retrospective-immigration.txt");
  });

  it("collapses punctuation and whitespace into single hyphens", () => {
    expect(sprintRetrospectiveFilename("  States CP / K Affs!  ")).toBe(
      "sprint-retrospective-states-cp-k-affs.txt",
    );
  });

  it("falls back to 'topic' for a blank or punctuation-only topic", () => {
    expect(sprintRetrospectiveFilename("   ")).toBe("sprint-retrospective-topic.txt");
    expect(sprintRetrospectiveFilename("!!!")).toBe("sprint-retrospective-topic.txt");
  });
});

describe("createWhiteboardNote", () => {
  it("creates a note, trimming the text and author id", () => {
    const note = createWhiteboardNote({
      id: "n1",
      topic: "Immigration",
      text: "  What if we frame this as a due-process argument?  ",
      authorId: "  alice  ",
      color: "blue",
      createdAt: NOW,
    });

    expect(note).toEqual({
      id: "n1",
      topic: "Immigration",
      text: "What if we frame this as a due-process argument?",
      color: "blue",
      authorId: "alice",
      createdAt: NOW,
    });
  });

  it("clamps overly long text to 280 characters", () => {
    const note = createWhiteboardNote({
      id: "n1",
      topic: "Immigration",
      text: "x".repeat(400),
      authorId: "alice",
      color: "blue",
      createdAt: NOW,
    });
    expect(note.text).toHaveLength(280);
  });

  it("falls back to a blank author id becoming 'me'", () => {
    const note = createWhiteboardNote({
      id: "n1",
      topic: "Immigration",
      text: "Note",
      authorId: "   ",
      color: "blue",
      createdAt: NOW,
    });
    expect(note.authorId).toBe("me");
  });

  it("falls back to the palette's first color for an unrecognized color", () => {
    const note = createWhiteboardNote({
      id: "n1",
      topic: "Immigration",
      text: "Note",
      authorId: "alice",
      color: "chartreuse" as WhiteboardNote["color"],
      createdAt: NOW,
    });
    expect(note.color).toBe(WHITEBOARD_NOTE_COLORS[0]);
  });

  it("throws when topic is blank", () => {
    expect(() =>
      createWhiteboardNote({ id: "n1", topic: "  ", text: "Note", authorId: "alice", color: "blue", createdAt: NOW }),
    ).toThrow("createWhiteboardNote: topic is required");
  });

  it("throws when text is blank", () => {
    expect(() =>
      createWhiteboardNote({ id: "n1", topic: "Immigration", text: "   ", authorId: "alice", color: "blue", createdAt: NOW }),
    ).toThrow("createWhiteboardNote: text is required");
  });
});

describe("getWhiteboardNotesForTopic", () => {
  const noteA: WhiteboardNote = createWhiteboardNote({
    id: "na",
    topic: "Immigration",
    text: "First",
    authorId: "alice",
    color: "yellow",
    createdAt: 200,
  });
  const noteB: WhiteboardNote = createWhiteboardNote({
    id: "nb",
    topic: "Immigration",
    text: "Second",
    authorId: "bob",
    color: "pink",
    createdAt: 100,
  });
  const noteC: WhiteboardNote = createWhiteboardNote({
    id: "nc",
    topic: "Healthcare",
    text: "Unrelated",
    authorId: "carol",
    color: "blue",
    createdAt: 50,
  });

  it("filters to one topic, oldest first", () => {
    expect(getWhiteboardNotesForTopic([noteA, noteB, noteC], "Immigration").map((n) => n.id)).toEqual([
      "nb",
      "na",
    ]);
  });

  it("returns an empty array when no notes match", () => {
    expect(getWhiteboardNotesForTopic([noteA], "Healthcare")).toEqual([]);
  });
});

describe("nextWhiteboardNoteColor", () => {
  it("cycles through the palette by the existing note count", () => {
    expect(nextWhiteboardNoteColor(0)).toBe(WHITEBOARD_NOTE_COLORS[0]);
    expect(nextWhiteboardNoteColor(1)).toBe(WHITEBOARD_NOTE_COLORS[1]);
    expect(nextWhiteboardNoteColor(WHITEBOARD_NOTE_COLORS.length)).toBe(WHITEBOARD_NOTE_COLORS[0]);
    expect(nextWhiteboardNoteColor(WHITEBOARD_NOTE_COLORS.length + 2)).toBe(WHITEBOARD_NOTE_COLORS[2]);
  });
});

describe("nextWhiteboardNotePosition", () => {
  it("places the first four notes across one row", () => {
    expect(nextWhiteboardNotePosition(0)).toEqual({ x: 0, y: 0 });
    expect(nextWhiteboardNotePosition(1)).toEqual({ x: 176, y: 0 });
    expect(nextWhiteboardNotePosition(2)).toEqual({ x: 352, y: 0 });
    expect(nextWhiteboardNotePosition(3)).toEqual({ x: 528, y: 0 });
  });

  it("wraps into a new row after four notes", () => {
    expect(nextWhiteboardNotePosition(4)).toEqual({ x: 0, y: 150 });
    expect(nextWhiteboardNotePosition(5)).toEqual({ x: 176, y: 150 });
    expect(nextWhiteboardNotePosition(9)).toEqual({ x: 176, y: 300 });
  });
});

describe("getWhiteboardNotePosition", () => {
  const positioned: WhiteboardNote = createWhiteboardNote({
    id: "n1",
    topic: "Immigration",
    text: "Note",
    authorId: "alice",
    color: "blue",
    createdAt: NOW,
    x: 40,
    y: 90,
  });
  const legacy: WhiteboardNote = createWhiteboardNote({
    id: "n2",
    topic: "Immigration",
    text: "Older note with no saved position",
    authorId: "bob",
    color: "pink",
    createdAt: NOW,
  });

  it("returns a note's own position when it has one", () => {
    expect(getWhiteboardNotePosition(positioned, 5)).toEqual({ x: 40, y: 90 });
  });

  it("falls back to the staggered grid slot for a note with no saved position", () => {
    expect(getWhiteboardNotePosition(legacy, 4)).toEqual(nextWhiteboardNotePosition(4));
  });
});

describe("moveWhiteboardNote", () => {
  const note: WhiteboardNote = createWhiteboardNote({
    id: "n1",
    topic: "Immigration",
    text: "Note",
    authorId: "alice",
    color: "blue",
    createdAt: NOW,
    x: 40,
    y: 90,
  });

  it("repositions a note, rounding fractional coordinates", () => {
    expect(moveWhiteboardNote(note, 120.6, 75.4)).toEqual({ ...note, x: 121, y: 75 });
  });

  it("clamps negative coordinates to zero", () => {
    expect(moveWhiteboardNote(note, -30, -10)).toEqual({ ...note, x: 0, y: 0 });
  });

  it("leaves every other field untouched", () => {
    const moved = moveWhiteboardNote(note, 10, 10);
    expect(moved.id).toBe(note.id);
    expect(moved.text).toBe(note.text);
    expect(moved.color).toBe(note.color);
    expect(moved.authorId).toBe(note.authorId);
    expect(moved.createdAt).toBe(note.createdAt);
  });
});
