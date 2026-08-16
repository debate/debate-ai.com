/**
 * @fileoverview Persistent storage for `team-collaboration-mode.ts`'s
 * `SprintNote` records — the "(a) persisting `SprintNote`s and a topic
 * sprint's inputs somewhere" follow-up named in that slice for the "Team
 * Collaboration Mode" idea in TODO.md. Stores notes in localStorage,
 * mirroring the existing `debate-round` `prepNotes.ts`/`coachingPrograms.ts`
 * persistence convention. This is the first localStorage-backed persistence
 * store in this package.
 *
 * @module state/sprintNotes
 */

import type { SprintNote } from "../lib/team-collaboration-mode";
import { getNotesForTopic } from "../lib/team-collaboration-mode";

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
