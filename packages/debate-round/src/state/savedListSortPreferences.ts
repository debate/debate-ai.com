/**
 * @fileoverview The sort order a user last chose for a "Saved to account"
 * list, so the list opens in that order on every visit and every device
 * instead of resetting to "Newest saved first".
 *
 * One record per list **surface** (`SavedListSortSurface`). Today that is
 * only `FlowHistoryDialog`'s **Saved to account** tab (the account's
 * `saved_flows` / `saved_rounds` rows); the record is keyed by surface so
 * another saved list can remember its own order without a new store.
 *
 * Stored as a JSON array under {@link SAVED_LIST_SORT_PREFERENCES_STORAGE_KEY},
 * each record keyed by `id`, which is the shape `debate-search-evidence`'s
 * `TOOL_RECORD_COLLECTIONS` syncs. Its `savedListSortPreferences` entry
 * carries the store to a signed-in user's account (`saved_tool_records`).
 * This module itself does no network I/O: the auto-sync watcher flushes local
 * changes, and an account merge writes back here and dispatches a `storage`
 * event, which {@link isSavedListSortPreferencesStorageEvent} recognizes.
 *
 * SSR- and corrupt-storage-safe: with no `localStorage`, bad JSON or an
 * unknown sort, reads return `"newest"` and never throw.
 *
 * @module state/savedListSortPreferences
 */

import { toSavedSummarySort, type SavedSummarySort } from "./savedSummaryFilter";

/** The `localStorage` key (and synced collection key) for the preferences. */
export const SAVED_LIST_SORT_PREFERENCES_STORAGE_KEY = "savedListSortPreferences";

/** The saved lists that remember a sort: Flow History's "Saved to account" tab. */
export type SavedListSortSurface = "flow-history-saved";

/** One list's saved order. */
export type SavedListSortPreference = {
  /** The list surface; the record's sync id. */
  id: SavedListSortSurface;
  sort: SavedSummarySort;
  /** Epoch milliseconds of the last change. */
  updatedAt: number;
};

const SURFACES: ReadonlySet<string> = new Set<SavedListSortSurface>(["flow-history-saved"]);

function isSort(value: unknown): value is SavedSummarySort {
  return value === "newest" || value === "oldest" || value === "name";
}

function isPreference(value: unknown): value is SavedListSortPreference {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    SURFACES.has(record.id) &&
    isSort(record.sort) &&
    typeof record.updatedAt === "number" &&
    Number.isFinite(record.updatedAt)
  );
}

/** Every stored record, raw, so an unrecognized one written by a newer client survives a save. */
function readRaw(): unknown[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_LIST_SORT_PREFERENCES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** The order a list should open in: its saved choice, or `"newest"` when there is none or it is unusable. */
export function getSavedListSort(surface: SavedListSortSurface): SavedSummarySort {
  const found = readRaw().find((r): r is SavedListSortPreference => isPreference(r) && r.id === surface);
  return toSavedSummarySort(found?.sort);
}

/**
 * Saves a list's order, replacing its earlier one. An unknown sort or surface
 * is ignored rather than stored. Returns whether anything was written;
 * choosing the order that is already saved writes nothing, so it doesn't
 * trigger a sync.
 */
export function saveSavedListSort(surface: SavedListSortSurface, sort: unknown, now: number = Date.now()): boolean {
  if (typeof localStorage === "undefined" || !SURFACES.has(surface) || !isSort(sort)) return false;
  const records = readRaw();
  const index = records.findIndex((r) => isPreference(r) && r.id === surface);
  if (index !== -1 && (records[index] as SavedListSortPreference).sort === sort) return false;
  const next: SavedListSortPreference = { id: surface, sort, updatedAt: now };
  // Drop any malformed copy of this surface so only one record carries its id.
  const kept = records.filter(
    (r, i) => i !== index && !(typeof r === "object" && r !== null && (r as { id?: unknown }).id === surface),
  );
  try {
    localStorage.setItem(SAVED_LIST_SORT_PREFERENCES_STORAGE_KEY, JSON.stringify([...kept, next]));
    return true;
  } catch {
    // Quota or a disabled store: the list still sorts for this visit.
    return false;
  }
}

/**
 * Whether a `storage` event may have changed the preferences: their key, or
 * a `null` key (`localStorage.clear()`).
 */
export function isSavedListSortPreferencesStorageEvent(event: Pick<StorageEvent, "key">): boolean {
  return event.key === null || event.key === SAVED_LIST_SORT_PREFERENCES_STORAGE_KEY;
}
