/**
 * @fileoverview Sortable data grid for leaderboard entries (VPF / VLD / VCX divisions).
 * @module components/debate/DebateVideos/panels/LeaderboardTable
 */

"use client"

import { useState, Fragment } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Info, ChevronUp, ChevronDown, Trophy } from "lucide-react"
import type { LeaderboardEntry } from "@/packages/debate-data-sync/rankings/sync-rankings-debatedrills"
import { ELO_TOOLTIP, hasValue, getNumericValue } from "./leaderboardUtils"
import type { Division, SortKey, SortState } from "./leaderboardUtils"

/** Props for the {@link LeaderboardTable} component. */
interface LeaderboardTableProps {
  /** Pre-sorted and pre-filtered entries to render. */
  filteredData: LeaderboardEntry[]
  /** Whether to render Elo-rating columns (VPF and VLD divisions only). */
  showElo: boolean
  /** Whether to render TOC-bid columns (current season only). */
  showTocColumns: boolean
  /** Tailwind `grid-cols-*` class string controlling the responsive layout. */
  gridCols: string
  /** Active division; used for LD abbreviated-name display logic. */
  division: Division
  /** Current sort state passed down from the parent panel. */
  sort: SortState
  /** Callback invoked when the user clicks a sortable column header. */
  onToggleSort: (key: SortKey) => void
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders the full leaderboard table: a sticky header row with sortable columns and
 * expandable detail rows for each team.
 *
 * - Clicking a row expands an accordion with per-tournament bid detail.
 * - On mobile, debater names and tournament pills are shown in a secondary inline row
 *   rather than a separate expanded section.
 * - Row expansion state is local; it resets whenever the parent passes a new `key`
 *   (e.g. on division change).
 *
 * @param props - See {@link LeaderboardTableProps}.
 */
export function LeaderboardTable({
  filteredData,
  showElo,
  showTocColumns,
  gridCols,
  division,
  sort,
  onToggleSort,
}: LeaderboardTableProps) {
  /** Index of the currently expanded row, or `null` when none is expanded. */
  const [expandedRow, setExpandedRow] = useState<number | null>(null)

  const toggleRow = (index: number) =>
    setExpandedRow((prev) => (prev === index ? null : index))

  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[480px]">
          {/* ----------------------------------------------------------------
              Header row
          ---------------------------------------------------------------- */}
          <div
            className={`grid ${gridCols} gap-1 sm:gap-2 px-2 sm:px-4 py-3 bg-gray-50 border-b text-sm font-medium text-muted-foreground`}
          >
            {showElo && showTocColumns ? (
              <>
                <div
                  className="cursor-pointer select-none"
                  onClick={() => onToggleSort("eloRank")}
                >
                  Elo Rk <SortIcon col="eloRank" sort={sort} />
                </div>
                <div
                  className="cursor-pointer select-none"
                  onClick={() => onToggleSort("rank")}
                >
                  Bid Rk <SortIcon col="rank" sort={sort} />
                </div>
              </>
            ) : (
              <div
                className="cursor-pointer select-none"
                onClick={() => onToggleSort("rank")}
              >
                Bid Rk <SortIcon col="rank" sort={sort} />
              </div>
            )}

            <div>Team</div>

            {showTocColumns && (
              <>
                <div
                  className="text-center cursor-pointer select-none"
                  onClick={() => onToggleSort("state")}
                >
                  St <SortIcon col="state" sort={sort} />
                </div>
                <div
                  className="text-right cursor-pointer select-none"
                  onClick={() => onToggleSort("bids")}
                >
                  Bids <SortIcon col="bids" sort={sort} />
                </div>
                <div
                  className="text-right cursor-pointer select-none"
                  onClick={() => onToggleSort("tocScore")}
                >
                  Bid Score <SortIcon col="tocScore" sort={sort} />
                </div>
              </>
            )}

            {showElo && showTocColumns && (
              <>
                {/* Elo column with formula tooltip */}
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

                {/* Elo/Bid ratio column */}
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

                {/* Elo×Bid product column */}
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

            {/* Elo column for historical (non-TOC) seasons */}
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

          {/* ----------------------------------------------------------------
              Data rows
          ---------------------------------------------------------------- */}
          {filteredData.map((entry: LeaderboardEntry, index: number) => {
            const hasMobileExtra = !!(
              entry.students ||
              (entry.details && entry.details.length > 0)
            )

            return (
              <Fragment key={index}>
                <div className="border-b">
                  {/* Main row */}
                  <div
                    className={`grid ${gridCols} gap-1 sm:gap-2 items-center px-2 sm:px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer`}
                    onClick={() => toggleRow(index)}
                  >
                    {showElo && showTocColumns ? (
                      <>
                        <div className="font-bold text-sm sm:text-base">
                          {entry.eloRank ?? "--"}
                        </div>
                        <div className="text-sm">{entry.rank}</div>
                      </>
                    ) : (
                      <div className="font-bold text-sm sm:text-base">
                        {entry.rank}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="font-semibold text-xs sm:text-sm truncate">
                        {division === "VLD" && entry.students
                          ? `${entry.teamName} ${entry.students
                              .split(/\s+/)
                              .filter(Boolean)
                              .map((w) => w[0].toUpperCase())
                              .join("")}`
                          : entry.teamName}
                      </div>
                      {/* Desktop: debater last names */}
                      {entry.students && (
                        <div className="hidden sm:block text-xs text-muted-foreground truncate">
                          {entry.teamName}{" "}
                          {entry.students
                            .split("&")
                            .map((s) => s.trim().split(/\s+/).pop())
                            .join(" & ")}
                        </div>
                      )}
                      {/* Desktop: tournament placement pills */}
                      {entry.details && entry.details.length > 0 && (
                        <div className="hidden sm:block text-xs text-muted-foreground mt-0.5 truncate">
                          {entry.details
                            .map((d) => `${d.tournament} ${d.placementNormalized}`)
                            .join(", ")}
                        </div>
                      )}
                    </div>

                    {showTocColumns && (
                      <>
                        <div className="text-center text-xs text-muted-foreground">
                          {entry.state || "--"}
                        </div>
                        <div className="text-right font-medium text-sm">
                          {entry.bids ?? "--"}
                        </div>
                        <div className="text-right text-sm">
                          {entry.tocScore ?? "--"}
                        </div>
                      </>
                    )}

                    {showElo && showTocColumns && (
                      <>
                        <div className="text-right text-sm">
                          {entry.debateElo ?? "--"}
                        </div>
                        <div className="text-right text-sm">
                          {hasValue(entry.eloRank) && hasValue(entry.rank)
                            ? (
                                getNumericValue(entry.eloRank) /
                                getNumericValue(entry.rank)
                              ).toFixed(2)
                            : "--"}
                        </div>
                        <div className="text-right text-sm">
                          {hasValue(entry.eloRank) && hasValue(entry.rank)
                            ? Math.round(
                                getNumericValue(entry.eloRank) *
                                  getNumericValue(entry.rank),
                              )
                            : "--"}
                        </div>
                      </>
                    )}

                    {!showTocColumns && (
                      <div className="text-right text-sm">
                        {entry.debateElo ?? "--"}
                      </div>
                    )}
                  </div>

                  {/* Mobile: inline secondary row with full names + tournament pills */}
                  {hasMobileExtra && (
                    <div
                      className="sm:hidden px-4 pb-3 cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleRow(index)}
                    >
                      {entry.students && (
                        <div className="text-sm font-medium text-foreground mb-1.5">
                          {entry.teamName}{" "}
                          {entry.students
                            .split("&")
                            .map((s) => s.trim().split(/\s+/).pop())
                            .join(" & ")}
                        </div>
                      )}
                      {entry.details && entry.details.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {entry.details.map((d, di) => (
                            <span
                              key={di}
                              className="inline-flex items-center gap-1 text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5"
                            >
                              <Trophy className="h-2.5 w-2.5 text-yellow-500 shrink-0" />
                              {d.tournament} · {d.placementNormalized}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Expanded bid-detail accordion */}
                {expandedRow === index &&
                  entry.details &&
                  entry.details.length > 0 && (
                    <div className="bg-gray-50 border-b px-4 sm:px-8 py-3">
                      <div className="grid grid-cols-[1fr_80px_60px] sm:grid-cols-[1fr_100px_80px_60px] gap-1 text-xs font-medium text-muted-foreground mb-1">
                        <div>Tournament</div>
                        <div className="hidden sm:block">Bid Tier</div>
                        <div>Placement</div>
                        <div className="text-right">Pts</div>
                      </div>
                      {entry.details.map((d, di) => (
                        <div
                          key={di}
                          className="grid grid-cols-[1fr_80px_60px] sm:grid-cols-[1fr_100px_80px_60px] gap-1 text-xs py-1 border-t border-gray-100"
                        >
                          <div className="font-medium">{d.tournament}</div>
                          <div className="hidden sm:block text-muted-foreground">
                            {d.bidTier}
                          </div>
                          <div>{d.placementNormalized}</div>
                          <div className="text-right">{d.score}</div>
                        </div>
                      ))}
                    </div>
                  )}
              </Fragment>
            )
          })}
        </div>
      </div>
    </div>
  )
}
