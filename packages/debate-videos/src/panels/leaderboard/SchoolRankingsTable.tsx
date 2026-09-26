/**
 * @fileoverview Sortable Schools table: every school with ranked entries,
 * ranked by its best entry's rating, alongside the average rating of all its
 * entries.
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

/** One table column: which field it shows and how. */
interface Column {
  key: SchoolSortKey | "events"
  label: string
  /** Right-align and use tabular figures. */
  numeric?: boolean
  /** Explains how the value is computed. */
  tooltip?: string
  width: number
  render: (row: SchoolRanking) => React.ReactNode
}

/** A rating rounded to a whole number, leading digits emphasized (matches the division tables). */
function Rating({ value }: { value: number }) {
  const text = Math.round(value).toString()
  const head = text.length > 2 ? text.slice(0, -2) : text
  const tail = text.length > 2 ? text.slice(-2) : ""
  return (
    <span className="text-foreground" aria-label={text}>
      <span className="text-base font-bold">{head}</span>
      {tail && <span className="text-xs font-medium text-muted-foreground">{tail}</span>}
    </span>
  )
}

const COLUMNS: Column[] = [
  { key: "rank", label: "#", numeric: true, width: 60, render: (r) => <span className="font-semibold">{r.rank}</span> },
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
    tooltip: "Highest adjusted rating (Rating − 2 × Deviation) among the school's ranked entries. Schools rank on it.",
    render: (r) => <Rating value={r.bestRating} />,
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
    render: (r) => <Rating value={r.avgRating} />,
  },
  { key: "teams", label: "Teams", numeric: true, width: 90, render: (r) => r.teams },
  { key: "events", label: "Events", width: 160, render: (r) => r.events.join(", ") },
]

/** Props for the {@link SchoolRankingsTable} component. */
interface SchoolRankingsTableProps {
  /** Pre-sorted and pre-filtered rows to render. */
  rows: SchoolRanking[]
  /** Current sort state. */
  sort: SchoolSortState
  /** Called when the user clicks a sortable column header. */
  onToggleSort: (key: SchoolSortKey) => void
}

/**
 * Renders the Schools table. Every column but Events sorts; the rating
 * columns explain how they are computed. Scrolls horizontally on narrow screens.
 *
 * @param props - See {@link SchoolRankingsTableProps}.
 */
export function SchoolRankingsTable({ rows, sort, onToggleSort }: SchoolRankingsTableProps) {
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
          {rows.map((row) => (
            <TableRow key={row.school}>
              {COLUMNS.map((col) => (
                <TableCell
                  key={col.key}
                  className={cn(
                    "truncate whitespace-nowrap text-muted-foreground px-2 py-1",
                    col.numeric && "text-right tabular-nums",
                  )}
                  title={col.key === "school" ? row.school : col.key === "bestEntry" ? row.bestEntry : undefined}
                >
                  {col.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
