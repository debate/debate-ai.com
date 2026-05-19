/**
 * @fileoverview Individual data row for the leaderboard table.
 * Renders the main grid row, a mobile secondary row with full names and tournament
 * pills, and an expandable accordion with per-tournament bid detail.
 * @module components/debate/DebateVideos/panels/LeaderboardDataRow
 */

"use client"

import { Trophy } from "lucide-react"
import type { LeaderboardEntry } from "@/packages/debate-data-sync/rankings/sync-rankings-debatedrills"
import { hasValue, getNumericValue } from "./leaderboardUtils"
import type { Division } from "./leaderboardTypes"

/** Props for the {@link LeaderboardDataRow} component. */
interface LeaderboardDataRowProps {
  /** The leaderboard entry to render. */
  entry: LeaderboardEntry
  /** Row index — used to track which row is expanded. */
  index: number
  /** Index of the currently expanded row, or `null` for none. */
  expandedRow: number | null
  /** Called when the user clicks the row to toggle expansion. */
  onToggle: (index: number) => void
  /** Whether Elo columns are shown (VPF/VLD only). */
  showElo: boolean
  /** Whether TOC bid columns are shown (current season only). */
  showTocColumns: boolean
  /** Tailwind `grid-cols-*` class controlling the row layout. */
  gridCols: string
  /** Active division — used for LD abbreviated-name display. */
  division: Division
}

/**
 * Renders one full leaderboard row: main grid row, mobile secondary name/tournament
 * row, and an expandable bid-detail accordion.
 *
 * @param props - See {@link LeaderboardDataRowProps}.
 */
export function LeaderboardDataRow({
  entry,
  index,
  expandedRow,
  onToggle,
  showElo,
  showTocColumns,
  gridCols,
  division,
}: LeaderboardDataRowProps) {
  const hasMobileExtra = !!(
    entry.students ||
    (entry.details && entry.details.length > 0)
  )

  return (
    <div className="border-b">
      {/* Main row */}
      <div
        className={`grid ${gridCols} gap-1 sm:gap-2 items-center px-2 sm:px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer`}
        onClick={() => onToggle(index)}
      >
        {showElo && showTocColumns ? (
          <>
            <div className="font-bold text-sm sm:text-base">
              {entry.eloRank ?? "--"}
            </div>
            <div className="text-sm">{entry.rank}</div>
          </>
        ) : (
          <div className="font-bold text-sm sm:text-base">{entry.rank}</div>
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
          {entry.students && (
            <div className="hidden sm:block text-xs text-muted-foreground truncate">
              {entry.teamName}{" "}
              {entry.students
                .split("&")
                .map((s) => s.trim().split(/\s+/).pop())
                .join(" & ")}
            </div>
          )}
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
            <div className="text-right text-sm">{entry.tocScore ?? "--"}</div>
          </>
        )}

        {showElo && showTocColumns && (
          <>
            <div className="text-right text-sm">{entry.debateElo ?? "--"}</div>
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
          <div className="text-right text-sm">{entry.debateElo ?? "--"}</div>
        )}
      </div>

      {/* Mobile: inline secondary row with full names + tournament pills */}
      {hasMobileExtra && (
        <div
          className="sm:hidden px-4 pb-3 cursor-pointer hover:bg-gray-50"
          onClick={() => onToggle(index)}
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

      {/* Expanded bid-detail accordion */}
      {expandedRow === index && entry.details && entry.details.length > 0 && (
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
              <div className="hidden sm:block text-muted-foreground">{d.bidTier}</div>
              <div>{d.placementNormalized}</div>
              <div className="text-right">{d.score}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
