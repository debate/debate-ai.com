/**
 * @fileoverview Video grid view used by DebateVideosPanel for rounds and
 * top-picks categories. Renders the sticky search/filter bar, video grid,
 * and infinite-scroll trigger as a self-contained layout component.
 * @module components/debate/DebateVideos/panels/VideoGridView
 */

"use client"

import React from "react"
import type { VideoType } from "@/lib/types/videos"
import { Footer } from "@/components/debate/DebateCardSearch/Footer"
import { StickyHeader } from "../components/layout/StickyHeader"
import { VideoSearchBar } from "../components/video-search/VideoSearchBar"
import { VideoGrid } from "../components/video-grid/VideoGrid"
import { YouTubeStatsModal } from "../components/youtube-stats-modal/YouTubeStatsModal"
import type { DebateStyle, CategoryType, TopicType } from "@/lib/types/videos"
// import { ico } from  "grab-url/icons";

/** Props for the {@link VideoGridView} component. */
interface VideoGridViewProps {
  // ---- State ----
  /** Current search query string. */
  searchTerm: string
  /** Active sort order key. */
  sortOrder: string
  /** Active year filter (e.g. `"2026"`), or empty string for all years. */
  selectedYear: string
  /** Whether the search input is currently focused. */
  isSearchFocused: boolean
  /** Whether video thumbnails are shown in the grid. */
  showThumbnails: boolean
  /** Whether only marked as favorite videos are shown. */
  showFavoritesOnly: boolean
  /** Currently active view category (`"rounds"` or `"topPicks"`). */
  currentCategory: CategoryType
  /** `true` while the initial video data is loading. */
  isLoading: boolean
  /** Error message from a failed fetch, or empty string. */
  errorMessage: string
  /** `true` while additional pages are loading (infinite scroll). */
  isLoadingMore: boolean
  /** Active debate-style filter, or `""` for no filter. */
  selectedStyle: DebateStyle | ""
  /** Set of marked as favorite video IDs. */
  favorites: Set<string>
  /** Set of hidden video IDs. */
  hiddenVideos: Set<string>
  /** Full unfiltered video list (used by the search bar for counts). */
  allVideos: VideoType[]
  /** Filtered+paginated videos currently visible in the grid. */
  currentVideos: VideoType[]
  /** Topic metadata for badge rendering. */
  topics: TopicType[] | undefined
  /** Set of video IDs marked as top picks. */
  topPicks: Set<string>
  /** Ref attached to the sentinel element that triggers infinite scroll. */
  loadMoreTriggerRef: React.RefObject<HTMLDivElement | null>
  /** Ref attached to the video grid container (used for scroll positioning). */
  videoContainerRef: React.RefObject<HTMLDivElement | null>
  /** YouTube channel stats object, or `null` before data loads. */
  youtubeStats: any
  /** Whether the YouTube stats modal is open. */
  statsModalOpen: boolean

  // ---- Handlers ----
  /** Called when the search input value changes. */
  onSearchChange: (value: string) => void
  /** Called when the search input receives focus. */
  onSearchFocus: () => void
  /** Called when the search input loses focus. */
  onSearchBlur: () => void
  /** Called to clear the search term. */
  onClearSearch: () => void
  /** Called when the user changes the sort order. */
  onSortChange: (value: string) => void
  /** Called when the user changes the year filter. */
  onYearChange: (year: string) => void
  /** Toggles thumbnail visibility in the grid. */
  onToggleThumbnails: () => void
  /** Toggles the favorites-only filter. */
  onToggleFavoritesOnly: () => void
  /** Toggles the top-picks category filter. */
  onToggleTopPicks: () => void
  /** Switches the view to the leaderboard category. */
  onToggleRankings: () => void
  /** Called when the user changes the debate-style filter. */
  onStyleChange: (style: DebateStyle | "") => void
  /** Toggles the favorite state of a single video. */
  onToggleFavorite: (id: string) => void
  /** Hides a video from the grid. */
  onHideVideo: (id: string) => void
  /** Restores a previously hidden video. */
  onUnhideVideo: (id: string) => void
  /** Called when the YouTube stats modal open state changes. */
  onStatsModalOpenChange: (open: boolean) => void
}

/**
 * Renders the full video-grid layout: sticky search bar, loading/error states,
 * the video grid, and the infinite-scroll sentinel.
 *
 * @param props - See {@link VideoGridViewProps}.
 */
export function VideoGridView({
  searchTerm,
  sortOrder,
  selectedYear,
  isSearchFocused,
  showThumbnails,
  showFavoritesOnly,
  currentCategory,
  isLoading,
  errorMessage,
  isLoadingMore,
  selectedStyle,
  favorites,
  hiddenVideos,
  allVideos,
  currentVideos,
  topics,
  topPicks,
  loadMoreTriggerRef,
  videoContainerRef,
  youtubeStats,
  statsModalOpen,
  onSearchChange,
  onSearchFocus,
  onSearchBlur,
  onClearSearch,
  onSortChange,
  onYearChange,
  onToggleThumbnails,
  onToggleFavoritesOnly,
  onToggleTopPicks,
  onToggleRankings,
  onStyleChange,
  onToggleFavorite,
  onHideVideo,
  onUnhideVideo,
  onStatsModalOpenChange,
}: VideoGridViewProps) {
  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <StickyHeader
        controls={
          <VideoSearchBar
            searchTerm={searchTerm}
            sortOrder={sortOrder}
            selectedYear={selectedYear}
            isSearchFocused={isSearchFocused}
            showThumbnails={showThumbnails}
            showFavoritesOnly={showFavoritesOnly}
            onSearchChange={onSearchChange}
            onSearchFocus={onSearchFocus}
            onSearchBlur={onSearchBlur}
            onClearSearch={onClearSearch}
            onSortChange={onSortChange}
            onYearChange={onYearChange}
            onToggleThumbnails={onToggleThumbnails}
            onToggleFavoritesOnly={onToggleFavoritesOnly}
            showTopPicksActive={currentCategory === "topPicks"}
            onToggleTopPicks={onToggleTopPicks}
            showRankingsActive={false}
            onToggleRankings={onToggleRankings}
            totalVideos={currentVideos.length}
            selectedStyle={selectedStyle}
            onStyleChange={onStyleChange}
            allVideos={allVideos}
            hiddenVideos={hiddenVideos}
            extraButtons={
              youtubeStats && (
                <YouTubeStatsModal stats={youtubeStats} open={statsModalOpen} onOpenChange={onStatsModalOpenChange} />
              )
            }
          />
        }
      />

      <Footer />

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading videos...</p>
        </div>
      ) : errorMessage ? (
        <div className="text-center py-12">
          <p className="text-destructive">{errorMessage}</p>
        </div>
      ) : currentVideos.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No videos found matching your search.</p>
        </div>
      ) : (
        <>
          <VideoGrid
            videos={currentVideos}
            showThumbnails={showThumbnails}
            topics={topics}
            videoContainerRef={videoContainerRef}
            favorites={favorites}
            onToggleFavorite={onToggleFavorite}
            onBadgeClick={onSearchChange}
            onHideVideo={onHideVideo}
            onUnhideVideo={onUnhideVideo}
            hiddenVideos={hiddenVideos}
            topPicks={topPicks}
          />

          <div ref={loadMoreTriggerRef} className="h-10" />

          {isLoadingMore && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">Loading more...</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
