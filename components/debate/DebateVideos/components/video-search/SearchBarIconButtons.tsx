/**
 * @fileoverview Compact icon-button toolbar for the video search bar.
 * Contains sort-order toggle, favorites filter, top-picks toggle, and rankings toggle.
 * @module components/debate/DebateVideos/components/video-search/SearchBarIconButtons
 */

import Image from "next/image"
import { Star, Calendar, Eye, Trophy } from "lucide-react"
import { IconTopRounds } from "@/components/icons"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/** Props for the {@link SearchBarIconButtons} component. */
interface SearchBarIconButtonsProps {
  /** Currently active sort order (`"Recency"` or `"Views"`). */
  sortOrder: string
  /** Callback invoked with the next sort order when the sort button is clicked. */
  onSortChange: (value: string) => void
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

      {/* Favorites filter toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className={`shrink-0 ${
              showFavoritesOnly
                ? "bg-amber-100 text-amber-600 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 border-amber-200 dark:border-amber-800"
                : ""
            }`}
            variant="outline"
            size="icon"
            onClick={onToggleFavoritesOnly}
          >
            <Star
              className={`h-4 w-4 ${showFavoritesOnly ? "fill-current" : ""}`}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {showFavoritesOnly ? "Show all videos" : "Show favorites only"}
        </TooltipContent>
      </Tooltip>

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
