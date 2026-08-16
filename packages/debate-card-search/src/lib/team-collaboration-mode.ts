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
} from "./research-task-routing";
import type { TopicCoverageReport } from "./topic-coverage";

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
