/**
 * @fileoverview Lectures page coordinator.
 *
 * Manages all state, data-fetching, URL sync, and slug-based routing for
 * the /videos and /videos/[category] routes, then delegates rendering to
 * one of three branch views:
 *
 * - {@link LeaderboardPanel} — when the active category is `"leaderboard"`
 * - {@link LecturesDictionaryView} — when the active category is `"dictionary"`
 * - {@link LecturesVideoGridView} — for all lecture/video categories
 * @module components/debate/DebateVideos/panels/LecturesPage
 */

"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams, useParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import type { CategoryType, DebateStyle, DebateVideosData } from "@/lib/types/videos"
import { Footer } from "@/components/debate/DebateCardSearch/Footer"
import { LeaderboardPanel } from "./leaderboard/RankingsLeaderboardPanel"
import { setStateInURL } from "@/lib/utils"
import { StickyHeader } from "../components/layout/StickyHeader"
import { SLUG_MAP } from "./lectureRouteConfig"
import { LecturesDictionaryView } from "./dictionary/LecturesDictionaryView"
import { LecturesVideoGridView } from "./LecturesVideoGridView"

// Hooks
import { useVideoState } from "../hooks/useVideoState"
import { useVideoDataFetch, useVideoFiltering, useResponsiveVideosPerPage } from "../hooks/useVideoData"
import { useInfiniteScroll } from "../hooks/useInfiniteScroll"
import { useVideoPlayerStore } from "@/lib/state/videoPlayerStore"

/**
 * Lectures page — top-level coordinator for the /videos route family.
 *
 * All state lives here; rendering is delegated to the three branch view
 * components depending on `state.currentCategory`.
 */
export function LecturesPage() {
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

  const topPicksSet = useMemo(
    () => new Set(state.debateVideos?.topPicks || []),
    [state.debateVideos?.topPicks],
  )

  // ---------------------------------------------------------------------------
  // Quick-link counts (per-category video tallies for navigation cards)
  // ---------------------------------------------------------------------------

  const quickLinkCounts = useMemo(() => {
    const data = state.debateVideos
    if (!data) return {} as Record<string, number>
    const rounds = data.rounds || []
    const lectures = data.lectures || []
    const all = [...rounds, ...lectures]
    const byStyle = (n: number) => all.filter((v) => v[6] === n).length
    const favSet = state.favorites
    return {
      lectures: lectures.length,
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

  // ---------------------------------------------------------------------------
  // UI state
  // ---------------------------------------------------------------------------

  const [dictSearchTerm, setDictSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [showLectureCategories, setShowLectureCategories] = useState(false)
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
  // Scroll-to-videos on category/slug change
  // ---------------------------------------------------------------------------

  const videosSectionRef = useRef<HTMLDivElement | null>(null)
  const pendingScrollRef = useRef(false)

  const scrollToVideos = useCallback(() => {
    pendingScrollRef.current = true
  }, [])

  useEffect(() => {
    if (!pendingScrollRef.current || state.isLoading || state.filteredVideos.length === 0) return
    pendingScrollRef.current = false
    requestAnimationFrame(() => {
      videosSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [state.isLoading, state.filteredVideos.length])

  // Sync ?category= from URL (legacy query-string form)
  useEffect(() => {
    const urlCategory = searchParams.get("category")
    if (urlCategory) {
      setSelectedCategory(urlCategory)
      scrollToVideos()
    }
  }, [searchParams])

  // ---------------------------------------------------------------------------
  // Category management
  // ---------------------------------------------------------------------------

  const changeCategory = useCallback(
    (category: CategoryType, data: DebateVideosData) => {
      actions.setCurrentCategory(category)
      actions.setCurrentPage(1)

      if (category === "lectures") {
        actions.setAllVideos([...(data.lectures || []), ...(data.rounds || [])])
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

  // React to slug changes: apply the slug's state overrides when data is available
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
      if (nextView !== "lectures") setShowLectureCategories(false)
      scrollToVideos()
    } else if (slug) {
      // Unknown slug → treat as lecture-category id
      actions.setSelectedStyle("")
      actions.setShowFavoritesOnly(false)
      setStatsModalOpen(false)
      if (data) changeCategory("lectures", data)
      else actions.setCurrentCategory("lectures")
      setSelectedCategory(slug)
      scrollToVideos()
      setShowLectureCategories(true)
    } else {
      actions.setSelectedStyle("")
      actions.setShowFavoritesOnly(false)
      setStatsModalOpen(false)
      setSelectedCategory("all")
      if (data && state.currentCategory !== "lectures") changeCategory("lectures", data)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, state.debateVideos])

  // ---------------------------------------------------------------------------
  // Data fetching & filtering
  // ---------------------------------------------------------------------------

  const { filterAndSortVideos } = useVideoFiltering()

  useVideoDataFetch(
    actions.setDebateVideos, actions.setIsLoading,
    actions.setErrorMessage, changeCategory, initialCategory,
  )
  useResponsiveVideosPerPage(actions.setVideosPerPage)

  useEffect(() => {
    let filtered = filterAndSortVideos(
      state.allVideos, state.searchTerm, state.sortOrder, state.selectedYear,
      state.debateVideos, state.showFavoritesOnly, state.favorites,
      state.selectedStyle, state.hiddenVideos,
    )

    // "All Lectures" shows only lecture videos (string category at index 6), not rounds (numeric style).
    if (state.currentCategory === "lectures" && selectedCategory === "all" && !state.selectedStyle) {
      filtered = filtered.filter((video) => typeof video[6] !== "number")
    }

    // Apply the selected lecture sub-category filter
    if (selectedCategory !== "all") {
      filtered = filtered.filter((video) => {
        const cat = video[6]
        if (typeof cat !== "string") return false
        const key = cat.toLowerCase().replace(/\s+/g, "_").replace(/[&/]/g, "_")
        return cat === selectedCategory || key === selectedCategory
      })
    }

    actions.setFilteredVideos(filtered)
    actions.setCurrentPage(1)
  }, [
    state.allVideos, state.searchTerm, state.sortOrder, state.selectedYear,
    state.debateVideos, state.showFavoritesOnly, state.favorites,
    state.selectedStyle, state.hiddenVideos, state.currentCategory,
    selectedCategory, filterAndSortVideos, actions.setFilteredVideos, actions.setCurrentPage,
  ])

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

  const totalPages = Math.ceil(state.filteredVideos.length / state.videosPerPage)
  const endIndex = state.currentPage * state.videosPerPage
  const currentVideos = state.filteredVideos.slice(0, endIndex)

  useInfiniteScroll(
    state.loadMoreTriggerRef,
    state.currentPage,
    totalPages,
    state.isLoadingMore,
    actions.setCurrentPage,
    actions.setIsLoadingMore,
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
          <StickyHeader controls={backButton} />
          <LeaderboardPanel history={state.debateVideos?.history} />
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
      showFavoritesOnly={state.showFavoritesOnly}
      currentCategory={state.currentCategory}
      totalVideos={state.filteredVideos.length}
      isLoading={state.isLoading}
      errorMessage={state.errorMessage}
      isLoadingMore={state.isLoadingMore}
      allVideos={state.allVideos}
      currentVideos={currentVideos}
      favorites={state.favorites}
      hiddenVideos={state.hiddenVideos}
      topPicks={topPicksSet}
      topics={state.debateVideos?.topics}
      debateLectures={state.debateVideos?.lectures}
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
    />
  )
}
