/**
 * @fileoverview Sortable Schools table: every school with ranked entries,
 * ranked by its balanced score, alongside its best rating, the average rating of all its
 * entries and a balanced score led by its top three entries.
 * @module components/debate/DebateVideos/panels/SchoolRankingsTable
 */

"use client"

import Link from "next/link"
import { ChevronDown, ChevronUp, Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/primitives/tooltip"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/primitives/table"
import { cn } from "../../ui/lib/utils"
import type { SchoolRanking, SchoolSortKey, SchoolSortState } from "./leaderboardTypes"
import { schoolHref } from "./profile/rankingProfileHelpers"
import { LegendaryBadge, ROW_TIER_CLASS, rowTier, type RowTier } from "./rowTier"
import { RatingDigits } from "./RatingDigits"

/** One table column: which field it shows and how. */
interface Column {
  key: SchoolSortKey | "events"
  label: string
  /** Right-align and use tabular figures. */
  numeric?: boolean
  /** Explains how the value is computed. */
  tooltip?: string
  width: number
  render: (row: SchoolRanking, tier: RowTier, format: string | undefined) => React.ReactNode
}

const COLUMNS: Column[] = [
  {
    key: "rank",
    label: "#",
    numeric: true,
    width: 120,
    render: (r, tier, format) => (
      <>
        {tier === "legendary" && <LegendaryBadge format={format} />}
        <span className="ml-1 font-semibold">{r.rank}</span>
      </>
    ),
  },
  {
    key: "school",
    label: "School",
    width: 240,
    render: (r) => (
      <Link href={schoolHref(r.school)} className="font-medium text-foreground hover:underline underline-offset-4">
        {r.school}
      </Link>
    ),
  },
  {
    key: "bestRating",
    label: "Best Rating",
    numeric: true,
    width: 120,
    tooltip: "Highest adjusted rating (Rating − 2 × Deviation) among the school's ranked entries.",
    render: (r) => <RatingDigits value={r.bestRating} />,
  },
  {
    key: "bestEntry",
    label: "Top Entry",
    width: 220,
    render: (r) => (
      <span>
        {r.bestEntry} <span className="text-xs text-muted-foreground/70">({r.bestEvent})</span>
      </span>
    ),
  },
  {
    key: "avgRating",
    label: "Avg Rating",
    numeric: true,
    width: 120,
    tooltip: "Mean adjusted rating across every ranked team (or LD debater) from the school.",
    render: (r) => <RatingDigits value={r.avgRating} />,
  },
  {
    key: "balancedScore",
    label: "Balanced",
    numeric: true,
    width: 120,
    tooltip:
      "1.1 × (0.7 × average of the top 3 entries + 0.3 × (½ Avg Rating + ½ depth)), where depth grows with team count and reaches 100 at 15 teams. Schools under 4 teams are diluted (×0.80 for 1 team up to ×1.00 for 4); capped at 109. Schools rank on it.",
    render: (r) => <RatingDigits value={r.balancedScore} />,
  },
  { key: "teams", label: "Teams", numeric: true, width: 90, render: (r) => r.teams },
  { key: "events", label: "Events", width: 160, render: (r) => r.events.join(", ") },
]

/** Props for the {@link SchoolRankingsTable} component. */
interface SchoolRankingsTableProps {
  /** Pre-sorted and pre-filtered rows to render. */
  rows: SchoolRanking[]
  /** How many top ranks are legendary, from the whole list ({@link legendaryCount}). */
  legendary: number
  /** Short format label for the legend badge ("PF"), or omitted when the list spans every format. */
  format?: string
  /** Current sort state. */
  sort: SchoolSortState
  /** Called when the user clicks a sortable column header. */
  onToggleSort: (key: SchoolSortKey) => void
}

/**
 * Renders the Schools table. Every column but Events sorts; the rating
 * columns explain how they are computed. The top few schools are marked
 * legendary (see {@link legendaryCount}) and schools with a balanced score of 80+ get a gold border
 * (see {@link rowTier}). Scrolls horizontally on narrow screens.
 *
 * @param props - See {@link SchoolRankingsTableProps}.
 */
export function SchoolRankingsTable({ rows, legendary, format, sort, onToggleSort }: SchoolRankingsTableProps) {
  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
      <Table
        className="table-fixed text-sm"
        style={{ width: COLUMNS.reduce((total, col) => total + col.width, 0) }}
      >
        <TableHeader className="bg-muted/50">
          <TableRow>
            {COLUMNS.map((col) => {
              const sortKey = col.key === "events" ? null : col.key
              const active = sortKey !== null && sort.key === sortKey
              return (
                <TableHead
                  key={col.key}
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                  style={{ width: col.width }}
                  className={cn("overflow-hidden whitespace-nowrap px-2 py-1", col.numeric && "text-right")}
                >
                  <span className={cn("inline-flex max-w-full items-center gap-1", col.numeric && "flex-row-reverse")}>
                    {sortKey ? (
                      <button
                        type="button"
                        onClick={() => onToggleSort(sortKey)}
                        className={cn(
                          "inline-flex items-center gap-0.5 select-none hover:text-foreground",
                          active && "text-foreground",
                        )}
                      >
                        {col.label}
                        {active &&
                          (sort.dir === "desc" ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronUp className="h-3 w-3" />
                          ))}
                      </button>
                    ) : (
                      col.label
                    )}
                    {col.tooltip && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 cursor-help opacity-60" aria-label={`About ${col.label}`} />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs font-normal">{col.tooltip}</TooltipContent>
                      </Tooltip>
                    )}
                  </span>
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const tier = rowTier(row.rank, row.balancedScore, legendary)
            return (
            <TableRow key={row.school} data-tier={tier ?? undefined} className={tier ? ROW_TIER_CLASS[tier] : undefined}>
              {COLUMNS.map((col) => (
                <TableCell
                  key={col.key}
                  className={cn(
                    "truncate whitespace-nowrap text-muted-foreground px-2 py-1",
                    col.numeric && "text-right tabular-nums",
                  )}
                  title={col.key === "school" ? row.school : col.key === "bestEntry" ? row.bestEntry : undefined}
                >
                  {col.render(row, tier, format)}
                </TableCell>
              ))}
            </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
