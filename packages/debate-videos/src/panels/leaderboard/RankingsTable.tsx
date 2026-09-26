/**
 * @fileoverview Sortable table of `debate-rankings` rows, one column per field
 * of `output/<prefix>full_rankings.csv`.
 * @module components/debate/DebateVideos/panels/RankingsTable
 */

"use client"

import type { RankingEntry } from "debate-rankings"
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
import { COLUMN_TOOLTIPS, displayEntryName } from "./leaderboardUtils"
import type { Division, SortKey, SortState } from "./leaderboardTypes"
import { schoolHref, teamHref } from "./profile/rankingProfileHelpers"

/** One table column: which field it shows and how. */
interface Column {
  key: SortKey
  label: string
  /** Right-align and use tabular figures. */
  numeric?: boolean
  /** Shrink the column to its content instead of sharing spare width. */
  compact?: boolean
  render: (entry: RankingEntry, division: Division) => React.ReactNode
}

/**
 * A rating rounded to a whole number, with the leading (thousands and
 * hundreds) digits bold and large and the last two digits smaller, so the
 * magnitude reads at a glance: **15**43.
 */
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

/** A win-rate progress bar with its percentage, or a dash when no rounds were debated on that side. */
function WinRate({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground/60">—</span>
  const pct = Math.min(100, Math.max(0, value))
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"
      >
        <span
          className={cn(
            "block h-full rounded-full",
            value >= 75 ? "bg-emerald-500" : value < 25 ? "bg-muted-foreground/40" : "bg-primary/70",
          )}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span
        className={cn(
          "w-11 text-right",
          value >= 75 && "text-emerald-600 dark:text-emerald-400 font-medium",
          value < 25 && "text-muted-foreground",
        )}
      >
        {Number.isInteger(value) ? value : value.toFixed(1)}%
      </span>
    </span>
  )
}

const COLUMNS: Column[] = [
  { key: "rank", label: "#", numeric: true, compact: true, render: (e) => <span className="font-semibold">{e.rank}</span> },
  {
    key: "school",
    label: "School",
    render: (e) => (
      <Link href={schoolHref(e.school)} className="hover:text-foreground hover:underline underline-offset-4">
        {e.school}
      </Link>
    ),
  },
  {
    key: "name",
    label: "Name",
    render: (e, division) => (
      <Link href={teamHref(e)} className="font-medium text-foreground hover:underline underline-offset-4">
        {displayEntryName(e.name, division)}
      </Link>
    ),
  },
  {
    key: "adjustedRating",
    label: "Rating",
    numeric: true,
    compact: true,
    render: (e) => <Rating value={e.adjustedRating} />,
  },
  { key: "matches", label: "Matches", numeric: true, render: (e) => e.matches },
  { key: "affWinRate", label: "Aff Win", numeric: true, render: (e) => <WinRate value={e.affWinRate} /> },
  { key: "negWinRate", label: "Neg Win", numeric: true, render: (e) => <WinRate value={e.negWinRate} /> },
  { key: "affElimWinRate", label: "Aff Elim", numeric: true, render: (e) => <WinRate value={e.affElimWinRate} /> },
  { key: "negElimWinRate", label: "Neg Elim", numeric: true, render: (e) => <WinRate value={e.negElimWinRate} /> },
]

/** Props for the {@link RankingsTable} component. */
interface RankingsTableProps {
  /** Pre-sorted and pre-filtered rows to render. */
  entries: RankingEntry[]
  /** Active division; LD rows show only the debater's last name. */
  division: Division
  /** Current sort state. */
  sort: SortState
  /** Called when the user clicks a column header. */
  onToggleSort: (key: SortKey) => void
}

/**
 * Renders every field of each ranking row. Every column header sorts; headers
 * with a {@link COLUMN_TOOLTIPS} entry explain how the value is computed.
 * Wide on purpose — the table scrolls horizontally on narrow screens.
 *
 * @param props - See {@link RankingsTableProps}.
 */
export function RankingsTable({ entries, division, sort, onToggleSort }: RankingsTableProps) {
  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <Table className="min-w-[960px] text-sm">
        <TableHeader className="bg-muted/50">
          <TableRow>
            {COLUMNS.map((col) => {
              const tip = COLUMN_TOOLTIPS[col.key]
              const active = sort?.key === col.key
              return (
                <TableHead
                  key={col.key}
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                  className={cn("whitespace-nowrap px-2 py-1", col.numeric && "text-right", col.compact && "w-px")}
                >
                  <span className={cn("inline-flex items-center gap-1", col.numeric && "flex-row-reverse")}>
                    <button
                      type="button"
                      onClick={() => onToggleSort(col.key)}
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
                    {tip && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 cursor-help opacity-60" aria-label={`About ${col.key === "rank" ? "rank" : col.label}`} />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs font-normal">{tip}</TooltipContent>
                      </Tooltip>
                    )}
                  </span>
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.hash || `${entry.rank}-${entry.name}`}>
              {COLUMNS.map((col) => (
                <TableCell
                  key={col.key}
                  className={cn(
                    "whitespace-nowrap text-muted-foreground px-2 py-1",
                    col.numeric && "text-right tabular-nums",
                    col.compact && "w-px",
                    col.key === "school" && "max-w-[180px] truncate",
                    col.key === "name" && "max-w-[180px] truncate",
                  )}
                  title={col.key === "school" ? entry.school : col.key === "name" ? entry.name : undefined}
                >
                  {col.render(entry, division)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
