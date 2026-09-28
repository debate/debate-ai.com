/**
 * @fileoverview Lectures page coordinator.
 *
 * Manages filter state, URL sync, and slug-based routing for the /videos and
 * /videos/[category] routes, pages videos in from `/api/videos` through
 * {@link useVideoFeed}, then delegates rendering to one of four branch views:
 *
 * - {@link LeaderboardPanel} — when the active category is `"leaderboard"`
 * - {@link LecturesDictionaryView} — when the active category is `"dictionary"`
 * - {@link StatisticsPage} — when the active category is `"statistics"`
 * - {@link LecturesVideoGridView} — for all lecture/video categories, the
 *   watch history (`"history"`) included: it is the same listing over an
 *   explicit id allow-list, the way My Favorites is.
 * @module components/debate/DebateVideos/panels/LecturesPage
 */

"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams, useParams, useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { normalizeCategoryKey } from "debate-data-sync/src/videos/video-rows"
import { MAX_VIDEO_PAGE_SIZE } from "debate-data-sync/src/videos/video-query"
import type { CategoryType, DebateStyle } from "../types/videos"
import { Footer } from "../ui/layout/footer"
import { LeaderboardPanel } from "./leaderboard/RankingsLeaderboardPanel"
import { LeaderboardFilterBar } from "./leaderboard/LeaderboardFilterBar"
import type { LeaderboardTab } from "./leaderboard/leaderboardUtils"
import { VALID_LEADERBOARD_TABS, currentSeasonYear, seasonYears } from "./leaderboard/leaderboardUtils"
import { setStateInURL } from "../ui/lib/utils"
import { StickyHeader } from "../components/layout/StickyHeader"
import { SLUG_MAP } from "./lectureRouteConfig"
import { LecturesDictionaryView } from "./dictionary/LecturesDictionaryView"
import { LecturesSidebarShell } from "./LecturesSidebarShell"
import { LecturesVideoGridView } from "./LecturesVideoGridView"
import { StatisticsPage } from "./statistics/StatisticsPage"

// Hooks
import { useVideoState } from "../hooks/useVideoState"
import { useVideoFeed, useVideoMeta, type VideoFeedFilters } from "../hooks/useVideoFeed"
import { useInfiniteScroll } from "../hooks/useInfiniteScroll"
import { useYouTubeStats } from "../hooks/useYouTubeStats"
import { useVideoPlayerStore } from "../state/videoPlayerStore"
import { useWatchHistory } from "../hooks/useWatchHistory"

/** Number of entries in the debate dictionary, shown on its quick-link card. */
const DICTIONARY_ENTRY_COUNT = 203

/** Props for the {@link LecturesPage} component. */
interface LecturesPageProps {
  /**
   * App-owned navigation dock, rendered at the top of the persistent left
   * sidebar (md+ only) — by {@link LecturesVideoGridView} on the grid, and by
   * {@link LecturesSidebarShell} on the rankings and glossary branches, which
   * keep their own *content* layout but share that column. They used to drop
   * it, which left both with no dock and no nav tree at all.
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
    if (view === "statistics") return "statistics"
    return "lectures"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------------------
  // Core video state and search handler
  // ---------------------------------------------------------------------------

  const { state, actions } = useVideoState(initialCategory)
  const setSearchHandler = useVideoPlayerStore((state) => state.setSearchHandler)

  // ---------------------------------------------------------------------------
  // UI state
  // ---------------------------------------------------------------------------

  const [dictSearchTerm, setDictSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [showLectureCategories, setShowLectureCategories] = useState(true)
  const [statsModalOpen, setStatsModalOpen] = useState(false)
  const youtubeStats = useYouTubeStats()

  // Leaderboard states managed at page level for top-bar sticky header integration
  const router = useRouter()
  const initialDivision = useMemo(() => {
    const f = searchParams.get("format")
    return f && VALID_LEADERBOARD_TABS.has(f) ? (f as LeaderboardTab) : "VPF"
  }, [searchParams])

  const [leaderboardDivision, setLeaderboardDivision] = useState<LeaderboardTab>(initialDivision)
  const [leaderboardYear, setLeaderboardYear] = useState(() => String(currentSeasonYear()))

  const leaderboardYears = useMemo(() => seasonYears(), [])

  const handleDivisionChange = useCallback((val: LeaderboardTab) => {
    setLeaderboardDivision(val)
    const params = new URLSearchParams(searchParams.toString())
    params.set("format", val)
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [searchParams, router])

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
      // A style route still uses the shared "lectures" grid view internally,
      // but it is a round-archive destination.  Do not leave the Lectures
      // section expanded/looking selected after clicking College, Policy, PF,
      // or LD merely because that implementation detail says "lectures".
      setShowLectureCategories(nextView === "lectures" && !slugState.style)
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

  // Watch history. The listing is the library filtered to an explicit id
  // allow-list — the same mechanism as My Favorites — because the history
  // itself stores only the id, position and title, not the video's channel,
  // category or season, which the listing's columns need.
  const watchHistory = useWatchHistory()

  const isHistory = state.currentCategory === "history"

  /**
   * The videos to list, newest-watched first. An empty array still filters:
   * a history with nothing in it must list nothing rather than everything.
   */
  const historyIds = useMemo<string[] | null>(() => {
    if (!isHistory) return null
    return [...watchHistory.values()]
      .sort((a, b) => b.watchedAt.localeCompare(a.watchedAt))
      .map((entry) => entry.videoId)
  }, [isHistory, watchHistory])

  const isVideoCategory =
    state.currentCategory !== "leaderboard" &&
    state.currentCategory !== "dictionary" &&
    state.currentCategory !== "statistics"

  // Hidden videos are a browser-local preference; an explicit search still
  // surfaces them, as it always has, so the deny-list is only sent while not
  // searching — otherwise a hidden video could never be found again to unhide.
  const excludeIds = useMemo(
    () => (state.searchTerm.trim() || state.hiddenVideos.size === 0 ? null : Array.from(state.hiddenVideos)),
    [state.searchTerm, state.hiddenVideos],
  )

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
    // The history spans both libraries, and is the allow-list itself rather
    // than a narrowing of a category — which is why nothing above needs a
    // `history` case: its slug leaves the style, category and favourites
    // filters at their defaults.
    ids: historyIds ?? favoriteIds,
    excludeIds,
    // One request for the whole history, where it fits: the server answers an
    // allow-list in the *library's* order, so a history spread over pages
    // reads in publish order until the last page lands (the re-sort below
    // only orders what is loaded). The store caps itself at 500 entries, so
    // this is the whole thing for all but the heaviest viewers.
    pageSize: isHistory ? MAX_VIDEO_PAGE_SIZE : undefined,
    withFacets: true,
    enabled: isVideoCategory,
  }

  // Search chips must describe the active library category rather than the
  // whole archive. The hook deliberately ignores the typed search term.
  const { meta, counts, lectureCategories, suggestions } = useVideoMeta(filters)
  const feed = useVideoFeed(filters)

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
        history: watchHistory.size,
        rankings: 4,
        statistics: counts.total,
        dictionary: DICTIONARY_ENTRY_COUNT,
      }) as Record<string, number>,
    [counts, state.favorites, watchHistory],
  )

  // The feed returns the allow-list in the library's own order; the history
  // reads newest-watched first, which only this side knows.
  const currentVideos = useMemo(() => {
    if (!isHistory) return feed.videos
    const rank = new Map(historyIds?.map((videoId, index) => [videoId, index]))
    return [...feed.videos].sort(
      (a, b) => (rank.get(a[0]) ?? Infinity) - (rank.get(b[0]) ?? Infinity),
    )
  }, [isHistory, feed.videos, historyIds])

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

  // `atCapacity` stops the automatic paging at `MAX_LOADED_VIDEOS`: past that
  // the next page comes from the button in `LecturesVideoGridView`, which the
  // user has to press. Scrolling on its own can no longer grow the grid past
  // the point where the page stops responding.
  useInfiniteScroll(
    state.loadMoreTriggerRef,
    feed.hasMore && !feed.atCapacity,
    feed.isLoading || feed.isLoadingMore,
    feed.loadMore,
  )

  const handleLoadMore = useCallback(() => feed.loadMore({ force: true }), [feed.loadMore])

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

  // Both branches below are wrapped in the same sidebar the grid renders, so
  // a tree link into either one lands on a page you can navigate out of.
  // `sidebarShellProps` is shared between them rather than spelled twice.
  const sidebarShellProps = {
    dockSlot,
    counts: quickLinkCounts,
    lectureCategories,
    selectedCategory,
    lecturesExpanded: showLectureCategories,
    onToggleLectures: () => setShowLectureCategories((shown) => !shown),
  }

  if (state.currentCategory === "leaderboard") {
    return (
      <LecturesSidebarShell {...sidebarShellProps} activeId="rankings">
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
      </LecturesSidebarShell>
    )
  }

  if (state.currentCategory === "dictionary") {
    return (
      <LecturesSidebarShell {...sidebarShellProps} activeId="dictionary">
        <LecturesDictionaryView
          dictSearchTerm={dictSearchTerm}
          onDictSearchTermChange={setDictSearchTerm}
        />
      </LecturesSidebarShell>
    )
  }

  if (state.currentCategory === "statistics") {
    return (
      <LecturesSidebarShell {...sidebarShellProps} activeId="statistics">
        <StatisticsPage topics={meta?.topics} youtubeStats={youtubeStats} />
      </LecturesSidebarShell>
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
      stackedPlaylists={state.stackedPlaylists}
      currentCategory={state.currentCategory}
      totalVideos={feed.total}
      facets={feed.facets}
      searchSuggestions={suggestions}
      isLoading={feed.isLoading}
      errorMessage={feed.errorMessage}
      isLoadingMore={feed.isLoadingMore}
      atCapacity={feed.atCapacity}
      onLoadMore={handleLoadMore}
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
      onToggleStackedPlaylists={() => actions.setStackedPlaylists(!state.stackedPlaylists)}
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
