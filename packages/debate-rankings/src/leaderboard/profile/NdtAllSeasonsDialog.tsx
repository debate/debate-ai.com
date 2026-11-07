/**
 * @fileoverview "All seasons" button on a college school's NDT record and the
 * modal it opens: every NDT team (a pair of debaters) and every school ranked
 * by all-seasons NDT points — elim finishes, Copeland Awards, first-round
 * at-large bids and speaker awards — with each row's point breakdown and the
 * scoring printed underneath. Teams link to their past-team pages, schools to
 * their school pages. The school whose page it is is highlighted.
 * @module leaderboard/profile/NdtAllSeasonsDialog
 */

"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { Medal, X } from "lucide-react"
import type { NdtSchoolHistory } from "../../sync/ndt-school-history"
import { Button } from "../ui/primitives/button"
import { pastTeamHref } from "./pastTeamHelpers"
import { schoolHref } from "./rankingProfileHelpers"
import {
  buildNdtAllSeasons,
  NDT_ERA_WEIGHTS,
  NDT_POINTS_PARTS,
  ndtSchoolDisplayName,
  rowRanks,
  type NdtAllSeasonsTable,
  type NdtPointsRow,
} from "./ndtAllSeasons"
import { STRENGTH_WEIGHTS } from "./programStrength"

/** Rows shown before "Show more". */
const PAGE = 50

let cachedTable: { history: NdtSchoolHistory[]; table: NdtAllSeasonsTable } | null = null

function allSeasonsTable(history: NdtSchoolHistory[]): NdtAllSeasonsTable {
  if (cachedTable?.history !== history) cachedTable = { history, table: buildNdtAllSeasons(history) }
  return cachedTable.table
}

const years = (row: Pick<NdtPointsRow, "firstYear" | "lastYear">) => (row.firstYear === row.lastYear ? `${row.firstYear}` : `${row.firstYear}–${row.lastYear}`)

function Breakdown({ row }: { row: NdtPointsRow }) {
  const c = row.counts
  const detail: Record<string, string> = {
    elims: `${c.elims} elim${c.elims === 1 ? "" : "s"}${c.titles ? `, ${c.titles} title${c.titles === 1 ? "" : "s"}` : ""}`,
    copeland: `${c.copeland}×`,
    bids: `${c.bids}×`,
    speakers: `${c.speakerAwards} award${c.speakerAwards === 1 ? "" : "s"}`,
    partners: `${row.sidePartnerships?.length ?? 0} side team${row.sidePartnerships?.length === 1 ? "" : "s"}`,
  }
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
      {NDT_POINTS_PARTS.filter(({ key }) => row.parts[key] > 0).map(({ key, short }) => (
        <span key={key}>
          {short} <span className="tabular-nums text-foreground">{row.parts[key]}</span>{" "}
          <span className="text-muted-foreground/80">({detail[key]})</span>
        </span>
      ))}
    </div>
  )
}

function RankedRows({
  rows,
  kind,
  highlight,
}: {
  rows: { row: NdtPointsRow; rank: number }[]
  kind: "teams" | "schools"
  highlight: string | null
}) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">No matches.</p>
  return (
    <ol className="divide-y">
      {rows.map(({ row, rank }) => {
        const own = highlight !== null && row.school === highlight
        return (
          <li
            key={row.key}
            className={`flex items-start gap-3 px-2 py-2 ${own ? "rounded-md bg-primary/10" : ""}`}
            data-own-school={own || undefined}
          >
            <span className="w-9 shrink-0 pt-0.5 text-right text-sm font-semibold tabular-nums text-muted-foreground">
              #{rank}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                {kind === "teams" ? (
                  <>
                    <Link
                      href={pastTeamHref({ school: row.school, name: row.team })}
                      className="font-medium text-foreground hover:underline underline-offset-4"
                    >
                      {row.team}
                    </Link>
                    <span className="text-sm text-muted-foreground">{ndtSchoolDisplayName(row.school)}</span>
                  </>
                ) : (
                  <Link
                    href={schoolHref(ndtSchoolDisplayName(row.school))}
                    className="font-medium text-foreground hover:underline underline-offset-4"
                  >
                    {ndtSchoolDisplayName(row.school)}
                  </Link>
                )}
                <span className="text-xs tabular-nums text-muted-foreground/80">{years(row)}</span>
              </div>
              <Breakdown row={row} />
              {row.sidePartnerships && row.sidePartnerships.length > 0 && (
                <ul className="mt-1 space-y-0.5 border-l pl-2 text-xs text-muted-foreground" aria-label="Side partnerships">
                  {row.sidePartnerships.map((side) => (
                    <li key={side.key} className="flex flex-wrap items-baseline gap-x-2">
                      <Link
                        href={pastTeamHref({ school: side.school, name: side.team })}
                        className="text-foreground hover:underline underline-offset-4"
                      >
                        {side.team}
                      </Link>
                      <span className="tabular-nums">{years(side)}</span>
                      <span className="tabular-nums">
                        {side.total} pts, ½ = <span className="text-foreground">+{side.credit}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <span className="shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-foreground">{row.total} pts</span>
          </li>
        )
      })}
    </ol>
  )
}

const ELIM_ROUNDS = ["Champion", "Finals", "Semis", "Quarters", "Octas", "Doubles"]

/** The scoring, printed under the table. */
export function NdtAllSeasonsScoring() {
  const w = STRENGTH_WEIGHTS
  return (
    <details className="mt-3 text-xs text-muted-foreground">
      <summary className="cursor-pointer text-sm text-foreground">How the points work</summary>
      <ul className="mt-2 list-disc space-y-0.5 pl-5">
        <li>
          Each NDT a team broke at, by the deepest round it reached:{" "}
          {ELIM_ROUNDS.map((round) => `${round} ${w.ndtElim[round]}`).join(", ")}. A title is Champion, not Finals
          plus a bonus.
        </li>
        <li>Copeland Award (the season's top first-round at-large seed): {w.copeland}</li>
        <li>Each first-round at-large bid: {w.firstRoundBid}. The Copeland winner holds a bid too, so it scores both.</li>
        <li>
          Each NDT speaker award: top speaker {w.speaker[0].points}, 2nd–5th {w.speaker[1].points}, 6th–10th{" "}
          {w.speaker[2].points}, 11th–20th {w.speaker[3].points}, credited to the speaker's team that year
        </li>
        <li>
          Then each result is weighted by its season, so recent teams rank higher: every season counts{" "}
          {NDT_ERA_WEIGHTS.yearlyGrowth * 100}% more than the one before it (the latest NDT counts in full, 2015
          about 0.78×, 2000 about 0.54×), and results before {NDT_ERA_WEIGHTS.legacyBefore} are also multiplied by{" "}
          {NDT_ERA_WEIGHTS.legacyMultiplier}. Points shown are after weighting; the counts in brackets are not.
        </li>
        <li>
          A team also gets half the points each of its debaters scored with other partners, listed under it (Miles &
          Vellayappan add half of what Vellayappan scored with another partner).
        </li>
      </ul>
      <p className="mt-2">
        A team is one pair of debaters at one school, across every season they debated together; a debater with two
        partners has two teams. A partnership gets its own row only when it is both debaters' best; any other
        shows under the team it adds to. A school adds up every team it sent, plus speaker awards that can't be matched to
        one listed team. Results come from the NDT's published school history: elims and speakers from 1947,
        first-round bids and the Copeland Award from 1973, when they began.
      </p>
    </details>
  )
}

/**
 * @param props.history - The NDT school history, already loaded by the NDT card.
 * @param props.school - The NDT name of the school whose page this is, highlighted in the table.
 */
export function NdtAllSeasonsButton({ history, school }: { history: NdtSchoolHistory[]; school: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"teams" | "schools">("teams")
  const [query, setQuery] = useState("")
  const [onlyOwn, setOnlyOwn] = useState(false)
  const [shown, setShown] = useState(PAGE)

  const table = useMemo(() => (open ? allSeasonsTable(history) : null), [open, history])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal()
      else dialog.setAttribute("open", "")
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close()
      else dialog.removeAttribute("open")
    }
  }, [open])

  useEffect(() => setShown(PAGE), [tab, query, onlyOwn])

  const view = useMemo(() => {
    if (!table) return null
    const rows = table[tab]
    const ranks = rowRanks(rows)
    const needle = query.trim().toLowerCase()
    const matches = rows
      .map((row, index) => ({ row, rank: ranks[index] }))
      .filter(({ row }) => (!onlyOwn || row.school === school) && (!needle || `${row.team} ${row.school}`.toLowerCase().includes(needle)))
    const ownSchool = table.schools.findIndex((row) => row.school === school)
    return {
      matches,
      ownSchoolRank: ownSchool >= 0 ? rowRanks(table.schools)[ownSchool] : null,
      ownBestTeam: (() => {
        const index = table.teams.findIndex((row) => row.school === school)
        return index >= 0 ? { row: table.teams[index], rank: rowRanks(table.teams)[index] } : null
      })(),
    }
  }, [table, tab, query, onlyOwn, school])

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <Medal aria-hidden />
        All seasons
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby="ndt-all-seasons-title"
        onClose={() => setOpen(false)}
        onClick={(event) => event.target === event.currentTarget && setOpen(false)}
        className="m-auto w-[min(48rem,calc(100vw-2rem))] max-h-[85vh] overflow-hidden rounded-lg border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/50"
      >
        {open && view && (
          <div className="flex max-h-[85vh] flex-col">
            <header className="border-b px-4 pb-3 pt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="ndt-all-seasons-title" className="text-lg font-semibold">
                    All seasons: NDT points
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Every NDT team and school since 1947, ranked by points for elim finishes, Copeland Awards,
                    first-round bids and speaker awards, weighted toward recent seasons.
                  </p>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
                  <X aria-hidden />
                </Button>
              </div>
              <p className="mt-2 text-sm">
                {ndtSchoolDisplayName(school)}:{" "}
                {view.ownSchoolRank ? (
                  <>
                    school <span className="font-semibold tabular-nums">#{view.ownSchoolRank}</span> of{" "}
                    {table!.schools.length}
                  </>
                ) : (
                  "no NDT points"
                )}
                {view.ownBestTeam && (
                  <>
                    {" "}
                    · best team {view.ownBestTeam.row.team}{" "}
                    <span className="font-semibold tabular-nums">#{view.ownBestTeam.rank}</span>
                  </>
                )}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div role="tablist" aria-label="Rank" className="inline-flex rounded-md border p-0.5">
                  {(["teams", "schools"] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={tab === key}
                      onClick={() => setTab(key)}
                      className={`rounded px-3 py-1 text-sm ${tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {key === "teams" ? `Teams (${table!.teams.length})` : `Schools (${table!.schools.length})`}
                    </button>
                  ))}
                </div>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter by name or school"
                  aria-label="Filter by name or school"
                  className="h-8 min-w-0 flex-1 rounded-md border bg-transparent px-2 text-sm"
                />
                {tab === "teams" && (
                  <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <input type="checkbox" checked={onlyOwn} onChange={(event) => setOnlyOwn(event.target.checked)} />
                    Only {ndtSchoolDisplayName(school)}
                  </label>
                )}
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
              <RankedRows rows={view.matches.slice(0, shown)} kind={tab} highlight={school} />
              {view.matches.length > shown && (
                <div className="py-2 text-center">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShown((count) => count + PAGE)}>
                    Show more ({view.matches.length - shown} left)
                  </Button>
                </div>
              )}
              <div className="px-2 pb-2">
                <NdtAllSeasonsScoring />
              </div>
            </div>
          </div>
        )}
      </dialog>
    </>
  )
}
