/**
 * @fileoverview Main video grid view for the lectures page.
 * Renders the floating search/filter control, quick-link navigation cards,
 * the lecture-category gallery, and the paginated video grid with
 * infinite-scroll trigger.
 * @module components/debate/DebateVideos/panels/LecturesVideoGridView
 */

"use client"

import React, { useMemo } from "react"
import { Globe as GlobeIcon, Mic, Users } from "lucide-react"
import { useParams, usePathname } from "next/navigation"
import { librarySlug } from "./lectureRouteConfig"
import type { CategoryType, TopicType, VideoFacets, VideoSuggestions } from "../types/videos"
import type { LectureCategoryFacet, VideoType } from "../types/videos"
import { Footer } from "../ui/layout/footer"
import { ResizableSidebarLayout } from "../ui/layout/ResizableSidebarLayout"
import { VideoSearchBar } from "../components/video-search/VideoSearchBar"
import { VideoSearchSuggestions } from "../components/video-search/VideoSearchSuggestions"
import { SubmitToLibraryButton } from "../components/video-search/SubmitToLibraryButton"
import { getSearchPhrases } from "../components/video-search/searchPhrases"
import { VideoGrid } from "../components/video-grid/VideoGrid"
import { VideoListRows } from "../components/video-grid/VideoListRows"
import { LectureCategoryGridGallery } from "../components/category-gallery/LectureCategoryGridGallery"
import { QuickLinksGrid } from "../components/category-gallery/QuickLinksGrid"
import { VideoSidebarTree } from "../components/category-gallery/VideoSidebarTree"
import { ToolNavTree } from "../components/category-gallery/ToolNavTree"
import { GoatSparklesHeading } from "../components/category-gallery/GoatSparklesHeading"
import { cn } from "../ui/lib/utils";
import { formatCount } from "../components/category-gallery/format-count";
import { SIDEBAR_VIDEO_LINKS_BY_ID } from "../components/category-gallery/sidebar-video-links";
import { GlowingEffect } from "../ui/effects/glowing-effect";
import type { DebateStyle } from "../types/videos"
import type { VideoViewMode } from "../hooks/useVideoState"
import { useVideoStacks } from "../hooks/useVideoStacks"

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
  /** Whether related videos share one card/row with `<` / `>` arrows. */
  stackedPlaylists: boolean
  /** Active category (`"lectures"`, `"topPicks"` or `"history"`). */
  currentCategory: CategoryType
  /** Total number of videos matching the current filters, across every page. */
  totalVideos: number
  /** Season/style counts for the filter dropdowns, or `null` before they load. */
  facets: VideoFacets | null
  /** Popular keyword and tournament searches offered under the grid. */
  searchSuggestions: VideoSuggestions

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
  /** Toggles whether related videos are stacked onto one card/row. */
  onToggleStackedPlaylists: () => void
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
  /**
   * App-owned account menu, pinned at the sidebar's foot. It carries the site
   * links, so the column drops its own footer row when this is given.
   */
  accountSlot?: React.ReactNode
  /** Host-owned controls (e.g. the account-sync badge) rendered beside the search bar. */
  headerActionsSlot?: React.ReactNode
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
  stackedPlaylists,
  currentCategory,
  totalVideos,
  facets,
  searchSuggestions,
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
  selectedCategory,
  onSearchChange,
  onSearchFocus,
  onSearchBlur,
  onClearSearch,
  onSortChange,
  onYearChange,
  onToggleThumbnails,
  onViewModeChange,
  onToggleFavoritesOnly,
  onToggleFavorite,
  onHideVideo,
  onUnhideVideo,
  selectedStyle,
  onStyleChange,
  dockSlot,
  accountSlot,
  headerActionsSlot,
}: LecturesVideoGridViewProps) {
  const params = useParams()
  const pathname = usePathname()
  const slug = useMemo(
    () => librarySlug(params?.category, pathname),
    [params, pathname],
  )

  /** Derive the active quick-link card ID from filter state and active slug. */
  const activeQuickLinkId = useMemo(() => {
    if (showFavoritesOnly) return "favorites"
    if (currentCategory === "history") return "history"
    if (currentCategory === "topPicks") return "topPicks"
    
    // Map selected debate style to highlight the respective quick links
    if (selectedStyle === 1) return "policy"
    if (selectedStyle === 2) return "pf"
    if (selectedStyle === 3) return "ld"
    if (selectedStyle === 4) return "college"
    
    if (slug === undefined && currentCategory === "lectures") return "allVideos"

    // Highlight "lectures" only when the slug is explicitly "lectures"
    if (slug === "lectures") {
      return "lectures"
    }
    
    return undefined
  }, [showFavoritesOnly, currentCategory, selectedStyle, slug])

  // Members of every stacked playlist the loaded page touches. The feed marks
  // each row with its stack key but cannot carry the companion video — a
  // round and the analysis of it are pages apart in any ordering — so they are
  // resolved here and handed to whichever layout is rendering.
  const stacks = useVideoStacks(currentVideos, stackedPlaylists)

  // Whether the page is browsing the lecture library at all. The tree's
  // lecture-category rows highlight only then: `selectedCategory` stays at
  // "all" while a round collection is open, which used to light up "All
  // Lectures" alongside College Policy.
  const browsingLibrary =
    currentCategory === "lectures" && !selectedStyle && !showFavoritesOnly
  // Bare `/videos` is "All Videos" — every round and lecture — not the
  // lecture library, which lives at `/lectures`.
  const browsingAllVideos = browsingLibrary && slug === undefined
  const browsingLectures = browsingLibrary && !browsingAllVideos

  /** The watch-history listing, which is neither a category nor a filter. */
  const isHistory = currentCategory === "history"

  // Dropdown phrases for the search box, a different set per category.
  const searchPhrases = useMemo(
    () => getSearchPhrases({ currentCategory, selectedStyle, selectedCategory }),
    [currentCategory, selectedStyle, selectedCategory],
  )

  // One row: the season dropdown and sort/layout buttons sit to the right of
  // the search input.
  const searchBarNode = (
    <VideoSearchBar
      searchTerm={searchTerm}
      sortOrder={sortOrder}
      isSearchFocused={isSearchFocused}
      showThumbnails={showThumbnails}
      viewMode={viewMode}
      onViewModeChange={onViewModeChange}
      showFavoritesOnly={showFavoritesOnly}
      stackedPlaylists={stackedPlaylists}
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
      suggestedPhrases={searchPhrases}
    />
  )

  // The lecture categories are not in the sidebar: on the lecture library
  // they are a bar of cards at the top of the page, the one place to switch
  // between categories.
  const showLectureGallery = browsingLibrary && lectureCategories.length > 0

  /** Favorite round videos, for the separate tables on the favorites page. */
  const favoriteRounds = useMemo(
    () => currentVideos.filter((v) => typeof v[6] === "number"),
    [currentVideos],
  );
  /** Favorite lectures, for the separate tables on the favorites page. */
  const favoriteLectures = useMemo(
    () => currentVideos.filter((v) => typeof v[6] !== "number"),
    [currentVideos],
  );

  const isFavoritesPage = showFavoritesOnly;

  return (
    // Persistent left sidebar (md+): app dock, video categories, lecture
    // categories, footer — in the shared drag-resizable column
    // (`ResizableSidebarLayout`), so its width matches the rest of the app's.
    // The search and filter controls are deliberately not here — they sit at
    // the top of the results panel instead, which is what
    // lets this column be the same column on the glossary and rankings pages,
    // where there is nothing to search. The dock arrives in `dockSlot` already
    // sized to the column rather than to its own contents, so it can't reach
    // across the border onto the grid.
    <ResizableSidebarLayout
      className="bg-background"
      contentClassName="p-3 sm:p-6"
      footer={accountSlot}
      sidebar={
        <>
          {dockSlot}

          {/* Videos only: the app's REASON document panels used to mount here
              (`docsSlot`), above the tree. They belong on the routes the
              documents are the subject of — the sidebar of the video library is
              the video library. */}
          <VideoSidebarTree
            counts={quickLinkCounts}
            browsingLectures={browsingLectures}
            activeId={activeQuickLinkId}
          />

          {accountSlot ? null : <Footer />}
        </>
      }
    >

        {/* Mobile-only nav (sidebar above is md+ only) */}
        <div className="md:hidden">
          <QuickLinksGrid
            counts={quickLinkCounts}
            activeId={activeQuickLinkId}
          />

          {/* The rest of the sidebar tree — Apps / Coaching / Research /
              Practice and the glossary/rankings pair. The tiles above cover
              only its Videos section, so without this the tool sections had
              no counterpart on a phone anywhere on the page (the dock's
              Settings menu carries them too, as its Videos/Apps/… submenus).
              Sections start collapsed here: expanded, forty rows would push
              the video grid off the screen. */}
          <nav className="mb-6 flex flex-col gap-3 text-sm" aria-label="Tools">
            <ToolNavTree defaultExpanded={false} />
          </nav>

          <Footer />
        </div>

        <div ref={videosSectionRef} className="scroll-mt-20" />

        {/* WSD, ACC, Speech cards - shown on the all videos page */}
        {browsingAllVideos && (
          <div className="mb-6">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
              {[ "wsd", "acc", "speech" ].map((id) => {
                const link = SIDEBAR_VIDEO_LINKS_BY_ID[id];
                // Define style properties for each link
                const styles: Record<string, { gradient: string; iconBg: string; icon: React.ReactNode }> = {
                  wsd: { gradient: "from-blue-500/20 via-indigo-500/10 to-transparent", iconBg: "bg-blue-500/15 ring-1 ring-blue-500/30", icon: GlobeIcon },
                  acc: { gradient: "from-red-500/20 via-yellow-500/10 to-transparent", iconBg: "bg-red-500/15 ring-1 ring-red-500/30", icon: Users },
                  speech: { gradient: "from-pink-500/20 via-yellow-500/10 to-transparent", iconBg: "bg-pink-500/15 ring-1 ring-pink-500/30", icon: Mic },
                };
                const linkStyles = styles[id];
                return (
                  <div key={link.id} className="list-none">
                    <a
                      href={link.href}
                      className={cn(
                        "relative h-full w-full block rounded-lg border-[0.75px] border-border p-1 hover-border-primary/60 transition-colors group",
                        activeQuickLinkId === link.id && "border-primary/60",
                      )}
                    >
                      <GlowingEffect spread={30} glow proximity={48} inactiveZone={0.01} borderWidth={1.5} />
                      <div
                        className={cn(
                          "relative flex h-full flex-col overflow-hidden rounded-md border-[0.75px] bg-background p-2 shadow-sm dark:shadow-[0px_0px_20px_0px_rgba(45,45,45,0.2)] transition-all bg-gradient-to-br",
                          linkStyles.gradient,
                          activeQuickLinkId === link.id && "ring-1 ring-primary/50",
                        )}
                      >
                        <div className="flex items-center justify-center h-14 w-full">
                          <div className={cn("rounded-md p-1.5 flex items-center justify-center transition-transform group-hover:scale-110", linkStyles.iconBg)}>
                            {link.glyph ? (
                              <link.glyph className="h-10 w-10 text-foreground/70" />
                            ) : (
                              <linkStyles.icon className="h-10 w-10 text-foreground/70" />
                            )}
                          </div>
                        </div>
                        <h3 className="mt-auto text-xs leading-tight font-semibold font-sans tracking-[-0.01em] text-foreground text-center min-h-[2rem] flex items-center justify-center">
                          {link.title}
                        </h3>
                        {quickLinkCounts?.[link.id] != null && quickLinkCounts?.[link.id] > 0 && (
                          <span className="absolute top-1 right-1 text-[10px] font-semibold text-foreground/60 leading-none">
                            {formatCount(quickLinkCounts?.[link.id])}
                          </span>
                        )}
                      </div>
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}
          {showLectureGallery && (
          <nav className="mb-6" aria-label="Lecture categories">
            <LectureCategoryGridGallery
              categories={lectureCategories}
              selectedCategory={selectedCategory}
            />
          </nav>
        )}
        {/* The Greatest of All-Time collection opens on its own banner. */}
        {currentCategory === "topPicks" && <GoatSparklesHeading />}

        {/* The search and filter controls, always visible on every
            breakpoint, with the one-click searches drawn from the library
            (popular debate terms and the tournaments with the most rounds)
            underneath. */}
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex w-full flex-wrap items-center gap-2">
            <div className="w-full max-w-2xl">{searchBarNode}</div>
            {/* Submit a video or channel to the moderators' review queue. */}
            <SubmitToLibraryButton />
            {headerActionsSlot}
          </div>
          <VideoSearchSuggestions
            suggestions={searchSuggestions}
            searchTerm={searchTerm}
            onSelect={onSearchChange}
            className="min-w-0"
          />
        </div>

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
            {isHistory ? (
              <>
                <p className="text-muted-foreground">
                  Nothing watched yet.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Play any video and it will show up here, with how far through
                  it you got.
                </p>
              </>
            ) : showFavoritesOnly && favorites.size === 0 ? (
              <>
                <p className="text-muted-foreground">
                  Star videos to add them to My Favorites.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Click the star on any video and it will show up here.
                </p>
              </>
            ) : showFavoritesOnly ? (
              <p className="text-muted-foreground">
                None of your starred videos are in the library right now.
              </p>
            ) : (
              <p className="text-muted-foreground">
                No videos found matching your filters — try one of the searches above.
              </p>
            )}
          </div>
        ) : (
          <>
            {isFavoritesPage ? (
              <>
                {favoriteLectures.length > 0 && (
                  <>
                    <h2 className="text-xl font-semibold px-5 pt-6 pb-2">
                      Lectures
                    </h2>
                    {viewMode === "list" ? (
                      <VideoListRows
                        videos={favoriteLectures}
                        layout="lecture"
                        videoContainerRef={videoContainerRef}
                        favorites={favorites}
                        onToggleFavorite={onToggleFavorite}
                        onHideVideo={onHideVideo}
                        onUnhideVideo={onUnhideVideo}
                        hiddenVideos={hiddenVideos}
                        topPicks={topPicks}
                        stacks={stacks}
                        stacksEnabled={stackedPlaylists}
                        showThumbnails={showThumbnails}
                        onSearch={onSearchChange}
                      />
                    ) : (
                      <VideoGrid
                        videos={favoriteLectures}
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
                        stacks={stacks}
                        stacksEnabled={stackedPlaylists}
                        showFullDate={true}
                        showDescription={true}
                      />
                    )}
                  </>
                )}
                {favoriteRounds.length > 0 && (
                  <>
                    <h2 className="text-xl font-semibold px-5 pt-6 pb-2">
                      Rounds
                    </h2>
                    {viewMode === "list" ? (
                      <VideoListRows
                        videos={favoriteRounds}
                        layout="round"
                        videoContainerRef={videoContainerRef}
                        favorites={favorites}
                        onToggleFavorite={onToggleFavorite}
                        onHideVideo={onHideVideo}
                        onUnhideVideo={onUnhideVideo}
                        hiddenVideos={hiddenVideos}
                        topPicks={topPicks}
                        stacks={stacks}
                        stacksEnabled={stackedPlaylists}
                        showThumbnails={showThumbnails}
                        onSearch={onSearchChange}
                      />
                    ) : (
                      <VideoGrid
                        videos={favoriteRounds}
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
                        stacks={stacks}
                        stacksEnabled={stackedPlaylists}
                        showFullDate={true}
                        showDescription={true}
                      />
                    )}
                  </>
                )}
              </>
            ) : viewMode === "list" ? (
              <VideoListRows
                videos={currentVideos}
                layout={browsingLectures ? "lecture" : selectedStyle ? "round" : undefined}
                // History reads most recently watched first, with a column to
                // say how long ago and to re-sort by; the round tree would
                // scatter that order across seasons and tournaments.
                grouped={isHistory ? false : undefined}
                showWatched={isHistory}
                // Top Picks mixes every format, so each tournament says which.
                showFormat={currentCategory === "topPicks"}
                defaultSort={isHistory ? { column: "watched", direction: "desc" } : undefined}
                videoContainerRef={videoContainerRef}
                favorites={favorites}
                onToggleFavorite={onToggleFavorite}
                onHideVideo={onHideVideo}
                onUnhideVideo={onUnhideVideo}
                hiddenVideos={hiddenVideos}
                topPicks={topPicks}
                stacks={stacks}
                stacksEnabled={stackedPlaylists}
                showThumbnails={showThumbnails}
                onSearch={onSearchChange}
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
                stacks={stacks}
                stacksEnabled={stackedPlaylists}
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
    </ResizableSidebarLayout>
  )
}
