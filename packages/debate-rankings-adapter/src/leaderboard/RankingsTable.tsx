/**
 * @fileoverview Sortable table of `debate-rankings` rows, one column per field
 * of `output/<prefix>full_rankings.csv`.
 * @module leaderboard/RankingsTable
 */

"use client"

import { teamDisplayParts, type RankingEntry } from "../index"
import { RatingDigits } from "./RatingDigits"
import Link from "next/link"
import { ChevronDown, ChevronUp, Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/primitives/tooltip"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/primitives/table"
import { cn } from "./ui/lib/utils"
import { ColumnResizeHandle } from "./grid/ColumnResizeHandle"
import { useResizableColumns } from "./grid/useResizableColumns"
import { COLUMN_TOOLTIPS, DIVISION_SHORT_LABELS, schoolRankOf } from "./leaderboardUtils"
import type { Division, SortKey, SortState } from "./leaderboardTypes"
import { schoolHref, teamHref } from "./profile/rankingProfileHelpers"
import { TeamLabel } from "./team-label/TeamLabel"
import { LegendaryBadge, ROW_TIER_CLASS, rowTier, type RowTier } from "./rowTier"
import { rankedTeamKey, type TocBidTeam } from "@debate-ai/data-sync/src/rankings/sync-toc-bids-sheet"

/** TOC bids per entry, keyed by `rankedTeamKey` (see `matchTocBids`). */
export type EntryBids = ReadonlyMap<string, TocBidTeam>

/** The fields shown as columns. */
type ColumnKey = Extract<
  SortKey,
  | "rank"
  | "school"
  | "adjustedRating"
  | "bids"
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
  render: (
    entry: RankingEntry,
    division: Division,
    tier: RowTier,
    schoolRanks: ReadonlyMap<string, number>,
    bids: EntryBids | undefined,
  ) => React.ReactNode
}

/** A team's bid count; hovering it lists the tournaments the bids came from. */
function BidCount({ team }: { team: TocBidTeam | undefined }) {
  if (!team) return <span className="text-muted-foreground/60">—</span>
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="cursor-help font-semibold text-foreground underline decoration-dotted underline-offset-2"
          aria-label={`${team.bids} TOC ${team.bids === 1 ? "bid" : "bids"}: ${team.tournaments.join(", ")}`}
        >
          {team.bids}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs font-normal">
        <p className="mb-1 font-medium">
          {team.bids} TOC {team.bids === 1 ? "bid" : "bids"}
        </p>
        {team.tournaments.length > 0 ? (
          <ul className="list-disc pl-4">
            {team.tournaments.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">Tournaments not listed on the bids sheet.</p>
        )}
      </TooltipContent>
    </Tooltip>
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
  {
    key: "rank",
    label: "#",
    numeric: true,
    render: (e) => <span className="font-semibold">{e.rank}</span>,
  },
  {
    key: "school",
    label: "Team",
    render: (e, division, tier, schoolRanks) => {
      const schoolRank = schoolRankOf(schoolRanks, e.school)
      return (
        <>
          <TeamLabel
            {...teamDisplayParts({ school: e.school, name: e.name })}
            schoolHref={schoolHref(e.school)}
            href={teamHref(e)}
            title={`${e.school} · ${e.name}`}
            className="text-foreground"
          />
          {schoolRank !== undefined && (
            <span className="ml-1.5 text-xs tabular-nums text-muted-foreground/70" title="School rank in the Schools tab for this format">
              #{schoolRank}
            </span>
          )}
          {tier === "legendary" && (
            <span className="ml-1.5">
              <LegendaryBadge format={DIVISION_SHORT_LABELS[division]} />
            </span>
          )}
        </>
      )
    },
  },
  {
    key: "adjustedRating",
    label: "Rating",
    numeric: true,
    render: (e) => <RatingDigits value={e.adjustedRating} />,
  },
  {
    key: "bids",
    label: "Bids",
    numeric: true,
    render: (e, _division, _tier, _schoolRanks, bids) => <BidCount team={bids?.get(rankedTeamKey(e))} />,
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
  school: 360,
  adjustedRating: 90,
  bids: 70,
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
  /** How many top ranks are legendary, from the whole list ({@link legendaryCount}). */
  legendary: number
  /** Each school's rank in the Schools tab for this division ({@link schoolRanksByName}). */
  schoolRanks: ReadonlyMap<string, number>
  /** Active division; LD rows show only the debater's last name. */
  division: Division
  /** Current sort state. */
  sort: SortState
  /** Called when the user clicks a column header. */
  onToggleSort: (key: SortKey) => void
  /** TOC bids per entry; the Bids column shows only when this is given (policy). */
  bids?: EntryBids
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
export function RankingsTable({ entries, legendary, schoolRanks, division, sort, onToggleSort, bids }: RankingsTableProps) {
  const { widths, startResize } = useResizableColumns(DEFAULT_COLUMN_WIDTHS)
  const columns = bids ? COLUMNS : COLUMNS.filter((col) => col.key !== "bids")
  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <Table
        className="table-fixed text-sm"
        style={{ width: columns.reduce((total, col) => total + widths[col.key], 0) }}
      >
        <TableHeader className="bg-muted/50">
          <TableRow>
            {columns.map((col) => {
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
          {entries.map((entry) => {
            const tier = rowTier(entry.rank, entry.adjustedRating, legendary)
            return (
            <TableRow
              key={entry.hash || `${entry.rank}-${entry.name}`}
              data-tier={tier ?? undefined}
              className={tier ? ROW_TIER_CLASS[tier] : undefined}
            >
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className={cn(
                    "truncate whitespace-nowrap text-muted-foreground px-2 py-1",
                    col.numeric && "text-right tabular-nums",
                  )}
                  title={col.key === "school" ? `${entry.school} · ${entry.name}` : undefined}
                >
                  {col.render(entry, division, tier, schoolRanks, bids)}
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
