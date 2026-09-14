/**
 * @fileoverview Persistent storage for `team-collaboration-mode.ts`'s
 * `WhiteboardNote` records — the "a shared whiteboard/canvas for sprint
 * brainstorming" follow-up named under the "🤝 Team Collaboration Mode"
 * bullet in TODO.md. Stores notes in localStorage, mirroring
 * `state/sprintSessions.ts`'s exact persistence convention.
 *
 * @module state/sprintWhiteboard
 */

import type { WhiteboardNote } from "../lib/team-collaboration-mode";
import { getWhiteboardNotesForTopic, moveWhiteboardNotePosition } from "../lib/team-collaboration-mode";

const STORAGE_KEY = "sprintWhiteboardNotes";

function readAll(): WhiteboardNote[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WhiteboardNote[]) : [];
  } catch {
    return [];
  }
}

function writeAll(notes: WhiteboardNote[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

/** Lists every persisted whiteboard note, across all topics. */
export function listWhiteboardNotes(): WhiteboardNote[] {
  return readAll();
}

/** Lists every persisted whiteboard note for one topic, oldest first. */
export function listWhiteboardNotesForTopic(topic: string): WhiteboardNote[] {
  return getWhiteboardNotesForTopic(readAll(), topic);
}

/** Saves a whiteboard note, overwriting any existing record with the same id. */
export function saveWhiteboardNote(note: WhiteboardNote): void {
  const notes = readAll();
  const index = notes.findIndex((existing) => existing.id === note.id);
  if (index === -1) {
    notes.push(note);
  } else {
    notes[index] = note;
  }
  writeAll(notes);
}

/** Deletes a persisted whiteboard note by id; a no-op if it isn't stored. */
export function deleteWhiteboardNote(id: string): void {
  writeAll(readAll().filter((note) => note.id !== id));
}

/**
 * Persists a note's new `x`/`y` position on the freeform whiteboard —
 * the write-side of dragging a sticky note. A no-op if `id` isn't stored.
 */
export function updatePersistedWhiteboardNotePosition(id: string, x: number, y: number): void {
  writeAll(moveWhiteboardNotePosition(readAll(), id, x, y));
}
