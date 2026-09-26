/**
 * @fileoverview Main panel for the debate videos browsing interface.
 *
 * Owns filter state and URL sync, pages videos in from `/api/videos` through
 * {@link useVideoFeed}, then delegates rendering to {@link LeaderboardView} or
 * {@link VideoGridView} depending on the active category.
 * @module components/debate/DebateVideos/panels/DebateVideosPanel
 */

"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import type { CategoryType } from "../types/videos"
import type { DebateStyle } from "../types/videos"
import { setStateInURL } from "../ui/lib/utils"

// Hooks
import { useVideoState } from "../hooks/useVideoState"
import { useVideoFeed, useVideoMeta, type VideoFeedFilters } from "../hooks/useVideoFeed"
import { useInfiniteScroll } from "../hooks/useInfiniteScroll"
import { useYouTubeStats } from "../hooks/useYouTubeStats"

// Components
import { useCategoryDock } from "../context/category-dock-context"
import { useVideoPlayerStore } from "../state/videoPlayerStore"
import { LeaderboardView } from "./leaderboard/LeaderboardView"
import { currentSeasonYear, seasonYears } from "./leaderboard/leaderboardUtils"
import { VideoGridView } from "./VideoGridView"

/**
 * Main video browsing page that composes filter state, the paginated feed, and
 * the UI sub-components.
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
  const [lbYear, setLbYear] = useState(() => String(currentSeasonYear()))
  const lbYears = useMemo(() => seasonYears(), [])

  const { meta } = useVideoMeta()

  const youtubeStats = useYouTubeStats()

  // ============================================================================
  // Feed
  // ============================================================================

  // Favourites live in localStorage, so the server filters on an explicit id
  // list rather than knowing anything about them.
  const favoriteIds = useMemo(
    () => (state.showFavoritesOnly ? Array.from(state.favorites) : null),
    [state.showFavoritesOnly, state.favorites],
  )

  // Hidden videos are a browser-local preference; an explicit search still
  // surfaces them, as it always has, so the deny-list is only sent while not
  // searching — otherwise a hidden video could never be found again to unhide.
  const excludeIds = useMemo(
    () => (state.searchTerm.trim() || state.hiddenVideos.size === 0 ? null : Array.from(state.hiddenVideos)),
    [state.searchTerm, state.hiddenVideos],
  )

  const filters: VideoFeedFilters = {
    // A search spans rounds and lectures, matching the old client-side
    // behaviour of searching the whole library from any tab.
    source: state.searchTerm.trim() || state.currentCategory === "topPicks" ? "all" : "round",
    topPicksOnly: state.currentCategory === "topPicks",
    style: state.selectedStyle,
    year: state.selectedYear,
    sort: state.sortOrder,
    q: state.searchTerm,
    ids: favoriteIds,
    excludeIds,
    withFacets: true,
    enabled: state.currentCategory !== "leaderboard",
  }

  const feed = useVideoFeed(filters)

  const currentVideos = feed.videos

  const topPicksSet = useMemo(
    () => new Set(feed.videos.filter((video) => video[15] === true).map((video) => video[0])),
    [feed.videos],
  )

  // ============================================================================
  // Category Management
  // ============================================================================

  /**
   * Handles a category change triggered by the UI.
   *
   * @param category - The category selected by the user.
   */
  const handleCategoryChange = useCallback(
    (category: CategoryType) => {
      actions.setCurrentCategory(category)
      const params = new URLSearchParams(searchParams.toString())
      params.set("view", category)
      router.replace(`?${params.toString()}`, { scroll: false })
    },
    [actions.setCurrentCategory, searchParams, router],
  )

  useCategoryDock(state.currentCategory, handleCategoryChange)

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
    feed.hasMore,
    feed.isLoading || feed.isLoadingMore,
    feed.loadMore,
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
        history={meta?.history}
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
      isLoading={feed.isLoading}
      errorMessage={feed.errorMessage}
      isLoadingMore={feed.isLoadingMore}
      selectedStyle={state.selectedStyle}
      favorites={state.favorites}
      hiddenVideos={state.hiddenVideos}
      currentVideos={currentVideos}
      totalVideos={feed.total}
      facets={feed.facets}
      topics={meta?.topics}
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
