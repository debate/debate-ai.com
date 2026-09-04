/**
 * @fileoverview Persistent storage for `team-collaboration-mode.ts`'s
 * `SprintNote` records — the "(a) persisting `SprintNote`s and a topic
 * sprint's inputs somewhere" follow-up named in that slice for the "Team
 * Collaboration Mode" idea in TODO.md. Stores notes in localStorage,
 * mirroring the existing `debate-round` `prepNotes.ts`/`coachingPrograms.ts`
 * persistence convention. This is the first localStorage-backed persistence
 * store in this package.
 *
 * `buildSprintNotesPanelView`/`nextSprintNoteStatus`/
 * `updatePersistedSprintNoteStatus`/`assignPersistedSprintNote` support the
 * "🤝 Team Collaboration Mode" bullet's follow-up (a) in TODO.md, "a
 * collaboration-mode panel UI" — see `panels/SprintNotesPanel.tsx`. These
 * mirror `debate-round`'s `state/prepNotes.ts` exactly, applying
 * `team-collaboration-mode.ts`'s pure `updateSprintNoteStatus`/
 * `assignSprintNote` transitions against a stored note rather than
 * introducing new mutation logic.
 *
 * @module state/sprintNotes
 */

import type { SprintNote, SprintNoteStatus } from "../lib/team-collaboration-mode";
import { assignSprintNote, getNotesForTopic, updateSprintNoteStatus } from "../lib/team-collaboration-mode";

const STORAGE_KEY = "sprintNotes";

function readAll(): SprintNote[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SprintNote[]) : [];
  } catch {
    return [];
  }
}

function writeAll(notes: SprintNote[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

/** Lists every persisted sprint note, across all topics. */
export function listSprintNotes(): SprintNote[] {
  return readAll();
}

/** Lists every persisted sprint note for one topic, oldest first. */
export function listSprintNotesForTopic(topic: string): SprintNote[] {
  return getNotesForTopic(readAll(), topic);
}

/** Looks up a single persisted sprint note by id, if any. */
export function getSprintNote(id: string): SprintNote | undefined {
  return readAll().find((note) => note.id === id);
}

/** Saves a sprint note, overwriting any existing record with the same id. */
export function saveSprintNote(note: SprintNote): void {
  const notes = readAll();
  const index = notes.findIndex((existing) => existing.id === note.id);
  if (index === -1) {
    notes.push(note);
  } else {
    notes[index] = note;
  }
  writeAll(notes);
}

/** Deletes a persisted sprint note by id; a no-op if it isn't stored. */
export function deleteSprintNote(id: string): void {
  writeAll(readAll().filter((note) => note.id !== id));
}

/**
 * Applies `updateSprintNoteStatus` to the persisted note with `id` and saves
 * the result, so the status change actually persists. Returns the updated
 * note, or `undefined` (leaving storage untouched) if no note with that id is
 * stored.
 */
export function updatePersistedSprintNoteStatus(
  id: string,
  status: SprintNoteStatus,
  updatedAt: number,
): SprintNote | undefined {
  const note = getSprintNote(id);
  if (!note) return undefined;

  const updated = updateSprintNoteStatus(note, status, updatedAt);
  saveSprintNote(updated);
  return updated;
}

/**
 * Applies `assignSprintNote` to the persisted note with `id` and saves the
 * result, so assigning (or unassigning, via `assignedToId: null`) the note as
 * a task actually persists. Returns the updated note, or `undefined` (leaving
 * storage untouched) if no note with that id is stored.
 */
export function assignPersistedSprintNote(
  id: string,
  assignedToId: string | null,
  updatedAt: number,
): SprintNote | undefined {
  const note = getSprintNote(id);
  if (!note) return undefined;

  const updated = assignSprintNote(note, assignedToId, updatedAt);
  saveSprintNote(updated);
  return updated;
}

/** One topic's group of persisted sprint notes, for the collaboration panel. */
export type SprintNotesPanelGroup = {
  topic: string;
  notes: SprintNote[];
};

/**
 * Reads every persisted sprint note and groups it by topic (topics in
 * first-seen order across the stored notes), each group's notes oldest
 * first. Used by `SprintNotesPanel` to render a topic-grouped list.
 */
export function buildSprintNotesPanelView(): SprintNotesPanelGroup[] {
  const notes = readAll();
  const topics: string[] = [];
  for (const note of notes) {
    if (!topics.includes(note.topic)) topics.push(note.topic);
  }
  return topics.map((topic) => ({ topic, notes: getNotesForTopic(notes, topic) }));
}

const NEXT_STATUS: Record<SprintNoteStatus, SprintNoteStatus> = {
  open: "covered",
  covered: "needs-follow-up",
  "needs-follow-up": "open",
};

/**
 * The next status in a sprint note's status cycle (open → covered →
 * needs-follow-up → open), for a panel's "cycle status" action.
 */
export function nextSprintNoteStatus(status: SprintNoteStatus): SprintNoteStatus {
  return NEXT_STATUS[status];
}
