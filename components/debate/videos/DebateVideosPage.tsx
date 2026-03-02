"use client"

/**
 * @fileoverview Debate Videos Page Component (Refactored)
 *
 * Refactored video browsing interface with modular architecture.
 * Features category navigation, search, filtering, and infinite scroll.
 *
 * @module components/debate/videos/DebateVideosPage
 */

import { useCallback, useEffect } from "react"
import { ChampionsPanel } from "./panels/ChampionsPanel"
import { DictionaryPanel } from "./panels/DictionaryPanel"
import { LeaderboardPanel } from "./panels/LeaderboardPanel"

// Hooks
import { useVideoState } from "./hooks/useVideoState"
import { useVideoDataFetch, useVideoFiltering, useResponsiveVideosPerPage } from "./hooks/useVideoData"
import { useInfiniteScroll } from "./hooks/useInfiniteScroll"

// Components
import { CategoryDock } from "./components/CategoryDock"
import { VideoSearchBar } from "./components/VideoSearchBar"
import { VideoGrid } from "./components/VideoGrid"
import { VideoPagination } from "./components/VideoPagination"

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
  const { state, actions } = useVideoState()

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

      if (category === "rounds" || category === "lectures" || category === "topPicks") {
        const videos = data[category] || []
        actions.setAllVideos(videos)
        actions.setIsLoading(false)
      } else {
        actions.setAllVideos([])
        actions.setFilteredVideos([])
        actions.setIsLoading(false)
      }
    },
    [actions.setCurrentCategory, actions.setCurrentPage, actions.setAllVideos, actions.setFilteredVideos, actions.setIsLoading],
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
    },
    [state.debateVideos, changeCategory],
  )

  // ============================================================================
  // Data Fetching & Filtering
  // ============================================================================
  const { filterAndSortVideos } = useVideoFiltering()

  useVideoDataFetch(actions.setDebateVideos, actions.setIsLoading, actions.setErrorMessage, changeCategory)

  useResponsiveVideosPerPage(actions.setVideosPerPage)

  // Filter and sort when dependencies change
  useEffect(() => {
    const filtered = filterAndSortVideos(state.allVideos, state.searchTerm, state.sortOrder, state.debateVideos)
    actions.setFilteredVideos(filtered)
    actions.setCurrentPage(1)
  }, [state.allVideos, state.searchTerm, state.sortOrder, state.debateVideos, filterAndSortVideos, actions.setFilteredVideos, actions.setCurrentPage])

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
  // Pagination Handlers
  // ============================================================================

  /**
   * Decrements the current page and scrolls the grid into view.
   * No-ops if already on the first page.
   */
  const handlePrevPage = useCallback(() => {
    if (state.currentPage > 1) {
      actions.setCurrentPage(state.currentPage - 1)
      state.videoContainerRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [state.currentPage, state.videoContainerRef, actions.setCurrentPage])

  /**
   * Increments the current page and scrolls the grid into view.
   * No-ops if already on the last page.
   */
  const handleNextPage = useCallback(() => {
    if (state.currentPage < totalPages) {
      actions.setCurrentPage(state.currentPage + 1)
      state.videoContainerRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [state.currentPage, totalPages, state.videoContainerRef, actions.setCurrentPage])

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
  if (state.currentCategory === "champions") {
    return (
      <div className="min-h-screen bg-background p-3 sm:p-6">
        <CategoryDock currentCategory={state.currentCategory} onCategoryChange={handleCategoryChange} />
        <ChampionsPanel onYearSelect={() => { }} />
      </div>
    )
  }

  if (state.currentCategory === "dictionary") {
    return (
      <div className="min-h-screen bg-background p-3 sm:p-6">
        <CategoryDock currentCategory={state.currentCategory} onCategoryChange={handleCategoryChange} />
        <DictionaryPanel />
      </div>
    )
  }

  if (state.currentCategory === "leaderboard") {
    return (
      <div className="min-h-screen bg-background p-3 sm:p-6">
        <CategoryDock currentCategory={state.currentCategory} onCategoryChange={handleCategoryChange} />
        <LeaderboardPanel />
      </div>
    )
  }

  // ============================================================================
  // Render Main Video Grid
  // ============================================================================
  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <CategoryDock currentCategory={state.currentCategory} onCategoryChange={handleCategoryChange} />

      <VideoSearchBar
        searchTerm={state.searchTerm}
        sortOrder={state.sortOrder}
        isSearchFocused={state.isSearchFocused}
        showThumbnails={state.showThumbnails}
        onSearchChange={handleSearchChange}
        onSearchFocus={() => actions.setIsSearchFocused(true)}
        onSearchBlur={() => actions.setIsSearchFocused(false)}
        onClearSearch={handleClearSearch}
        onSortChange={handleSortChange}
        onToggleThumbnails={handleToggleThumbnails}
      />

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
            videoContainerRef={state.videoContainerRef}
          />

          {/* Infinite scroll trigger */}
          <div ref={state.loadMoreTriggerRef} className="h-10" />

          {state.isLoadingMore && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">Loading more...</p>
            </div>
          )}

          <VideoPagination
            currentPage={state.currentPage}
            totalPages={totalPages}
            onPrevPage={handlePrevPage}
            onNextPage={handleNextPage}
          />
        </>
      )}
    </div>
  )
}
