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
 * `checkPersistedPageForExistingCards` composes `shared-evidence-library.ts`'s
 * pure `checkPageForExistingCards` against this store — the persisted half
 * of the "On Page Card Reuse Search" idea's first slice in TODO.md.
 *
 * `searchPersistedEvidenceLibraryWithIndex` composes
 * `evidence-search-index.ts`'s inverted-index search against this store's
 * "live" entries — the persisted half of the "📋 Shared Evidence Library"
 * bullet's follow-up (c), "a real search index ... once entries are
 * persisted at scale." Added alongside `searchPersistedEvidenceLibrary`
 * (not replacing it), so existing callers of the original keyword-overlap
 * search are unaffected.
 *
 * @module state/evidenceLibraryEntries
 */

import type { EvidenceLibraryEntry, EvidenceSearchQuery, EvidenceSearchResult, PageReuseCheckResult } from "../lib/shared-evidence-library";
import { buildEvidenceEntryRevision, checkPageForExistingCards, searchEvidenceLibrary } from "../lib/shared-evidence-library";
import { buildEvidenceSearchIndex, searchEvidenceLibraryWithIndex } from "../lib/evidence-search-index";
import type { ArgumentLibrary, LibraryCard } from "../lib/argument-library";
import { buildArgumentLibrary, buildLibraryCardsFromContributions, buildTagCollections } from "../lib/argument-library";
import { saveRevisionRecord, type CardRevisionRecord } from "./revisionHistory";
import { listContributions } from "./contributions";
import { isCardLive } from "../lib/peer-review";
import { getPeerReview } from "./peerReviews";

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

/**
 * Whether an entry is live under peer-review gating — see
 * `lib/peer-review.ts`'s `isCardLive`. Looks up the entry's `CardReview` by
 * treating its `id` as the review's `cardId` (the same free-form key
 * `panels/ReviewQueuePanel.tsx`'s "Start review" form uses).
 */
export function isEntryLive(id: string): boolean {
  return isCardLive(getPeerReview(id));
}

/**
 * Every persisted entry currently held back from "live" by an in-progress
 * (not yet `published`) `CardReview`, so a panel can still surface a
 * pending submission to its author instead of it silently disappearing.
 */
export function listPendingReviewEntries(): EvidenceLibraryEntry[] {
  return readAll().filter((entry) => !isEntryLive(entry.id));
}

/**
 * Searches the persisted evidence repository, reusing `searchEvidenceLibrary`
 * directly. Only entries that are "live" (see `isEntryLive`) are searched —
 * a card held under an in-progress peer review doesn't yet appear in the
 * shared library, closing follow-up (c) named under the "🗣️ Peer Review
 * System" bullet in TODO.md.
 */
export function searchPersistedEvidenceLibrary(query: EvidenceSearchQuery = {}): EvidenceSearchResult[] {
  return searchEvidenceLibrary(readAll().filter((entry) => isEntryLive(entry.id)), query);
}

/**
 * Searches the persisted evidence repository via a freshly built
 * `EvidenceSearchIndex` — the real, postings-list-backed search index named
 * in follow-up (c) under the "📋 Shared Evidence Library" bullet in
 * TODO.md, rather than `searchPersistedEvidenceLibrary`'s full re-scan on
 * every call. Only "live" entries are indexed (see `isEntryLive`), matching
 * `searchPersistedEvidenceLibrary`'s own gating, so a card still held back
 * by an in-progress peer review doesn't appear in results here either. The
 * index itself is rebuilt on every call rather than cached — this store has
 * no lifecycle hook to invalidate a cached index on write, so a fresh build
 * is the correctness-first choice; caching the index across calls is a
 * further follow-up once write volume makes that matter.
 */
export function searchPersistedEvidenceLibraryWithIndex(query: EvidenceSearchQuery = {}): EvidenceSearchResult[] {
  const liveEntries = readAll().filter((entry) => isEntryLive(entry.id));
  return searchEvidenceLibraryWithIndex(buildEvidenceSearchIndex(liveEntries), query);
}

/**
 * Checks whether a page has already been cut into the persisted evidence
 * repository, reusing `checkPageForExistingCards` directly — the "On Page
 * Card Reuse Search" idea in TODO.md's Product Feature Ideas list. Only
 * "live" entries count as an existing cut (see `isEntryLive`), matching
 * `searchPersistedEvidenceLibrary`'s own gating, so a card still held back
 * by an in-progress peer review doesn't yet count as "already cut" for this
 * check either.
 */
export function checkPersistedPageForExistingCards(url: string): PageReuseCheckResult {
  return checkPageForExistingCards(readAll().filter((entry) => isEntryLive(entry.id)), url);
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
 * The same combined corpus `buildCombinedPersistedArgumentLibrary` folds
 * into topic folders and tag collections, exposed flat — every persisted
 * evidence-library entry plus every persisted Contributions Feed
 * contribution that carries `topic`/`caseArea`. For callers that need to
 * score or search individual cards rather than browse the organized
 * library (e.g. `debate-round`'s flow-note suggestions, see idea #16's
 * follow-up (c) in TODO.md).
 */
export function listCombinedPersistedLibraryCards(): LibraryCard[] {
  return [...readAll(), ...buildLibraryCardsFromContributions(listContributions())];
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
  return buildArgumentLibrary(listCombinedPersistedLibraryCards());
}

/**
 * Every distinct tag used across the persisted evidence repository, sorted —
 * the corpus a tag-autocomplete affordance suggests from (see
 * `argument-library.ts`'s `suggestTags`).
 */
export function listPersistedTags(): string[] {
  return buildTagCollections(readAll()).map((collection) => collection.tag);
}
