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
 * `buildCombinedPersistedArgumentLibrary` closes follow-up (a) named under
 * the "📚 Common Argument Library" bullet in TODO.md — it composes this
 * store's evidence-library cards with `state/contributions.ts`'s persisted
 * Contributions Feed (via `argument-library.ts`'s
 * `buildLibraryCardsFromContributions`) into one combined library, so a
 * general-purpose contribution tagged with `topic`/`caseArea`/`tags` is
 * organized alongside a dedicated evidence-library entry.
 *
 * @module state/evidenceLibraryEntries
 */

import type { EvidenceLibraryEntry, EvidenceSearchQuery, EvidenceSearchResult } from "../lib/shared-evidence-library";
import { buildEvidenceEntryRevision, searchEvidenceLibrary } from "../lib/shared-evidence-library";
import type { ArgumentLibrary } from "../lib/argument-library";
import { buildArgumentLibrary, buildLibraryCardsFromContributions, buildTagCollections } from "../lib/argument-library";
import { saveRevisionRecord, type CardRevisionRecord } from "./revisionHistory";
import { listContributions } from "./contributions";

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

/**
 * Saves an edited evidence-library entry and, when it overwrites an existing
 * entry (not a brand-new submission), records the edit as a
 * `CardRevisionRecord` — the "(a) wiring an actual card-edit/save flow to
 * call `saveRevisionRecord` with a before/after snapshot" follow-up named
 * under the "Revision Incentives" bullet in TODO.md. Composes
 * `shared-evidence-library.ts`'s pure `buildEvidenceEntryRevision` directly
 * against this store's own before/after entries, so the Revision Incentives
 * leaderboard now reflects real edits instead of only caller-supplied
 * snapshots.
 */
export function saveEvidenceLibraryEntryRevision(entry: EvidenceLibraryEntry, contributorId: string): void {
  const previous = getEvidenceLibraryEntry(entry.id);
  saveEvidenceLibraryEntry(entry);
  if (!previous) return;

  const revision = buildEvidenceEntryRevision(previous, entry, contributorId);
  const record: CardRevisionRecord = {
    ...revision,
    id: `${entry.id}-${contributorId}-${Date.now()}`,
    revisedAt: new Date().toISOString(),
  };
  saveRevisionRecord(record);
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

/**
 * Organizes the persisted evidence repository together with every persisted
 * Contributions Feed contribution that carries `topic`/`caseArea` into one
 * combined Common Argument Library — closes follow-up (a) named under the
 * "📚 Common Argument Library" bullet in TODO.md. A contribution missing
 * `topic` or `caseArea` is silently excluded (see
 * `argument-library.ts`'s `buildLibraryCardsFromContributions`), so this is
 * safe to call even before any contribution is tagged for the library.
 */
export function buildCombinedPersistedArgumentLibrary(): ArgumentLibrary {
  return buildArgumentLibrary([...readAll(), ...buildLibraryCardsFromContributions(listContributions())]);
}

/**
 * Every distinct tag used across the persisted evidence repository, sorted —
 * the corpus a tag-autocomplete affordance suggests from (see
 * `argument-library.ts`'s `suggestTags`).
 */
export function listPersistedTags(): string[] {
  return buildTagCollections(readAll()).map((collection) => collection.tag);
}
