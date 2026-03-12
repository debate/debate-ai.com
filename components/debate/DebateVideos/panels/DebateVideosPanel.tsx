/**
 * @fileoverview Main panel for the debate videos browsing interface.
 * Coordinates video data fetching, filtering, and special category views.
 */

"use client"


import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import type { CategoryType, DebateVideosData } from "@/lib/types/videos"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Video } from "lucide-react"
import { LeaderboardPanel } from "./RankingsLeaderboardPanel"

// Hooks
import { useVideoState } from "../hooks/useVideoState"
import { useVideoDataFetch, useVideoFiltering, useResponsiveVideosPerPage } from "../hooks/useVideoData"
import { useInfiniteScroll } from "../hooks/useInfiniteScroll"

// Components
import { useCategoryDock } from "@/components/category-dock-context"
import { VideoSearchBar } from "../components/VideoSearchBar"
import { VideoGrid } from "../components/VideoGrid"

/**
 * Main video browsing page that composes state, data-fetching, and UI sub-components.
 *
 * Manages video browsing with a clean, modular architecture:
 * - Custom hooks for state, data fetching, and filtering
 * - Reusable UI components
 * - Special panels for champions, dictionary, and leaderboard
 *
 * @returns The complete video browsing interface, or a special-panel view for
 *   the "champions", "dictionary", and "leaderboard" categories.
 */
export function DebateVideosPage() {
  // ============================================================================
  // State Management
  // ============================================================================
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

  // Lifted state for special panels
  const [lbDivision, setLbDivision] = useState<"VPF" | "VLD" | "VCX" | "NDT">("VPF")
  const [lbYear, setLbYear] = useState("2026")
  const lbYears = Array.from({ length: Math.max(new Date().getFullYear(), 2026) - 2001 }, (_, i) => String(Math.max(new Date().getFullYear(), 2026) - i))

  const topPicksSet = useMemo(() => new Set(state.debateVideos?.topPicks || []), [state.debateVideos?.topPicks])

  // ============================================================================
  // Computed Values
  // ============================================================================
  /** Total number of pagination pages for the current filtered list. */
  const totalPages = Math.ceil(state.filteredVideos.length / state.videosPerPage)
  /** Slice start index; always 0 because infinite scroll accumulates videos. */
  const startIndex = 0
  /** Slice end index based on how many pages have been loaded. */
  const endIndex = state.currentPage * state.videosPerPage
  /** The subset of filtered videos visible in the current infinite-scroll window. */
  const currentVideos = state.filteredVideos.slice(startIndex, endIndex)

  // ============================================================================
  // Category Management
  // ============================================================================

  /**
   * Switches the active category and resets pagination.
   * Loads video list from the provided data for video categories; clears it
   * for special categories (champions, dictionary, leaderboard).
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
        const topPickVideos = allAvailableVideos.filter((v) => topPickIds.has(v[0]))
        actions.setAllVideos(topPickVideos)
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
      if (state.debateVideos) {
        changeCategory(category, state.debateVideos)
      }
      const params = new URLSearchParams(searchParams.toString())
      params.set("view", category)
      router.replace(`?${params.toString()}`, { scroll: false })
    },
    [state.debateVideos, changeCategory, searchParams, router],
  )

  // Register video category state into the global dock
  useCategoryDock(state.currentCategory, handleCategoryChange)

  // ============================================================================
  // Data Fetching & Filtering
  // ============================================================================
  const { filterAndSortVideos } = useVideoFiltering()

  useVideoDataFetch(actions.setDebateVideos, actions.setIsLoading, actions.setErrorMessage, changeCategory, initialCategory)

  useResponsiveVideosPerPage(actions.setVideosPerPage)

  // Filter and sort when dependencies change
  useEffect(() => {
    const filtered = filterAndSortVideos(state.allVideos, state.searchTerm, state.sortOrder, state.selectedYear, state.debateVideos, state.showFavoritesOnly, state.favorites, state.selectedStyle, state.hiddenVideos)
    actions.setFilteredVideos(filtered)
    actions.setCurrentPage(1)
  }, [state.allVideos, state.searchTerm, state.sortOrder, state.selectedYear, state.debateVideos, state.showFavoritesOnly, state.favorites, state.selectedStyle, state.hiddenVideos, filterAndSortVideos, actions.setFilteredVideos, actions.setCurrentPage])

  // ============================================================================
  // Search & Filter Handlers
  // ============================================================================

  /**
   * Updates the search term state as the user types.
   *
   * @param value - The new search input value.
   */
  const handleSearchChange = useCallback(
    (value: string) => {
      actions.setSearchTerm(value)
    },
    [actions.setSearchTerm],
  )

  /** Clears the current search term. */
  const handleClearSearch = useCallback(() => {
    actions.setSearchTerm("")
  }, [actions.setSearchTerm])

  /**
   * Updates the active sort order.
   *
   * @param value - The sort option value selected by the user.
   */
  const handleSortChange = useCallback(
    (value: string) => {
      actions.setSortOrder(value)
    },
    [actions.setSortOrder],
  )

  /** Toggles thumbnail visibility in the video grid. */
  const handleToggleThumbnails = useCallback(() => {
    actions.setShowThumbnails(!state.showThumbnails)
  }, [actions.setShowThumbnails, state.showThumbnails])

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
  // Render Special Panels
  // ============================================================================

  // ============================================================================
  // Render Special Panels
  // ============================================================================
  // Sticky header: CategoryDock + optional right-side controls
  // Desktop: single row (flex-nowrap). Mobile: wraps to multiple rows.
  const stickyHeader = (controls?: React.ReactNode) => (
    <div className="sm:sticky top-0 z-40 supports-backdrop-blur:bg-background/30 bg-background/80 backdrop-blur-lg border-b border-white/10 dark:border-white/5 -mx-3 sm:-mx-6 px-3 sm:px-6 py-2 mb-4 flex flex-wrap md:flex-nowrap items-center gap-2 md:justify-end">
      {controls && <div className="min-w-0 flex flex-wrap items-center gap-2">{controls}</div>}
    </div>
  )

  if (state.currentCategory === "leaderboard") {
    const DIVISION_LABELS: { value: "VPF" | "VLD" | "VCX" | "NDT"; label: string }[] = [
      { value: "VPF", label: "PF" },
      { value: "VLD", label: "LD" },
      { value: "VCX", label: "Policy" },
      { value: "NDT", label: "NDT" },
    ]
    const lbControls = (
      <>
        <div className="flex items-center gap-1 mr-auto md:mr-0">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-3"
            onClick={() => handleCategoryChange("rounds")}
          >
            <Video className="h-4 w-4" />
            <span className="hidden xs:inline">Videos</span>
          </Button>
        </div>
        <Tabs value={lbDivision} onValueChange={(v) => setLbDivision(v as typeof lbDivision)}>
          <TabsList className="h-8">
            {DIVISION_LABELS.map((d) => (
              <TabsTrigger key={d.value} value={d.value} className="text-xs px-2 py-1">{d.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Select value={lbYear} onValueChange={setLbYear}>
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {lbYears.map((y) => (
              <SelectItem key={y} value={y} className="text-xs">
                {Number(y) - 1}-{y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </>
    )
    return (
      <div className="min-h-screen bg-background p-3 sm:p-6">
        {stickyHeader(lbControls)}
        <LeaderboardPanel
          controlledDivision={lbDivision}
          controlledYear={lbYear}
          onControlledDivisionChange={setLbDivision}
          onControlledYearChange={setLbYear}
          history={state.debateVideos?.history}
        />
      </div>
    )
  }

  // ============================================================================
  // Render Main Video Grid
  // ============================================================================
  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      {stickyHeader(
        <VideoSearchBar
          searchTerm={state.searchTerm}
          sortOrder={state.sortOrder}
          selectedYear={state.selectedYear}
          isSearchFocused={state.isSearchFocused}
          showThumbnails={state.showThumbnails}
          showFavoritesOnly={state.showFavoritesOnly}
          onSearchChange={handleSearchChange}
          onSearchFocus={() => actions.setIsSearchFocused(true)}
          onSearchBlur={() => actions.setIsSearchFocused(false)}
          onClearSearch={handleClearSearch}
          onSortChange={handleSortChange}
          onYearChange={(year) => actions.setSelectedYear(year)}
          onToggleThumbnails={handleToggleThumbnails}
          onToggleFavoritesOnly={() => actions.setShowFavoritesOnly(!state.showFavoritesOnly)}
          showTopPicksActive={state.currentCategory === "topPicks"}
          onToggleTopPicks={() => handleCategoryChange(state.currentCategory === "topPicks" ? "rounds" : "topPicks")}
          showRankingsActive={state.currentCategory === "leaderboard"}
          onToggleRankings={() => handleCategoryChange(state.currentCategory === "leaderboard" ? "rounds" : "leaderboard")}
          totalVideos={state.filteredVideos.length}
          selectedStyle={state.selectedStyle}
          onStyleChange={(style) => actions.setSelectedStyle(style)}
        />
      )}

      {state.isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading videos...</p>
        </div>
      ) : state.errorMessage ? (
        <div className="text-center py-12">
          <p className="text-destructive">{state.errorMessage}</p>
        </div>
      ) : currentVideos.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No videos found matching your search.</p>
        </div>
      ) : (
        <>
          <VideoGrid
            videos={currentVideos}
            showThumbnails={state.showThumbnails}
            topics={state.debateVideos?.topics}
            videoContainerRef={state.videoContainerRef}
            favorites={state.favorites}
            onToggleFavorite={actions.toggleFavorite}
            onBadgeClick={handleSearchChange}
            onHideVideo={actions.hideVideo}
            onUnhideVideo={actions.unhideVideo}
            hiddenVideos={state.hiddenVideos}
            topPicks={topPicksSet}
          />

          {/* Infinite scroll trigger */}
          <div ref={state.loadMoreTriggerRef} className="h-10" />

          {state.isLoadingMore && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">Loading more...</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
