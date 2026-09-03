/**
 * @fileoverview Compact icon-button toolbar for the video search bar.
 * Contains sort-order toggle, favorites filter, top-picks toggle, and rankings toggle.
 * @module components/debate/DebateVideos/components/video-search/SearchBarIconButtons
 */

import Image from "next/image"
import { Calendar, Eye, Trophy, LayoutGrid, Rows3 } from "lucide-react"
import { IconTopRounds } from "../../ui/icons"
import { Button } from "../../ui/primitives/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../ui/primitives/tooltip"
import type { VideoViewMode } from "../../hooks/useVideoState"

/** Props for the {@link SearchBarIconButtons} component. */
interface SearchBarIconButtonsProps {
  /** Currently active sort order (`"Recency"` or `"Views"`). */
  sortOrder: string
  /** Callback invoked with the next sort order when the sort button is clicked. */
  onSortChange: (value: string) => void
  /** Current results layout. When omitted, the grid/list toggle button is hidden. */
  viewMode?: VideoViewMode
  /** Callback invoked with the new layout when the grid/list toggle is clicked. */
  onViewModeChange?: (mode: VideoViewMode) => void
  /** Whether the favorites-only filter is currently active. */
  showFavoritesOnly: boolean
  /** Callback invoked to toggle the favorites filter. */
  onToggleFavoritesOnly: () => void
  /** Whether the Top Picks view is currently active. */
  showTopPicksActive?: boolean
  /**
   * Callback invoked to toggle the Top Picks view.
   * When omitted the Top Picks button is hidden.
   */
  onToggleTopPicks?: () => void
  /** Whether the Rankings view is currently active. */
  showRankingsActive?: boolean
  /**
   * Callback invoked to toggle the Rankings view.
   * When omitted the Rankings button is hidden.
   */
  onToggleRankings?: () => void
  /** Extra icon buttons injected by the parent, rendered after the built-in set. */
  extraButtons?: React.ReactNode
}

/**
 * Renders the compact icon-button row shown in the video search bar toolbar.
 * Buttons: sort-order toggle, favorites, top picks (optional), rankings (optional),
 * and any additional {@link SearchBarIconButtonsProps.extraButtons}.
 *
 * @param props - See {@link SearchBarIconButtonsProps}.
 */
export function SearchBarIconButtons({
  sortOrder,
  onSortChange,
  viewMode,
  onViewModeChange,
  showFavoritesOnly,
  onToggleFavoritesOnly,
  showTopPicksActive,
  onToggleTopPicks,
  showRankingsActive,
  onToggleRankings,
  extraButtons,
}: SearchBarIconButtonsProps) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      {/* Sort-order toggle: Recency ↔ Views */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="shrink-0"
            variant="outline"
            size="icon"
            onClick={() =>
              onSortChange(sortOrder === "Recency" ? "Views" : "Recency")
            }
          >
            {sortOrder === "Recency" ? (
              <Calendar className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {sortOrder === "Recency"
            ? "Sorted by date (click for views)"
            : "Sorted by views (click for date)"}
        </TooltipContent>
      </Tooltip>

      {/* Grid/list layout toggle (rendered only when onViewModeChange is provided) */}
      {onViewModeChange && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="shrink-0"
              variant="outline"
              size="icon"
              onClick={() =>
                onViewModeChange(viewMode === "list" ? "grid" : "list")
              }
            >
              {viewMode === "list" ? (
                <LayoutGrid className="h-4 w-4" />
              ) : (
                <Rows3 className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {viewMode === "list"
              ? "Switch to grid view"
              : "Switch to row view"}
          </TooltipContent>
        </Tooltip>
      )}

      {/* Top Picks toggle (rendered only when onToggleTopPicks is provided) */}
      {onToggleTopPicks && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className={`shrink-0 ${
                showTopPicksActive ? "bg-primary/20 ring-2 ring-primary" : ""
              }`}
              variant="outline"
              size="icon"
              onClick={onToggleTopPicks}
            >
              <Image
                src={IconTopRounds}
                alt="Top Picks"
                width={16}
                height={16}
                className="h-4 w-4"
                unoptimized
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {showTopPicksActive ? "Show all debates" : "Show top picks"}
          </TooltipContent>
        </Tooltip>
      )}

      {/* Rankings toggle (rendered only when onToggleRankings is provided) */}
      {onToggleRankings && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className={`shrink-0 ${
                showRankingsActive ? "bg-primary/20 ring-2 ring-primary" : ""
              }`}
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
  )
}
