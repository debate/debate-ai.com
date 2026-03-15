/**
 * @fileoverview Search bar with filters for videos
 * @module components/debate/videos/components/VideoSearchBar
 */

import { Search, X, Video, VideoOff, Star, Trophy, ChevronLeft, ChevronRight, Eye, Calendar } from "lucide-react"
import Image from "next/image"
import { IconTopRounds } from "@/components/icons"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { GlowingEffect } from "@/components/ui/glowing-effect"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
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
  /** Whether the Rankings view is currently active. */
  showRankingsActive?: boolean
  /** Callback invoked to toggle the Rankings view. */
  onToggleRankings?: () => void
  /** Total number of videos matching the current filter. */
  totalVideos?: number
  /** Currently selected debate style filter. */  selectedStyle?: DebateStyle | ""
  /** Callback invoked when the style filter changes. */
  onStyleChange?: (style: DebateStyle | "") => void
  /** Custom element rendered right after the search input. */
  afterSearchElement?: React.ReactNode
  /** Extra icon buttons rendered alongside the built-in icon buttons. */
  extraButtons?: React.ReactNode
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
  showRankingsActive,
  onToggleRankings,
  totalVideos,
  selectedStyle,
  onStyleChange,
  afterSearchElement,
  extraButtons,
}: VideoSearchBarProps) {
  const currentYear = new Date().getFullYear()
  const maxYear = Math.max(currentYear, 2026)
  // Stop seasons at 2011
  const years = Array.from({ length: maxYear - 2011 + 1 }, (_, i) => String(maxYear - i))

  const pagination = totalVideos !== undefined ? (
    <div className="flex items-center gap-1 shrink-0 ml-auto">
      <Badge variant="secondary" className="hidden sm:inline-flex text-[10px] sm:text-xs tabular-nums whitespace-nowrap px-1.5 py-0 h-5">
        {totalVideos}
      </Badge>
    </div>
  ) : null

  return (
    <TooltipProvider>
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 flex-1 min-w-0">
        {/* Row 1 (mobile): Search + Season */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Search input */}
          <div className="relative min-w-0 flex-1">
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

          {/* Custom element after search */}
          {afterSearchElement}

          {/* Season dropdown */}
          <div className="w-[110px] sm:w-[130px] shrink-0">
            <Select value={selectedYear || "all"} onValueChange={(v) => onYearChange(v === "all" ? "" : v)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All Seasons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Seasons</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>
                    {Number(y) - 1}-{y}
                  </SelectItem>
                ))}
                <SelectItem value="legacy">Pre-2010</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2 (mobile): Format selector + Icon buttons + Pagination */}
        <div className="flex items-center gap-2 sm:contents">
          {/* Style dropdown */}
          {onStyleChange && (
            <div className="w-[80px] shrink-0">
              <Select value={selectedStyle ? String(selectedStyle) : "all"} onValueChange={(v) => onStyleChange(v === "all" ? "" : Number(v) as DebateStyle)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {(Object.entries(DEBATE_STYLE_LABELS) as [string, string][]).map(([styleStr, label]) => (
                    <SelectItem key={styleStr} value={styleStr}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Icon buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Sort toggle button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="shrink-0"
                  variant="outline"
                  size="icon"
                  onClick={() => onSortChange(sortOrder === "Recency" ? "Views" : "Recency")}
                >
                  {sortOrder === "Recency" ? (
                    <Calendar className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {sortOrder === "Recency" ? "Sorted by date (click for views)" : "Sorted by views (click for date)"}
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
            {onToggleRankings && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className={`shrink-0 ${showRankingsActive ? "bg-primary/20 ring-2 ring-primary" : ""}`}
                    variant="outline"
                    size="icon"
                    onClick={onToggleRankings}
                  >
                    <Trophy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {showRankingsActive ? "Show all debates" : "Show rankings"}
                </TooltipContent>
              </Tooltip>
            )}
            {extraButtons}
          </div>

          {/* Video Total Badge */}
          {pagination}
        </div>
      </div>
    </TooltipProvider>
  )
}
