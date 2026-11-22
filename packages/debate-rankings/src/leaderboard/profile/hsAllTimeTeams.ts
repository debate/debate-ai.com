/**
 * @fileoverview The greatest high school teams of all time in Policy,
 * Lincoln-Douglas and Public Forum, the high school counterpart of the
 * college "Greatest of All Time" list. College teams are ranked by
 * all-seasons NDT points; high school has no national results table that
 * long, so a team here scores its national championship finishes: every
 * Tournament of Champions result on record (1972 on) and every NDCA
 * championship result (2006 on), with the weights the school strength chart
 * gives TOC finishes ({@link HS_ALL_TIME_POINTS}).
 *
 * A "team" is a pair in Policy and Public Forum and one debater in
 * Lincoln-Douglas, at one school, across every year it debated. A top
 * speaker award goes to the pair that speaker debated in that year at that
 * school (the LD debater themself); a Policy or PF speaker whose pair has no
 * recorded finish that year isn't credited, since the partner is unknown. Rows the source names only by surname or team code
 * (`partialNames`) can't be told apart from other teams, so they don't
 * count here (they still show on the school's nationals list).
 * @module leaderboard/profile/hsAllTimeTeams
 */

import { NDCA_HISTORY, ndcaEvent, type NdcaResult } from "../../sync/ndca-champions"
import { matchTocSchool, TOC_HISTORY, tocSchoolKey, type TocResult } from "../../sync/toc-champions"

/** The three high school debate events with an all-time list, in page order. */
export type HsAllTimeEvent = "Policy" | "Lincoln-Douglas" | "Public Forum"

export const HS_ALL_TIME_EVENTS: readonly HsAllTimeEvent[] = ["Policy", "Lincoln-Douglas", "Public Forum"]

/**
 * Points per national finish, TOC and NDCA alike. Titles, finals,
 * semifinals and top speaker match `HS_STRENGTH_WEIGHTS.toc`; the deeper
 * NDCA elimination rounds score less.
 */
export const HS_ALL_TIME_POINTS: Record<string, number> = {
  Champion: 30,
  "Co-champion": 30,
  "Runner-up": 18,
  Finalist: 18,
  Semifinalist: 12,
  Quarterfinalist: 6,
  Octafinalist: 3,
  "Double-octafinalist": 1,
  "Top speaker": 10,
}

/** One finish that scored toward a team. */
export interface HsAllTimeFinish {
  tournament: "TOC" | "NDCA"
  year: number
  place: string
  points: number
}

/** One team in an event's all-time list. */
export interface HsAllTimeTeam {
  /** 1-based; equal totals share a rank. */
  rank: number
  event: HsAllTimeEvent
  /** The school as the source names it, without a state tag. */
  school: string
  /** {@link tocSchoolKey} of the school, for matching a school page. */
  schoolKey: string
  /** The school as the source names it, state tag kept, for {@link matchTocSchool}. */
  sourceSchool: string
  /** The debaters' full names, e.g. `"Tanner Lewis & Clyde Shepherd"`. */
  debaters: string
  /** Last names, e.g. `"Lewis & Shepherd"`. */
  lastNames: string
  firstYear: number
  lastYear: number
  total: number
  titles: number
  finishes: HsAllTimeFinish[]
}

type Source = { tournament: "TOC" | "NDCA"; event: string; year: number; place: string; school: string; competitors: string; partialNames?: boolean }

const splitNames = (competitors: string) =>
  competitors
    .split(/\s*(?:&|\/|,| and )\s*/i)
    .map((name) => name.trim())
    .filter(Boolean)

const nameKey = (name: string) => name.toLowerCase().replace(/[^a-z]/g, "")
const lastWord = (name: string) => name.trim().split(/\s+/).at(-1) ?? ""
const withoutState = (school: string) => school.replace(/\s*\([A-Z]{2}\)\s*$/, "").trim()

function sources(toc: readonly TocResult[], ndca: readonly NdcaResult[]): Source[] {
  return [
    ...toc.map((r) => ({ tournament: "TOC" as const, ...r })),
    ...ndca.map((r) => ({ tournament: "NDCA" as const, ...r, event: ndcaEvent(r) })),
  ]
}

interface Building {
  event: HsAllTimeEvent
  school: string
  sourceSchool: string
  schoolKey: string
  names: string[]
  finishes: HsAllTimeFinish[]
}

/**
 * Every scoring team per event, best first. Teams tie on total; ties list
 * the more titles first, then the more recent team.
 *
 * @param toc - TOC results (defaults to the full history).
 * @param ndca - NDCA results (defaults to the full history).
 */
export function buildHsAllTimeTeams(
  toc: readonly TocResult[] = TOC_HISTORY,
  ndca: readonly NdcaResult[] = NDCA_HISTORY,
): Record<HsAllTimeEvent, HsAllTimeTeam[]> {
  const events = new Set<string>(HS_ALL_TIME_EVENTS)
  const rows = sources(toc, ndca).filter(
    (r) => events.has(r.event) && !r.partialNames && HS_ALL_TIME_POINTS[r.place] !== undefined,
  )
  const teams = new Map<string, Building>()
  const teamKey = (event: string, schoolKey: string, names: string[]) =>
    `${event}|${schoolKey}|${names.map(nameKey).sort().join("+")}`
  const add = (key: string, team: Omit<Building, "finishes">, finish: HsAllTimeFinish) => {
    const existing = teams.get(key) ?? { ...team, finishes: [] }
    if (!/\([A-Z]{2}\)/.test(existing.sourceSchool) && /\([A-Z]{2}\)/.test(team.sourceSchool)) {
      existing.sourceSchool = team.sourceSchool
      existing.school = team.school
    }
    existing.finishes.push(finish)
    teams.set(key, existing)
  }

  // Team finishes first, so speaker awards can find the pair they belong to.
  const speakers: Source[] = []
  for (const r of rows) {
    if (r.place === "Top speaker") {
      speakers.push(r)
      continue
    }
    const names = splitNames(r.competitors)
    if (!names.length) continue
    const schoolKey = tocSchoolKey(r.school)
    add(
      teamKey(r.event, schoolKey, names),
      { event: r.event as HsAllTimeEvent, school: withoutState(r.school), sourceSchool: r.school, schoolKey, names },
      { tournament: r.tournament, year: r.year, place: r.place, points: HS_ALL_TIME_POINTS[r.place] },
    )
  }
  for (const r of speakers) {
    const [speaker] = splitNames(r.competitors)
    if (!speaker) continue
    const schoolKey = tocSchoolKey(r.school)
    const finish = { tournament: r.tournament, year: r.year, place: r.place, points: HS_ALL_TIME_POINTS[r.place] }
    // The pair this speaker debated in that year, at that school.
    const pair = [...teams.entries()].find(
      ([, team]) =>
        team.event === r.event &&
        team.schoolKey === schoolKey &&
        team.names.some((name) => nameKey(name) === nameKey(speaker)) &&
        team.finishes.some((f) => f.year === r.year),
    )
    if (pair) {
      pair[1].finishes.push(finish)
    } else if (r.event === "Lincoln-Douglas") {
      add(
        teamKey(r.event, schoolKey, [speaker]),
        { event: "Lincoln-Douglas", school: withoutState(r.school), sourceSchool: r.school, schoolKey, names: [speaker] },
        finish,
      )
    }
    // A pair event's speaker with no recorded finish that year: their pair is unknown, so it isn't credited.
  }

  const out = Object.fromEntries(HS_ALL_TIME_EVENTS.map((event) => [event, [] as HsAllTimeTeam[]])) as Record<
    HsAllTimeEvent,
    HsAllTimeTeam[]
  >
  for (const team of teams.values()) {
    const finishes = [...team.finishes].sort((a, b) => a.year - b.year)
    const years = finishes.map((f) => f.year)
    out[team.event].push({
      rank: 0,
      event: team.event,
      school: team.school,
      schoolKey: team.schoolKey,
      sourceSchool: team.sourceSchool,
      debaters: team.names.join(" & "),
      lastNames: team.names.map(lastWord).join(" & "),
      firstYear: Math.min(...years),
      lastYear: Math.max(...years),
      total: finishes.reduce((sum, f) => sum + f.points, 0),
      titles: finishes.filter((f) => f.place === "Champion" || f.place === "Co-champion").length,
      finishes,
    })
  }
  for (const list of Object.values(out)) {
    list.sort((a, b) => b.total - a.total || b.titles - a.titles || b.lastYear - a.lastYear)
    list.forEach((team, i) => {
      team.rank = i > 0 && list[i - 1].total === team.total ? list[i - 1].rank : i + 1
    })
  }
  return out
}

let cached: Record<HsAllTimeEvent, HsAllTimeTeam[]> | null = null

/** {@link buildHsAllTimeTeams} over the bundled histories, built once. */
export function hsAllTimeTeams(): Record<HsAllTimeEvent, HsAllTimeTeam[]> {
  cached ??= buildHsAllTimeTeams()
  return cached
}

/**
 * The {@link tocSchoolKey} a school page's name resolves to among the
 * schools with all-time teams, by the TOC record's matching rules (exact
 * key or alias, state tag must agree), or `null`.
 *
 * @param school - School name as the rankings or a school page spell it.
 * @param lists - The all-time lists to look in.
 */
export function hsAllTimeSchoolKey(
  school: string,
  lists: Record<HsAllTimeEvent, HsAllTimeTeam[]> = hsAllTimeTeams(),
): string | null {
  // One name per school, preferring a spelling with its state tag.
  const bySchool = new Map<string, { school: string; key: string }>()
  for (const list of Object.values(lists)) {
    for (const team of list) {
      const seen = bySchool.get(team.schoolKey)
      if (!seen || (!/\([A-Z]{2}\)/.test(seen.school) && /\([A-Z]{2}\)/.test(team.sourceSchool))) {
        bySchool.set(team.schoolKey, { school: team.sourceSchool, key: team.schoolKey })
      }
    }
  }
  return matchTocSchool(school, [...bySchool.values()])?.key ?? null
}
