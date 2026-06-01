/**
 * @fileoverview Sticky header row for the leaderboard data grid.
 * Renders sortable column labels and Elo tooltip popovers.
 * @module components/debate/DebateVideos/panels/LeaderboardTableHeader
 */

"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Info, ChevronUp, ChevronDown } from "lucide-react"
import { ELO_TOOLTIP } from "./leaderboardUtils"
import type { Division, SortKey, SortState } from "./leaderboardTypes"

/** Props for the {@link LeaderboardTableHeader} component. */
interface LeaderboardTableHeaderProps {
  /** Whether to render Elo-rating columns (VPF and VLD divisions only). */
  showElo: boolean
  /** Whether to render TOC-bid columns (current season only). */
  showTocColumns: boolean
  /** Tailwind `grid-cols-*` class string controlling the responsive layout. */
  gridCols: string
  /** Active division; used to determine which columns to show. */
  division: Division
  /** Current sort state. */
  sort: SortState
  /** Called when the user clicks a sortable column header. */
  onToggleSort: (key: SortKey) => void
}

/**
 * Renders a ▲ / ▼ sort-direction indicator for a given column.
 * Returns `null` when `col` is not the currently sorted column.
 *
 * @param col - Column key to check against the active sort.
 * @param sort - Active sort state from the parent.
 */
function SortIcon({ col, sort }: { col: SortKey; sort: SortState }) {
  if (sort?.key !== col) return null
  return sort.dir === "desc" ? (
    <ChevronDown className="h-3 w-3 inline-block" />
  ) : (
    <ChevronUp className="h-3 w-3 inline-block" />
  )
}

/**
 * Sticky header row for the leaderboard grid.
 * Renders sortable column labels and Elo/ratio tooltip popovers.
 *
 * @param props - See {@link LeaderboardTableHeaderProps}.
 */
export function LeaderboardTableHeader({
  showElo,
  showTocColumns,
  gridCols,
  sort,
  onToggleSort,
}: LeaderboardTableHeaderProps) {
  return (
    <div
      className={`grid ${gridCols} gap-1 sm:gap-2 px-2 sm:px-4 py-3 bg-gray-50 border-b text-sm font-medium text-muted-foreground`}
    >
      {showElo && showTocColumns ? (
        <>
          <div className="cursor-pointer select-none" onClick={() => onToggleSort("eloRank")}>
            Elo Rk <SortIcon col="eloRank" sort={sort} />
          </div>
          <div className="cursor-pointer select-none" onClick={() => onToggleSort("rank")}>
            Bid Rk <SortIcon col="rank" sort={sort} />
          </div>
        </>
      ) : (
        <div className="cursor-pointer select-none" onClick={() => onToggleSort("rank")}>
          Bid Rk <SortIcon col="rank" sort={sort} />
        </div>
      )}

      <div>Team</div>

      {showTocColumns && (
        <>
          <div className="text-center cursor-pointer select-none" onClick={() => onToggleSort("state")}>
            St <SortIcon col="state" sort={sort} />
          </div>
          <div className="text-right cursor-pointer select-none" onClick={() => onToggleSort("bids")}>
            Bids <SortIcon col="bids" sort={sort} />
          </div>
          <div className="text-right cursor-pointer select-none" onClick={() => onToggleSort("tocScore")}>
            Bid Score <SortIcon col="tocScore" sort={sort} />
          </div>
        </>
      )}

      {showElo && showTocColumns && (
        <>
          <div
            className="text-right cursor-pointer select-none flex items-center justify-end gap-1"
            onClick={() => onToggleSort("debateElo")}
          >
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <span className="cursor-help flex items-center gap-1">
                  Elo
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="text-xs leading-relaxed">{ELO_TOOLTIP}</p>
              </TooltipContent>
            </Tooltip>
            <SortIcon col="debateElo" sort={sort} />
          </div>

          <div
            className="text-right cursor-pointer select-none flex items-center justify-end gap-1"
            onClick={() => onToggleSort("eloToBid")}
          >
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <span className="cursor-help flex items-center gap-1">
                  Elo/Bid
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="text-xs leading-relaxed">
                  Elo/Bid ratio = Elo Rank ÷ Bid Rank. Lower scores indicate
                  strong teams that underperform in key elimination rounds
                  relative to their overall performance. Higher scores suggest
                  an underdog team that won a clutch round.
                </p>
              </TooltipContent>
            </Tooltip>
            <SortIcon col="eloToBid" sort={sort} />
          </div>

          <div
            className="text-right cursor-pointer select-none flex items-center justify-end gap-1"
            onClick={() => onToggleSort("eloTimesBid")}
          >
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <span className="cursor-help flex items-center gap-1">
                  Elo×Bid
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="text-xs leading-relaxed">
                  Elo×Bid = Elo Rank × Bid Rank. This represents a balanced
                  measure of prelim and elimination performance. Lower scores
                  indicate teams that perform well in both categories.
                </p>
              </TooltipContent>
            </Tooltip>
            <SortIcon col="eloTimesBid" sort={sort} />
          </div>
        </>
      )}

      {!showTocColumns && (
        <div
          className="text-right cursor-pointer select-none flex items-center justify-end gap-1"
          onClick={() => onToggleSort("debateElo")}
        >
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <span className="cursor-help flex items-center gap-1">
                Elo
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="text-xs leading-relaxed">{ELO_TOOLTIP}</p>
            </TooltipContent>
          </Tooltip>
          <SortIcon col="debateElo" sort={sort} />
        </div>
      )}
    </div>
  )
}
