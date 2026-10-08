/**
 * @fileoverview Hook for managing CARD search state, filters, and API fetching.
 *
 * Encapsulates all search-related state including the search term, filters,
 * sort order, result selection, and debounced API fetching. Provides a single
 * source of truth for the search sidebar and result navigation.
 *
 * @module components/debate/DebateCardSearch/hooks/useSearchState
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import grab from "grab-url";
import type { SearchFilters } from "../components/ResearchSearchSidebar";
import type { SearchResult } from "../types";
import {
  DEFAULT_SEARCH_FILTERS,
  SEARCH_DEBOUNCE_MS,
  buildSearchUrl,
  readCardsSearchParams,
} from "../lib/search-query";
import { isTypingTarget, nextSelectionIndex } from "../lib/result-navigation";
import {
  DEFAULT_SEARCH_SORT,
  isDefaultSearch,
  readDefaultSearchCache,
  writeDefaultSearchCache,
} from "../lib/default-search-cache";

/** Params that open the page on a pre-filled search instead of the default one. */
const PREFILL_PARAMS = ["q", "year", "school", "team", "tournament", "event"];

function hasPrefillParams(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return PREFILL_PARAMS.some((k) => params.has(k));
}

/**
 * Manages search state including term, filters, sorting, results, and selection.
 *
 * Fetches the default search as soon as the page mounts, showing the results
 * cached from the last visit until it returns, then fetches with a 300ms
 * debounce whenever the search term, sort order, or filters change. Supports keyboard navigation with arrow keys
 * to cycle through results.
 *
 * @returns All search state values and their setters, plus computed helpers.
 */
export function useSearchState() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(
    null,
  );
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [sortBy, setSortBy] = useState(DEFAULT_SEARCH_SORT);
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_SEARCH_FILTERS);
  const [loading, setLoading] = useState(true);

  /**
   * Sequence number of the most recently issued request.
   *
   * Debounced searches can still overlap when one query is slower than the
   * next, and a late response would otherwise overwrite newer results with
   * stale ones. Only the newest request is allowed to set state.
   */
  const requestId = useRef(0);

  /**
   * True while the list shows the cached default results from the last
   * visit. The refresh that replaces them runs without the loading state, so
   * the list stays on screen rather than flashing to a spinner.
   */
  const showingCachedDefault = useRef(false);

  /** The first fetch runs at once; only later changes wait out the debounce. */
  const firstFetch = useRef(true);

  /**
   * Starts the search from the URL (`/research/cards?q=…&year=…&event=…`), so other
   * pages — the topics explorer's links, for one — can open a pre-filled
   * search. Read once on mount; the debounced fetch below picks it up before
   * its first request fires.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!hasPrefillParams()) {
      // The default search: show last visit's results while it refreshes.
      const cached = readDefaultSearchCache();
      if (cached) {
        showingCachedDefault.current = true;
        setSearchResults(cached.results);
        setTotalResults(cached.total);
        setLoading(false);
      }
      return;
    }
    const initial = readCardsSearchParams(params);
    setSearchTerm(initial.searchTerm);
    // A pre-filled link narrows quotes; it does not switch kinds.
    setFilters({ ...initial.filters, searchQuotes: true });
  }, []);

  /**
   * Select a search result by reference and index.
   * Also used by keyboard navigation and click handlers.
   */
  const selectResult = useCallback((result: SearchResult, index: number) => {
    setSelectedResult(result);
    setSelectedIndex(index);
  }, []);

  /**
   * Arrow-key navigation between search results.
   *
   * Keystrokes aimed at a text field are left alone — this listener is on
   * `window`, so without that check every arrow press inside the search box
   * moved the selection instead of the caret.
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      const next = nextSelectionIndex(e.key, selectedIndex, searchResults.length);
      if (next === null) return;

      e.preventDefault();
      selectResult(searchResults[next], next);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, searchResults, selectResult]);

  /**
   * Build query params from current state and fetch results from the search API.
   * Resets selection on each new fetch.
   */
  const fetchResults = useCallback(async () => {
    const id = ++requestId.current;
    const query = { searchTerm, sortBy, filters };
    const isDefault = isDefaultSearch(query);
    if (!(isDefault && showingCachedDefault.current)) setLoading(true);
    showingCachedDefault.current = false;
    try {
      const response = await grab(buildSearchUrl(query), { baseURL: "" });
      if (id !== requestId.current) return;
      const data = response.data;
      setSearchResults(data?.results ?? []);
      setTotalResults(data?.total ?? 0);
      if (isDefault && !data?.error) writeDefaultSearchCache(data?.results ?? [], data?.total ?? 0);
      setSelectedResult(null);
      setSelectedIndex(-1);
    } catch (error) {
      if (id !== requestId.current) return;
      console.error("Failed to fetch search results:", error);
      setSearchResults([]);
      setTotalResults(0);
      setSelectedResult(null);
      setSelectedIndex(-1);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [sortBy, searchTerm, filters]);

  /** Debounced search: re-fetch when search term, sort, or filters change. */
  useEffect(() => {
    // Opening the page has nothing to debounce: the default search goes out
    // straight away. A pre-filled link still waits, because the state it
    // sets on mount replaces this first query.
    if (firstFetch.current) {
      firstFetch.current = false;
      if (!hasPrefillParams()) {
        void fetchResults();
        return;
      }
    }
    const timer = setTimeout(fetchResults, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [fetchResults]);

  return {
    searchTerm,
    setSearchTerm,
    searchResults,
    totalResults,
    selectedResult,
    selectedIndex,
    selectResult,
    sortBy,
    setSortBy,
    filters,
    setFilters,
    loading,
  };
}
