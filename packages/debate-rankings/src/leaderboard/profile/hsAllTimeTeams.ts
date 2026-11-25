/**
 * @fileoverview The greatest high school teams of all time in Policy,
 * Lincoln-Douglas and Public Forum, the high school counterpart of the
 * college "Greatest of All Time" list, scored with that list's weights so
 * college counts for more than high school. A team scores its national
 * championship finishes at the three high school championships, weighted
 * alike at the college list's high school points ({@link HS_ALL_TIME_POINTS},
 * a TOC title is 10 to an NDT title's 30) times its high school multiplier
 * (`NDT_POINTS_MULTIPLIERS.highSchool`, 0.5) and era multiplier (before
 * 2000, 0.6): every Tournament of Champions result on record (1972 on),
 * every NDCA championship result (2006 on) and the Barkley Forum's Silver
 * Key champions and top speakers (2018, 2021 on), and the Cal Invitational
 * at UC Berkeley's LD and PF finals and top speakers (2017–2019, 2022,
 * 2024). On top of that, each
 * debater who went on to debate in college adds their own all-seasons NDT
 * points in full ({@link HS_ALL_TIME_COLLEGE_SHARE}), high school credit left
 * out so it isn't counted twice.
 *
 * A "team" is a pair in Policy and Public Forum and one debater in
 * Lincoln-Douglas, at one school, across every year it debated. A top
 * speaker award goes to the pair that speaker debated in that year at that
 * school (the LD debater themself); a Policy or PF speaker whose pair has no
 * recorded finish that year isn't credited, since the partner is unknown.
 * Rows the source names only by surname or team code (`partialNames`) can't
 * be told apart from other teams, so they don't count here (they still show
 * on the school's nationals list).
 * @module leaderboard/profile/hsAllTimeTeams
 */

import { BARKLEY_RESULTS, type BarkleyResult } from "../../sync/barkley-champions"
import { CAL_RESULTS, type CalResult } from "../../sync/berkeley-champions"
import { NDCA_HISTORY, NDCA_NAME_ALIASES, ndcaEvent, type NdcaResult } from "../../sync/ndca-champions"
import {
  HS_NDCA_FINISH_POINTS,
  HS_TOC_POINTS,
  NDT_POINTS_MULTIPLIERS,
  ndtEraMultiplier,
  type NdtAllSeasonsTable,
} from "./ndtAllSeasons"
import { profileSlug } from "./rankingProfileHelpers"
import { matchTocSchool, TOC_HISTORY, tocSchoolKey, type TocResult } from "../../sync/toc-champions"

/** The three high school debate events with an all-time list, in page order. */
export type HsAllTimeEvent = "Policy" | "Lincoln-Douglas" | "Public Forum"

export const HS_ALL_TIME_EVENTS: readonly HsAllTimeEvent[] = ["Policy", "Lincoln-Douglas", "Public Forum"]

/** The national championships a team's finishes come from. */
export type HsAllTimeTournament = "TOC" | "NDCA" | "Barkley" | "Cal"

/** What each debater's college NDT points are multiplied by when added to their high school team: in full, as the college list counts them. */
export const HS_ALL_TIME_COLLEGE_SHARE = 1

/**
 * Base points per national finish, TOC, NDCA, Barkley Forum and Cal alike: the
 * college all-seasons list's high school points ({@link HS_TOC_POINTS},
 * {@link HS_NDCA_FINISH_POINTS}), before {@link HS_ALL_TIME_MULTIPLIER} and
 * the era multiplier.
 */
export const HS_ALL_TIME_POINTS: Record<string, number> = {
  Champion: HS_TOC_POINTS.Champion,
  "Co-champion": HS_TOC_POINTS["Co-champion"],
  "Runner-up": HS_TOC_POINTS["Runner-up"],
  Finalist: HS_NDCA_FINISH_POINTS.Finalist,
  Semifinalist: HS_NDCA_FINISH_POINTS.Semifinalist,
  Quarterfinalist: HS_NDCA_FINISH_POINTS.Quarterfinalist,
  Octafinalist: HS_NDCA_FINISH_POINTS.Octafinalist,
  "Double-octafinalist": HS_NDCA_FINISH_POINTS["Double-octafinalist"],
  "Top speaker": HS_TOC_POINTS["Top speaker"],
}

/** What a high school finish's base points are multiplied by: the college list's high school multiplier. */
export const HS_ALL_TIME_MULTIPLIER = NDT_POINTS_MULTIPLIERS.highSchool

/** A finish's points: base × {@link HS_ALL_TIME_MULTIPLIER} × the era multiplier. */
export function hsAllTimeFinishPoints(place: string, year: number): number {
  return round2((HS_ALL_TIME_POINTS[place] ?? 0) * HS_ALL_TIME_MULTIPLIER * ndtEraMultiplier(year))
}

/** One finish that scored toward a team. */
export interface HsAllTimeFinish {
  tournament: HsAllTimeTournament
  year: number
  place: string
  points: number
}

/** One debater's college record, as it adds to their high school team. */
export interface HsAllTimeCollege {
  /** The debater as the high school source spells them. */
  debater: string
  /** Their NDT school, e.g. `"Northwestern University (IL)"`. */
  school: string
  /** Their own all-seasons NDT points, high school credit left out. */
  collegePoints: number
  /** What it adds to the team: {@link collegePoints} times {@link HS_ALL_TIME_COLLEGE_SHARE}. */
  credit: number
}

/** A debater's college NDT points by name, or `null` for one who didn't debate at the NDT. */
export type HsCollegeLookup = (debater: string) => { school: string; points: number } | null

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
  /** Points from national finishes alone. */
  nationals: number
  /** Points added from the debaters' college records. */
  collegeCredit: number
  titles: number
  finishes: HsAllTimeFinish[]
  /** Debaters with a college record, best first. */
  college: HsAllTimeCollege[]
}

type Source = { tournament: HsAllTimeTournament; event: string; year: number; place: string; school: string; competitors: string; partialNames?: boolean }

const splitNames = (competitors: string) =>
  competitors
    .split(/\s*(?:&|\/|,| and )\s*/i)
    .map((name) => name.trim())
    .filter(Boolean)

const nameKey = (name: string) => name.toLowerCase().replace(/[^a-z]/g, "")
const lastWord = (name: string) => name.trim().split(/\s+/).at(-1) ?? ""
const withoutState = (school: string) => school.replace(/\s*\([A-Z]{2}\)\s*$/, "").trim()

function sources(
  toc: readonly TocResult[],
  ndca: readonly NdcaResult[],
  barkley: readonly BarkleyResult[],
  cal: readonly CalResult[],
): Source[] {
  return [
    ...toc.map((r) => ({ tournament: "TOC" as const, ...r })),
    ...ndca.map((r) => ({ tournament: "NDCA" as const, ...r, event: ndcaEvent(r) })),
    ...barkley.map((r) => ({ tournament: "Barkley" as const, ...r })),
    ...cal.map((r) => ({ tournament: "Cal" as const, ...r })),
  ]
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * A lookup of each debater's own college points from the all-seasons NDT
 * table's `debaters` rows (total minus the high school part), by name slug;
 * high school spellings go through `NDCA_NAME_ALIASES`. A name two colleges
 * share keeps the better record.
 */
export function collegeLookupFromNdt(table: Pick<NdtAllSeasonsTable, "debaters">): HsCollegeLookup {
  const bySlug = new Map<string, { school: string; points: number }>()
  for (const row of table.debaters) {
    if (row.highSchoolOnly) continue
    const points = round2(row.total - (row.parts.highSchool ?? 0))
    if (points <= 0) continue
    const slug = profileSlug(row.team)
    const seen = bySlug.get(slug)
    if (!seen || seen.points < points) bySlug.set(slug, { school: row.school, points })
  }
  return (debater) => bySlug.get(profileSlug(NDCA_NAME_ALIASES[debater] ?? debater)) ?? null
}

/** Inputs to {@link buildHsAllTimeTeams}; each defaults to the bundled history, college to none. */
export interface HsAllTimeSources {
  toc?: readonly TocResult[]
  ndca?: readonly NdcaResult[]
  barkley?: readonly BarkleyResult[]
  cal?: readonly CalResult[]
  college?: HsCollegeLookup | null
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
 * @param input - The results to score and the college lookup ({@link HsAllTimeSources}).
 */
export function buildHsAllTimeTeams(input: HsAllTimeSources = {}): Record<HsAllTimeEvent, HsAllTimeTeam[]> {
  const { toc = TOC_HISTORY, ndca = NDCA_HISTORY, barkley = BARKLEY_RESULTS, cal = CAL_RESULTS, college = null } = input
  const events = new Set<string>(HS_ALL_TIME_EVENTS)
  const rows = sources(toc, ndca, barkley, cal).filter(
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
      { tournament: r.tournament, year: r.year, place: r.place, points: hsAllTimeFinishPoints(r.place, r.year) },
    )
  }
  for (const r of speakers) {
    const [speaker] = splitNames(r.competitors)
    if (!speaker) continue
    const schoolKey = tocSchoolKey(r.school)
    const finish = { tournament: r.tournament, year: r.year, place: r.place, points: hsAllTimeFinishPoints(r.place, r.year) }
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
    const nationals = round2(finishes.reduce((sum, f) => sum + f.points, 0))
    const collegeRecords: HsAllTimeCollege[] = college
      ? team.names
          .map((debater) => {
            const record = college(debater)
            return record
              ? { debater, school: record.school, collegePoints: record.points, credit: round2(record.points * HS_ALL_TIME_COLLEGE_SHARE) }
              : null
          })
          .filter((record): record is HsAllTimeCollege => record !== null)
          .sort((a, b) => b.credit - a.credit)
      : []
    const collegeCredit = round2(collegeRecords.reduce((sum, r) => sum + r.credit, 0))
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
      total: round2(nationals + collegeCredit),
      nationals,
      collegeCredit,
      titles: finishes.filter((f) => f.place === "Champion" || f.place === "Co-champion").length,
      finishes,
      college: collegeRecords,
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

/** {@link buildHsAllTimeTeams} over the bundled histories, without college records, built once. */
export function hsAllTimeTeams(): Record<HsAllTimeEvent, HsAllTimeTeam[]> {
  cached ??= buildHsAllTimeTeams()
  return cached
}

let loading: Promise<Record<HsAllTimeEvent, HsAllTimeTeam[]>> | null = null

/**
 * {@link buildHsAllTimeTeams} with every debater's college record, once the
 * bundled NDT history has loaded (shared with the college all-seasons table).
 */
export function loadHsAllTimeTeams(): Promise<Record<HsAllTimeEvent, HsAllTimeTeam[]>> {
  loading ??= import("./ndtAllTimeRanks")
    .then(({ loadNdtAllSeasonsTable }) => loadNdtAllSeasonsTable())
    .then(({ table }) => buildHsAllTimeTeams({ college: collegeLookupFromNdt(table) }))
    .catch((error) => {
      loading = null
      throw error
    })
  return loading
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
