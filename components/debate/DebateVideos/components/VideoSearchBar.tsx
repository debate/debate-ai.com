/**
 * @fileoverview Search bar with filters for videos
 * @module components/debate/videos/components/VideoSearchBar
 */

import { Search, X, Video, VideoOff, Star, ChevronLeft, ChevronRight } from "lucide-react"
import Image from "next/image"
import { IconTopRounds } from "@/components/icons"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { GlowingEffect } from "@/components/ui/glowing-effect"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { DebateStyle } from "@/lib/types/videos"
import { DEBATE_STYLE_LABELS } from "@/lib/types/videos"

/**
 * Props for the VideoSearchBar component.
 */
interface VideoSearchBarProps {
  /** Current value of the search input. */
  searchTerm: string
  /** Currently active sort order (e.g. "Recency" or "Views"). */
  sortOrder: string
  /** Whether the search input is focused; controls the glowing effect. */
  isSearchFocused: boolean
  /** Whether video thumbnails are currently visible in the grid. */
  showThumbnails: boolean
  /** Currently selected season year. */
  selectedYear: string
  /** Callback invoked with the new search string on every input change. */
  onSearchChange: (value: string) => void
  /** Callback invoked when the search input receives focus. */
  onSearchFocus: () => void
  /** Callback invoked when the search input loses focus. */
  onSearchBlur: () => void
  /** Callback invoked when the clear-search button is clicked. */
  onClearSearch: () => void
  /** Callback invoked with the newly selected sort option value. */
  onSortChange: (value: string) => void
  /** Callback invoked with the newly selected season year. */
  onYearChange: (value: string) => void
  /** Callback invoked to toggle thumbnail visibility. */
  onToggleThumbnails: () => void
  /** Whether to show only favorite videos. */
  showFavoritesOnly: boolean
  /** Callback invoked to toggle favorite visualization filter. */
  onToggleFavoritesOnly: () => void
  /** Whether the Top Picks view is currently active. */
  showTopPicksActive?: boolean
  /** Callback invoked to toggle the Top Picks view. */
  onToggleTopPicks?: () => void
  /** Current page number for pagination. */
  currentPage?: number
  /** Total number of pages for pagination. */
  totalPages?: number
  /** Total number of videos matching the current filter. */
  totalVideos?: number
  /** Callback for previous page action. */
  onPrevPage?: () => void
  /** Callback for next page action. */
  onNextPage?: () => void
  /** Currently selected debate style filter. */
  selectedStyle?: DebateStyle | ""
  /** Callback invoked when the style filter changes. */
  onStyleChange?: (style: DebateStyle | "") => void
}

/** Available sort options shown in the sort dropdown. */
const sortOptions = [
  { value: "Recency", label: "Recency" },
  { value: "Views", label: "Views" },
]

/**
 * Renders a search input, sort order selector, and thumbnail toggle button.
 *
 * @param props - Search bar state and event handlers.
 * @param props.searchTerm - Current search input value.
 * @param props.sortOrder - Currently selected sort order.
 * @param props.isSearchFocused - Whether the search input is focused.
 * @param props.showThumbnails - Whether thumbnails are currently shown.
 * @param props.onSearchChange - Handler for search input changes.
 * @param props.onSearchFocus - Handler for search input focus.
 * @param props.onSearchBlur - Handler for search input blur.
 * @param props.onClearSearch - Handler for the clear-search action.
 * @param props.onSortChange - Handler for sort order changes.
 * @param props.onToggleThumbnails - Handler to toggle thumbnail display.
 * @returns A toolbar row containing the search field, sort selector, and thumbnail toggle.
 */
export function VideoSearchBar({
  searchTerm,
  sortOrder,
  isSearchFocused,
  showThumbnails,
  selectedYear,
  onSearchChange,
  onSearchFocus,
  onSearchBlur,
  onClearSearch,
  onSortChange,
  onYearChange,
  onToggleThumbnails,
  showFavoritesOnly,
  onToggleFavoritesOnly,
  showTopPicksActive,
  onToggleTopPicks,
  currentPage,
  totalPages,
  totalVideos,
  onPrevPage,
  onNextPage,
  selectedStyle,
  onStyleChange,
}: VideoSearchBarProps) {
  const currentYear = new Date().getFullYear()
  const maxYear = Math.max(currentYear, 2026)
  const years = Array.from({ length: maxYear - 2001 }, (_, i) => String(maxYear - i))

  const pagination = totalPages && totalPages > 1 && currentPage && onPrevPage && onNextPage ? (
    <TooltipProvider>
      <div className="flex items-center gap-1 shrink-0">
        {totalVideos !== undefined && (
          <span className="text-[10px] sm:text-xs text-muted-foreground tabular-nums whitespace-nowrap">
            {totalVideos} videos
          </span>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrevPage} disabled={currentPage === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Previous page</TooltipContent>
        </Tooltip>
        <span className="text-[10px] sm:text-xs font-medium tabular-nums whitespace-nowrap text-muted-foreground min-w-[3rem] text-center">
          {currentPage} / {totalPages}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNextPage} disabled={currentPage >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Next page</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  ) : null

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {/* Row 1: Search + icon buttons */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                onFocus={onSearchFocus}
                onBlur={onSearchBlur}
                className="pl-9 pr-8 h-9"
              />
              {searchTerm && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={onClearSearch}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Clear search</TooltipContent>
                </Tooltip>
              )}
              {isSearchFocused && <GlowingEffect />}
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button className="shrink-0" variant="outline" size="icon" onClick={onToggleThumbnails}>
                {showThumbnails ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {showThumbnails ? "Hide thumbnails" : "Show thumbnails"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className={`shrink-0 ${showFavoritesOnly ? "bg-amber-100 text-amber-600 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 border-amber-200 dark:border-amber-800" : ""}`}
                variant="outline"
                size="icon"
                onClick={onToggleFavoritesOnly}
              >
                <Star className={`h-4 w-4 ${showFavoritesOnly ? "fill-current" : ""}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {showFavoritesOnly ? "Show all videos" : "Show favorites only"}
            </TooltipContent>
          </Tooltip>
          {onToggleTopPicks && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className={`shrink-0 ${showTopPicksActive ? "bg-primary/20 ring-2 ring-primary" : ""}`}
                  variant="outline"
                  size="icon"
                  onClick={onToggleTopPicks}
                >
                  <Image src={IconTopRounds} alt="Top Picks" width={16} height={16} className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {showTopPicksActive ? "Show all debates" : "Show top picks"}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Row 2: Style tabs */}
        {onStyleChange && (
          <Tabs value={selectedStyle || "all"} onValueChange={(v) => onStyleChange(v === "all" ? "" : v as DebateStyle)}>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs px-2 py-1">All</TabsTrigger>
              {(Object.entries(DEBATE_STYLE_LABELS) as [DebateStyle, string][]).map(([style, label]) => (
                <TabsTrigger key={style} value={style} className="text-xs px-2 py-1">{label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {/* Row 3: Sort + Season + Pagination */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-[100px] sm:w-[120px] shrink-0">
                <Select value={sortOrder} onValueChange={onSortChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">Sort videos by recency or views</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-[110px] sm:w-[130px] shrink-0">
                <Select value={selectedYear || "all"} onValueChange={(v) => onYearChange(v === "all" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Seasons" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Seasons</SelectItem>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>
                        {Number(y) - 1}-{y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">Filter by debate season</TooltipContent>
          </Tooltip>

          {pagination && <div className="ml-auto">{pagination}</div>}
        </div>
      </div>
    </TooltipProvider>
  )
}
