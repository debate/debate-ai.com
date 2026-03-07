/**
 * @fileoverview Hook for managing CARD search state, filters, and API fetching.
 *
 * Encapsulates all search-related state including the search term, filters,
 * sort order, result selection, and debounced API fetching. Provides a single
 * source of truth for the search sidebar and result navigation.
 *
 * @module components/debate/DebateCARDSearch/hooks/useSearchState
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import grab from "grab-url"
import type { SearchFilters } from "@/components/debate/DebateCARDSearch/ResearchSearchSidebar"
import type { SearchResult } from "@/components/debate/DebateCARDSearch/types"

/** Default empty filter state with all toggles off and text fields blank. */
const EMPTY_FILTERS: SearchFilters = {
  year: "",
  school: "",
  team: "",
  tournament: "",
  event: "",
  searchHighlighted: false,
  searchUnderlined: false,
  searchSummaries: false,
  searchOutlines: false,
  searchRoundSpeeches: false,
  searchQuotes: false,
  searchAllText: false,
}

/** Debounce delay in ms before executing a search after input changes. */
const SEARCH_DEBOUNCE_MS = 300

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
  const [searchTerm, setSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [totalResults, setTotalResults] = useState(0)
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const [sortBy, setSortBy] = useState("_text_match:desc")
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS)
  const [loading, setLoading] = useState(true)

  /**
   * Select a search result by reference and index.
   * Also used by keyboard navigation and click handlers.
   */
  const selectResult = useCallback((result: SearchResult, index: number) => {
    setSelectedResult(result)
    setSelectedIndex(index)
  }, [])

  /** Arrow-key navigation between search results. */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && selectedIndex > 0) {
        e.preventDefault()
        selectResult(searchResults[selectedIndex - 1], selectedIndex - 1)
      } else if (e.key === "ArrowRight" && selectedIndex < searchResults.length - 1) {
        e.preventDefault()
        selectResult(searchResults[selectedIndex + 1], selectedIndex + 1)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedIndex, searchResults, selectResult])

  /**
   * Build query params from current state and fetch results from the search API.
   * Resets selection on each new fetch.
   */
  const fetchResults = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("sort", sortBy)
      if (searchTerm.trim()) params.set("q", searchTerm.trim())
      if (filters.year) params.set("year", filters.year)
      if (filters.school) params.set("school", filters.school)
      if (filters.team) params.set("team", filters.team)
      if (filters.tournament) params.set("tournament", filters.tournament)
      if (filters.event && filters.event !== "all") params.set("event", filters.event)
      if (filters.searchHighlighted) params.set("searchHighlighted", "1")
      if (filters.searchUnderlined) params.set("searchUnderlined", "1")
      if (filters.searchSummaries) params.set("searchSummaries", "1")
      if (filters.searchOutlines) params.set("searchOutlines", "1")
      if (filters.searchRoundSpeeches) params.set("searchRoundSpeeches", "1")
      if (filters.searchQuotes) params.set("searchQuotes", "1")
      if (filters.searchAllText) params.set("searchAllText", "1")

      const response = await grab(`search?${params.toString()}`)
      const data = response.data
      setSearchResults(data?.results ?? [])
      setTotalResults(data?.total ?? 0)
      setSelectedResult(null)
      setSelectedIndex(-1)
    } catch (error) {
      console.error("Failed to fetch search results:", error)
      setSearchResults([])
      setTotalResults(0)
      setSelectedResult(null)
      setSelectedIndex(-1)
    } finally {
      setLoading(false)
    }
  }, [sortBy, searchTerm, filters])

  /** Debounced search: re-fetch when search term, sort, or filters change. */
  useEffect(() => {
    const timer = setTimeout(fetchResults, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [fetchResults])

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
  }
}
