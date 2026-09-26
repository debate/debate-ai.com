/**
 * @fileoverview Sortable table of `debate-rankings` rows, one column per field
 * of `output/<prefix>full_rankings.csv`.
 * @module components/debate/DebateVideos/panels/RankingsTable
 */

"use client"

import type { RankingEntry } from "debate-rankings-adapter"
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
import { ColumnResizeHandle } from "../../components/video-grid/ColumnResizeHandle"
import { useResizableColumns } from "../../components/video-grid/useResizableColumns"
import { COLUMN_TOOLTIPS, displayEntryName } from "./leaderboardUtils"
import type { Division, SortKey, SortState } from "./leaderboardTypes"
import { schoolHref, teamHref } from "./profile/rankingProfileHelpers"

/** The fields shown as columns. */
type ColumnKey = Extract<
  SortKey,
  | "rank"
  | "school"
  | "name"
  | "adjustedRating"
  | "matches"
  | "affWinRate"
  | "negWinRate"
  | "affElimWinRate"
  | "negElimWinRate"
>

/** One table column: which field it shows and how. */
interface Column {
  key: ColumnKey
  label: string
  /** Right-align and use tabular figures. */
  numeric?: boolean
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

/** A win-rate bar with its whole-number percentage overlaid, or a dash when no rounds were debated on that side. */
function WinRate({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground/60">—</span>
  const pct = Math.min(100, Math.max(0, Math.round(value)))
  return (
    <span
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className="relative ml-auto flex h-5 w-14 items-center justify-center overflow-hidden rounded-md bg-muted"
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0",
          value >= 75 ? "bg-emerald-500/35" : value < 25 ? "bg-muted-foreground/20" : "bg-primary/30",
        )}
        style={{ width: `${pct}%` }}
      />
      <span
        className={cn(
          "relative text-xs font-medium text-foreground",
          value >= 75 && "text-emerald-700 dark:text-emerald-300",
          value < 25 && "text-muted-foreground",
        )}
      >
        {pct}%
      </span>
    </span>
  )
}

const COLUMNS: Column[] = [
  { key: "rank", label: "#", numeric: true, render: (e) => <span className="font-semibold">{e.rank}</span> },
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
    render: (e) => <Rating value={e.adjustedRating} />,
  },
  { key: "matches", label: "Matches", numeric: true, render: (e) => e.matches },
  { key: "affWinRate", label: "Aff Win", numeric: true, render: (e) => <WinRate value={e.affWinRate} /> },
  { key: "negWinRate", label: "Neg Win", numeric: true, render: (e) => <WinRate value={e.negWinRate} /> },
  { key: "affElimWinRate", label: "Aff Elim", numeric: true, render: (e) => <WinRate value={e.affElimWinRate} /> },
  { key: "negElimWinRate", label: "Neg Elim", numeric: true, render: (e) => <WinRate value={e.negElimWinRate} /> },
]

/** Starting pixel width of each column; every column can be dragged wider or narrower. */
const DEFAULT_COLUMN_WIDTHS: Record<ColumnKey, number> = {
  rank: 60,
  school: 200,
  name: 200,
  adjustedRating: 90,
  matches: 90,
  affWinRate: 100,
  negWinRate: 100,
  affElimWinRate: 100,
  negElimWinRate: 100,
}

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
 * Every column resizes by dragging its header's right edge; text that no
 * longer fits is cut off with an ellipsis. Wide on purpose — the table
 * scrolls horizontally on narrow screens.
 *
 * @param props - See {@link RankingsTableProps}.
 */
export function RankingsTable({ entries, division, sort, onToggleSort }: RankingsTableProps) {
  const { widths, startResize } = useResizableColumns(DEFAULT_COLUMN_WIDTHS)
  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <Table
        className="table-fixed text-sm"
        style={{ width: COLUMNS.reduce((total, col) => total + widths[col.key], 0) }}
      >
        <TableHeader className="bg-muted/50">
          <TableRow>
            {COLUMNS.map((col) => {
              const tip = COLUMN_TOOLTIPS[col.key]
              const active = sort?.key === col.key
              return (
                <TableHead
                  key={col.key}
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                  style={{ width: widths[col.key] }}
                  className={cn("relative overflow-hidden whitespace-nowrap px-2 py-1", col.numeric && "text-right")}
                >
                  <span className={cn("inline-flex max-w-full items-center gap-1", col.numeric && "flex-row-reverse")}>
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
                  <ColumnResizeHandle onResizeStart={(clientX) => startResize(col.key, clientX)} />
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
                    "truncate whitespace-nowrap text-muted-foreground px-2 py-1",
                    col.numeric && "text-right tabular-nums",
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
