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
  EMPTY_FILTERS,
  SEARCH_DEBOUNCE_MS,
  buildSearchUrl,
} from "../lib/search-query";
import { isTypingTarget, nextSelectionIndex } from "../lib/result-navigation";

/**
 * Manages search state including term, filters, sorting, results, and selection.
 *
 * Automatically fetches results with a 300ms debounce whenever the search term,
 * sort order, or filters change. Supports keyboard navigation with arrow keys
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
  const [sortBy, setSortBy] = useState("_text_match:desc");
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
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
    setLoading(true);
    try {
      const response = await grab(
        buildSearchUrl({ searchTerm, sortBy, filters }),
      );
      if (id !== requestId.current) return;
      const data = response.data;
      setSearchResults(data?.results ?? []);
      setTotalResults(data?.total ?? 0);
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
