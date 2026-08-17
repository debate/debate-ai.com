/**
 * @fileoverview Persistent storage for `shared-evidence-library.ts`'s
 * `EvidenceLibraryEntry` records — the "(a) wiring real submitted cards and
 * team-drafted blocks into a persisted repository instead of caller-supplied
 * entries" follow-up named in that slice for the "Shared Evidence Library"
 * idea in TODO.md. Stores entries in localStorage, mirroring the existing
 * `contributions.ts`/`groupChallenges.ts` persistence convention
 * (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
 * rather than throwing). Also unblocks the "Collaboration Prep Room" idea's
 * own follow-up (a), which named a persisted evidence store as its
 * prerequisite.
 *
 * @module state/evidenceLibraryEntries
 */

import type { EvidenceLibraryEntry, EvidenceSearchQuery, EvidenceSearchResult } from "../lib/shared-evidence-library";
import { searchEvidenceLibrary } from "../lib/shared-evidence-library";
import type { ArgumentLibrary } from "../lib/argument-library";
import { buildArgumentLibrary } from "../lib/argument-library";

const STORAGE_KEY = "evidenceLibraryEntries";

function readAll(): EvidenceLibraryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as EvidenceLibraryEntry[]) : [];
  } catch {
    return [];
  }
}

function writeAll(entries: EvidenceLibraryEntry[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

/** Lists every persisted evidence library entry. */
export function listEvidenceLibraryEntries(): EvidenceLibraryEntry[] {
  return readAll();
}

/** Looks up a single persisted evidence library entry by id, if any. */
export function getEvidenceLibraryEntry(id: string): EvidenceLibraryEntry | undefined {
  return readAll().find((entry) => entry.id === id);
}

/** Saves an evidence library entry, overwriting any existing record with the same id. */
export function saveEvidenceLibraryEntry(entry: EvidenceLibraryEntry): void {
  const entries = readAll();
  const index = entries.findIndex((existing) => existing.id === entry.id);
  if (index === -1) {
    entries.push(entry);
  } else {
    entries[index] = entry;
  }
  writeAll(entries);
}

/** Deletes a persisted evidence library entry by id; a no-op if it isn't stored. */
export function deleteEvidenceLibraryEntry(id: string): void {
  writeAll(readAll().filter((entry) => entry.id !== id));
}

/** Searches the persisted evidence repository, reusing `searchEvidenceLibrary` directly. */
export function searchPersistedEvidenceLibrary(query: EvidenceSearchQuery = {}): EvidenceSearchResult[] {
  return searchEvidenceLibrary(readAll(), query);
}

/**
 * Organizes the persisted evidence repository into the Common Argument
 * Library's topic folders and tag collections, reusing `buildArgumentLibrary`
 * directly — every `EvidenceLibraryEntry` is already a `LibraryCard`.
 */
export function buildPersistedArgumentLibrary(): ArgumentLibrary {
  return buildArgumentLibrary(readAll());
}
