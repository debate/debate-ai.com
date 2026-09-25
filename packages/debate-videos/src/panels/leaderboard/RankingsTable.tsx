/**
 * @fileoverview Sortable table of `debate-rankings` rows, one column per field
 * of `output/<prefix>full_rankings.csv`.
 * @module components/debate/DebateVideos/panels/RankingsTable
 */

"use client"

import type { RankingEntry } from "debate-rankings"
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

/** One table column: which field it shows and how. */
interface Column {
  key: SortKey
  label: string
  /** Right-align and use tabular figures. */
  numeric?: boolean
  render: (entry: RankingEntry, division: Division) => React.ReactNode
}

const rating = (n: number) => n.toFixed(1)

/** A win-rate percentage, or a dash when no rounds were debated on that side. */
function WinRate({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground/60">—</span>
  return (
    <span
      className={cn(
        value >= 75 && "text-emerald-600 dark:text-emerald-400 font-medium",
        value < 25 && "text-muted-foreground",
      )}
    >
      {Number.isInteger(value) ? value : value.toFixed(1)}%
    </span>
  )
}

const COLUMNS: Column[] = [
  { key: "rank", label: "Rank", numeric: true, render: (e) => <span className="font-semibold">{e.rank}</span> },
  { key: "school", label: "School", render: (e) => e.school },
  { key: "name", label: "Name", render: (e) => <span className="font-medium text-foreground">{e.name}</span> },
  {
    key: "adjustedRating",
    label: "Adj. Rating",
    numeric: true,
    render: (e) => <span className="font-semibold text-foreground">{rating(e.adjustedRating)}</span>,
  },
  { key: "rating", label: "Rating", numeric: true, render: (e) => rating(e.rating) },
  { key: "deviation", label: "Dev", numeric: true, render: (e) => `±${rating(e.deviation)}` },
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
                  className={cn("whitespace-nowrap px-2 py-1", col.numeric && "text-right")}
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
                          <Info className="h-3 w-3 cursor-help opacity-60" aria-label={`About ${col.label}`} />
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
