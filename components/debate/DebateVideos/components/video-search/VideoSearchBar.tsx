/**
 * @fileoverview Search bar with debounced text input plus season, style, and icon-button filters.
 * @module components/debate/DebateVideos/components/video-search/VideoSearchBar
 */

import { useState, useEffect } from "react"
import { Search, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { GlowingEffect } from "@/components/ui/glowing-effect"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip"
import type { DebateStyle } from "@/lib/types/videos"
import { useVideoSearchCounts } from "./useVideoSearchCounts"
import { SeasonDropdown } from "./SeasonDropdown"
import { StyleDropdown } from "./StyleDropdown"
import { SearchBarIconButtons } from "./SearchBarIconButtons"

/** Props for the {@link VideoSearchBar} component. */
interface VideoSearchBarProps {
  /** Current value of the search input. */
  searchTerm: string
  /** Currently active sort order (e.g. `"Recency"` or `"Views"`). */
  sortOrder: string
  /** Whether the search input is focused; controls the glowing outline effect. */
  isSearchFocused: boolean
  /** Whether video thumbnails are currently visible in the grid. */
  showThumbnails: boolean
  /** Currently selected season year (e.g. `"2026"`), or `undefined` for all seasons. */
  selectedYear?: string
  /** Callback invoked with the new search string on every (debounced) input change. */
  onSearchChange: (value: string) => void
  /** Callback invoked when the search input receives focus. */
  onSearchFocus: () => void
  /** Callback invoked when the search input loses focus. */
  onSearchBlur: () => void
  /** Callback invoked when the clear-search (×) button is clicked. */
  onClearSearch: () => void
  /** Callback invoked with the newly selected sort option value. */
  onSortChange: (value: string) => void
  /** Callback invoked with the new season year, or empty string to clear. */
  onYearChange?: (value: string) => void
  /** Callback invoked to toggle thumbnail visibility. */
  onToggleThumbnails: () => void
  /** Whether to show only favourite videos. */
  showFavoritesOnly: boolean
  /** Callback invoked to toggle the favourites filter. */
  onToggleFavoritesOnly: () => void
  /** Whether the Top Picks view is currently active. */
  showTopPicksActive?: boolean
  /** Callback invoked to toggle the Top Picks view. When omitted the button is hidden. */
  onToggleTopPicks?: () => void
  /** Whether the Rankings view is currently active. */
  showRankingsActive?: boolean
  /** Callback invoked to toggle the Rankings view. When omitted the button is hidden. */
  onToggleRankings?: () => void
  /** Total number of videos matching the current filter, shown as a badge. */
  totalVideos?: number
  /** Currently selected debate-style filter. */
  selectedStyle?: DebateStyle | ""
  /** Callback invoked when the style filter changes. When omitted the dropdown is hidden. */
  onStyleChange?: (style: DebateStyle | "") => void
  /** Full video list used to compute per-year and per-style counts. */
  allVideos?: any[]
  /** Set of hidden video IDs excluded from counts. */
  hiddenVideos?: Set<string>
  /** Custom element rendered immediately after the search input. */
  afterSearchElement?: React.ReactNode
  /** Extra icon buttons rendered after the built-in icon buttons. */
  extraButtons?: React.ReactNode
}

/**
 * Toolbar row containing a debounced text search input, an optional season-year
 * dropdown, an optional debate-style dropdown, a compact icon-button strip
 * (sort, favourites, top picks, rankings), and a total-video count badge.
 *
 * Input changes are debounced by 2 s before propagating to the parent via
 * {@link VideoSearchBarProps.onSearchChange}, keeping expensive filter passes
 * off the hot path while the user is still typing.
 *
 * @param props - See {@link VideoSearchBarProps}.
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
  allVideos = [],
  hiddenVideos = new Set(),
  afterSearchElement,
  extraButtons,
}: VideoSearchBarProps) {
  /** Mirrors searchTerm locally so the input stays responsive while debouncing. */
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm)

  // Sync local mirror when the parent clears the search term externally.
  useEffect(() => {
    setLocalSearchTerm(searchTerm)
  }, [searchTerm])

  // Propagate the debounced value to the parent after 2 s of inactivity.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearchTerm !== searchTerm) {
        onSearchChange(localSearchTerm)
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, [localSearchTerm, searchTerm, onSearchChange])

  const handleClearSearch = () => {
    setLocalSearchTerm("")
    onClearSearch()
  }

  const { years, yearCounts, styleCounts } = useVideoSearchCounts({
    allVideos,
    hiddenVideos,
    selectedStyle,
    selectedYear,
  })

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {/* Row 1: search input — full width on mobile, flex item on desktop */}
        <div className="flex items-center gap-2 sm:hidden">
          <div className="relative min-w-0 flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                placeholder="Search..."
                value={localSearchTerm}
                onChange={(e) => setLocalSearchTerm(e.target.value)}
                onFocus={onSearchFocus}
                onBlur={onSearchBlur}
                className="pl-9 pr-8 h-9"
              />
              {localSearchTerm && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleClearSearch}
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
          {afterSearchElement}
        </div>

        {/* Row 2 (mobile) / single row (desktop): season + style dropdowns + icons */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Search — hidden on mobile (shown above), inline on desktop */}
          <div className="relative min-w-0 flex-1 hidden sm:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                placeholder="Search..."
                value={localSearchTerm}
                onChange={(e) => setLocalSearchTerm(e.target.value)}
                onFocus={onSearchFocus}
                onBlur={onSearchBlur}
                className="pl-9 pr-8 h-9"
              />
              {localSearchTerm && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleClearSearch}
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

          <div className="hidden sm:block">{afterSearchElement}</div>

          {onYearChange && (
            <SeasonDropdown
              selectedYear={selectedYear}
              onYearChange={onYearChange}
              years={years}
              yearCounts={yearCounts}
            />
          )}

          {onStyleChange && (
            <StyleDropdown
              selectedStyle={selectedStyle}
              onStyleChange={onStyleChange}
              styleCounts={styleCounts}
            />
          )}

          <SearchBarIconButtons
            sortOrder={sortOrder}
            onSortChange={onSortChange}
            showFavoritesOnly={showFavoritesOnly}
            onToggleFavoritesOnly={onToggleFavoritesOnly}
            showTopPicksActive={showTopPicksActive}
            onToggleTopPicks={onToggleTopPicks}
            showRankingsActive={showRankingsActive}
            onToggleRankings={onToggleRankings}
            extraButtons={extraButtons}
          />

          {totalVideos !== undefined && (
            <div className="flex items-center gap-1 shrink-0 ml-auto">
              <Badge
                variant="secondary"
                className="hidden sm:inline-flex text-[10px] sm:text-xs tabular-nums whitespace-nowrap px-1.5 py-0 h-5"
              >
                {totalVideos}
              </Badge>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
