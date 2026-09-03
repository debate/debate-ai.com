/**
 * @fileoverview Persistent storage for `rankings/opponent-team-profile.ts`'s
 * `OpponentRoundRecord`s — the raw scouted-round history behind an
 * `OpponentTeamProfile`, which `state/opponentTeamProfiles.ts` does not keep
 * (that store holds only the aggregate). Closes the "no profile
 * editing/creation UI" gap named in
 * `docs/features/opponent-team-profiles.md`: with the rounds themselves
 * persisted, a panel can log one scouted round at a time and have the team's
 * profile re-aggregate from the full history.
 *
 * A team competes in many rounds, so records aren't keyed by `teamId` alone —
 * each logged round gets its own caller-assigned `id`, mirroring
 * `debate-speech-writer`'s `judgeRoundRecords.ts` and this package's own
 * `tournamentResults.ts` wrapped-record convention (SSR/no-storage-safe,
 * corrupt or missing JSON degrades to an empty list rather than throwing).
 * Re-aggregation runs the existing `buildOpponentTeamProfile` and persists
 * through the existing `saveOpponentTeamProfile`, introducing no new scouting
 * logic here.
 *
 * This store is scoped to *opposing* teams. `debate-round`'s
 * `state/ownRoundHistory.ts` persists the same record type from this team's
 * own perspective for pre-round briefings, and is deliberately separate — a
 * team's own rounds shouldn't appear as an opponent's scouting profile.
 *
 * `updateOpponentRoundRecord` also keeps a small per-round undo history (a
 * separate `opponentRoundRecordEditHistory` store, keyed by round id),
 * closing the "editing a round is all-or-nothing... a correction can't be
 * undone" gap named in `docs/features/opponent-team-profiles.md`:
 * `undoLastOpponentRoundRecordEdit` steps a round back to the version it
 * held immediately before its most recent edit, one edit at a time. A
 * matching per-round redo stack (`opponentRoundRecordRedoHistory`) lets
 * `redoLastOpponentRoundRecordEdit` step forward through undone edits again
 * — each call to `undoLastOpponentRoundRecordEdit` pushes the version it
 * just replaced onto `id`'s redo stack, and a fresh
 * `updateOpponentRoundRecord` edit (or `deleteOpponentRoundRecord`) discards
 * it, the same "a new edit invalidates redo" rule any undo/redo stack
 * follows. Mirrors `debate-speech-writer`'s `judgeRoundRecords.ts` undo/redo
 * stacks exactly.
 *
 * @module state/opponentRoundRecords
 */

import type {
  OpponentRoundRecord,
  OpponentTeamProfile,
} from "../rankings/opponent-team-profile";
import { buildOpponentTeamProfile } from "../rankings/opponent-team-profile";
import { parseOpponentRoundRecordsCsv } from "../rankings/opponent-round-csv-import";
import { deleteOpponentTeamProfile, saveOpponentTeamProfile } from "./opponentTeamProfiles";

/** An `OpponentRoundRecord` as persisted: a unique id, since a team plays many rounds. */
export interface OpponentRoundRecordEntry extends OpponentRoundRecord {
  id: string;
}

const STORAGE_KEY = "opponentRoundRecords";
const EDIT_HISTORY_STORAGE_KEY = "opponentRoundRecordEditHistory";
const REDO_HISTORY_STORAGE_KEY = "opponentRoundRecordRedoHistory";

/** Most prior versions kept per round id; oldest is dropped once a correction exceeds this. */
const MAX_EDIT_HISTORY_PER_RECORD = 10;
/** Most undone versions kept per round id, same cap as the undo stack itself. */
const MAX_REDO_HISTORY_PER_RECORD = MAX_EDIT_HISTORY_PER_RECORD;

function readAll(): OpponentRoundRecordEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OpponentRoundRecordEntry[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: OpponentRoundRecordEntry[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

type EditHistoryById = Record<string, OpponentRoundRecordEntry[]>;

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
function pushEditHistory(id: string, previous: OpponentRoundRecordEntry): void {
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
function pushRedoHistory(id: string, replaced: OpponentRoundRecordEntry): void {
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

/** Lists every persisted scouted-round record, across every opposing team. */
export function listOpponentRoundRecords(): OpponentRoundRecordEntry[] {
  return readAll();
}

/** Lists every persisted scouted-round record for one opposing team. */
export function listOpponentRoundRecordsForTeam(teamId: string): OpponentRoundRecordEntry[] {
  return readAll().filter((record) => record.teamId === teamId);
}

/** Every distinct opposing-team id with at least one logged round, sorted alphabetically. */
export function listOpponentTeamIds(): string[] {
  return Array.from(new Set(readAll().map((record) => record.teamId))).sort();
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
 * The known opposing-team id closest to `query` by edit distance, for a "did
 * you mean" suggestion when a typed filter matches no logged round. Returns
 * `null` when there are no logged team ids or `query` is blank.
 */
export function findNearestOpponentTeamId(query: string): string | null {
  const trimmed = query.trim();
  if (trimmed === "") return null;
  const ids = listOpponentTeamIds();
  if (ids.length === 0) return null;
  return ids.reduce((closest, id) =>
    editDistance(trimmed, id) < editDistance(trimmed, closest) ? id : closest,
  );
}

/**
 * Re-derives one team's `OpponentTeamProfile` from its persisted scouted-round
 * records and saves it. A team with no records left has its derived profile
 * deleted instead of being left with a zero-round one; the deleted/absent case
 * returns `null`.
 */
export function rebuildOpponentTeamProfileFromRecords(
  teamId: string,
): OpponentTeamProfile | null {
  const records = listOpponentRoundRecordsForTeam(teamId);
  if (records.length === 0) {
    deleteOpponentTeamProfile(teamId);
    return null;
  }
  const profile = buildOpponentTeamProfile(teamId, records);
  saveOpponentTeamProfile(profile);
  return profile;
}

/**
 * Logs one scouted round: appends it to the persisted round history, then
 * re-aggregates and saves that team's profile from the full history. Returns
 * the team's updated profile.
 */
export function recordOpponentRound(record: OpponentRoundRecordEntry): OpponentTeamProfile {
  const records = readAll();
  records.push(record);
  writeAll(records);
  const profile = buildOpponentTeamProfile(
    record.teamId,
    records.filter((existing) => existing.teamId === record.teamId),
  );
  saveOpponentTeamProfile(profile);
  return profile;
}

/** Result of a bulk CSV opponent-round import. */
export interface OpponentRoundCsvImportResult {
  importedCount: number;
  skippedCount: number;
  /** One human-readable message per skipped CSV row, in row order. */
  errors: string[];
  /** Distinct team ids whose profile was created or updated by this import. */
  affectedTeamIds: string[];
}

/**
 * Parses `rawCsv` via `rankings/opponent-round-csv-import.ts`'s
 * `parseOpponentRoundRecordsCsv` and persists every well-formed row in one
 * batch: appends each parsed round to the full history, then re-aggregates
 * every affected team's profile once each (not once per row) — mirrors
 * `debate-card-search`'s `bulkImportScoredCards` convention of composing a
 * pure parser with the store's own persistence, reporting a skipped-row
 * count/reasons instead of failing the whole batch on one malformed row.
 */
export function bulkImportOpponentRoundRecords(rawCsv: string): OpponentRoundCsvImportResult {
  const { entries, skippedCount, errors } = parseOpponentRoundRecordsCsv(rawCsv);
  if (entries.length === 0) {
    return { importedCount: 0, skippedCount, errors, affectedTeamIds: [] };
  }

  const records = readAll();
  const importedAt = Date.now();
  const newEntries: OpponentRoundRecordEntry[] = entries.map((entry, index) => ({
    ...entry,
    id: `${entry.teamId}-${entry.tournamentName}-${entry.date}-${importedAt}-${index}`,
  }));
  records.push(...newEntries);
  writeAll(records);

  const affectedTeamIds = Array.from(new Set(newEntries.map((entry) => entry.teamId)));
  for (const teamId of affectedTeamIds) {
    rebuildOpponentTeamProfileFromRecords(teamId);
  }

  return { importedCount: newEntries.length, skippedCount, errors, affectedTeamIds };
}

/**
 * Replaces one persisted scouted-round record by `id`, keeping its position in
 * the history, then re-aggregates the affected team's profile. Reassigning a
 * round to a different team re-aggregates the previous team too (dropping its
 * derived profile when that was its last round). Returns the profile for the
 * updated record's team, or `null` if the id isn't stored.
 *
 * Discards any pending redo history for `record.id`: a fresh edit is a new
 * timeline, so a version that was undone before this edit is no longer
 * reachable by redo (it's still reachable by repeated undo, since this edit
 * itself is pushed onto the undo stack).
 */
export function updateOpponentRoundRecord(
  record: OpponentRoundRecordEntry,
): OpponentTeamProfile | null {
  const records = readAll();
  const index = records.findIndex((existing) => existing.id === record.id);
  if (index === -1) return null;
  const previous = records[index]!;
  pushEditHistory(record.id, previous);
  clearRedoHistory(record.id);
  records[index] = record;
  writeAll(records);
  if (previous.teamId !== record.teamId) {
    rebuildOpponentTeamProfileFromRecords(previous.teamId);
  }
  return rebuildOpponentTeamProfileFromRecords(record.teamId);
}

/**
 * Deletes one persisted scouted-round record by `id` and re-aggregates the
 * affected team's profile; a no-op if the id isn't stored. Also discards
 * that round's edit-undo and redo history, since there is no longer a
 * current version for either to apply to.
 */
export function deleteOpponentRoundRecord(id: string): void {
  const records = readAll();
  const removed = records.find((record) => record.id === id);
  if (!removed) return;
  writeAll(records.filter((record) => record.id !== id));
  clearEditHistory(id);
  clearRedoHistory(id);
  rebuildOpponentTeamProfileFromRecords(removed.teamId);
}

/**
 * Whether `id` has at least one prior version to undo back to — i.e. it has
 * been edited (via `updateOpponentRoundRecord`) since it was logged or last
 * undone.
 */
export function hasOpponentRoundRecordEditHistory(id: string): boolean {
  return (readEditHistory()[id]?.length ?? 0) > 0;
}

/**
 * Lists `id`'s prior versions, most-recent-edit-first — what the round
 * looked like immediately before each correction still available to undo.
 */
export function listOpponentRoundRecordEditHistory(id: string): OpponentRoundRecordEntry[] {
  return [...(readEditHistory()[id] ?? [])].reverse();
}

/**
 * Undoes the most recent edit to round `id`: restores it to the version it
 * held immediately before that edit and re-aggregates the affected team(s),
 * the same way `updateOpponentRoundRecord` would. Repeated calls step further
 * back through the id's history. Returns the profile for the restored
 * record's team, or `null` if the round isn't stored or has no edit to
 * undo (either because it was never edited, or every edit already has been).
 *
 * Pushes the version this undo just replaced onto `id`'s redo stack, so
 * `redoLastOpponentRoundRecordEdit` can step forward to it again.
 */
export function undoLastOpponentRoundRecordEdit(id: string): OpponentTeamProfile | null {
  const records = readAll();
  const index = records.findIndex((existing) => existing.id === id);
  if (index === -1) return null;

  const history = readEditHistory();
  const stack = history[id] ?? [];
  const restored = stack[stack.length - 1];
  if (!restored) return null;

  const replaced = records[index]!;
  const currentTeamId = replaced.teamId;
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

  if (currentTeamId !== restored.teamId) {
    rebuildOpponentTeamProfileFromRecords(currentTeamId);
  }
  return rebuildOpponentTeamProfileFromRecords(restored.teamId);
}

/**
 * Whether `id` has at least one undone version to redo forward to — i.e. it
 * has been undone (via `undoLastOpponentRoundRecordEdit`) more recently than
 * any fresh edit, delete, or exhausting redo.
 */
export function hasOpponentRoundRecordRedoHistory(id: string): boolean {
  return (readRedoHistory()[id]?.length ?? 0) > 0;
}

/**
 * Lists `id`'s undone versions, most-recently-undone-first — what redo would
 * restore, one step at a time.
 */
export function listOpponentRoundRecordRedoHistory(id: string): OpponentRoundRecordEntry[] {
  return [...(readRedoHistory()[id] ?? [])].reverse();
}

/**
 * Redoes the most recently undone edit to round `id`: re-applies the version
 * that was replaced by the last `undoLastOpponentRoundRecordEdit` call and
 * re-aggregates the affected team(s). Repeated calls step forward through
 * the id's redo stack. Pushes the version it replaces back onto the undo
 * stack, so a further undo can revert this redo. Returns the profile for the
 * redone record's team, or `null` if the round isn't stored or has nothing
 * to redo (either because it was never undone, or every undo already has
 * been redone or invalidated by a fresh edit/delete).
 */
export function redoLastOpponentRoundRecordEdit(id: string): OpponentTeamProfile | null {
  const records = readAll();
  const index = records.findIndex((existing) => existing.id === id);
  if (index === -1) return null;

  const redoHistory = readRedoHistory();
  const redoStack = redoHistory[id] ?? [];
  const redone = redoStack[redoStack.length - 1];
  if (!redone) return null;

  const replaced = records[index]!;
  const currentTeamId = replaced.teamId;
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

  if (currentTeamId !== redone.teamId) {
    rebuildOpponentTeamProfileFromRecords(currentTeamId);
  }
  return rebuildOpponentTeamProfileFromRecords(redone.teamId);
}
