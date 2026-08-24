/**
 * @fileoverview Persistent storage for `judge/judge-profile.ts`'s
 * `JudgeRoundRecord`s — the raw per-ballot history behind a
 * `JudgeProfile`, which `state/judgeProfiles.ts` does not keep (that store
 * holds only the aggregate). Closes the "no profile editing/creation UI"
 * gap named in `docs/features/judge-profiles.md`: with the ballots
 * themselves persisted, a panel can log one round at a time and have the
 * judge's profile re-aggregate from the full history.
 *
 * A judge decides many rounds, so records aren't keyed by `judgeId` alone —
 * each logged round gets its own caller-assigned `id`, mirroring
 * `debate-data-sync`'s `tournamentResults.ts` wrapped-record convention
 * (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
 * rather than throwing). Re-aggregation runs the existing
 * `buildJudgeProfile` and persists through the existing `saveJudgeProfile`,
 * introducing no new profile-scoring logic here.
 *
 * `updateJudgeRoundRecord` also keeps a small per-round undo history (a
 * separate `judgeRoundRecordEditHistory` store, keyed by round id), closing
 * the "editing a ballot is all-or-nothing... a correction can't be undone"
 * gap named in `docs/features/judge-profiles.md`: `undoLastJudgeRoundRecordEdit`
 * steps a round back to the version it held immediately before its most
 * recent edit, one edit at a time.
 *
 * A matching per-round redo stack (`judgeRoundRecordRedoHistory`) closes
 * this file's own follow-on gap, "Undo has no matching redo": each call to
 * `undoLastJudgeRoundRecordEdit` pushes the version it just replaced onto
 * `id`'s redo stack, and `redoLastJudgeRoundRecordEdit` steps forward
 * through it one undo at a time. A fresh `updateJudgeRoundRecord` edit
 * discards any pending redo for that round — the same "a new edit
 * invalidates redo" rule any undo/redo stack follows — and
 * `deleteJudgeRoundRecord` discards it too, for the same reason it already
 * discards the undo stack.
 *
 * @module state/judgeRoundRecords
 */

import type { JudgeProfile, JudgeRoundRecord } from "../judge/judge-profile";
import { buildJudgeProfile } from "../judge/judge-profile";
import { deleteJudgeProfile, saveJudgeProfile } from "./judgeProfiles";

/** A `JudgeRoundRecord` as persisted: a unique id, since a judge decides many rounds. */
export interface JudgeRoundRecordEntry extends JudgeRoundRecord {
  id: string;
}

const STORAGE_KEY = "judgeRoundRecords";
const EDIT_HISTORY_STORAGE_KEY = "judgeRoundRecordEditHistory";
const REDO_HISTORY_STORAGE_KEY = "judgeRoundRecordRedoHistory";

/** Most prior versions kept per round id; oldest is dropped once a correction exceeds this. */
const MAX_EDIT_HISTORY_PER_RECORD = 10;
/** Most undone versions kept per round id, same cap as the undo stack itself. */
const MAX_REDO_HISTORY_PER_RECORD = MAX_EDIT_HISTORY_PER_RECORD;

function readAll(): JudgeRoundRecordEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as JudgeRoundRecordEntry[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: JudgeRoundRecordEntry[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

type EditHistoryById = Record<string, JudgeRoundRecordEntry[]>;

function readEditHistory(): EditHistoryById {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(EDIT_HISTORY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as EditHistoryById)
      : {};
  } catch {
    return {};
  }
}

function writeEditHistory(history: EditHistoryById): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(EDIT_HISTORY_STORAGE_KEY, JSON.stringify(history));
}

/** Pushes `previous` onto `id`'s undo stack, oldest-first, capped at `MAX_EDIT_HISTORY_PER_RECORD`. */
function pushEditHistory(id: string, previous: JudgeRoundRecordEntry): void {
  const history = readEditHistory();
  const stack = [...(history[id] ?? []), previous];
  history[id] = stack.slice(-MAX_EDIT_HISTORY_PER_RECORD);
  writeEditHistory(history);
}

function clearEditHistory(id: string): void {
  const history = readEditHistory();
  if (!(id in history)) return;
  delete history[id];
  writeEditHistory(history);
}

function readRedoHistory(): EditHistoryById {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(REDO_HISTORY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as EditHistoryById)
      : {};
  } catch {
    return {};
  }
}

function writeRedoHistory(history: EditHistoryById): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(REDO_HISTORY_STORAGE_KEY, JSON.stringify(history));
}

/** Pushes `replaced` onto `id`'s redo stack, oldest-first, capped at `MAX_REDO_HISTORY_PER_RECORD`. */
function pushRedoHistory(id: string, replaced: JudgeRoundRecordEntry): void {
  const history = readRedoHistory();
  const stack = [...(history[id] ?? []), replaced];
  history[id] = stack.slice(-MAX_REDO_HISTORY_PER_RECORD);
  writeRedoHistory(history);
}

function clearRedoHistory(id: string): void {
  const history = readRedoHistory();
  if (!(id in history)) return;
  delete history[id];
  writeRedoHistory(history);
}

/** Lists every persisted judged-round record, across every judge. */
export function listJudgeRoundRecords(): JudgeRoundRecordEntry[] {
  return readAll();
}

/** Lists every persisted judged-round record for one judge. */
export function listJudgeRoundRecordsForJudge(judgeId: string): JudgeRoundRecordEntry[] {
  return readAll().filter((record) => record.judgeId === judgeId);
}

/** Every distinct judge id with at least one logged round, sorted alphabetically. */
export function listJudgeIds(): string[] {
  return Array.from(new Set(readAll().map((record) => record.judgeId))).sort();
}

/** Levenshtein edit distance between two strings, case-insensitive. */
function editDistance(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  const rows: number[][] = Array.from({ length: x.length + 1 }, () => new Array(y.length + 1).fill(0));
  for (let i = 0; i <= x.length; i++) rows[i]![0] = i;
  for (let j = 0; j <= y.length; j++) rows[0]![j] = j;
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      rows[i]![j] = Math.min(
        rows[i - 1]![j]! + 1,
        rows[i]![j - 1]! + 1,
        rows[i - 1]![j - 1]! + cost,
      );
    }
  }
  return rows[x.length]![y.length]!;
}

/**
 * The known judge id closest to `query` by edit distance, for a "did you
 * mean" suggestion when a typed filter matches no logged round. Returns
 * `null` when there are no logged judge ids or `query` is blank.
 */
export function findNearestJudgeId(query: string): string | null {
  const trimmed = query.trim();
  if (trimmed === "") return null;
  const ids = listJudgeIds();
  if (ids.length === 0) return null;
  return ids.reduce((closest, id) =>
    editDistance(trimmed, id) < editDistance(trimmed, closest) ? id : closest,
  );
}

/**
 * Re-derives one judge's `JudgeProfile` from their persisted round records
 * and saves it. A judge with no records left has their derived profile
 * deleted instead of being left with a zero-round one; the deleted/absent
 * case returns `null`.
 */
export function rebuildJudgeProfileFromRecords(judgeId: string): JudgeProfile | null {
  const records = listJudgeRoundRecordsForJudge(judgeId);
  if (records.length === 0) {
    deleteJudgeProfile(judgeId);
    return null;
  }
  const profile = buildJudgeProfile(judgeId, records);
  saveJudgeProfile(profile);
  return profile;
}

/**
 * Logs one judged round: appends it to the persisted ballot history, then
 * re-aggregates and saves that judge's profile from the full history.
 * Returns the judge's updated profile.
 */
export function recordJudgeRound(record: JudgeRoundRecordEntry): JudgeProfile {
  const records = readAll();
  records.push(record);
  writeAll(records);
  const profile = buildJudgeProfile(
    record.judgeId,
    records.filter((existing) => existing.judgeId === record.judgeId),
  );
  saveJudgeProfile(profile);
  return profile;
}

/**
 * Replaces one persisted judged-round record by `id`, keeping its position in
 * the history, then re-aggregates the affected judge's profile. Reassigning a
 * round to a different judge re-aggregates the previous judge too (dropping
 * their derived profile when that was their last round). Returns the profile
 * for the updated record's judge, or `null` if the id isn't stored.
 *
 * Discards any pending redo history for `record.id`: a fresh edit is a new
 * timeline, so a version that was undone before this edit is no longer
 * reachable by redo (it's still reachable by repeated undo, since this edit
 * itself is pushed onto the undo stack).
 */
export function updateJudgeRoundRecord(record: JudgeRoundRecordEntry): JudgeProfile | null {
  const records = readAll();
  const index = records.findIndex((existing) => existing.id === record.id);
  if (index === -1) return null;
  const previous = records[index]!;
  pushEditHistory(record.id, previous);
  clearRedoHistory(record.id);
  records[index] = record;
  writeAll(records);
  if (previous.judgeId !== record.judgeId) {
    rebuildJudgeProfileFromRecords(previous.judgeId);
  }
  return rebuildJudgeProfileFromRecords(record.judgeId);
}

/**
 * Deletes one persisted judged-round record by `id` and re-aggregates the
 * affected judge's profile; a no-op if the id isn't stored. Also discards
 * that round's edit-undo and redo history, since there is no longer a
 * current version for either to apply to.
 */
export function deleteJudgeRoundRecord(id: string): void {
  const records = readAll();
  const removed = records.find((record) => record.id === id);
  if (!removed) return;
  writeAll(records.filter((record) => record.id !== id));
  clearEditHistory(id);
  clearRedoHistory(id);
  rebuildJudgeProfileFromRecords(removed.judgeId);
}

/**
 * Whether `id` has at least one prior version to undo back to — i.e. it has
 * been edited (via `updateJudgeRoundRecord`) since it was logged or last
 * undone.
 */
export function hasJudgeRoundRecordEditHistory(id: string): boolean {
  return (readEditHistory()[id]?.length ?? 0) > 0;
}

/**
 * Lists `id`'s prior versions, most-recent-edit-first — what the round
 * looked like immediately before each correction still available to undo.
 */
export function listJudgeRoundRecordEditHistory(id: string): JudgeRoundRecordEntry[] {
  return [...(readEditHistory()[id] ?? [])].reverse();
}

/**
 * Undoes the most recent edit to round `id`: restores it to the version it
 * held immediately before that edit and re-aggregates the affected judge(s),
 * the same way `updateJudgeRoundRecord` would. Repeated calls step further
 * back through the id's history. Returns the profile for the restored
 * record's judge, or `null` if the round isn't stored or has no edit to
 * undo (either because it was never edited, or every edit already has been).
 *
 * Pushes the version this undo just replaced onto `id`'s redo stack, so
 * `redoLastJudgeRoundRecordEdit` can step forward to it again.
 */
export function undoLastJudgeRoundRecordEdit(id: string): JudgeProfile | null {
  const records = readAll();
  const index = records.findIndex((existing) => existing.id === id);
  if (index === -1) return null;

  const history = readEditHistory();
  const stack = history[id] ?? [];
  const restored = stack[stack.length - 1];
  if (!restored) return null;

  const replaced = records[index]!;
  const currentJudgeId = replaced.judgeId;
  records[index] = restored;
  writeAll(records);

  const remaining = stack.slice(0, -1);
  if (remaining.length > 0) {
    history[id] = remaining;
  } else {
    delete history[id];
  }
  writeEditHistory(history);
  pushRedoHistory(id, replaced);

  if (currentJudgeId !== restored.judgeId) {
    rebuildJudgeProfileFromRecords(currentJudgeId);
  }
  return rebuildJudgeProfileFromRecords(restored.judgeId);
}

/**
 * Whether `id` has at least one undone version to redo forward to — i.e. it
 * has been undone (via `undoLastJudgeRoundRecordEdit`) more recently than
 * any fresh edit, delete, or exhausting redo.
 */
export function hasJudgeRoundRecordRedoHistory(id: string): boolean {
  return (readRedoHistory()[id]?.length ?? 0) > 0;
}

/**
 * Lists `id`'s undone versions, most-recently-undone-first — what redo would
 * restore, one step at a time.
 */
export function listJudgeRoundRecordRedoHistory(id: string): JudgeRoundRecordEntry[] {
  return [...(readRedoHistory()[id] ?? [])].reverse();
}

/**
 * Redoes the most recently undone edit to round `id`: re-applies the version
 * that was replaced by the last `undoLastJudgeRoundRecordEdit` call and
 * re-aggregates the affected judge(s). Repeated calls step forward through
 * the id's redo stack. Pushes the version it replaces back onto the undo
 * stack, so a further undo can revert this redo. Returns the profile for the
 * redone record's judge, or `null` if the round isn't stored or has nothing
 * to redo (either because it was never undone, or every undo already has
 * been redone or invalidated by a fresh edit/delete).
 */
export function redoLastJudgeRoundRecordEdit(id: string): JudgeProfile | null {
  const records = readAll();
  const index = records.findIndex((existing) => existing.id === id);
  if (index === -1) return null;

  const redoHistory = readRedoHistory();
  const redoStack = redoHistory[id] ?? [];
  const redone = redoStack[redoStack.length - 1];
  if (!redone) return null;

  const replaced = records[index]!;
  const currentJudgeId = replaced.judgeId;
  records[index] = redone;
  writeAll(records);

  const remainingRedo = redoStack.slice(0, -1);
  if (remainingRedo.length > 0) {
    redoHistory[id] = remainingRedo;
  } else {
    delete redoHistory[id];
  }
  writeRedoHistory(redoHistory);
  pushEditHistory(id, replaced);

  if (currentJudgeId !== redone.judgeId) {
    rebuildJudgeProfileFromRecords(currentJudgeId);
  }
  return rebuildJudgeProfileFromRecords(redone.judgeId);
}
