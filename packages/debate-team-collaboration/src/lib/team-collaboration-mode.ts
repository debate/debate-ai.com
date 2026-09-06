/**
 * @fileoverview Live topic-sprint data model + composition for the "Team
 * Collaboration Mode" idea under Research Crowdsourcing Organizer Features
 * in TODO.md ("Let multiple debaters work on the same topic sprint with
 * shared notes, assignments, and live status"). A `SprintNote` attaches to
 * a specific topic the way `debate-round`'s `strategy-sync-notes.ts`
 * attaches a `PrepNote` to a flow box — this package has no dependency on
 * `debate-round`, so this mirrors that box-addressed note lifecycle
 * (open/covered/needs-follow-up, assignable as a task) with a topic in
 * place of a flow box rather than introducing a separate note-status
 * scheme. `buildTopicSprint` composes the existing "Daily Quests and
 * Targets" board (`daily-quests.ts`), "Research Task Routing" result
 * (`research-task-routing.ts`), and "Research Progress Tracking" board
 * (`research-progress.ts`) into one shared, topic-scoped session view,
 * reusing all three directly rather than introducing a separate
 * quest/assignment/progress signal. This is the first slice only — it
 * works entirely off caller-supplied quests, contributions, coverage
 * reports, contributor availability, assignments, and notes; it doesn't
 * persist a sprint or its notes, track live/presence status for who's
 * currently online, or render a collaboration-mode UI. See the follow-ups
 * noted in TODO.md.
 *
 * @module lib/team-collaboration-mode
 */

import {
  buildDailyQuestBoard,
  buildQuestBoardSummaryText,
  type QuestContribution,
  type QuestProgress,
  type QuestTemplate,
} from "./daily-quests";
import {
  buildResearchProgressBoard,
  type ContributorProgress,
  type TrackedTopicAssignment,
} from "./research-progress";
import {
  buildRoutingResult,
  buildRoutingSummaryText,
  type ContributorAvailability,
  type RoutingResult,
} from "debate-research-evidence/src/lib/research-task-routing";
import type { TopicCoverageReport } from "debate-research-evidence/src/lib/topic-coverage";

/** Where a sprint note's underlying topic currently stands — mirrors `debate-round`'s `PrepNoteStatus`. */
export type SprintNoteStatus = "open" | "covered" | "needs-follow-up";

/** A live prep note shared across a team, attached to one topic sprint. */
export interface SprintNote {
  id: string;
  topic: string;
  authorId: string;
  text: string;
  status: SprintNoteStatus;
  /** Teammate currently responsible for acting on this note, if assigned as a task. */
  assignedToId?: string;
  createdAt: number;
  updatedAt: number;
}

const MAX_NOTE_LENGTH = 1000;

export interface CreateSprintNoteInput {
  id: string;
  topic: string;
  authorId: string;
  text: string;
  createdAt: number;
  assignedToId?: string;
}

/**
 * Builds a `SprintNote` in the "open" status, validating that it names a
 * topic, has an author, and has non-blank text. `text` is trimmed and
 * clamped to `MAX_NOTE_LENGTH`.
 */
export function createSprintNote(input: CreateSprintNoteInput): SprintNote {
  if (!input.topic.trim()) {
    throw new Error("createSprintNote: topic is required");
  }
  if (!input.authorId.trim()) {
    throw new Error("createSprintNote: authorId is required");
  }
  const text = input.text.trim();
  if (!text) {
    throw new Error("createSprintNote: text is required");
  }

  return {
    id: input.id,
    topic: input.topic,
    authorId: input.authorId,
    text: text.slice(0, MAX_NOTE_LENGTH),
    status: "open",
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    ...(input.assignedToId ? { assignedToId: input.assignedToId } : {}),
  };
}

/** Returns a copy of `note` with its status changed and `updatedAt` bumped. */
export function updateSprintNoteStatus(note: SprintNote, status: SprintNoteStatus, updatedAt: number): SprintNote {
  return { ...note, status, updatedAt };
}

/**
 * Returns a copy of `note` assigned to `assignedToId` as a task, or
 * unassigned (task released) when `assignedToId` is `null`.
 */
export function assignSprintNote(note: SprintNote, assignedToId: string | null, updatedAt: number): SprintNote {
  if (assignedToId === null) {
    const { assignedToId: _omit, ...rest } = note;
    return { ...rest, updatedAt };
  }
  return { ...note, assignedToId, updatedAt };
}

/** Ascending by `createdAt`, without mutating the input array. */
export function sortNotesByCreatedAt(notes: SprintNote[]): SprintNote[] {
  return [...notes].sort((a, b) => a.createdAt - b.createdAt);
}

/** All notes attached to one specific topic, oldest first. */
export function getNotesForTopic(notes: SprintNote[], topic: string): SprintNote[] {
  return sortNotesByCreatedAt(notes.filter((note) => note.topic === topic));
}

/** All notes currently assigned to a teammate as a task, oldest first. */
export function getNotesAssignedTo(notes: SprintNote[], assignedToId: string): SprintNote[] {
  return sortNotesByCreatedAt(notes.filter((note) => note.assignedToId === assignedToId));
}

/**
 * Notes still flagged `needs-follow-up`, oldest first — the longest a note
 * has stood open, the more it's worth surfacing.
 */
export function getOpenFollowUps(notes: SprintNote[]): SprintNote[] {
  return sortNotesByCreatedAt(notes.filter((note) => note.status === "needs-follow-up"));
}

/** Truncation length for a sprint note's text once it's rendered outside its own panel (e.g. the News Stream feed). */
const ANNOUNCEMENT_TEXT_PREVIEW_LENGTH = 140;

/**
 * Renders a one-line announcement for a newly logged sprint note — the
 * source text for the News Stream feature's "wire a Team Collaboration Mode
 * sprint-note community item" slice, mirroring `gamified-quests.ts`'s
 * `buildStreakMilestoneAnnouncementText`/`group-challenges.ts`'s
 * `buildChallengeCompletionAnnouncementText`/`revision-incentives.ts`'s
 * `buildTopReviserAnnouncementText`. A note's text is truncated to
 * `ANNOUNCEMENT_TEXT_PREVIEW_LENGTH` characters (with an ellipsis) so a long
 * prep note doesn't dominate the feed's card.
 */
export function buildSprintNoteAnnouncementText(note: SprintNote): string {
  const preview =
    note.text.length > ANNOUNCEMENT_TEXT_PREVIEW_LENGTH
      ? `${note.text.slice(0, ANNOUNCEMENT_TEXT_PREVIEW_LENGTH).trimEnd()}…`
      : note.text;
  return `${note.authorId} logged a "${note.topic}" prep note: ${preview}`;
}

/** One topic's full shared collaboration session: quest board, task routing, progress board, and notes. */
export interface TopicSprint {
  topic: string;
  questBoard: QuestProgress[];
  routing: RoutingResult;
  progressBoard: ContributorProgress[];
  /** This topic's notes, oldest first. */
  notes: SprintNote[];
}

export interface BuildTopicSprintInput {
  topic: string;
  quests: QuestTemplate[];
  contributions: QuestContribution[];
  /** Epoch ms the quest board is evaluated as of — same convention as `daily-quests.ts`'s `buildDailyQuestBoard`. */
  now: number;
  coverageReport: TopicCoverageReport;
  contributors: ContributorAvailability[];
  assignments: TrackedTopicAssignment[];
  notes: SprintNote[];
}

/**
 * Builds a topic's shared collaboration session: the day's quest board
 * (`daily-quests.ts`), the topic-coverage-driven task routing
 * (`research-task-routing.ts`), the per-contributor progress board
 * (`research-progress.ts`), and this topic's notes — reusing each slice's
 * own composition entry point directly rather than reimplementing any of
 * their quest/routing/progress logic.
 */
export function buildTopicSprint(input: BuildTopicSprintInput): TopicSprint {
  return {
    topic: input.topic,
    questBoard: buildDailyQuestBoard(input.quests, input.contributions, input.now),
    routing: buildRoutingResult(input.coverageReport, input.contributors),
    progressBoard: buildResearchProgressBoard(input.contributions, input.assignments),
    notes: getNotesForTopic(input.notes, input.topic),
  };
}

/**
 * Renders a topic sprint as a short, human-readable status block for a
 * collaboration-mode header — quest progress, task routing, and open
 * follow-up notes, reusing each slice's own summary line rather than
 * introducing a separate rendering.
 */
export function buildTopicSprintSummaryText(sprint: TopicSprint): string {
  const followUps = getOpenFollowUps(sprint.notes);
  const lines = [
    `${sprint.topic} sprint`,
    buildQuestBoardSummaryText(sprint.questBoard),
    buildRoutingSummaryText(sprint.routing),
    `${sprint.progressBoard.length} contributor${sprint.progressBoard.length === 1 ? "" : "s"} active`,
    followUps.length === 1 ? "1 note needs follow-up" : `${followUps.length} notes need follow-up`,
  ];
  return lines.join("\n");
}

/** Still-open ("needs-follow-up") notes an end-of-sprint retrospective names individually before capping the rest to a count. */
const MAX_RETROSPECTIVE_CARRIED_OVER_NOTES = 5;

/**
 * A backward-looking summary of one topic sprint's outcomes — quest
 * completion, task routing, contributor activity, and note resolution — for
 * the "Team Collaboration Mode" end-of-sprint retrospective named as a
 * follow-up in TODO.md. Purely derived from an already-composed
 * `TopicSprint`; doesn't persist anything itself.
 */
export interface SprintRetrospective {
  topic: string;
  questsCompleted: number;
  questsTotal: number;
  tasksAssigned: number;
  tasksUnassigned: number;
  /** Sum of every active contributor's `totalCompletedTasks` on the progress board — cumulative, not just this sprint's newly routed tasks. */
  tasksCompletedByTeam: number;
  contributorsActive: number;
  notesTotal: number;
  notesCovered: number;
  notesOpen: number;
  notesNeedFollowUp: number;
  /** The oldest still-open follow-up notes, capped to `MAX_RETROSPECTIVE_CARRIED_OVER_NOTES`, that carry into the next sprint. */
  carriedOverFollowUps: SprintNote[];
}

/**
 * Summarizes a topic sprint's outcomes for an end-of-sprint retrospective:
 * how many quests/tasks got finished, how many contributors were active, how
 * many notes got resolved versus still need follow-up, and which open
 * follow-ups (oldest first, capped) would carry over into the next sprint.
 */
export function buildSprintRetrospective(sprint: TopicSprint): SprintRetrospective {
  const notesCovered = sprint.notes.filter((note) => note.status === "covered").length;
  const notesOpen = sprint.notes.filter((note) => note.status === "open").length;
  const followUps = getOpenFollowUps(sprint.notes);

  return {
    topic: sprint.topic,
    questsCompleted: sprint.questBoard.filter((quest) => quest.isComplete).length,
    questsTotal: sprint.questBoard.length,
    tasksAssigned: sprint.routing.assignments.length,
    tasksUnassigned: sprint.routing.unassignedTasks.length,
    tasksCompletedByTeam: sprint.progressBoard.reduce((sum, progress) => sum + progress.totalCompletedTasks, 0),
    contributorsActive: sprint.progressBoard.length,
    notesTotal: sprint.notes.length,
    notesCovered,
    notesOpen,
    notesNeedFollowUp: followUps.length,
    carriedOverFollowUps: followUps.slice(0, MAX_RETROSPECTIVE_CARRIED_OVER_NOTES),
  };
}

/**
 * Filename for a downloaded sprint retrospective — mirrors
 * `research-progress.ts`'s `researchProgressReportFilename` plain-text-report
 * convention, slugging the topic so the file name stays filesystem-safe.
 */
export function sprintRetrospectiveFilename(topic: string): string {
  const slug =
    topic
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "topic";
  return `sprint-retrospective-${slug}.txt`;
}

/**
 * A scheduled sprint session — a specific calendar day a team plans to work
 * together on a topic sprint. Closes the "calendar scheduling for sprint
 * sessions" follow-up named under the "🤝 Team Collaboration Mode" bullet in
 * TODO.md. Scheduled by UTC calendar day (`scheduledDayKey`, "YYYY-MM-DD")
 * rather than a precise time, mirroring `drill-sets.ts`'s "Review reminder"
 * date-only convention — this repo has no time-zone-aware scheduling
 * anywhere else either.
 */
export interface SprintSession {
  id: string;
  topic: string;
  title: string;
  /** UTC calendar day this session is scheduled for, "YYYY-MM-DD" (see `getUtcDayKey`). */
  scheduledDayKey: string;
  createdAt: number;
}

const MAX_SESSION_TITLE_LENGTH = 200;
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface CreateSprintSessionInput {
  id: string;
  topic: string;
  title: string;
  scheduledDayKey: string;
  createdAt: number;
}

/**
 * Builds a `SprintSession`, validating that it names a topic, has a
 * non-blank title, and carries a well-formed "YYYY-MM-DD" day key. `title`
 * is trimmed and clamped to `MAX_SESSION_TITLE_LENGTH`.
 */
export function createSprintSession(input: CreateSprintSessionInput): SprintSession {
  if (!input.topic.trim()) {
    throw new Error("createSprintSession: topic is required");
  }
  const title = input.title.trim();
  if (!title) {
    throw new Error("createSprintSession: title is required");
  }
  if (!DAY_KEY_PATTERN.test(input.scheduledDayKey)) {
    throw new Error("createSprintSession: scheduledDayKey must be in YYYY-MM-DD format");
  }

  return {
    id: input.id,
    topic: input.topic,
    title: title.slice(0, MAX_SESSION_TITLE_LENGTH),
    scheduledDayKey: input.scheduledDayKey,
    createdAt: input.createdAt,
  };
}

/** Ascending by `scheduledDayKey`, without mutating the input array. */
export function sortSprintSessionsByDay(sessions: SprintSession[]): SprintSession[] {
  return [...sessions].sort((a, b) => a.scheduledDayKey.localeCompare(b.scheduledDayKey));
}

/** All sessions scheduled for one specific topic, soonest first. */
export function getSessionsForTopic(sessions: SprintSession[], topic: string): SprintSession[] {
  return sortSprintSessionsByDay(sessions.filter((session) => session.topic === topic));
}

/** Sessions scheduled today (by UTC day key) or later, soonest first. */
export function getUpcomingSprintSessions(sessions: SprintSession[], todayKey: string): SprintSession[] {
  return sortSprintSessionsByDay(sessions.filter((session) => session.scheduledDayKey >= todayKey));
}

/** Sessions scheduled before today (by UTC day key), most recently past first. */
export function getPastSprintSessions(sessions: SprintSession[], todayKey: string): SprintSession[] {
  return sortSprintSessionsByDay(sessions.filter((session) => session.scheduledDayKey < todayKey)).reverse();
}

/**
 * A shared sticky note on a topic sprint's whiteboard — the "a shared
 * whiteboard/canvas for sprint brainstorming" follow-up named under the "🤝
 * Team Collaboration Mode" bullet in TODO.md. `x`/`y` place it on a freeform,
 * draggable canvas (pixels from the board's top-left corner); they're
 * optional so a note saved before this field existed still loads (see
 * `getWhiteboardNotePosition`'s fallback), but every newly created note
 * always gets one from `nextWhiteboardNotePosition`.
 */
export type WhiteboardNoteColor = "yellow" | "pink" | "blue" | "green" | "purple";

/** Fixed palette a whiteboard note's color is drawn from, in default cycling order. */
export const WHITEBOARD_NOTE_COLORS: readonly WhiteboardNoteColor[] = [
  "yellow",
  "pink",
  "blue",
  "green",
  "purple",
];

export interface WhiteboardNote {
  id: string;
  topic: string;
  text: string;
  color: WhiteboardNoteColor;
  authorId: string;
  createdAt: number;
  x?: number;
  y?: number;
}

const MAX_WHITEBOARD_NOTE_LENGTH = 280;

export interface CreateWhiteboardNoteInput {
  id: string;
  topic: string;
  text: string;
  authorId: string;
  color: WhiteboardNoteColor;
  createdAt: number;
  /** Board position; omit for a caller that doesn't place notes on a freeform canvas (see `getWhiteboardNotePosition`'s fallback). */
  x?: number;
  y?: number;
}

/**
 * Builds a `WhiteboardNote`, validating that it names a topic and has
 * non-blank text. `text` is trimmed and clamped to `MAX_WHITEBOARD_NOTE_LENGTH`;
 * an unrecognized `color` falls back to the palette's first entry rather than
 * throwing (a note is still worth keeping even with a garbled color).
 */
export function createWhiteboardNote(input: CreateWhiteboardNoteInput): WhiteboardNote {
  if (!input.topic.trim()) {
    throw new Error("createWhiteboardNote: topic is required");
  }
  const text = input.text.trim();
  if (!text) {
    throw new Error("createWhiteboardNote: text is required");
  }

  return {
    id: input.id,
    topic: input.topic,
    text: text.slice(0, MAX_WHITEBOARD_NOTE_LENGTH),
    color: WHITEBOARD_NOTE_COLORS.includes(input.color) ? input.color : WHITEBOARD_NOTE_COLORS[0],
    authorId: input.authorId.trim() || "me",
    createdAt: input.createdAt,
    x: input.x,
    y: input.y,
  };
}

/** All notes for one specific topic, oldest first. */
export function getWhiteboardNotesForTopic(notes: WhiteboardNote[], topic: string): WhiteboardNote[] {
  return notes.filter((note) => note.topic === topic).sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * The color a newly-added note should default to, cycling through
 * `WHITEBOARD_NOTE_COLORS` by how many notes the topic's board already has —
 * so consecutive notes on the same board read as visually distinct without
 * requiring every contributor to hand-pick a color.
 */
export function nextWhiteboardNoteColor(existingNoteCountForTopic: number): WhiteboardNoteColor {
  const index = existingNoteCountForTopic % WHITEBOARD_NOTE_COLORS.length;
  return WHITEBOARD_NOTE_COLORS[index];
}

export interface WhiteboardNotePosition {
  x: number;
  y: number;
}

const WHITEBOARD_NOTE_GRID_COLUMNS = 4;
const WHITEBOARD_NOTE_GRID_COLUMN_WIDTH = 176;
const WHITEBOARD_NOTE_GRID_ROW_HEIGHT = 150;

/**
 * The board position a newly-added (or legacy, position-less) note should
 * default to, staggered into a grid by how many notes the topic's board
 * already has — so notes don't all pile up in the same top-left corner
 * before a contributor drags them apart.
 */
export function nextWhiteboardNotePosition(existingNoteCountForTopic: number): WhiteboardNotePosition {
  const column = existingNoteCountForTopic % WHITEBOARD_NOTE_GRID_COLUMNS;
  const row = Math.floor(existingNoteCountForTopic / WHITEBOARD_NOTE_GRID_COLUMNS);
  return {
    x: column * WHITEBOARD_NOTE_GRID_COLUMN_WIDTH,
    y: row * WHITEBOARD_NOTE_GRID_ROW_HEIGHT,
  };
}

/**
 * A note's on-board position — its own `x`/`y` when set, or else a staggered
 * grid slot derived from `indexFallback` (that note's position within its
 * topic's list) for a note saved before freeform positions existed.
 */
export function getWhiteboardNotePosition(note: WhiteboardNote, indexFallback: number): WhiteboardNotePosition {
  if (typeof note.x === "number" && typeof note.y === "number") {
    return { x: note.x, y: note.y };
  }
  return nextWhiteboardNotePosition(indexFallback);
}

const MIN_WHITEBOARD_NOTE_COORDINATE = 0;

/**
 * Repositions a note on the board, rounding to whole pixels and clamping to
 * non-negative coordinates so a drag can't push a note off the board's
 * top/left edge.
 */
export function moveWhiteboardNote(note: WhiteboardNote, x: number, y: number): WhiteboardNote {
  return {
    ...note,
    x: Math.max(MIN_WHITEBOARD_NOTE_COORDINATE, Math.round(x)),
    y: Math.max(MIN_WHITEBOARD_NOTE_COORDINATE, Math.round(y)),
  };
}

/**
 * Renders a `SprintRetrospective` as a plain-text file for download,
 * mirroring `research-progress.ts`'s `buildResearchProgressReportText`
 * plain-text-report convention.
 */
export function buildSprintRetrospectiveText(retro: SprintRetrospective): string {
  const lines = [
    `${retro.topic} — end-of-sprint retrospective`,
    "",
    `Quests: ${retro.questsCompleted}/${retro.questsTotal} complete`,
    `Tasks: ${retro.tasksAssigned} assigned, ${retro.tasksUnassigned} unassigned, ${retro.tasksCompletedByTeam} completed by the team`,
    `Contributors active: ${retro.contributorsActive}`,
    `Notes: ${retro.notesTotal} total (${retro.notesCovered} covered, ${retro.notesOpen} open, ${retro.notesNeedFollowUp} need follow-up)`,
  ];

  if (retro.carriedOverFollowUps.length > 0) {
    lines.push("", "Carrying into the next sprint:");
    for (const note of retro.carriedOverFollowUps) {
      lines.push(`- ${note.authorId}: ${note.text}`);
    }
  }

  return lines.join("\n");
}
