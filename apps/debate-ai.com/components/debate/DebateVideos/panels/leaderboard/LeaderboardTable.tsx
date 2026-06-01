/**
 * @fileoverview Sortable data grid for leaderboard entries (VPF / VLD / VCX divisions).
 *
 * Composes {@link LeaderboardTableHeader} for the sticky column header row and
 * {@link LeaderboardDataRow} for each expandable team row.
 * @module components/debate/DebateVideos/panels/LeaderboardTable
 */

"use client"

import { useState, Fragment } from "react"
import type { LeaderboardEntry } from "@/packages/debate-data-sync/rankings/sync-rankings-debatedrills"
import type { Division, SortKey, SortState } from "./leaderboardTypes"
import { LeaderboardTableHeader } from "./LeaderboardTableHeader"
import { LeaderboardDataRow } from "./LeaderboardDataRow"

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

/**
 * Renders the full leaderboard table: a sticky header row with sortable columns
 * and expandable detail rows for each team.
 *
 * - Row expansion state is local; it resets whenever the parent passes a new `key`
 *   (e.g. on division change).
 * - Header and row rendering are delegated to {@link LeaderboardTableHeader}
 *   and {@link LeaderboardDataRow} respectively.
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
          <LeaderboardTableHeader
            showElo={showElo}
            showTocColumns={showTocColumns}
            gridCols={gridCols}
            division={division}
            sort={sort}
            onToggleSort={onToggleSort}
          />

          {filteredData.map((entry: LeaderboardEntry, index: number) => (
            <Fragment key={index}>
              <LeaderboardDataRow
                entry={entry}
                index={index}
                expandedRow={expandedRow}
                onToggle={toggleRow}
                showElo={showElo}
                showTocColumns={showTocColumns}
                gridCols={gridCols}
                division={division}
              />
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
