/**
 * @fileoverview "All seasons" button on a college school's NDT record and the
 * modal it opens: every NDT team (a pair of debaters) and every school ranked
 * by all-seasons NDT points — elim finishes, Copeland Awards, first-round
 * at-large bids and speaker awards — with each row's point breakdown and the
 * scoring printed underneath. A picker ranks people three ways
 * ({@link NdtRankingMode}): individual debaters, teams with their debaters'
 * other partnerships, or teams strictly on what the pair did together. Teams
 * link to their past-team pages, schools to their school pages. The school
 * whose page it is is highlighted.
 * @module leaderboard/profile/NdtAllSeasonsDialog
 */

"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { Medal, X } from "lucide-react"
import type { NdtSchoolHistory } from "../../sync/ndt-school-history"
import { Button } from "../ui/primitives/button"
import { SchoolLogo } from "../SchoolLogo"
import { pastTeamHref } from "./pastTeamHelpers"
import { schoolHref } from "./rankingProfileHelpers"
import {
  buildNdtAllSeasons,
  HS_NDCA_POINTS,
  HS_NDCA_FINISH_POINTS,
  HS_NDCA_SPEAKER_POINTS,
  HS_TOC_POINTS,
  highSchoolPlaceLabel,
  NDT_ERA_CUTOFF_YEAR,
  NDT_POINTS_MULTIPLIERS,
  NDT_PRE_ERA_MULTIPLIER,
  NDT_POINTS_PARTS,
  NDT_RANKING_MODES,
  ndtSchoolDisplayName,
  rowRanks,
  type NdtAllSeasonsTable,
  type NdtPointsRow,
  type NdtRankingMode,
} from "./ndtAllSeasons"
import { STRENGTH_WEIGHTS } from "./programStrength"

/** Rows shown before "Show more". */
const PAGE = 50

let cachedTable: { history: NdtSchoolHistory[]; table: NdtAllSeasonsTable } | null = null

function allSeasonsTable(history: NdtSchoolHistory[]): NdtAllSeasonsTable {
  if (cachedTable?.history !== history) cachedTable = { history, table: buildNdtAllSeasons(history) }
  return cachedTable.table
}

/** The rows a mode ranks. */
function modeRows(table: NdtAllSeasonsTable, mode: NdtRankingMode): NdtPointsRow[] {
  return mode === "debaters" ? table.debaters : mode === "strict" ? table.strictTeams : table.teams
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
    highSchool: `${row.highSchool?.length ?? 0} TOC/NDCA result${row.highSchool?.length === 1 ? "" : "s"}`,
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
  kind: "teams" | "debaters" | "schools"
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
                {kind === "debaters" ? (
                  <>
                    <span className="font-medium text-foreground">{row.team}</span>
                    <span className="text-sm text-muted-foreground">{ndtSchoolDisplayName(row.school)}</span>
                  </>
                ) : kind === "teams" ? (
                  <>
                    <Link
                      href={pastTeamHref({ school: row.school, name: row.team })}
                      className="font-medium text-foreground hover:underline underline-offset-4"
                    >
                      {row.team}
                    </Link>
                    <span className="inline-flex items-center gap-1 self-center text-sm text-muted-foreground">
                      <SchoolLogo school={ndtSchoolDisplayName(row.school)} className="h-4 w-auto shrink-0" />
                      {ndtSchoolDisplayName(row.school)}
                    </span>
                  </>
                ) : (
                  <Link
                    href={schoolHref(ndtSchoolDisplayName(row.school))}
                    className="inline-flex items-center gap-1.5 self-center font-medium text-foreground hover:underline underline-offset-4"
                  >
                    <SchoolLogo school={ndtSchoolDisplayName(row.school)} className="h-5 w-auto shrink-0" />
                    {ndtSchoolDisplayName(row.school)}
                  </Link>
                )}
                <span className="text-xs tabular-nums text-muted-foreground/80">{years(row)}</span>
              </div>
              <Breakdown row={row} />
              {row.sidePartnerships && row.sidePartnerships.length > 0 && (
                <ul className="mt-1 space-y-0.5 border-l pl-2 text-xs text-muted-foreground" aria-label={kind === "debaters" ? "Partnerships" : "Side partnerships"}>
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
                        <span className="text-foreground">{kind === "debaters" ? side.credit : `+${side.credit}`}</span> pts
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {row.highSchool && row.highSchool.length > 0 && (
                <ul className="mt-1 space-y-0.5 border-l pl-2 text-xs text-muted-foreground" aria-label="High school results">
                  {row.highSchool.map((result) => (
                    <li
                      key={`${result.tournament}-${result.year}-${result.place}-${result.rank ?? ""}-${result.debater}-${result.partners.join("+")}`}
                      className="flex flex-wrap items-baseline gap-x-2"
                    >
                      <span className="tabular-nums">{result.year}</span>
                      <span>
                        {result.tournament} {highSchoolPlaceLabel(result)}: <span className="text-foreground">{result.debater}</span>
                        {result.partners.length > 0 && <> with {result.partners.join(" & ")}</>}
                      </span>
                      <span>{result.school}</span>
                      <span className="tabular-nums">
                        <span className="text-foreground">+{result.points}</span> pts
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
  const m = NDT_POINTS_MULTIPLIERS
  const hs = (points: number) => points * m.highSchool
  return (
    <details className="mt-3 text-xs text-muted-foreground">
      <summary className="cursor-pointer text-sm text-foreground">How the points work</summary>
      <ul className="mt-2 list-disc space-y-0.5 pl-5">
        <li>
          Each NDT a team broke at, by the deepest round it reached:{" "}
          {ELIM_ROUNDS.map((round) => `${round} ${w.ndtElim[round]}`).join(", ")}. A title is Champion, not Finals
          plus a bonus.
        </li>
        <li>
          Copeland Award (the season's top first-round at-large seed): {w.copeland * m.copeland} ({w.copeland} ×{" "}
          {m.copeland}, extra credit for the season-long best team)
        </li>
        <li>Each first-round at-large bid: {w.firstRoundBid}. The Copeland winner holds a bid too, so it scores both.</li>
        <li>
          Each NDT speaker award: top speaker {w.speaker[0].points}, 2nd–5th {w.speaker[1].points}, 6th–10th{" "}
          {w.speaker[2].points}, 11th–20th {w.speaker[3].points}, credited to the speaker's team that year
        </li>
        <li>
          Results from seasons before {NDT_ERA_CUTOFF_YEAR} count {NDT_PRE_ERA_MULTIPLIER}× (40% less), season by
          season: a 1990s title is worth 18 instead of 30, and a team with results on both sides of{" "}
          {NDT_ERA_CUTOFF_YEAR} has only its earlier ones reduced.
        </li>
        <li>
          A team also gets {m.partners === 0.25 ? "a quarter" : `${m.partners} ×`} of the points each of its
          debaters scored with other partners, listed under it (Miles & Vellayappan add a quarter of what
          Vellayappan scored with Peyton Lee).
        </li>
        <li>
          High school: each debater's Tournament of Champions and NDCA national championship policy results, with
          any partner, count {m.highSchool === 0.5 ? "half" : `${m.highSchool} ×`} of their base points: TOC champion{" "}
          {hs(HS_TOC_POINTS.Champion)}, runner-up {hs(HS_TOC_POINTS["Runner-up"])}, top speaker{" "}
          {hs(HS_TOC_POINTS["Top speaker"])}; NDCA champion {hs(HS_NDCA_POINTS.Champion)}, top speaker{" "}
          {hs(HS_NDCA_POINTS["Top speaker"])}; NDCA finalist {hs(HS_NDCA_FINISH_POINTS.Finalist)}, semifinalist{" "}
          {hs(HS_NDCA_FINISH_POINTS.Semifinalist)}, quarterfinalist {hs(HS_NDCA_FINISH_POINTS.Quarterfinalist)},
          octafinalist {hs(HS_NDCA_FINISH_POINTS.Octafinalist)} (the full 2006 bracket, and the 2009, 2011 and 2012
          finalists); NDCA speaker 2nd–5th {hs(HS_NDCA_SPEAKER_POINTS[0].points)},
          6th–10th {hs(HS_NDCA_SPEAKER_POINTS[1].points)}, 11th–15th {hs(HS_NDCA_SPEAKER_POINTS[2].points)}. Debaters
          are matched by full name or a known spelling variant, and each result names the high school partner.
        </li>
      </ul>
      <p className="mt-2">
        A team's score is elims + {m.copeland} × Copeland + bids + speakers + {m.partners} × other partners +{" "}
        {m.highSchool} × high school, with each pre-{NDT_ERA_CUTOFF_YEAR} result then times {NDT_PRE_ERA_MULTIPLIER}.
        It ranks what a partnership did together first; other partners and high school are supplementary.
      </p>
      <ul className="mt-2 list-disc space-y-0.5 pl-5">
        <li>
          <span className="text-foreground">Individual debaters</span>: each debater's NDT elims, Copeland Awards and
          bids with every partner in full, their own speaker awards, and their own high school results.
        </li>
        <li>
          <span className="text-foreground">Teams, with partners' points</span>: each debater's best partnership,
          plus the share of their other partnerships above and their high school results.
        </li>
        <li>
          <span className="text-foreground">Teams, strictly together</span>: every partnership on only what that
          pair did together at the NDT. Nothing from other partners or high school.
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
  const [mode, setMode] = useState<NdtRankingMode>("teams")
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

  useEffect(() => setShown(PAGE), [tab, mode, query, onlyOwn])

  const view = useMemo(() => {
    if (!table) return null
    const people = modeRows(table, mode)
    const rows = tab === "schools" ? table.schools : people
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
        const index = people.findIndex((row) => row.school === school)
        return index >= 0 ? { row: people[index], rank: rowRanks(people)[index] } : null
      })(),
      peopleCount: people.length,
    }
  }, [table, tab, mode, query, onlyOwn, school])

  const modeInfo = NDT_RANKING_MODES.find((option) => option.key === mode)!

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
                    first-round bids and speaker awards, plus each debater's high school TOC and NDCA results.
                    Seasons before {NDT_ERA_CUTOFF_YEAR} count {NDT_PRE_ERA_MULTIPLIER}×.
                  </p>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
                  <X aria-hidden />
                </Button>
              </div>
              <p className="mt-2 text-sm">
                <SchoolLogo
                  school={ndtSchoolDisplayName(school)}
                  className="mr-1.5 inline-block h-5 w-auto align-text-bottom"
                />
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
                    · best {mode === "debaters" ? "debater" : "team"} {view.ownBestTeam.row.team}{" "}
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
                      {key === "teams" ? `${modeInfo.noun} (${view.peopleCount})` : `Schools (${table!.schools.length})`}
                    </button>
                  ))}
                </div>
                {tab === "teams" && (
                  <select
                    value={mode}
                    onChange={(event) => setMode(event.target.value as NdtRankingMode)}
                    aria-label="Rank by"
                    className="h-8 rounded-md border bg-background px-2 text-sm"
                  >
                    {NDT_RANKING_MODES.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
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
              <RankedRows
                rows={view.matches.slice(0, shown)}
                kind={tab === "schools" ? "schools" : mode === "debaters" ? "debaters" : "teams"}
                highlight={school}
              />
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
