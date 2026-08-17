/**
 * @fileoverview Persistent storage for `strategy-sync-notes.ts`'s `PrepNote`
 * records — the "(a) wiring `PrepNote` into wherever round/flow state is
 * eventually persisted" follow-up named in that slice for the "Strategy
 * Sync Notes" idea in TODO.md. Stores notes in localStorage, mirroring the
 * existing `coachingPrograms.ts`/`myTeamProfile.ts` persistence convention.
 *
 * Also closes that same entry's own follow-up (b) — `updatePersistedPrepNoteStatus`/
 * `assignPersistedPrepNote` apply `strategy-sync-notes.ts`'s pure
 * `updateNoteStatus`/`assignNote` state transitions directly against a
 * stored note and save the result, so a status change or assignment
 * actually persists instead of requiring the caller to re-derive and
 * re-save the note itself.
 *
 * @module state/prepNotes
 */

import type { PrepNote, PrepNoteStatus } from "../flow/strategy-sync-notes";
import { assignNote, getNotesForFlow, updateNoteStatus } from "../flow/strategy-sync-notes";

const STORAGE_KEY = "prepNotes";

function readAll(): PrepNote[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PrepNote[]) : [];
  } catch {
    return [];
  }
}

function writeAll(notes: PrepNote[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

/** Lists every persisted prep note, across all flows. */
export function listPrepNotes(): PrepNote[] {
  return readAll();
}

/** Lists every persisted prep note for one flow, oldest first. */
export function listPrepNotesForFlow(flowId: number): PrepNote[] {
  return getNotesForFlow(readAll(), flowId);
}

/** Looks up a single persisted prep note by id, if any. */
export function getPrepNote(id: string): PrepNote | undefined {
  return readAll().find((note) => note.id === id);
}

/** Saves a prep note, overwriting any existing record with the same id. */
export function savePrepNote(note: PrepNote): void {
  const notes = readAll();
  const index = notes.findIndex((existing) => existing.id === note.id);
  if (index === -1) {
    notes.push(note);
  } else {
    notes[index] = note;
  }
  writeAll(notes);
}

/** Deletes a persisted prep note by id; a no-op if it isn't stored. */
export function deletePrepNote(id: string): void {
  writeAll(readAll().filter((note) => note.id !== id));
}

/**
 * Applies `updateNoteStatus` to the persisted note with `id` and saves the
 * result, so the status change actually persists. Returns the updated note,
 * or `undefined` (leaving storage untouched) if no note with that id is
 * stored.
 */
export function updatePersistedPrepNoteStatus(
  id: string,
  status: PrepNoteStatus,
  updatedAt: number,
): PrepNote | undefined {
  const note = getPrepNote(id);
  if (!note) return undefined;

  const updated = updateNoteStatus(note, status, updatedAt);
  savePrepNote(updated);
  return updated;
}

/**
 * Applies `assignNote` to the persisted note with `id` and saves the
 * result, so assigning (or unassigning, via `assignedToId: null`) the note
 * as a task actually persists. Returns the updated note, or `undefined`
 * (leaving storage untouched) if no note with that id is stored.
 */
export function assignPersistedPrepNote(
  id: string,
  assignedToId: string | null,
  updatedAt: number,
): PrepNote | undefined {
  const note = getPrepNote(id);
  if (!note) return undefined;

  const updated = assignNote(note, assignedToId, updatedAt);
  savePrepNote(updated);
  return updated;
}
