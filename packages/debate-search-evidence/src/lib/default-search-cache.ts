/**
 * @fileoverview Remembers the results of the default CARDS search (no term,
 * default filters and sort) in `localStorage`, so `/research/cards` can show
 * them on the first paint instead of an empty list while the request runs.
 *
 * The cached list is only a placeholder: the page still fetches the default
 * search on load and replaces it, so it is never more than one visit stale.
 * Anything that fails here — private mode, a full quota, a malformed entry —
 * just means no placeholder.
 *
 * @module lib/default-search-cache
 */

import type { SearchResult } from "../types";
import { DEFAULT_SEARCH_FILTERS, buildSearchUrl, type SearchQueryInput } from "./search-query";

/** Sort the search starts with; the default search uses it. */
export const DEFAULT_SEARCH_SORT = "_text_match:desc";

export const DEFAULT_SEARCH_CACHE_KEY = "cardsSearch:defaultResults:v1";

/** Older than this, the placeholder is dropped rather than shown. */
export const DEFAULT_SEARCH_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Larger payloads are not cached: `localStorage` is small and shared. */
const MAX_CACHED_BYTES = 1_000_000;

const DEFAULT_SEARCH_URL = buildSearchUrl({
  searchTerm: "",
  sortBy: DEFAULT_SEARCH_SORT,
  filters: DEFAULT_SEARCH_FILTERS,
});

interface CachedDefaultSearch {
  savedAt: number;
  results: SearchResult[];
  total: number;
}

/** Whether `input` is the search the page opens with. */
export function isDefaultSearch(input: SearchQueryInput): boolean {
  return buildSearchUrl(input) === DEFAULT_SEARCH_URL;
}

/** The cached default results, or `null` when there are none worth showing. */
export function readDefaultSearchCache(now = Date.now()): { results: SearchResult[]; total: number } | null {
  try {
    const raw = localStorage.getItem(DEFAULT_SEARCH_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as Partial<CachedDefaultSearch>;
    if (!Array.isArray(cached.results) || cached.results.length === 0) return null;
    if (typeof cached.savedAt !== "number" || now - cached.savedAt > DEFAULT_SEARCH_CACHE_MAX_AGE_MS) return null;
    return { results: cached.results, total: typeof cached.total === "number" ? cached.total : cached.results.length };
  } catch {
    return null;
  }
}

/** Saves the default search's results for the next visit. */
export function writeDefaultSearchCache(results: SearchResult[], total: number, now = Date.now()): void {
  try {
    if (results.length === 0) return;
    const raw = JSON.stringify({ savedAt: now, results, total } satisfies CachedDefaultSearch);
    if (raw.length > MAX_CACHED_BYTES) return;
    localStorage.setItem(DEFAULT_SEARCH_CACHE_KEY, raw);
  } catch {
    // No placeholder next time; the search itself is unaffected.
  }
}
