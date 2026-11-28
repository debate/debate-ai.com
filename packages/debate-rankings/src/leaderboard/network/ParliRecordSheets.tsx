/**
 * @fileoverview The Parli tab's "Who debated whom" card: a record sheet for
 * each top-ranked NPDL team, built from Tabroom pairings (see
 * `parliRecordSheets.ts`). Each sheet is a table of the rounds the team
 * debated (tournament, round, side, opponent, judging panel, result) under a
 * headline W-L. Opponents that are themselves ranked jump to their own sheet.
 *
 * Falls back to {@link HeadToHeadNetworkEmpty} while the rankings load and
 * when no Tabroom rounds are available for the season, so the card never
 * shows an empty table.
 * @module @debate-ai/rankings/leaderboard/network/ParliRecordSheets
 */

"use client"

import { useEffect, useMemo, useState } from "react"
import { Network } from "lucide-react"
import type { NpdlRankingRow, NpdlSeasonRankings } from "../../sync/sync-npdl-rankings"
import type { ParliRoundsSeason } from "../../sync/parli-tabroom-rounds"
import { SIDE_BAR_DOT } from "../side-styles"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/primitives/table"
import { cn } from "../ui/lib/utils"
import { HeadToHeadNetworkEmpty } from "./HeadToHeadNetworkEmpty"
import { loadParliRounds } from "./loadParliRounds"
import {
  buildParliRecordSheets,
  parliTeamId,
  parliTeamLabel,
  PARLI_SHEET_LIMIT,
  type ParliRecordSheet,
  type ParliSheetRound,
} from "./parliRecordSheets"

const roundUrl = (round: Pick<ParliSheetRound, "tournamentId" | "roundId">) =>
  `https://www.tabroom.com/index/tourn/postings/round.mhtml?tourn_id=${encodeURIComponent(round.tournamentId)}&round_id=${encodeURIComponent(round.roundId)}`

/** `"Nov 14"` from `2026-11-14`. */
function shortDate(date: string | null): string {
  if (!date) return ""
  const [, month, day] = date.split("-").map(Number)
  const name = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month - 1]
  return name && day ? `${name} ${day}` : ""
}

/** `3–1`, with the rounds whose result is not public set aside. */
export function recordText(sheet: Pick<ParliRecordSheet, "wins" | "losses">): string {
  return `${sheet.wins}–${sheet.losses}`
}

function ResultCell({ round }: { round: ParliSheetRound }) {
  if (!round.result) {
    return (
      <span className="text-muted-foreground" title="Tabroom does not publish this round's result without a login">
        —
      </span>
    )
  }
  const inferred = round.resultSource === "advancement"
  return (
    <span
      className={cn("font-semibold", round.result === "W" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}
      title={inferred ? "Inferred: this team did (or did not) reach the next elimination round" : "From the round's ballots"}
    >
      {round.result}
      {round.votes ? <span className="ml-1 text-xs font-normal text-muted-foreground">{round.votes}</span> : null}
      {inferred ? <span className="ml-0.5 text-xs font-normal text-muted-foreground">*</span> : null}
    </span>
  )
}

function OpponentCell({ round, onOpen }: { round: ParliSheetRound; onOpen: (row: NpdlRankingRow) => void }) {
  const { opponent } = round
  if (!opponent) return <span title="Not in the season's rankings">{round.opponentCode}</span>
  return (
    <a
      href={`#${parliTeamId(opponent)}`}
      className="text-blue-600 hover:underline dark:text-blue-400"
      onClick={() => onOpen(opponent)}
      data-testid="parli-opponent-link"
    >
      {parliTeamLabel(opponent)}
      <span className="ml-1 text-xs text-muted-foreground">#{opponent.rank}</span>
    </a>
  )
}

function SheetTable({ sheet, onOpen }: { sheet: ParliRecordSheet; onOpen: (row: NpdlRankingRow) => void }) {
  return (
    <Table className="text-xs" data-testid="parli-sheet-table">
      <TableHeader>
        <TableRow>
          <TableHead>Tournament</TableHead>
          <TableHead>Round</TableHead>
          <TableHead>Side</TableHead>
          <TableHead>Opponent</TableHead>
          <TableHead className="hidden md:table-cell">Judges</TableHead>
          <TableHead className="text-right">Result</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sheet.rounds.map((round, i) => (
          <TableRow key={`${round.roundId}-${i}`}>
            <TableCell className="whitespace-normal">
              <span className="font-medium">{round.tournament}</span>
              {round.date ? <span className="ml-1 text-muted-foreground">{shortDate(round.date)}</span> : null}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <a
                href={roundUrl(round)}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("hover:underline", round.elim && "font-semibold")}
                title={`${round.tournament} ${round.round} on Tabroom`}
              >
                {round.round}
              </a>
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <span className="inline-flex items-center gap-1">
                <span className={cn("h-2 w-2 rounded-full", round.side === "Gov" ? SIDE_BAR_DOT.aff : SIDE_BAR_DOT.neg)} aria-hidden />
                {round.side}
              </span>
            </TableCell>
            <TableCell className="whitespace-normal">
              <OpponentCell round={round} onOpen={onOpen} />
            </TableCell>
            <TableCell className="hidden whitespace-normal text-muted-foreground md:table-cell">{round.judges.join(", ")}</TableCell>
            <TableCell className="text-right">
              <ResultCell round={round} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function SheetItem({
  sheet,
  open,
  onToggle,
  onOpenTeam,
  teamHref,
}: {
  sheet: ParliRecordSheet
  open: boolean
  onToggle: (open: boolean) => void
  onOpenTeam: (row: NpdlRankingRow) => void
  teamHref?: (row: NpdlRankingRow) => string | null
}) {
  const href = teamHref?.(sheet.team) ?? null
  const name = parliTeamLabel(sheet.team)
  return (
    <details
      id={parliTeamId(sheet.team)}
      open={open}
      onToggle={(e) => onToggle((e.currentTarget as HTMLDetailsElement).open)}
      className="rounded-md border"
      data-testid="parli-sheet"
    >
      <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-2 text-sm">
        <span className="w-8 text-right tabular-nums text-muted-foreground">#{sheet.team.rank}</span>
        {href ? (
          <a href={href} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
            {name}
          </a>
        ) : (
          <span className="font-medium">{name}</span>
        )}
        <span className="ml-auto tabular-nums" data-testid="parli-sheet-record">
          {recordText(sheet)}
        </span>
        <span className="text-xs text-muted-foreground">
          {sheet.rounds.length} rounds{sheet.unknown ? `, ${sheet.unknown} without a public result` : ""}
        </span>
      </summary>
      {open ? (
        <div className="border-t px-1 pb-2">
          <SheetTable sheet={sheet} onOpen={onOpenTeam} />
        </div>
      ) : null}
    </details>
  )
}

/** Props for {@link ParliRecordSheets}. */
export interface ParliRecordSheetsProps {
  /** The season's rankings: `undefined` while loading, `null` when unavailable. */
  rankings: NpdlSeasonRankings | null | undefined
  /** Teams that get a sheet (default {@link PARLI_SHEET_LIMIT}). */
  limit?: number
  /** A team's own page, when it has one (Parli teams have none yet, so rows are plain text by default). */
  teamHref?: (row: NpdlRankingRow) => string | null
  /** Replaces the lazy snapshot loader (tests). */
  loadRounds?: (season: string) => Promise<ParliRoundsSeason | null>
  className?: string
}

/** The card. */
export function ParliRecordSheets({
  rankings,
  limit = PARLI_SHEET_LIMIT,
  teamHref,
  loadRounds = loadParliRounds,
  className = "",
}: ParliRecordSheetsProps) {
  const season = rankings?.season ?? null
  const [data, setData] = useState<{ season: string; rounds: ParliRoundsSeason | null } | "error" | null>(null)
  /** Sheets the reader opened or closed; `null` until they do, when the best team's is open. */
  const [openIds, setOpenIds] = useState<ReadonlySet<string> | null>(null)

  useEffect(() => {
    if (!season) return
    let cancelled = false
    setData(null)
    loadRounds(season)
      .then((rounds) => !cancelled && setData({ season, rounds }))
      .catch(() => !cancelled && setData("error"))
    return () => {
      cancelled = true
    }
  }, [season, loadRounds])

  const result = useMemo(
    () =>
      rankings && data && data !== "error" && data.season === rankings.season && data.rounds
        ? buildParliRecordSheets(rankings.teams, data.rounds, limit)
        : null,
    [rankings, data, limit],
  )

  const firstId = result?.sheets[0] ? parliTeamId(result.sheets[0].team) : null
  const currentOpen: ReadonlySet<string> = openIds ?? new Set(firstId ? [firstId] : [])
  const setOpen = (id: string, open: boolean) => {
    if (currentOpen.has(id) === open) return
    const next = new Set(currentOpen)
    if (open) next.add(id)
    else next.delete(id)
    setOpenIds(next)
  }

  if (rankings === undefined || (rankings && (data === null || (data !== "error" && data.season !== rankings.season)))) {
    return <HeadToHeadNetworkEmpty className={className} message="Loading Tabroom rounds…" />
  }
  if (!rankings || !result || result.sheets.length === 0) {
    return (
      <HeadToHeadNetworkEmpty
        className={className}
        message={
          rankings
            ? `No Tabroom rounds for the top Parli teams in ${rankings.season} yet. The league publishes points per team, not the ballots or pairings behind them; record sheets appear here once its Tabroom tournaments are synced.`
            : undefined
        }
      />
    )
  }

  const openTeam = (row: NpdlRankingRow) => {
    const id = parliTeamId(row)
    if (result.sheets.some((s) => parliTeamId(s.team) === id)) setOpen(id, true)
  }

  return (
    <section aria-labelledby="h2h-network-title" className={cn("mb-4 rounded-lg border p-3 sm:p-4", className)} data-testid="parli-record-sheets">
      <div className="mb-1 flex items-center gap-2">
        <Network className="h-4 w-4 text-violet-500" aria-hidden />
        <h2 id="h2h-network-title" className="text-base font-semibold">
          Who debated whom
        </h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground" data-testid="parli-sheets-note">
        Record sheets for the top {result.sheets.length} {rankings.season} teams, from {result.pairings.toLocaleString("en-US")} Tabroom pairings at{" "}
        {result.tournaments} NPDL tournaments.{" "}
        {result.fullResults
          ? "Results are from each round's ballots."
          : "Tabroom hides round results behind a login, so only elimination rounds show a result (inferred from who advanced, marked *); W–L counts those."}
      </p>
      <div className="flex flex-col gap-2">
        {result.sheets.map((sheet) => {
          const id = parliTeamId(sheet.team)
          return (
            <SheetItem
              key={id}
              sheet={sheet}
              open={currentOpen.has(id)}
              onToggle={(open) => setOpen(id, open)}
              onOpenTeam={openTeam}
              teamHref={teamHref}
            />
          )
        })}
      </div>
      {result.unmatched.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground" data-testid="parli-sheets-unmatched">
          No Tabroom rounds matched for {result.unmatched.length} of the top {limit}:{" "}
          {result.unmatched.map((t) => `#${t.rank} ${parliTeamLabel(t)}`).join("; ")}.
        </p>
      )}
    </section>
  )
}
