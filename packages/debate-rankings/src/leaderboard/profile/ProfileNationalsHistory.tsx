/**
 * @fileoverview National championships section of a high school's profile:
 * one compact list of the school's Tournament of Champions, NDCA national
 * championship, Barkley Forum and Cal Invitational (UC Berkeley) finishes, newest year first, each row tagged with its
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
import { findNdcaSchoolRecord, ndcaEvent, ndcaPlaceLabel } from "../../sync/ndca-champions"
import { findTocSchoolRecord } from "../../sync/toc-champions"
import { findBarkleySchoolResults } from "../../sync/barkley-champions"
import { findCalSchoolResults } from "../../sync/berkeley-champions"
import { Badge } from "../ui/primitives/badge"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/primitives/card"

type Tournament = "TOC" | "NDCA" | "Barkley" | "Cal"

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

const TOURNAMENT_ORDER: Tournament[] = ["TOC", "NDCA", "Barkley", "Cal"]

const TOURNAMENT_TAG: Record<Tournament, string> = {
  TOC: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  NDCA: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  Barkley: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  Cal: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
}

/** "TOC, NDCA & Barkley nationals", naming the Barkley and the Cal only when the school has a finish there. */
function nationalsTitle(hasBarkley: boolean, hasCal: boolean): string {
  const names = ["TOC", "NDCA", ...(hasBarkley ? ["Barkley"] : []), ...(hasCal ? ["Cal"] : [])]
  return `${names.slice(0, -1).join(", ")} & ${names.at(-1)} nationals`
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
  const cal = useMemo(() => findCalSchoolResults(school), [school])

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
    for (const r of cal) {
      list.push({
        tournament: "Cal",
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
  }, [toc, ndca, barkley, cal])

  if (rows.length === 0) return null

  const showEvent = new Set(rows.map((r) => r.event)).size > 1
  const hasBarkley = rows.some((r) => r.tournament === "Barkley")
  const barkleyTitles = barkley.filter((r) => r.place === "Champion").length
  const hasCal = rows.some((r) => r.tournament === "Cal")
  const calTitles = cal.filter((r) => r.place === "Champion").length
  const stats = [
    count(toc?.titles ?? 0, "TOC title", "TOC titles"),
    count(toc?.runnerUps ?? 0, "TOC runner-up", "TOC runner-ups"),
    count(toc?.topSpeakers ?? 0, "TOC top speaker", "TOC top speakers"),
    count(ndca?.titles ?? 0, "NDCA title", "NDCA titles"),
    count(ndca?.elimFinishes ?? 0, "NDCA elim finish", "NDCA elim finishes"),
    count(ndca?.topSpeakers ?? 0, "NDCA top speaker", "NDCA top speakers"),
    count(barkleyTitles, "Barkley title", "Barkley titles"),
    count(calTitles, "Cal title", "Cal titles"),
  ].filter((s): s is string => s !== null)

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4" aria-hidden />
          {nationalsTitle(hasBarkley, hasCal)}
        </CardTitle>
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
