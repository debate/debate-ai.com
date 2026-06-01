/**
 * @fileoverview Main panel for the debate videos browsing interface.
 *
 * Orchestrates state, data-fetching, and URL sync via custom hooks, then
 * delegates rendering to {@link LeaderboardView} or {@link VideoGridView}
 * depending on the active category.
 * @module components/debate/DebateVideos/panels/DebateVideosPanel
 */

"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import type { CategoryType, DebateVideosData } from "@/lib/types/videos"
import type { DebateStyle } from "@/lib/types/videos"
import { setStateInURL } from "@/lib/utils"

// Hooks
import { useVideoState } from "../hooks/useVideoState"
import { useVideoDataFetch, useVideoFiltering, useResponsiveVideosPerPage } from "../hooks/useVideoData"
import { useInfiniteScroll } from "../hooks/useInfiniteScroll"

// Components
import { useCategoryDock } from "@/components/layout/category-dock-context"
import { useVideoPlayerStore } from "@/lib/state/videoPlayerStore"
import { LeaderboardView } from "./leaderboard/LeaderboardView"
import { VideoGridView } from "./VideoGridView"

/**
 * Main video browsing page that composes state, data-fetching, and UI sub-components.
 *
 * Renders {@link LeaderboardView} when the active category is `"leaderboard"`,
 * otherwise renders {@link VideoGridView} for rounds and top-picks browsing.
 *
 * @returns The complete video browsing interface.
 */
export function DebateVideosPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const VALID_VIEWS: Set<string> = new Set(["rounds", "topPicks", "leaderboard"])

  const initialCategory = useMemo(() => {
    const view = searchParams.get("view")
    if (view && VALID_VIEWS.has(view as CategoryType)) return view as CategoryType
    return "rounds"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { state, actions } = useVideoState(initialCategory)
  const setSearchHandler = useVideoPlayerStore((state) => state.setSearchHandler)

  // Stats modal auto-open via URL param
  const [statsModalOpen, setStatsModalOpen] = useState(false)

  // Initialize state from URL parameters
  useEffect(() => {
    const urlState = setStateInURL<{ q?: string; year?: string; style?: string; favorites?: string; stats?: string }>()
    if (urlState) {
      if (urlState.q) actions.setSearchTerm(urlState.q)
      if (urlState.year) actions.setSelectedYear(urlState.year)
      if (urlState.style) actions.setSelectedStyle(Number(urlState.style) as DebateStyle)
      if (urlState.favorites === "1") actions.setShowFavoritesOnly(true)
      if (urlState.stats === "1") setStatsModalOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Lifted state for the leaderboard view
  const [lbDivision, setLbDivision] = useState<"VPF" | "VLD" | "VCX" | "NDT">("VPF")
  const [lbYear, setLbYear] = useState("2026")
  const lbYears = Array.from(
    { length: Math.max(new Date().getFullYear(), 2026) - 2001 },
    (_, i) => String(Math.max(new Date().getFullYear(), 2026) - i),
  )

  const topPicksSet = useMemo(
    () => new Set(state.debateVideos?.topPicks || []),
    [state.debateVideos?.topPicks],
  )

  const [youtubeStats, setYoutubeStats] = useState<any>(null)
  useEffect(() => {
    fetch("/api/youtube-stats")
      .then((res) => res.json())
      .then((data) => setYoutubeStats(data))
      .catch((err) => console.error("Failed to load YouTube stats:", err))
  }, [])

  // ============================================================================
  // Computed Values
  // ============================================================================

  const totalPages = Math.ceil(state.filteredVideos.length / state.videosPerPage)
  const endIndex = state.currentPage * state.videosPerPage
  const currentVideos = state.filteredVideos.slice(0, endIndex)

  // ============================================================================
  // Category Management
  // ============================================================================

  /**
   * Switches the active category and resets pagination.
   *
   * @param category - The category to activate.
   * @param data - The full API video data to source videos from.
   */
  const changeCategory = useCallback(
    (category: CategoryType, data: DebateVideosData) => {
      actions.setCurrentCategory(category)
      actions.setCurrentPage(1)

      if (category === "rounds") {
        actions.setAllVideos(data.rounds || [])
        actions.setIsLoading(false)
      } else if (category === "topPicks") {
        const topPickIds = new Set(data.topPicks || [])
        const allAvailableVideos = [...(data.rounds || []), ...(data.lectures || [])]
        actions.setAllVideos(allAvailableVideos.filter((v) => topPickIds.has(v[0])))
        actions.setIsLoading(false)
      } else {
        actions.setAllVideos([])
        actions.setFilteredVideos([])
        actions.setIsLoading(false)
      }
    },
    [actions.setCurrentCategory, actions.setAllVideos, actions.setFilteredVideos, actions.setIsLoading],
  )

  /**
   * Handles a category change triggered by the UI when data is already available.
   *
   * @param category - The category selected by the user.
   */
  const handleCategoryChange = useCallback(
    (category: CategoryType) => {
      if (state.debateVideos) changeCategory(category, state.debateVideos)
      const params = new URLSearchParams(searchParams.toString())
      params.set("view", category)
      router.replace(`?${params.toString()}`, { scroll: false })
    },
    [state.debateVideos, changeCategory, searchParams, router],
  )

  useCategoryDock(state.currentCategory, handleCategoryChange)

  // ============================================================================
  // Data Fetching & Filtering
  // ============================================================================

  const { filterAndSortVideos } = useVideoFiltering()

  useVideoDataFetch(actions.setDebateVideos, actions.setIsLoading, actions.setErrorMessage, changeCategory, initialCategory)
  useResponsiveVideosPerPage(actions.setVideosPerPage)

  useEffect(() => {
    const filtered = filterAndSortVideos(
      state.allVideos, state.searchTerm, state.sortOrder, state.selectedYear,
      state.debateVideos, state.showFavoritesOnly, state.favorites,
      state.selectedStyle, state.hiddenVideos,
    )
    actions.setFilteredVideos(filtered)
    actions.setCurrentPage(1)
  }, [
    state.allVideos, state.searchTerm, state.sortOrder, state.selectedYear,
    state.debateVideos, state.showFavoritesOnly, state.favorites,
    state.selectedStyle, state.hiddenVideos,
    filterAndSortVideos, actions.setFilteredVideos, actions.setCurrentPage,
  ])

  // ============================================================================
  // Search & Filter Handlers
  // ============================================================================

  const handleSearchChange = useCallback(
    (value: string) => {
      actions.setSearchTerm(value)
      setStateInURL({ q: value || null })
    },
    [actions.setSearchTerm],
  )

  useEffect(() => {
    setSearchHandler(handleSearchChange)
    return () => setSearchHandler(null)
  }, [handleSearchChange, setSearchHandler])

  const handleClearSearch = useCallback(() => {
    actions.setSearchTerm("")
    setStateInURL({ q: null })
  }, [actions.setSearchTerm])

  const handleSortChange = useCallback(
    (value: string) => { actions.setSortOrder(value) },
    [actions.setSortOrder],
  )

  const handleToggleThumbnails = useCallback(
    () => { actions.setShowThumbnails(!state.showThumbnails) },
    [actions.setShowThumbnails, state.showThumbnails],
  )

  const handleYearChange = useCallback(
    (year: string) => {
      actions.setSelectedYear(year)
      setStateInURL({ year: year || null })
    },
    [actions.setSelectedYear],
  )

  const handleStyleChange = useCallback(
    (style: DebateStyle | "") => {
      actions.setSelectedStyle(style)
      setStateInURL({ style: style ? String(style) : null })
    },
    [actions.setSelectedStyle],
  )

  // ============================================================================
  // Infinite Scroll
  // ============================================================================

  useInfiniteScroll(
    state.loadMoreTriggerRef,
    state.currentPage,
    totalPages,
    state.isLoadingMore,
    actions.setCurrentPage,
    actions.setIsLoadingMore,
  )

  // ============================================================================
  // Render
  // ============================================================================

  if (state.currentCategory === "leaderboard") {
    return (
      <LeaderboardView
        lbDivision={lbDivision}
        setLbDivision={setLbDivision}
        lbYear={lbYear}
        setLbYear={setLbYear}
        lbYears={lbYears}
        history={state.debateVideos?.history}
        onBackToVideos={() => handleCategoryChange("rounds")}
      />
    )
  }

  return (
    <VideoGridView
      searchTerm={state.searchTerm}
      sortOrder={state.sortOrder}
      selectedYear={state.selectedYear}
      isSearchFocused={state.isSearchFocused}
      showThumbnails={state.showThumbnails}
      showFavoritesOnly={state.showFavoritesOnly}
      currentCategory={state.currentCategory}
      isLoading={state.isLoading}
      errorMessage={state.errorMessage}
      isLoadingMore={state.isLoadingMore}
      selectedStyle={state.selectedStyle}
      favorites={state.favorites}
      hiddenVideos={state.hiddenVideos}
      allVideos={state.allVideos}
      currentVideos={currentVideos}
      topics={state.debateVideos?.topics}
      topPicks={topPicksSet}
      loadMoreTriggerRef={state.loadMoreTriggerRef}
      videoContainerRef={state.videoContainerRef}
      youtubeStats={youtubeStats}
      statsModalOpen={statsModalOpen}
      onSearchChange={handleSearchChange}
      onSearchFocus={() => actions.setIsSearchFocused(true)}
      onSearchBlur={() => actions.setIsSearchFocused(false)}
      onClearSearch={handleClearSearch}
      onSortChange={handleSortChange}
      onYearChange={handleYearChange}
      onToggleThumbnails={handleToggleThumbnails}
      onToggleFavoritesOnly={() => actions.setShowFavoritesOnly(!state.showFavoritesOnly)}
      onToggleTopPicks={() => handleCategoryChange(state.currentCategory === "topPicks" ? "rounds" : "topPicks")}
      onToggleRankings={() => handleCategoryChange("leaderboard")}
      onStyleChange={handleStyleChange}
      onToggleFavorite={actions.toggleFavorite}
      onHideVideo={actions.hideVideo}
      onUnhideVideo={actions.unhideVideo}
      onStatsModalOpenChange={setStatsModalOpen}
    />
  )
}
