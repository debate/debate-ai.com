/**
 * @fileoverview Main video grid view for the lectures page.
 * Renders the sticky search/filter bar, quick-link navigation cards,
 * the lecture-category gallery, and the paginated video grid with
 * infinite-scroll trigger.
 * @module components/debate/DebateVideos/panels/LecturesVideoGridView
 */

"use client"

import React from "react"
import type { CategoryType, TopicType } from "@/lib/types/videos"
import type { VideoType } from "@/lib/types/videos"
import { Footer } from "@/components/debate/DebateCardSearch/Footer"
import { StickyHeader } from "../components/layout/StickyHeader"
import { VideoSearchBar } from "../components/video-search/VideoSearchBar"
import { VideoGrid } from "../components/video-grid/VideoGrid"
import { LectureCategoryGridGallery } from "../components/category-gallery/LectureCategoryGridGallery"
import { QuickLinksGrid } from "../components/category-gallery/QuickLinksGrid"
import { YouTubeStatsModal } from "../components/youtube-stats-modal/YouTubeStatsModal"

/** Props for the {@link LecturesVideoGridView} component. */
interface LecturesVideoGridViewProps {
  // ---- Search / filter state ----
  /** Current search query string. */
  searchTerm: string
  /** Active sort order key. */
  sortOrder: string
  /** Active year filter string (e.g. `"2026"`), or empty string for all years. */
  selectedYear: string
  /** Whether the search input is focused. */
  isSearchFocused: boolean
  /** Whether video thumbnails are shown. */
  showThumbnails: boolean
  /** Whether only favorited videos are shown. */
  showFavoritesOnly: boolean
  /** Active category (`"lectures"` or `"topPicks"`). */
  currentCategory: CategoryType
  /** Total filtered video count for the search bar counter. */
  totalVideos: number

  // ---- Load state ----
  /** `true` while the initial video data is loading. */
  isLoading: boolean
  /** Error message from a failed fetch, or empty string. */
  errorMessage: string
  /** `true` while additional pages are loading (infinite scroll). */
  isLoadingMore: boolean

  // ---- Video data ----
  /** Full unfiltered list, used by the search bar for counts. */
  allVideos: VideoType[]
  /** Filtered+paginated videos to display in the grid. */
  currentVideos: VideoType[]
  /** Set of video IDs marked as favorites. */
  favorites: Set<string>
  /** Set of video IDs marked as hidden. */
  hiddenVideos: Set<string>
  /** Set of top-pick video IDs. */
  topPicks: Set<string>
  /** Topic metadata for badge rendering. */
  topics: TopicType[] | undefined
  /** Lecture video list used by the category gallery. */
  debateLectures: VideoType[] | undefined

  // ---- Refs ----
  /** Sentinel element that triggers the next page load. */
  loadMoreTriggerRef: React.RefObject<HTMLDivElement | null>
  /** Grid container ref used for scroll positioning. */
  videoContainerRef: React.RefObject<HTMLDivElement | null>
  /** Ref for the scroll-to-videos anchor. */
  videosSectionRef: React.RefObject<HTMLDivElement | null>

  // ---- Lecture-specific state ----
  /** Per-category video counts shown on the quick-link cards. */
  quickLinkCounts: Record<string, number>
  /** Whether the lecture category gallery is visible. */
  showLectureCategories: boolean
  /** The active lecture category filter key, or `"all"`. */
  selectedCategory: string

  // ---- Stats modal ----
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
  /** Clears the active search term. */
  onClearSearch: () => void
  /** Called when the user changes the sort order. */
  onSortChange: (value: string) => void
  /** Called when the user changes the year filter. */
  onYearChange: (year: string) => void
  /** Toggles thumbnail visibility. */
  onToggleThumbnails: () => void
  /** Toggles the favorites-only filter. */
  onToggleFavoritesOnly: () => void
  /** Toggles the lecture category gallery visibility. */
  onToggleLectureCategories: () => void
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
 * Renders the full lectures video-grid layout:
 * - Sticky search/filter bar
 * - Quick-link navigation cards
 * - Lecture category gallery (collapsible)
 * - Video grid with infinite-scroll
 *
 * @param props - See {@link LecturesVideoGridViewProps}.
 */
export function LecturesVideoGridView({
  searchTerm,
  sortOrder,
  selectedYear,
  isSearchFocused,
  showThumbnails,
  showFavoritesOnly,
  currentCategory,
  totalVideos,
  isLoading,
  errorMessage,
  isLoadingMore,
  allVideos,
  currentVideos,
  favorites,
  hiddenVideos,
  topPicks,
  topics,
  debateLectures,
  loadMoreTriggerRef,
  videoContainerRef,
  videosSectionRef,
  quickLinkCounts,
  showLectureCategories,
  selectedCategory,
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
  onToggleLectureCategories,
  onToggleFavorite,
  onHideVideo,
  onUnhideVideo,
  onStatsModalOpenChange,
}: LecturesVideoGridViewProps) {
  /** Derive the active quick-link card ID from filter state. */
  const activeQuickLinkId =
    showFavoritesOnly ? "favorites"
    : currentCategory === "topPicks" ? "topPicks"
    : "lectures"

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <StickyHeader
        controls={
          <VideoSearchBar
            searchTerm={searchTerm}
            sortOrder={sortOrder}
            isSearchFocused={isSearchFocused}
            showThumbnails={showThumbnails}
            showFavoritesOnly={showFavoritesOnly}
            selectedYear={selectedYear}
            onYearChange={onYearChange}
            allVideos={allVideos}
            hiddenVideos={hiddenVideos}
            onSearchChange={onSearchChange}
            onSearchFocus={onSearchFocus}
            onSearchBlur={onSearchBlur}
            onClearSearch={onClearSearch}
            onSortChange={onSortChange}
            onToggleThumbnails={onToggleThumbnails}
            onToggleFavoritesOnly={onToggleFavoritesOnly}
            totalVideos={totalVideos}
            extraButtons={
              youtubeStats ? (
                <YouTubeStatsModal
                  stats={youtubeStats}
                  open={statsModalOpen}
                  onOpenChange={onStatsModalOpenChange}
                />
              ) : null
            }
          />
        }
      />

      <QuickLinksGrid
        counts={quickLinkCounts}
        showLectures={showLectureCategories}
        onToggleLectures={onToggleLectureCategories}
        activeId={activeQuickLinkId}
      />

      {showLectureCategories && debateLectures && (
        <div className="mb-8">
          <LectureCategoryGridGallery
            videosData={debateLectures}
            selectedCategory={selectedCategory}
          />
        </div>
      )}

      <Footer />

      <div ref={videosSectionRef} className="scroll-mt-20" />

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
          <p className="text-muted-foreground">No videos found matching your filters.</p>
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
            showFullDate={true}
            showDescription={true}
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
