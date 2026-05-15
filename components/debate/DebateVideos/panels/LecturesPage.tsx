/**
 * @fileoverview Lectures page - shows lecture videos with a Dictionary toggle button.
 */

"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams, useParams } from "next/navigation"
import { ArrowLeft, Search, X } from "lucide-react"
import type { CategoryType, DebateStyle, DebateVideosData } from "@/lib/types/videos"
import { YouTubeStatsModal } from "../components/youtube-stats-modal/YouTubeStatsModal"
import { Input } from "@/components/ui/input"
import { DictionaryPanel } from "./DictionaryPanel"
import { Footer } from "@/components/debate/DebateCardSearch/Footer"
import { LeaderboardPanel } from "./RankingsLeaderboardPanel"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { setStateInURL } from "@/lib/utils"

// Hooks
import { useVideoState } from "../hooks/useVideoState"
import { useVideoDataFetch, useVideoFiltering, useResponsiveVideosPerPage } from "../hooks/useVideoData"
import { useInfiniteScroll } from "../hooks/useInfiniteScroll"

// Components
import { VideoSearchBar } from "../components/video-search/VideoSearchBar"
import { VideoGrid } from "../components/video-grid/VideoGrid"
import { LectureCategoryGridGallery } from "../components/category-gallery/LectureCategoryGridGallery"
import { QuickLinksGrid } from "../components/category-gallery/QuickLinksGrid"
import { useVideoPlayerStore } from "@/lib/state/videoPlayerStore"

/**
 * Path-slug → derived state for /videos/[category].
 * style: filters by DebateStyle. view: switches the active category.
 * favorites: enables favorites-only filter. stats: auto-opens the stats modal.
 */
const SLUG_MAP: Record<string, { style?: DebateStyle; view?: CategoryType; favorites?: boolean; stats?: boolean }> = {
  policy: { style: 1 },
  ld: { style: 3 },
  pf: { style: 2 },
  college: { style: 4 },
  toppicks: { view: "topPicks" },
  favoritedebates: { favorites: true },
  favoritelectures: { favorites: true, view: "lectures" },
  favorites: { favorites: true },
  dictionary: { view: "dictionary" },
  rankings: { view: "leaderboard" },
  statistics: { stats: true },
  stats: { stats: true },
}

export function LecturesPage() {
  const searchParams = useSearchParams()
  const routeParams = useParams()

  const slug = useMemo(() => {
    const raw = routeParams?.category
    if (typeof raw === "string") return raw.toLowerCase()
    if (Array.isArray(raw) && raw.length > 0) return String(raw[0]).toLowerCase()
    return undefined
  }, [routeParams])

  const slugState = useMemo(() => (slug ? SLUG_MAP[slug] : undefined), [slug])

  const initialCategory = useMemo<CategoryType>(() => {
    if (slugState?.view) return slugState.view
    const view = searchParams.get("view")
    if (view === "dictionary") return "dictionary"
    if (view === "topPicks") return "topPicks"
    if (view === "leaderboard") return "leaderboard"
    return "lectures"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // /videos/rankings → render leaderboard via existing handler below; no redirect needed.
  // Legacy: /videos?view=leaderboard also handled the same way.

  const { state, actions } = useVideoState(initialCategory)
  const setSearchHandler = useVideoPlayerStore((state) => state.setSearchHandler)

  const topPicksSet = useMemo(() => new Set(state.debateVideos?.topPicks || []), [state.debateVideos?.topPicks])

  // Compute per-category counts for the QuickLinks cards
  const quickLinkCounts = useMemo(() => {
    const data = state.debateVideos
    if (!data) return {} as Record<string, number>
    const rounds = data.rounds || []
    const lectures = data.lectures || []
    const all = [...rounds, ...lectures]
    const byStyle = (n: number) => all.filter((v) => v[6] === n).length
    const favSet = state.favorites
    return {
      policy: byStyle(1),
      ld: byStyle(3),
      pf: byStyle(2),
      college: byStyle(4),
      topPicks: data.topPicks?.length || 0,
      favorites: all.filter((v) => favSet.has(v[0])).length,
      rankings: 4,
      statistics: all.length,
      dictionary: 203,
    } as Record<string, number>
  }, [state.debateVideos, state.favorites])

  const [dictSearchTerm, setDictSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [statsModalOpen, setStatsModalOpen] = useState(false)
  const [youtubeStats, setYoutubeStats] = useState<any>(null)

  useEffect(() => {
    fetch("/api/youtube-stats")
      .then((res) => res.json())
      .then((data) => setYoutubeStats(data))
      .catch((err) => console.error("Failed to load YouTube stats:", err))
  }, [])

  // Initialize state from URL parameters on mount
  useEffect(() => {
    const urlState = setStateInURL<{ q?: string; category?: string; favorites?: string; style?: string; stats?: string }>()
    if (urlState) {
      if (urlState.q) actions.setSearchTerm(urlState.q)
      if (urlState.category) setSelectedCategory(urlState.category)
      if (urlState.favorites === "1") actions.setShowFavoritesOnly(true)
      if (urlState.style) actions.setSelectedStyle(Number(urlState.style) as DebateStyle)
      if (urlState.stats === "1") setStatsModalOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const videosSectionRef = useRef<HTMLDivElement | null>(null)

  const scrollToVideos = useCallback(() => {
    const el = videosSectionRef.current
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY + 400
    window.scrollTo({ top, behavior: "smooth" })
  }, [])

  // Sync ?category= from URL (legacy query-string form).
  useEffect(() => {
    const urlCategory = searchParams.get("category")
    if (urlCategory) {
      setSelectedCategory(urlCategory)
      scrollToVideos()
    }
  }, [searchParams])

  // React to path-slug changes so navigation between /videos/<slug> routes
  // (without unmounting the page) applies the new filter state.
  // Unknown slugs are treated as lecture-category ids (e.g. /videos/topic_lectures).
  useEffect(() => {
    const data = state.debateVideos
    if (slugState) {
      actions.setSelectedStyle(slugState.style ?? "")
      actions.setShowFavoritesOnly(!!slugState.favorites)
      setStatsModalOpen(!!slugState.stats)
      const nextView: CategoryType = slugState.view ?? "lectures"
      if (data) changeCategory(nextView, data)
      else actions.setCurrentCategory(nextView)
      setSelectedCategory("all")
      scrollToVideos()
    } else if (slug) {
      actions.setSelectedStyle("")
      actions.setShowFavoritesOnly(false)
      setStatsModalOpen(false)
      if (data) changeCategory("lectures", data)
      else actions.setCurrentCategory("lectures")
      setSelectedCategory(slug)
      scrollToVideos()
    } else {
      actions.setSelectedStyle("")
      actions.setShowFavoritesOnly(false)
      setStatsModalOpen(false)
      setSelectedCategory("all")
      if (data && state.currentCategory !== "lectures") changeCategory("lectures", data)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, state.debateVideos])

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
        const combined = [...(data.lectures || []), ...(data.rounds || [])]
        actions.setAllVideos(combined)
        actions.setIsLoading(false)
      } else if (category === "topPicks") {
        const topPickIds = new Set(data.topPicks || [])
        const all = [...(data.rounds || []), ...(data.lectures || [])]
        actions.setAllVideos(all.filter((v) => topPickIds.has(v[0])))
        actions.setIsLoading(false)
      } else {
        actions.setAllVideos([])
        actions.setFilteredVideos([])
        actions.setIsLoading(false)
      }
    },
    [actions.setCurrentCategory, actions.setAllVideos, actions.setFilteredVideos, actions.setIsLoading],
  )

  // ============================================================================
  // Data Fetching & Filtering
  // ============================================================================
  const { filterAndSortVideos } = useVideoFiltering()

  useVideoDataFetch(actions.setDebateVideos, actions.setIsLoading, actions.setErrorMessage, changeCategory, initialCategory)

  useResponsiveVideosPerPage(actions.setVideosPerPage)

  useEffect(() => {
    let filtered = filterAndSortVideos(state.allVideos, state.searchTerm, state.sortOrder, state.selectedYear, state.debateVideos, state.showFavoritesOnly, state.favorites, state.selectedStyle, state.hiddenVideos)

    // Apply category filter if one is selected
    if (selectedCategory !== "all") {
      // Filter by category label at index 6
      filtered = filtered.filter((video) => {
        const videoCategory = video[6];
        if (typeof videoCategory === 'string') {
          // Match by label directly or by normalized key
          const normalizedKey = videoCategory.toLowerCase().replace(/\s+/g, '_').replace(/[&/]/g, '_');
          return videoCategory === selectedCategory || normalizedKey === selectedCategory;
        }
        return false;
      });
    }

    actions.setFilteredVideos(filtered)
    actions.setCurrentPage(1)
  }, [state.allVideos, state.searchTerm, state.sortOrder, state.selectedYear, state.debateVideos, state.showFavoritesOnly, state.favorites, state.selectedStyle, state.hiddenVideos, selectedCategory, filterAndSortVideos, actions.setFilteredVideos, actions.setCurrentPage])

  // ============================================================================
  // Search & Filter Handlers
  // ============================================================================
  const handleSearchChange = useCallback((value: string) => {
    actions.setSearchTerm(value)
    setStateInURL({ q: value || null })
  }, [actions.setSearchTerm])

  // Register search handler with video player store
  useEffect(() => {
    setSearchHandler(handleSearchChange)
    return () => setSearchHandler(null)
  }, [handleSearchChange, setSearchHandler])

  const handleClearSearch = useCallback(() => {
    actions.setSearchTerm("")
    setStateInURL({ q: null })
  }, [actions.setSearchTerm])
  const handleSortChange = useCallback((value: string) => { actions.setSortOrder(value) }, [actions.setSortOrder])
  const handleToggleThumbnails = useCallback(() => { actions.setShowThumbnails(!state.showThumbnails) }, [actions.setShowThumbnails, state.showThumbnails])


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

  const isDictionary = state.currentCategory === "dictionary"

  const stickyHeader = (controls?: React.ReactNode) => (
    <div className="sm:sticky top-0 z-40 supports-backdrop-blur:bg-background/30 bg-background/80 backdrop-blur-lg border-b border-white/10 dark:border-white/5 -mx-3 sm:-mx-6 px-3 sm:px-6 py-2 mb-4 flex flex-wrap md:flex-nowrap items-center gap-2 md:justify-end">
      {controls && <div className="min-w-0 flex flex-wrap items-center gap-2">{controls}</div>}
    </div>
  )

  // ============================================================================
  // Dictionary Panel
  // ============================================================================
  // ============================================================================
  // Leaderboard Panel (/videos/rankings)
  // ============================================================================
  const backButton = (
    <Link
      href="/videos"
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background hover:bg-accent text-sm font-medium text-foreground transition-colors"
      aria-label="Back to lectures"
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </Link>
  )

  if (state.currentCategory === "leaderboard") {
    return (
      <div className="min-h-screen bg-background p-3 sm:p-6">
        {stickyHeader(backButton)}
        <LeaderboardPanel history={state.debateVideos?.history} />
      </div>
    )
  }

  if (isDictionary) {
    return (
      <div className="min-h-screen bg-background p-3 sm:p-6">
        {stickyHeader(
          <div className="flex items-center gap-2 w-full md:w-auto">
            {backButton}
            <div className="relative flex-1 min-w-0 md:w-[240px] md:flex-none">
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
          isSearchFocused={state.isSearchFocused}
          showThumbnails={state.showThumbnails}
          showFavoritesOnly={state.showFavoritesOnly}
          selectedYear={state.selectedYear}
          onYearChange={actions.setSelectedYear}
          allVideos={state.allVideos}
          hiddenVideos={state.hiddenVideos}
          onSearchChange={handleSearchChange}
          onSearchFocus={() => actions.setIsSearchFocused(true)}
          onSearchBlur={() => actions.setIsSearchFocused(false)}
          onClearSearch={handleClearSearch}
          onSortChange={handleSortChange}
          onToggleThumbnails={handleToggleThumbnails}
          onToggleFavoritesOnly={() => actions.setShowFavoritesOnly(!state.showFavoritesOnly)}
          totalVideos={state.filteredVideos.length}
          extraButtons={
            youtubeStats ? (
              <YouTubeStatsModal
                stats={youtubeStats}
                open={statsModalOpen}
                onOpenChange={setStatsModalOpen}
              />
            ) : null
          }
        />
      )}

      {/* Quick-link shortcuts to other panels */}
      <QuickLinksGrid counts={quickLinkCounts} />

      {/* Category Grid Gallery */}
      {state.debateVideos?.lectures && (
        <div className="mb-8">
          <LectureCategoryGridGallery
            videosData={state.debateVideos.lectures}
            selectedCategory={selectedCategory}
          />
          <Footer />
        </div>
      )}

      <div ref={videosSectionRef} className="scroll-mt-20" />

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
          <p className="text-muted-foreground">No videos found matching your filters.</p>
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
            showFullDate={true}
            showDescription={true}
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
