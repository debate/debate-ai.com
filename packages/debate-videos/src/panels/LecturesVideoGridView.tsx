/**
 * @fileoverview Main video grid view for the lectures page.
 * Renders the sticky search/filter bar, quick-link navigation cards,
 * the lecture-category gallery, and the paginated video grid with
 * infinite-scroll trigger.
 * @module components/debate/DebateVideos/panels/LecturesVideoGridView
 */

"use client"

import React, { useMemo } from "react"
import { useParams } from "next/navigation"
import type { CategoryType, TopicType, VideoFacets } from "../types/videos"
import type { LectureCategoryFacet, VideoType } from "../types/videos"
import { Footer } from "../ui/layout/footer"
import { StickyHeader } from "../components/layout/StickyHeader"
import { VideoSearchBar } from "../components/video-search/VideoSearchBar"
import { VideoGrid } from "../components/video-grid/VideoGrid"
import { VideoListRows } from "../components/video-grid/VideoListRows"
import { LectureCategoryGridGallery } from "../components/category-gallery/LectureCategoryGridGallery"
import { QuickLinksGrid } from "../components/category-gallery/QuickLinksGrid"
import { VideoSidebarTree } from "../components/category-gallery/VideoSidebarTree"
import { YouTubeStatsModal } from "../components/youtube-stats-modal/YouTubeStatsModal"
import type { DebateStyle } from "../types/videos"
import type { VideoViewMode } from "../hooks/useVideoState"

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
  /** Current results layout: card grid or dense row list. */
  viewMode: VideoViewMode
  /** Whether only favorited videos are shown. */
  showFavoritesOnly: boolean
  /** Active category (`"lectures"` or `"topPicks"`). */
  currentCategory: CategoryType
  /** Total number of videos matching the current filters, across every page. */
  totalVideos: number
  /** Season/style counts for the filter dropdowns, or `null` before they load. */
  facets: VideoFacets | null

  // ---- Load state ----
  /** `true` while the initial video data is loading. */
  isLoading: boolean
  /** Error message from a failed fetch, or empty string. */
  errorMessage: string
  /** `true` while additional pages are loading (infinite scroll). */
  isLoadingMore: boolean

  // ---- Video data ----
  /** Videos loaded so far for the active filters. */
  currentVideos: VideoType[]
  /** Set of video IDs marked as favorites. */
  favorites: Set<string>
  /** Set of video IDs marked as hidden. */
  hiddenVideos: Set<string>
  /** Set of top-pick video IDs. */
  topPicks: Set<string>
  /** Topic metadata for badge rendering. */
  topics: TopicType[] | undefined
  /** Lecture category cards (label, slug, size) from `/api/videos/meta`. */
  lectureCategories: LectureCategoryFacet[]

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
  /** Called when the user switches between grid and row layout. */
  onViewModeChange: (mode: VideoViewMode) => void
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
  /** Currently selected debate-style filter. */
  selectedStyle?: DebateStyle | ""
  /** Called when the style filter changes. */
  onStyleChange: (style: DebateStyle | "") => void
  /**
   * App-owned navigation dock, rendered at the top of the persistent left
   * sidebar (md+ only). The page supplies this rather than the package
   * rendering it directly, since the dock depends on app-level concerns
   * (auth session, routing, settings menu).
   */
  dockSlot?: React.ReactNode
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
  viewMode,
  showFavoritesOnly,
  currentCategory,
  totalVideos,
  facets,
  isLoading,
  errorMessage,
  isLoadingMore,
  currentVideos,
  favorites,
  hiddenVideos,
  topPicks,
  topics,
  lectureCategories,
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
  onViewModeChange,
  onToggleFavoritesOnly,
  onToggleLectureCategories,
  onToggleFavorite,
  onHideVideo,
  onUnhideVideo,
  onStatsModalOpenChange,
  selectedStyle,
  onStyleChange,
  dockSlot,
}: LecturesVideoGridViewProps) {
  const params = useParams()
  const slug = useMemo(() => {
    const raw = params?.category
    if (typeof raw === "string") return raw.toLowerCase()
    if (Array.isArray(raw) && raw.length > 0) return String(raw[0]).toLowerCase()
    return undefined
  }, [params])

  /** Derive the active quick-link card ID from filter state and active slug. */
  const activeQuickLinkId = useMemo(() => {
    if (showFavoritesOnly) return "favorites"
    if (currentCategory === "topPicks") return "topPicks"
    
    // Map selected debate style to highlight the respective quick links
    if (selectedStyle === 1) return "policy"
    if (selectedStyle === 2) return "pf"
    if (selectedStyle === 3) return "ld"
    if (selectedStyle === 4) return "college"
    
    // Highlight "lectures" only when the slug is explicitly "lectures"
    if (slug === "lectures") {
      return "lectures"
    }
    
    return undefined
  }, [showFavoritesOnly, currentCategory, selectedStyle, slug])

  const searchBarNode = (stacked: boolean) => (
    <VideoSearchBar
      searchTerm={searchTerm}
      sortOrder={sortOrder}
      isSearchFocused={isSearchFocused}
      showThumbnails={showThumbnails}
      viewMode={viewMode}
      onViewModeChange={onViewModeChange}
      showFavoritesOnly={showFavoritesOnly}
      selectedYear={selectedYear}
      onYearChange={onYearChange}
      facets={facets}
      onSearchChange={onSearchChange}
      onSearchFocus={onSearchFocus}
      onSearchBlur={onSearchBlur}
      onClearSearch={onClearSearch}
      onSortChange={onSortChange}
      onToggleThumbnails={onToggleThumbnails}
      onToggleFavoritesOnly={onToggleFavoritesOnly}
      totalVideos={totalVideos}
      stacked={stacked}
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
  )

  const showLectureGallery =
    showLectureCategories && currentCategory === "lectures" && !selectedStyle && lectureCategories.length > 0

  return (
    <div className="min-h-screen bg-background flex">
      {/* Persistent left sidebar (md+): app dock, search controls, video
          categories, lecture categories, footer. Below md the same controls
          render inline above the grid instead — see the mobile block below.
          `min-w-0` keeps every child bound to this column; the dock arrives
          in `dockSlot` already sized to the column rather than to its own
          contents, so it can't reach across the border onto the grid. */}
      <aside className="hidden md:flex md:w-[300px] lg:w-[320px] md:shrink-0 md:min-w-0 md:flex-col md:h-screen md:sticky md:top-0 md:overflow-y-auto md:border-r md:border-border/60 md:bg-background/40 gap-4 p-3">
        {dockSlot}

        {searchBarNode(true)}

        <VideoSidebarTree
          counts={quickLinkCounts}
          lectureCategories={lectureCategories}
          selectedCategory={selectedCategory}
          activeId={activeQuickLinkId}
          lecturesExpanded={showLectureCategories}
          onToggleLectures={onToggleLectureCategories}
        />

        <Footer />
      </aside>

      <div className="min-w-0 flex-1 p-3 sm:p-6">
        {/* Mobile-only controls (sidebar above is md+ only) */}
        <div className="md:hidden">
          <StickyHeader controls={searchBarNode(false)} />

          <QuickLinksGrid
            counts={quickLinkCounts}
            showLectures={showLectureCategories}
            onToggleLectures={onToggleLectureCategories}
            activeId={activeQuickLinkId}
          />

          {showLectureGallery && (
            <div className="mb-8">
              <LectureCategoryGridGallery
                categories={lectureCategories}
                selectedCategory={selectedCategory}
              />
            </div>
          )}

          <Footer />
        </div>

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
            {viewMode === "list" ? (
              <VideoListRows
                videos={currentVideos}
                videoContainerRef={videoContainerRef}
                favorites={favorites}
                onToggleFavorite={onToggleFavorite}
                onHideVideo={onHideVideo}
                onUnhideVideo={onUnhideVideo}
                hiddenVideos={hiddenVideos}
                topPicks={topPicks}
              />
            ) : (
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
            )}

            <div ref={loadMoreTriggerRef} className="h-10" />

            {isLoadingMore && (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Loading more...</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
