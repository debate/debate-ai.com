/**
 * @fileoverview Lectures page - shows lecture videos with a Dictionary toggle button.
 */

"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Search, X } from "lucide-react"
import Image from "next/image"
import type { CategoryType, DebateVideosData } from "@/lib/types/videos"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { IconBook } from "@/components/icons"
import { DictionaryPanel } from "./DictionaryPanel"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"

// Hooks
import { useVideoState } from "../hooks/useVideoState"
import { useVideoDataFetch, useVideoFiltering, useResponsiveVideosPerPage } from "../hooks/useVideoData"
import { useInfiniteScroll } from "../hooks/useInfiniteScroll"

// Components
import { VideoSearchBar } from "../components/VideoSearchBar"
import { VideoGrid } from "../components/VideoGrid"

export function LecturesPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const initialCategory = useMemo<CategoryType>(() => {
    const view = searchParams.get("view")
    return view === "dictionary" ? "dictionary" : "lectures"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { state, actions } = useVideoState(initialCategory)

  const [dictSearchTerm, setDictSearchTerm] = useState("")

  // ============================================================================
  // Computed Values
  // ============================================================================
  const totalPages = Math.ceil(state.filteredVideos.length / state.videosPerPage)
  const endIndex = state.currentPage * state.videosPerPage
  const currentVideos = state.filteredVideos.slice(0, endIndex)

  // ============================================================================
  // Category Management
  // ============================================================================
  const changeCategory = useCallback(
    (category: CategoryType, data: DebateVideosData) => {
      actions.setCurrentCategory(category)
      actions.setCurrentPage(1)

      if (category === "lectures") {
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

  // ============================================================================
  // Data Fetching & Filtering
  // ============================================================================
  const { filterAndSortVideos } = useVideoFiltering()

  useVideoDataFetch(actions.setDebateVideos, actions.setIsLoading, actions.setErrorMessage, changeCategory, initialCategory)

  useResponsiveVideosPerPage(actions.setVideosPerPage)

  useEffect(() => {
    const filtered = filterAndSortVideos(state.allVideos, state.searchTerm, state.sortOrder, state.selectedYear, state.debateVideos, state.showFavoritesOnly, state.favorites)
    actions.setFilteredVideos(filtered)
    actions.setCurrentPage(1)
  }, [state.allVideos, state.searchTerm, state.sortOrder, state.selectedYear, state.debateVideos, state.showFavoritesOnly, state.favorites, filterAndSortVideos, actions.setFilteredVideos, actions.setCurrentPage])

  // ============================================================================
  // Search & Filter Handlers
  // ============================================================================
  const handleSearchChange = useCallback((value: string) => { actions.setSearchTerm(value) }, [actions.setSearchTerm])
  const handleClearSearch = useCallback(() => { actions.setSearchTerm("") }, [actions.setSearchTerm])
  const handleSortChange = useCallback((value: string) => { actions.setSortOrder(value) }, [actions.setSortOrder])
  const handleToggleThumbnails = useCallback(() => { actions.setShowThumbnails(!state.showThumbnails) }, [actions.setShowThumbnails, state.showThumbnails])

  // ============================================================================
  // Pagination Handlers
  // ============================================================================
  const handlePrevPage = useCallback(() => {
    if (state.currentPage > 1) {
      actions.setCurrentPage(state.currentPage - 1)
      state.videoContainerRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [state.currentPage, state.videoContainerRef, actions.setCurrentPage])

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
  // Dictionary toggle button (shown in every header)
  // ============================================================================
  const isDictionary = state.currentCategory === "dictionary"

  const dictToggleButton = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className={`shrink-0 ${isDictionary ? "bg-primary/20 ring-2 ring-primary" : ""}`}
            variant="outline"
            size="icon"
            onClick={() => handleCategoryChange(isDictionary ? "lectures" : "dictionary")}
          >
            <Image src={IconBook} alt="Dictionary" width={16} height={16} className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {isDictionary ? "Back to lectures" : "Show dictionary"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )

  const stickyHeader = (controls?: React.ReactNode) => (
    <div className="sm:sticky top-0 z-40 bg-background border-b border-border/30 -mx-3 sm:-mx-6 px-3 sm:px-6 py-2 mb-4 flex flex-wrap md:flex-nowrap items-center gap-2 md:justify-end">
      {controls && <div className="min-w-0 flex flex-wrap items-center gap-2">{controls}{dictToggleButton}</div>}
    </div>
  )

  // ============================================================================
  // Dictionary Panel
  // ============================================================================
  if (isDictionary) {
    const dictControls = (
      <div className="relative w-full md:w-[240px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search terms..."
          value={dictSearchTerm}
          onChange={(e) => setDictSearchTerm(e.target.value)}
          className="pl-9 pr-8 h-9"
        />
        {dictSearchTerm && (
          <button
            onClick={() => setDictSearchTerm("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    )
    return (
      <div className="min-h-screen bg-background p-3 sm:p-6">
        {stickyHeader(
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search terms..."
                value={dictSearchTerm}
                onChange={(e) => setDictSearchTerm(e.target.value)}
                className="pl-9 pr-8 h-9"
              />
              {dictSearchTerm && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setDictSearchTerm("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Clear search</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        )}
        <DictionaryPanel controlledSearchTerm={dictSearchTerm} onControlledSearchChange={setDictSearchTerm} />
      </div>
    )
  }

  // ============================================================================
  // Lectures Video Grid
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
          currentPage={state.currentPage}
          totalPages={totalPages}
          totalVideos={state.filteredVideos.length}
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
        />
      )}

      {state.isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading lectures...</p>
        </div>
      ) : state.errorMessage ? (
        <div className="text-center py-12">
          <p className="text-destructive">{state.errorMessage}</p>
        </div>
      ) : currentVideos.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No lectures found matching your search.</p>
        </div>
      ) : (
        <>
          <VideoGrid
            videos={currentVideos}
            showThumbnails={state.showThumbnails}
            videoContainerRef={state.videoContainerRef}
            favorites={state.favorites}
            onToggleFavorite={actions.toggleFavorite}
            onChannelClick={handleSearchChange}
          />

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
