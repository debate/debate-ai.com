/**
 * @fileoverview Pure query-building helpers for the CARDS evidence search.
 *
 * Kept free of React so the exact shape of every outgoing `/search` request can
 * be unit tested without rendering the search interface.
 *
 * @module lib/search-query
 */

import type { SearchFilters } from "../components/ResearchSearchSidebar";

/** Default empty filter state with all toggles off and text fields blank. */
export const EMPTY_FILTERS: SearchFilters = {
  year: "",
  school: "",
  team: "",
  tournament: "",
  event: "",
  searchHighlighted: false,
  searchUnderlined: false,
  searchSummaries: false,
  searchBlockAndFileTitles: false,
  searchOutlines: false,
  searchRoundSpeeches: false,
  searchQuotes: false,
  searchAllText: false,
};

/** Debounce delay in ms before executing a search after input changes. */
export const SEARCH_DEBOUNCE_MS = 300;

/** Filter keys that map to a plain `key=value` query parameter. */
const TEXT_FILTER_KEYS = [
  "year",
  "school",
  "team",
  "tournament",
] as const satisfies readonly (keyof SearchFilters)[];

/** Filter keys that map to a `key=1` flag when enabled. */
const FLAG_FILTER_KEYS = [
  "searchHighlighted",
  "searchUnderlined",
  "searchSummaries",
  "searchBlockAndFileTitles",
  "searchOutlines",
  "searchRoundSpeeches",
  "searchQuotes",
  "searchAllText",
] as const satisfies readonly (keyof SearchFilters)[];

/** Inputs used to build a search request. */
export interface SearchQueryInput {
  /** Raw text typed by the user; trimmed and dropped when blank. */
  searchTerm: string;
  /** Typesense sort expression, e.g. `_text_match:desc`. */
  sortBy: string;
  /** Sidebar filter state. */
  filters: SearchFilters;
}

/**
 * Builds the query parameters for a `/search` request.
 *
 * Blank text filters are omitted entirely, boolean filters are serialized as
 * `1` only when enabled, and the sentinel `event=all` is treated as "no event
 * filter" so the API never receives a meaningless constraint.
 *
 * @param input - Current search term, sort order and filter state.
 * @returns URL search params ready to be appended to the search endpoint.
 */
export function buildSearchParams({
  searchTerm,
  sortBy,
  filters,
}: SearchQueryInput): URLSearchParams {
  const params = new URLSearchParams();
  params.set("sort", sortBy);

  if (searchTerm.trim()) params.set("q", searchTerm.trim());

  for (const key of TEXT_FILTER_KEYS) {
    const value = filters[key];
    if (typeof value === "string" && value) params.set(key, value);
  }

  if (filters.event && filters.event !== "all") {
    params.set("event", filters.event);
  }

  for (const key of FLAG_FILTER_KEYS) {
    if (filters[key]) params.set(key, "1");
  }

  return params;
}

/**
 * Builds the cards API URL fetched by the search hook.
 *
 * @param input - Current search term, sort order and filter state.
 * @returns The `/api/search?…` path with serialized query parameters.
 */
export function buildSearchUrl(input: SearchQueryInput): string {
  return `/api/search?${buildSearchParams(input).toString()}`;
}

/** Path of the CARDS search page, which reads its starting state from the URL. */
export const CARDS_SEARCH_PATH = "/cards";

/** The part of a `/cards` link other pages can pre-fill. */
export interface CardsSearchLink {
  /** Search term, matched against every indexed field of a card. */
  q?: string;
  /** Season year, e.g. `"2024"`. */
  year?: string | number;
  /** Debate format as the search stores it: `CX`, `PF`, `LD`, `NDT` or `NFA`. */
  event?: string;
}

/**
 * Builds a link into the CARDS search pre-filled with a term and filters, so
 * another page (e.g. the topics explorer) can open "everything on this topic
 * that season". Blank values are left out of the URL.
 *
 * @param link - Term and filters to open the search with.
 * @returns A `/cards?…` href.
 */
export function buildCardsSearchHref({ q, year, event }: CardsSearchLink): string {
  const params = new URLSearchParams();
  if (q?.trim()) params.set("q", q.trim());
  if (year != null && String(year).trim()) params.set("year", String(year).trim());
  if (event?.trim() && event.trim() !== "all") params.set("event", event.trim());
  const query = params.toString();
  return query ? `${CARDS_SEARCH_PATH}?${query}` : CARDS_SEARCH_PATH;
}

/**
 * Reads the search term and text filters a `/cards` URL was opened with — the
 * inverse of {@link buildCardsSearchHref}.
 *
 * @param params - The page's query string.
 * @returns The term and filters to start the search with; filters the URL
 *   doesn't mention keep their {@link EMPTY_FILTERS} value.
 */
export function readCardsSearchParams(params: URLSearchParams): {
  searchTerm: string;
  filters: SearchFilters;
} {
  const filters: SearchFilters = { ...EMPTY_FILTERS };
  for (const key of TEXT_FILTER_KEYS) filters[key] = params.get(key)?.trim() ?? "";
  filters.event = params.get("event")?.trim() ?? "";
  return { searchTerm: params.get("q")?.trim() ?? "", filters };
}
