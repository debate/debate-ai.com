/**
 * @fileoverview Lectures page coordinator.
 *
 * Manages filter state, URL sync, and slug-based routing for the /videos and
 * /videos/[category] routes, pages videos in from `/api/videos` through
 * {@link useVideoFeed}, then delegates rendering to one of three branch views:
 *
 * - {@link LeaderboardPanel} — when the active category is `"leaderboard"`
 * - {@link LecturesDictionaryView} — when the active category is `"dictionary"`
 * - {@link LecturesVideoGridView} — for all lecture/video categories
 * @module components/debate/DebateVideos/panels/LecturesPage
 */

"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams, useParams, useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { getYoutubeStats } from "debate-api-client"
import { apiClient } from "../lib/api-client"
import { normalizeCategoryKey } from "debate-data-sync/src/videos/video-rows"
import type { CategoryType, DebateStyle, VideoType } from "../types/videos"
import { Footer } from "../ui/layout/footer"
import { LeaderboardPanel } from "./leaderboard/RankingsLeaderboardPanel"
import { LeaderboardFilterBar } from "./leaderboard/LeaderboardFilterBar"
import type { Division } from "./leaderboard/leaderboardUtils"
import { setStateInURL } from "../ui/lib/utils"
import { StickyHeader } from "../components/layout/StickyHeader"
import { SLUG_MAP } from "./lectureRouteConfig"
import { LecturesDictionaryView } from "./dictionary/LecturesDictionaryView"
import { LecturesVideoGridView } from "./LecturesVideoGridView"

// Hooks
import { useVideoState } from "../hooks/useVideoState"
import { useVideoFeed, useVideoMeta, type VideoFeedFilters } from "../hooks/useVideoFeed"
import { useInfiniteScroll } from "../hooks/useInfiniteScroll"
import { useVideoPlayerStore } from "../state/videoPlayerStore"

/** Number of entries in the debate dictionary, shown on its quick-link card. */
const DICTIONARY_ENTRY_COUNT = 203

/** Props for the {@link LecturesPage} component. */
interface LecturesPageProps {
  /**
   * App-owned navigation dock, forwarded to {@link LecturesVideoGridView} for
   * the top of its persistent left sidebar (md+ only). Omitted for the
   * leaderboard and dictionary branches, which keep their own top layout.
   */
  dockSlot?: React.ReactNode
}

/**
 * Lectures page — top-level coordinator for the /videos route family.
 *
 * All filter state lives here; the videos themselves are paged in from the
 * API, and rendering is delegated to the three branch view components
 * depending on `state.currentCategory`.
 */
export function LecturesPage({ dockSlot }: LecturesPageProps = {}) {
  const searchParams = useSearchParams()
  const routeParams = useParams()

  // ---------------------------------------------------------------------------
  // Slug / route state
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Core video state and search handler
  // ---------------------------------------------------------------------------

  const { state, actions } = useVideoState(initialCategory)
  const setSearchHandler = useVideoPlayerStore((state) => state.setSearchHandler)
  const { meta, counts, lectureCategories } = useVideoMeta()

  // ---------------------------------------------------------------------------
  // UI state
  // ---------------------------------------------------------------------------

  const [dictSearchTerm, setDictSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [showLectureCategories, setShowLectureCategories] = useState(true)
  const [statsModalOpen, setStatsModalOpen] = useState(false)
  const [youtubeStats, setYoutubeStats] = useState<any>(null)

  // ---------------------------------------------------------------------------
  // Quick-link counts (per-category video tallies for navigation cards)
  // ---------------------------------------------------------------------------

  const quickLinkCounts = useMemo(
    () =>
      ({
        lectures: counts.lectures,
        policy: counts.byStyle[1] ?? 0,
        ld: counts.byStyle[3] ?? 0,
        pf: counts.byStyle[2] ?? 0,
        college: counts.byStyle[4] ?? 0,
        topPicks: counts.topPicks,
        favorites: state.favorites.size,
        rankings: 4,
        statistics: counts.total,
        dictionary: DICTIONARY_ENTRY_COUNT,
      }) as Record<string, number>,
    [counts, state.favorites],
  )

  // Leaderboard states managed at page level for top-bar sticky header integration
  const router = useRouter()
  const initialDivision = useMemo(() => {
    const f = searchParams.get("format")
    return f && ["VPF", "VLD", "VCX", "NDT"].includes(f) ? (f as Division) : "VPF"
  }, [searchParams])

  const [leaderboardDivision, setLeaderboardDivision] = useState<Division>(initialDivision)
  const [leaderboardYear, setLeaderboardYear] = useState("2026")

  const leaderboardYears = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const maxYear = Math.max(currentYear, 2026)
    return Array.from({ length: maxYear - 2001 }, (_, i) => String(maxYear - i))
  }, [])

  const handleDivisionChange = useCallback((val: Division) => {
    setLeaderboardDivision(val)
    const params = new URLSearchParams(searchParams.toString())
    params.set("format", val)
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [searchParams, router])

  useEffect(() => {
    getYoutubeStats({}, { client: apiClient }).then(({ data, error }) => {
      if (error) {
        console.error("Failed to load YouTube stats:", error)
        return
      }
      setYoutubeStats(data)
    })
  }, [])

  // Initialize state from URL parameters on mount
  useEffect(() => {
    const urlState = setStateInURL<{
      q?: string; category?: string; favorites?: string
      style?: string; stats?: string; sort?: string; year?: string
    }>()
    if (urlState) {
      if (urlState.q) actions.setSearchTerm(urlState.q)
      if (urlState.category) setSelectedCategory(urlState.category)
      if (urlState.favorites === "1") actions.setShowFavoritesOnly(true)
      if (urlState.style) actions.setSelectedStyle(Number(urlState.style) as DebateStyle)
      if (urlState.stats === "1") setStatsModalOpen(true)
      if (urlState.sort) actions.setSortOrder(urlState.sort)
      if (urlState.year) actions.setSelectedYear(urlState.year)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------------------
  // Category management
  // ---------------------------------------------------------------------------

  // React to slug changes: apply the slug's state overrides. The first run is
  // tracked so landing on `/videos?view=dictionary` (no slug) keeps the view
  // the URL asked for, while later navigation back to `/videos` resets it.
  const didMountRef = useRef(false)

  useEffect(() => {
    const isFirstRun = !didMountRef.current
    didMountRef.current = true

    if (slugState) {
      actions.setSelectedStyle(slugState.style ?? "")
      actions.setShowFavoritesOnly(!!slugState.favorites)
      setStatsModalOpen(!!slugState.stats)
      const nextView: CategoryType = slugState.view ?? "lectures"
      actions.setCurrentCategory(nextView)
      setSelectedCategory("all")
      if (nextView !== "lectures") setShowLectureCategories(false)
      scrollToVideos()
    } else if (slug) {
      // Unknown slug → treat as lecture-category id
      actions.setSelectedStyle("")
      actions.setShowFavoritesOnly(false)
      setStatsModalOpen(false)
      actions.setCurrentCategory("lectures")
      setSelectedCategory(slug)
      scrollToVideos()
      setShowLectureCategories(true)
    } else {
      actions.setSelectedStyle("")
      actions.setShowFavoritesOnly(false)
      setStatsModalOpen(false)
      setSelectedCategory("all")
      if (!isFirstRun) actions.setCurrentCategory("lectures")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  // Sync ?category= from URL (legacy query-string form)
  useEffect(() => {
    const urlCategory = searchParams.get("category")
    if (urlCategory) {
      setSelectedCategory(urlCategory)
      scrollToVideos()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // ---------------------------------------------------------------------------
  // Feed
  // ---------------------------------------------------------------------------

  const favoriteIds = useMemo(
    () => (state.showFavoritesOnly ? Array.from(state.favorites) : null),
    [state.showFavoritesOnly, state.favorites],
  )

  const isVideoCategory =
    state.currentCategory !== "leaderboard" && state.currentCategory !== "dictionary"

  const filters: VideoFeedFilters = {
    source: "all",
    // "All Lectures" means everything without a numeric debate style — rounds
    // surface through the style filter and the category tabs instead.
    lecturesOnly:
      state.currentCategory === "lectures" &&
      selectedCategory === "all" &&
      !state.selectedStyle,
    topPicksOnly: state.currentCategory === "topPicks",
    categoryKey: selectedCategory === "all" ? null : normalizeCategoryKey(selectedCategory),
    style: state.selectedStyle,
    year: state.selectedYear,
    sort: state.sortOrder,
    q: state.searchTerm,
    ids: favoriteIds,
    withFacets: true,
    enabled: isVideoCategory,
  }

  const feed = useVideoFeed(filters)

  const currentVideos = useMemo<VideoType[]>(() => {
    if (state.searchTerm.trim() || state.hiddenVideos.size === 0) return feed.videos
    return feed.videos.filter((video) => !state.hiddenVideos.has(video[0]))
  }, [feed.videos, state.hiddenVideos, state.searchTerm])

  const topPicksSet = useMemo(
    () => new Set(feed.videos.filter((video) => video[15] === true).map((video) => video[0])),
    [feed.videos],
  )

  // ---------------------------------------------------------------------------
  // Scroll-to-videos on category/slug change
  // ---------------------------------------------------------------------------

  const videosSectionRef = useRef<HTMLDivElement | null>(null)
  const pendingScrollRef = useRef(false)

  function scrollToVideos() {
    pendingScrollRef.current = true
  }

  useEffect(() => {
    if (!pendingScrollRef.current || feed.isLoading || currentVideos.length === 0) return
    pendingScrollRef.current = false
    requestAnimationFrame(() => {
      videosSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [feed.isLoading, currentVideos.length])

  // ---------------------------------------------------------------------------
  // Search & filter handlers
  // ---------------------------------------------------------------------------

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

  const handleYearChange = useCallback(
    (value: string) => {
      actions.setSelectedYear(value)
      setStateInURL({ year: value || null })
    },
    [actions.setSelectedYear],
  )

  const handleSortChange = useCallback(
    (value: string) => {
      actions.setSortOrder(value)
      setStateInURL({ sort: value || null })
    },
    [actions.setSortOrder],
  )

  const handleToggleThumbnails = useCallback(
    () => { actions.setShowThumbnails(!state.showThumbnails) },
    [actions.setShowThumbnails, state.showThumbnails],
  )

  // ---------------------------------------------------------------------------
  // Infinite scroll
  // ---------------------------------------------------------------------------

  useInfiniteScroll(
    state.loadMoreTriggerRef,
    feed.hasMore,
    feed.isLoading || feed.isLoadingMore,
    feed.loadMore,
  )

  // ---------------------------------------------------------------------------
  // Shared back button
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Branch rendering
  // ---------------------------------------------------------------------------

  if (state.currentCategory === "leaderboard") {
    return (
      <div className="min-h-screen bg-background p-3 sm:p-6 flex flex-col justify-between">
        <div>
          <StickyHeader
            controls={
              <div className="flex flex-row items-center gap-3 w-full justify-between sm:justify-start">
                {backButton}
                <LeaderboardFilterBar
                  division={leaderboardDivision}
                  year={leaderboardYear}
                  years={leaderboardYears}
                  onChangeDivision={handleDivisionChange}
                  onChangeYear={setLeaderboardYear}
                />
              </div>
            }
          />
          <LeaderboardPanel
            controlledDivision={leaderboardDivision}
            controlledYear={leaderboardYear}
            onControlledDivisionChange={handleDivisionChange}
            onControlledYearChange={setLeaderboardYear}
            history={meta?.history}
          />
        </div>
        <Footer />
      </div>
    )
  }

  if (state.currentCategory === "dictionary") {
    return (
      <LecturesDictionaryView
        dictSearchTerm={dictSearchTerm}
        onDictSearchTermChange={setDictSearchTerm}
      />
    )
  }

  return (
    <LecturesVideoGridView
      searchTerm={state.searchTerm}
      sortOrder={state.sortOrder}
      selectedYear={state.selectedYear}
      isSearchFocused={state.isSearchFocused}
      showThumbnails={state.showThumbnails}
      viewMode={state.viewMode}
      showFavoritesOnly={state.showFavoritesOnly}
      currentCategory={state.currentCategory}
      totalVideos={feed.total}
      facets={feed.facets}
      isLoading={feed.isLoading}
      errorMessage={feed.errorMessage}
      isLoadingMore={feed.isLoadingMore}
      currentVideos={currentVideos}
      favorites={state.favorites}
      hiddenVideos={state.hiddenVideos}
      topPicks={topPicksSet}
      topics={meta?.topics}
      lectureCategories={lectureCategories}
      loadMoreTriggerRef={state.loadMoreTriggerRef}
      videoContainerRef={state.videoContainerRef}
      videosSectionRef={videosSectionRef}
      quickLinkCounts={quickLinkCounts}
      showLectureCategories={showLectureCategories}
      selectedCategory={selectedCategory}
      youtubeStats={youtubeStats}
      statsModalOpen={statsModalOpen}
      onSearchChange={handleSearchChange}
      onSearchFocus={() => actions.setIsSearchFocused(true)}
      onSearchBlur={() => actions.setIsSearchFocused(false)}
      onClearSearch={handleClearSearch}
      onSortChange={handleSortChange}
      onYearChange={handleYearChange}
      onToggleThumbnails={handleToggleThumbnails}
      onViewModeChange={actions.setViewMode}
      onToggleFavoritesOnly={() => actions.setShowFavoritesOnly(!state.showFavoritesOnly)}
      onToggleLectureCategories={() => setShowLectureCategories((v) => !v)}
      onToggleFavorite={actions.toggleFavorite}
      onHideVideo={actions.hideVideo}
      onUnhideVideo={actions.unhideVideo}
      onStatsModalOpenChange={setStatsModalOpen}
      selectedStyle={state.selectedStyle}
      onStyleChange={(style) => {
        actions.setSelectedStyle(style)
        setStateInURL({ style: style ? String(style) : null })
      }}
      dockSlot={dockSlot}
    />
  )
}
