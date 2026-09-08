/**
 * @fileoverview Local-first persistence for `debate-speech-writer`'s
 * `SavedCustomOpponentPersona` library entries — the "🤖 AI Practice
 * Opponent" idea's "share a custom-authored persona across a team instead
 * of per-user only" Next item in TODO.md. Mirrors
 * `state/opponentPersonaSelections.ts`'s persistence convention
 * (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
 * rather than throwing).
 *
 * `resolveCustomOpponentPersonaLibraryConflict`/`planCustomOpponentPersonaLibraryMerge`
 * below mirror `state/drillSets.ts`'s exactly, keyed by library entry `id`
 * instead of `roundId` — used by `hooks/useCustomOpponentPersonaLibrary.ts`'s
 * account merge.
 *
 * @module state/customOpponentPersonaLibrary
 */

import {
  buildSavedCustomOpponentPersona,
  sortCustomOpponentPersonaLibrary,
  type CustomOpponentPersonaLibraryEntryInput,
  type SavedCustomOpponentPersona,
} from "debate-speech-writer/src/opponent/opponent-persona-library";

export type { CustomOpponentPersonaLibraryEntryInput, SavedCustomOpponentPersona };

const STORAGE_KEY = "customOpponentPersonaLibrary";

function readAll(): SavedCustomOpponentPersona[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedCustomOpponentPersona[]) : [];
  } catch {
    return [];
  }
}

function writeAll(entries: SavedCustomOpponentPersona[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

/** Lists every persisted custom-persona library entry, in stored order. */
export function listCustomOpponentPersonaLibrary(): SavedCustomOpponentPersona[] {
  return readAll();
}

/** Looks up a persisted library entry by id, if any. */
export function getCustomOpponentPersonaLibraryEntry(id: string): SavedCustomOpponentPersona | undefined {
  return readAll().find((entry) => entry.id === id);
}

/** Saves a full, already-built library entry, overwriting any existing entry with the same id (upsert). */
export function saveCustomOpponentPersonaLibraryEntry(entry: SavedCustomOpponentPersona): void {
  const entries = readAll();
  const index = entries.findIndex((existing) => existing.id === entry.id);
  if (index === -1) {
    entries.push(entry);
  } else {
    entries[index] = entry;
  }
  writeAll(entries);
}

/**
 * Builds and saves a library entry from user input — a fresh entry when
 * `input.id` is omitted, or an in-place revision (fresh `updatedAt`,
 * original `createdAt` preserved) when it names an existing entry. Throws
 * when `name`/`notes` is empty after sanitization (see
 * `buildSavedCustomOpponentPersona`).
 */
export function createOrUpdateCustomOpponentPersonaLibraryEntry(
  input: CustomOpponentPersonaLibraryEntryInput,
): SavedCustomOpponentPersona {
  const existing = input.id ? getCustomOpponentPersonaLibraryEntry(input.id) : undefined;
  const entry = buildSavedCustomOpponentPersona(input);
  const stamped: SavedCustomOpponentPersona = existing
    ? { ...entry, createdAt: existing.createdAt }
    : entry;
  saveCustomOpponentPersonaLibraryEntry(stamped);
  return stamped;
}

/** Deletes a persisted library entry by id; a no-op if it isn't stored. */
export function deleteCustomOpponentPersonaLibraryEntry(id: string): void {
  writeAll(readAll().filter((entry) => entry.id !== id));
}

/** Every persisted library entry, alphabetically by name — for the library UI. */
export function buildCustomOpponentPersonaLibraryPanelView(): SavedCustomOpponentPersona[] {
  return sortCustomOpponentPersonaLibrary(listCustomOpponentPersonaLibrary());
}

export type CustomOpponentPersonaLibraryConflictResolution = "local" | "remote" | "none";

/**
 * Decides which side of a same-id conflict wins during account merge: the
 * newer `updatedAt` timestamp — mirrors
 * `state/drillSets.ts#resolveDrillSetConflict` exactly.
 */
export function resolveCustomOpponentPersonaLibraryConflict(
  local: SavedCustomOpponentPersona,
  remote: SavedCustomOpponentPersona,
): CustomOpponentPersonaLibraryConflictResolution {
  if (remote.updatedAt > local.updatedAt) return "remote";
  if (local.updatedAt > remote.updatedAt) return "local";
  return "none";
}

export type CustomOpponentPersonaLibraryMergePlan = {
  /** Entries to adopt locally — new to this device, or the remote copy is newer per `resolveCustomOpponentPersonaLibraryConflict`. */
  adopt: SavedCustomOpponentPersona[];
  /** Local entries to best-effort push to the account — new to the account, or the local copy is newer. */
  pushLocal: SavedCustomOpponentPersona[];
};

/**
 * Pure merge-planning step for `hooks/useCustomOpponentPersonaLibrary.ts`'s
 * account merge, extracted so it's directly testable without a hook/DOM
 * harness — mirrors `state/drillSets.ts#planDrillSetMerge` exactly, keyed
 * by library entry `id`.
 */
export function planCustomOpponentPersonaLibraryMerge(
  localEntries: SavedCustomOpponentPersona[],
  remoteEntries: SavedCustomOpponentPersona[],
): CustomOpponentPersonaLibraryMergePlan {
  const localById = new Map(localEntries.map((entry) => [entry.id, entry]));
  const remoteIds = new Set(remoteEntries.map((entry) => entry.id));

  const adopt: SavedCustomOpponentPersona[] = [];
  const pushLocal: SavedCustomOpponentPersona[] = [];

  for (const remote of remoteEntries) {
    const local = localById.get(remote.id);
    if (!local) {
      adopt.push(remote);
      continue;
    }
    const resolution = resolveCustomOpponentPersonaLibraryConflict(local, remote);
    if (resolution === "remote") adopt.push(remote);
    else if (resolution === "local") pushLocal.push(local);
  }
  for (const local of localEntries) {
    if (!remoteIds.has(local.id)) pushLocal.push(local);
  }

  return { adopt, pushLocal };
}
