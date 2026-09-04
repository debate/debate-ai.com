/**
 * @fileoverview Named, account-synced saved searches over the Shared
 * Evidence Library — the "saved searches with alerts on new matches"
 * follow-up named under the "📋 Shared Evidence Library" bullet (Research
 * Crowdsourcing Organizer Features) in `TODO.md`. Lets a user save
 * `EvidenceLibraryPanel`'s current filter-field values under a name and
 * reapply them later, mirroring `argument-library-collections.ts`'s
 * add/remove-only shape exactly (a saved search isn't edited in place — it's
 * deleted and re-saved).
 *
 * A saved search also carries `seenEntryIds`: every persisted evidence-entry
 * id that matched this search the last time it was saved or re-run. Running
 * the search again and diffing its fresh results against `seenEntryIds` (via
 * `diffNewEvidenceSearchMatchIds`) is how `EvidenceLibraryPanel` renders a
 * "N new matches" badge — no server-side alerting/notification exists in
 * this repo, so this is computed client-side on demand rather than pushed.
 *
 * Pure validation/serialization helpers shared by the `/api/settings`
 * D1-backed route (`apps/debate-ai.com`) and
 * `hooks/useSavedEvidenceSearches.ts`, mirroring
 * `argument-library-collections.ts`'s split exactly.
 *
 * @module lib/saved-evidence-searches
 */

import type { EvidenceEntryKind, EvidenceSearchFormFilters } from "./shared-evidence-library";

export type SavedEvidenceSearch = {
  /** Stable id, independent of `name` so a rename (not currently supported) wouldn't need to migrate anything. */
  id: string;
  /** User-chosen label for this saved search, e.g. "New topicality cards". */
  name: string;
  filters: EvidenceSearchFormFilters;
  /** Epoch milliseconds this search was first saved. */
  createdAt: number;
  /** Every persisted evidence-entry id that matched this search as of the last save/re-run — the "already seen" baseline `diffNewEvidenceSearchMatchIds` diffs fresh results against. */
  seenEntryIds: string[];
};

export type SavedEvidenceSearchesPayload = {
  savedEvidenceSearches: SavedEvidenceSearch[];
};

/** Mirrors every other `DEFAULT_*` in this repo's settings surfaces: the value used when no saved row/value exists yet. */
export const DEFAULT_SAVED_EVIDENCE_SEARCHES: SavedEvidenceSearchesPayload = {
  savedEvidenceSearches: [],
};

/** Generous but bounded, so a buggy or malicious client can't grow the row without limit — mirrors `MAX_SAVED_ARGUMENT_COLLECTIONS`. */
export const MAX_SAVED_EVIDENCE_SEARCHES = 30;

const MAX_SEARCH_NAME_LENGTH = 60;
const EVIDENCE_ENTRY_KINDS: readonly EvidenceEntryKind[] = ["card", "block"];

/** Case-insensitive, trimmed — matches `normalizeSavedArgumentCollectionName`'s duplicate-detection convention. */
export function normalizeSavedEvidenceSearchName(name: string): string {
  return name.trim().toUpperCase();
}

export function isValidSavedEvidenceSearchName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= MAX_SEARCH_NAME_LENGTH;
}

function isValidEvidenceSearchFormFilters(value: unknown): value is EvidenceSearchFormFilters {
  if (typeof value !== "object" || value === null) return false;
  const filters = value as Record<string, unknown>;
  if (typeof filters.text !== "string") return false;
  if (filters.kind !== undefined && !(EVIDENCE_ENTRY_KINDS as string[]).includes(filters.kind as string)) return false;
  if (typeof filters.topic !== "string") return false;
  if (typeof filters.caseArea !== "string") return false;
  if (typeof filters.tags !== "string") return false;
  return true;
}

function isValidSeenEntryIdsList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((id) => typeof id === "string");
}

function isValidSavedEvidenceSearch(value: unknown): value is SavedEvidenceSearch {
  if (typeof value !== "object" || value === null) return false;
  const search = value as Record<string, unknown>;
  return (
    typeof search.id === "string" &&
    search.id.trim().length > 0 &&
    isValidSavedEvidenceSearchName(search.name) &&
    isValidEvidenceSearchFormFilters(search.filters) &&
    typeof search.createdAt === "number" &&
    isValidSeenEntryIdsList(search.seenEntryIds)
  );
}

export function isValidSavedEvidenceSearchesList(value: unknown): value is SavedEvidenceSearch[] {
  if (!Array.isArray(value) || value.length > MAX_SAVED_EVIDENCE_SEARCHES) return false;
  if (!value.every(isValidSavedEvidenceSearch)) return false;
  const ids = value.map((search) => (search as SavedEvidenceSearch).id);
  const normalizedNames = value.map((search) => normalizeSavedEvidenceSearchName((search as SavedEvidenceSearch).name));
  return new Set(ids).size === ids.length && new Set(normalizedNames).size === normalizedNames.length;
}

export type SavedEvidenceSearchesPatchResult = {
  /** Only the field, if present in `input` *and* valid. */
  valid: Partial<SavedEvidenceSearchesPayload>;
  /** One message per rejected or malformed field. */
  errors: string[];
};

/**
 * Validates an untrusted (e.g. parsed request-body JSON) patch: the whole
 * `savedEvidenceSearches` array is accepted or rejected as one field,
 * mirroring `normalizeSavedArgumentCollectionsPatch`'s "replace the full
 * list in one PUT" shape.
 */
export function normalizeSavedEvidenceSearchesPatch(input: unknown): SavedEvidenceSearchesPatchResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: {}, errors: ["Request body must be a JSON object."] };
  }

  const record = input as Record<string, unknown>;
  const valid: Partial<SavedEvidenceSearchesPayload> = {};
  const errors: string[] = [];

  if ("savedEvidenceSearches" in record) {
    if (isValidSavedEvidenceSearchesList(record.savedEvidenceSearches)) {
      valid.savedEvidenceSearches = record.savedEvidenceSearches;
    } else {
      errors.push(
        `"savedEvidenceSearches" must be an array of up to ${MAX_SAVED_EVIDENCE_SEARCHES} entries, each a { id, name, filters, createdAt, seenEntryIds } record with a non-empty name (max ${MAX_SEARCH_NAME_LENGTH} characters), with no two entries sharing an id or a name (case-insensitive).`,
      );
    }
  }

  return { valid, errors };
}

/** Serializes a saved-searches list for the `saved_evidence_searches` D1 column: `null` when empty, matching the "no saved value yet" semantics every other nullable column here uses. */
export function serializeSavedEvidenceSearches(list: SavedEvidenceSearch[]): string | null {
  return list.length === 0 ? null : JSON.stringify(list);
}

/** Parses the `saved_evidence_searches` D1 column back into a list. Never throws — a null, malformed, or invalid-shape value reads back as an empty list rather than erroring the request. */
export function parseSavedEvidenceSearches(raw: string | null | undefined): SavedEvidenceSearch[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return isValidSavedEvidenceSearchesList(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Diffs a saved search's fresh result-entry ids against its
 * `seenEntryIds` baseline, returning only the ids that are genuinely new
 * since the last save/re-run. Order-preserving over `currentEntryIds`, pure
 * and synchronous — there's no push/cron alerting infrastructure in this
 * repo, so `EvidenceLibraryPanel` calls this on demand (on mount and
 * whenever the underlying entries could have changed) to render a "N new
 * matches" badge per saved search.
 */
export function diffNewEvidenceSearchMatchIds(currentEntryIds: string[], seenEntryIds: string[]): string[] {
  const seen = new Set(seenEntryIds);
  return currentEntryIds.filter((id) => !seen.has(id));
}
