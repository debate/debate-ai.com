/**
 * @fileoverview National championships section of a high school's profile:
 * one compact list of the school's Tournament of Champions, NDCA national
 * championship and Barkley Forum finishes, newest year first, each row tagged with its
 * tournament (and its event when the school has more than one). A short stat
 * line counts TOC titles, runner-ups and top speakers and NDCA titles, elim
 * finishes and top speakers; zero counts are left out. Speaker places below
 * first aren't listed: they only score in the all-seasons NDT points.
 * Renders nothing for a school with neither record.
 * @module leaderboard/profile/ProfileNationalsHistory
 */

"use client"

import { useMemo } from "react"
import { Trophy } from "lucide-react"
import { findNdcaSchoolRecord, NDCA_SOURCE_URL, ndcaEvent, ndcaPlaceLabel } from "../../sync/ndca-champions"
import { findTocSchoolRecord, TOC_SOURCE_URL } from "../../sync/toc-champions"
import { BARKLEY_SOURCE_URL, findBarkleySchoolResults } from "../../sync/barkley-champions"
import { Badge } from "../ui/primitives/badge"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/primitives/card"

type Tournament = "TOC" | "NDCA" | "Barkley"

/** One listed finish, from either tournament. */
interface NationalsRow {
  tournament: Tournament
  year: number
  event: string
  place: string
  label: string
  competitors: string
  formerName?: string
}

/** Short event names for the row tag. */
const EVENT_SHORT: Record<string, string> = {
  Policy: "Policy",
  "Lincoln-Douglas": "LD",
  "Public Forum": "PF",
  "Silver Public Forum": "Silver PF",
  "World Schools": "WS",
  "Extemporaneous Speaking": "Extemp",
  "Original Oratory": "OO",
  "Dramatic Interpretation": "DI",
  "Duo Interpretation": "Duo",
  "Humorous Interpretation": "HI",
  "Oral Interpretation": "OI",
  "Program Oral Interpretation": "POI",
  "Informative Speaking": "Info",
}

/** Best finish first within a year. */
const PLACE_ORDER = [
  "Champion",
  "Co-champion",
  "Runner-up",
  "Finalist",
  "Top speaker",
  "Semifinalist",
  "Quarterfinalist",
  "Octafinalist",
  "Double-octafinalist",
]

const placeRank = (place: string) => {
  const i = PLACE_ORDER.indexOf(place)
  return i === -1 ? PLACE_ORDER.length : i
}

function placeVariant(place: string): "default" | "secondary" | "outline" {
  if (place === "Champion" || place === "Co-champion") return "default"
  if (place === "Top speaker") return "outline"
  return "secondary"
}

const TOURNAMENT_ORDER: Tournament[] = ["TOC", "NDCA", "Barkley"]

const TOURNAMENT_TAG: Record<Tournament, string> = {
  TOC: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  NDCA: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  Barkley: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
}

/** `1 TOC title`, `2 NDCA elim finishes`. */
function count(n: number, one: string, many: string): string | null {
  return n > 0 ? `${n} ${n === 1 ? one : many}` : null
}

/**
 * @param props.school - School name as the rankings spell it.
 */
export function ProfileNationalsHistory({ school }: { school: string }) {
  const toc = useMemo(() => findTocSchoolRecord(school), [school])
  const ndca = useMemo(() => findNdcaSchoolRecord(school), [school])
  const barkley = useMemo(() => findBarkleySchoolResults(school), [school])

  const rows = useMemo(() => {
    const list: NationalsRow[] = []
    for (const r of toc?.results ?? []) {
      if (r.place === "Speaker") continue
      list.push({
        tournament: "TOC",
        year: r.year,
        event: r.event,
        place: r.place,
        label: r.place,
        competitors: r.competitors,
        formerName: r.formerName,
      })
    }
    for (const r of ndca?.results ?? []) {
      if (r.place === "Speaker") continue
      list.push({
        tournament: "NDCA",
        year: r.year,
        event: ndcaEvent(r),
        place: r.place,
        label: ndcaPlaceLabel(r),
        competitors: r.competitors,
      })
    }
    for (const r of barkley) {
      list.push({
        tournament: "Barkley",
        year: r.year,
        event: r.event,
        place: r.place,
        label: r.place,
        competitors: r.competitors,
      })
    }
    return list.sort(
      (a, b) =>
        b.year - a.year ||
        TOURNAMENT_ORDER.indexOf(a.tournament) - TOURNAMENT_ORDER.indexOf(b.tournament) ||
        placeRank(a.place) - placeRank(b.place),
    )
  }, [toc, ndca, barkley])

  if (rows.length === 0) return null

  const name = toc?.school ?? ndca?.school ?? barkley[0]?.school ?? school
  const showEvent = new Set(rows.map((r) => r.event)).size > 1
  const years = rows.map((r) => r.year)
  const first = Math.min(...years)
  const last = Math.max(...years)
  const hasToc = rows.some((r) => r.tournament === "TOC")
  const hasNdca = rows.some((r) => r.tournament === "NDCA")
  const hasBarkley = rows.some((r) => r.tournament === "Barkley")
  const barkleyTitles = barkley.filter((r) => r.place === "Champion").length
  const stats = [
    count(toc?.titles ?? 0, "TOC title", "TOC titles"),
    count(toc?.runnerUps ?? 0, "TOC runner-up", "TOC runner-ups"),
    count(toc?.topSpeakers ?? 0, "TOC top speaker", "TOC top speakers"),
    count(ndca?.titles ?? 0, "NDCA title", "NDCA titles"),
    count(ndca?.elimFinishes ?? 0, "NDCA elim finish", "NDCA elim finishes"),
    count(ndca?.topSpeakers ?? 0, "NDCA top speaker", "NDCA top speakers"),
    count(barkleyTitles, "Barkley title", "Barkley titles"),
  ].filter((s): s is string => s !== null)

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4" aria-hidden />
          {hasBarkley ? "TOC, NDCA & Barkley nationals" : "TOC & NDCA nationals"}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {name} · {first === last ? first : `${first}–${last}`} · sources:{" "}
          {hasToc && (
            <a href={TOC_SOURCE_URL} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
              UK TOC results
            </a>
          )}
          {hasToc && hasNdca && ", "}
          {hasNdca && (
            <a
              href={NDCA_SOURCE_URL}
              target="_blank"
              rel="noreferrer"
              className="underline-offset-2 hover:underline"
              title="NDCA titles and top speakers from 2006 (LD and PF from 2015); policy elim finishes for 2006, 2009, 2011, 2012, 2015–2018, 2021 and 2025; LD 2015 final four"
            >
              NDCA history
            </a>
          )}
          {(hasToc || hasNdca) && hasBarkley && ", "}
          {hasBarkley && (
            <a
              href={BARKLEY_SOURCE_URL}
              target="_blank"
              rel="noreferrer"
              className="underline-offset-2 hover:underline"
              title="Barkley Forum Silver Key winners 2018 and 2021–2026 from the tournament invitations and page; Woodward Academy's own policy finals and semifinals 2001–2019; 2024 LD and PF finalists from Victory Briefs"
            >
              Barkley Forum
            </a>
          )}
        </p>
        {stats.length > 0 && <p className="text-sm tabular-nums text-foreground">{stats.join(" · ")}</p>}
      </CardHeader>
      <CardContent>
        <ul className="space-y-0.5 text-sm">
          {rows.map((row, i) => (
            <li
              key={`${row.tournament}-${row.year}-${row.event}-${row.label}-${row.competitors}-${i}`}
              className="flex flex-wrap items-baseline gap-x-2"
            >
              <span className="w-10 shrink-0 tabular-nums text-foreground">{row.year}</span>
              <span
                className={`rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${TOURNAMENT_TAG[row.tournament]}`}
              >
                {row.tournament}
              </span>
              {showEvent && <span className="text-xs text-muted-foreground">{EVENT_SHORT[row.event] ?? row.event}</span>}
              <Badge variant={placeVariant(row.place)} className="text-xs">
                {row.label}
              </Badge>
              <span className="text-foreground">{row.competitors}</span>
              {row.formerName && <span className="text-xs text-muted-foreground">as {row.formerName}</span>}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
