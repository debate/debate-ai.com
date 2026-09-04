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
 * `buildPrepNotesPanelView`/`nextPrepNoteStatus` support the "🔄 Strategy
 * Sync Notes" bullet's follow-up (a) in TODO.md, "a prep-notes panel UI" —
 * see `panels/PrepNotesPanel.tsx`.
 *
 * `assignPersistedPrepNote` also closes that bullet's follow-up (b), "an
 * assignee notification" — every real assignment (not an unassignment)
 * records a `state/prepNoteNotifications.ts` notification for the new
 * assignee.
 *
 * `updatePersistedPrepNotePriority` closes that bullet's "a priority flag"
 * follow-up — a note can be flagged high priority, sorted ahead of its
 * status-mates by `buildPrepNotesPanelView`.
 *
 * @module state/prepNotes
 */

import type { PrepNote, PrepNotePriority, PrepNoteStatus } from "debate-round/src/flow/strategy-sync-notes";
import {
  assignNote,
  getNotesForBox,
  getNotesForFlow,
  setNotePriority,
  sortNotesByPriorityThenCreatedAt,
  updateNoteStatus,
} from "debate-round/src/flow/strategy-sync-notes";
import { recordPrepNoteAssignedNotification } from "./prepNoteNotifications";

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

/**
 * Lists a single box's persisted prep notes within one flow, oldest first —
 * feeds the `FlowSpreadsheet` cell affordance (`PrepNoteBadge`/
 * `PrepNotePopover`) that lets a note be created directly against the box
 * it's about, without leaving the live grid for the separate, cross-flow
 * `PrepNotesPanel`.
 */
export function listPrepNotesForBox(flowId: number, boxPath: number[]): PrepNote[] {
  return getNotesForBox(readAll(), flowId, boxPath);
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
 * Applies `setNotePriority` to the persisted note with `id` and saves the
 * result, so flagging (or unflagging, via `"normal"`) a note as high
 * priority actually persists. Returns the updated note, or `undefined`
 * (leaving storage untouched) if no note with that id is stored.
 */
export function updatePersistedPrepNotePriority(
  id: string,
  priority: PrepNotePriority,
  updatedAt: number,
): PrepNote | undefined {
  const note = getPrepNote(id);
  if (!note) return undefined;

  const updated = setNotePriority(note, priority, updatedAt);
  savePrepNote(updated);
  return updated;
}

/**
 * Applies `assignNote` to the persisted note with `id` and saves the
 * result, so assigning (or unassigning, via `assignedToId: null`) the note
 * as a task actually persists. On a real assignment (not an unassignment)
 * this also records a `prepNoteNotifications.ts` notification for the new
 * assignee. Returns the updated note, or `undefined` (leaving storage
 * untouched) if no note with that id is stored.
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

  if (assignedToId) {
    recordPrepNoteAssignedNotification(`${updated.id}-notif-${updatedAt}`, updated, assignedToId, updatedAt);
  }

  return updated;
}

/** One status group of persisted prep notes, for the prep-notes panel. */
export type PrepNotesPanelGroup = {
  status: PrepNoteStatus;
  notes: PrepNote[];
};

/**
 * Status groups in the order a prep-notes panel should render them —
 * notes still needing follow-up surfaced first, matching
 * `buildPrepNoteSummaryText`'s ordering.
 */
export const PREP_NOTE_STATUS_ORDER: PrepNoteStatus[] = ["needs-follow-up", "open", "covered"];

/**
 * Reads every persisted prep note (across all flows) and groups it by
 * status, in `PREP_NOTE_STATUS_ORDER`, each group's notes high-priority
 * first and oldest first within each priority tier. Used by
 * `PrepNotesPanel` to render a status-grouped list.
 */
export function buildPrepNotesPanelView(): PrepNotesPanelGroup[] {
  const notes = readAll();
  return PREP_NOTE_STATUS_ORDER.map((status) => ({
    status,
    notes: sortNotesByPriorityThenCreatedAt(notes.filter((note) => note.status === status)),
  }));
}

const NEXT_STATUS: Record<PrepNoteStatus, PrepNoteStatus> = {
  open: "covered",
  covered: "needs-follow-up",
  "needs-follow-up": "open",
};

/**
 * The next status in a prep note's status cycle (open → covered →
 * needs-follow-up → open), for a panel's "cycle status" action.
 */
export function nextPrepNoteStatus(status: PrepNoteStatus): PrepNoteStatus {
  return NEXT_STATUS[status];
}
