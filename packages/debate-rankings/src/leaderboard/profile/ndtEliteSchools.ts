/**
 * @fileoverview The "Elite 8": the eight schools with the most all-seasons
 * NDT points ({@link buildNdtAllSeasons}), and where each ranked among every
 * NDT school season by season over the last {@link ELITE_SEASONS} seasons,
 * so a bump chart can show who rose and fell. A season's rank is by the
 * points the school earned over a trailing window of {@link ELITE_WINDOW}
 * seasons (one college career), scored exactly like the all-seasons table's
 * school rows: `elims + 1.5×Copeland + bids + speakers`, with seasons before
 * {@link NDT_ERA_CUTOFF_YEAR} at {@link NDT_PRE_ERA_MULTIPLIER}×. Each season
 * also lists what the school did at that NDT (titles, elim finishes, the
 * Copeland Award, first-round bids, top-20 speakers) for the chart's tooltip.
 * @module leaderboard/profile/ndtEliteSchools
 */

import type { NdtSchoolHistory } from "../../sync/ndt-school-history"
import { speakerPoints, STRENGTH_WEIGHTS } from "./programStrength"
import {
  buildNdtAllSeasons,
  cleanTeamName,
  ndtEraMultiplier,
  ndtElimPoints,
  ndtTeamKey,
  NDT_POINTS_MULTIPLIERS,
  NDT_ERA_CUTOFF_YEAR,
  NDT_PRE_ERA_MULTIPLIER,
  type NdtAllSeasonsTable,
} from "./ndtAllSeasons"

/** How many top schools the chart follows. */
export const ELITE_COUNT = 8

/** How many seasons back the chart goes, the latest included. */
export const ELITE_SEASONS = 50

/** Seasons in each season's trailing points window: a four-year college career. */
export const ELITE_WINDOW = 4

/** Ranks below this are drawn at the bottom of the chart, as "{@link ELITE_RANK_FLOOR}+". */
export const ELITE_RANK_FLOOR = 25

/** One thing a school did at one NDT. */
export interface EliteAccomplishment {
  kind: "title" | "elim" | "copeland" | "bid" | "speaker" | "entry"
  /** E.g. `"NDT champion: Arsht & Markoff"`, `"Semis: A & B"`, `"3rd speaker: Jane Doe"`. */
  label: string
}

/** One season of one Elite 8 school. */
export interface EliteSeason {
  year: number
  /** Rank among every NDT school by the trailing window's points; equal points share a rank. */
  rank: number
  /** Points over the trailing window ending this season. */
  windowPoints: number
  /** Points from this season's NDT alone. */
  seasonPoints: number
  /** What the school did at this season's NDT, biggest first. */
  accomplishments: EliteAccomplishment[]
}

/** One Elite 8 school and its seasons, oldest first. */
export interface EliteSchool {
  /** NDT school name, e.g. `"Dartmouth College (NH)"`. */
  school: string
  /** The school page's `@handle`, when it isn't derived from the name (high school charts). */
  handle?: string
  /** 1–8: its all-seasons NDT points rank. */
  allTimeRank: number
  /** All-seasons NDT points. */
  total: number
  seasons: EliteSeason[]
}

/** The chart's data. */
export interface EliteSchoolsChart {
  firstYear: number
  lastYear: number
  schools: EliteSchool[]
}

const ROUND_ORDER = ["Champion", "Finals", "Semis", "Quarters", "Octas", "Doubles"]

/** Last names of `"A B & C D"`: `"B & D"`. */
function lastNames(team: string): string {
  return cleanTeamName(team)
    .split(/\s*(?:&|\/| and )\s*/i)
    .map((name) => name.trim().split(/\s+/).at(-1) ?? name)
    .filter(Boolean)
    .join(" & ")
}

function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`
}

/** Points a school earned at each NDT, by year, scored like the all-seasons school row. */
function seasonPointsByYear(school: NdtSchoolHistory): Map<number, number> {
  const points = new Map<number, number>()
  const add = (year: number, part: keyof typeof NDT_POINTS_MULTIPLIERS, value: number) => {
    if (!value) return
    points.set(year, (points.get(year) ?? 0) + value * NDT_POINTS_MULTIPLIERS[part] * ndtEraMultiplier(year))
  }
  const deepest = new Map<string, { year: number; round: string }>()
  for (const elim of [
    ...school.elims.map((e) => ({ ...e, round: e.round ?? "" })),
    ...school.championships.map((t) => ({ ...t, round: "Champion" })),
  ]) {
    const id = `${elim.year}|${ndtTeamKey(school.school, elim.team)}`
    const seen = deepest.get(id)
    if (!seen || ndtElimPoints(elim.round) > ndtElimPoints(seen.round)) deepest.set(id, elim)
  }
  for (const elim of deepest.values()) add(elim.year, "elims", ndtElimPoints(elim.round))
  for (const winner of school.copelandWinners) add(winner.year, "copeland", STRENGTH_WEIGHTS.copeland)
  for (const bid of school.atLargeBids) add(bid.year, "bids", STRENGTH_WEIGHTS.firstRoundBid)
  for (const award of school.speakerAwards) add(award.year, "speakers", speakerPoints(award.rank))
  return points
}

/** What a school did at one NDT, biggest first. */
export function eliteAccomplishments(school: NdtSchoolHistory, year: number): EliteAccomplishment[] {
  const out: EliteAccomplishment[] = []
  const deepest = new Map<string, { team: string; round: string }>()
  for (const elim of [
    ...school.elims.filter((e) => e.year === year).map((e) => ({ team: e.team, round: e.round ?? "" })),
    ...school.championships.filter((t) => t.year === year).map((t) => ({ team: t.team, round: "Champion" })),
  ]) {
    const id = ndtTeamKey(school.school, elim.team)
    const seen = deepest.get(id)
    if (!seen || ndtElimPoints(elim.round) > ndtElimPoints(seen.round)) deepest.set(id, elim)
  }
  const elims = [...deepest.values()]
    .filter((elim) => ROUND_ORDER.includes(elim.round))
    .sort((a, b) => ROUND_ORDER.indexOf(a.round) - ROUND_ORDER.indexOf(b.round))
  for (const elim of elims) {
    out.push(
      elim.round === "Champion"
        ? { kind: "title", label: `NDT champion: ${lastNames(elim.team)}` }
        : { kind: "elim", label: `${elim.round === "Finals" ? "Runner-up" : elim.round}: ${lastNames(elim.team)}` },
    )
  }
  for (const winner of school.copelandWinners.filter((w) => w.year === year)) {
    out.push({ kind: "copeland", label: `Copeland Award: ${lastNames(winner.team)}` })
  }
  const bids = school.atLargeBids.filter((bid) => bid.year === year)
  if (bids.length) {
    out.push({
      kind: "bid",
      label: `${bids.length} first-round bid${bids.length === 1 ? "" : "s"}: ${bids.map((bid) => lastNames(bid.team)).join(", ")}`,
    })
  }
  const speakers = school.speakerAwards
    .filter((award) => award.year === year && award.rank !== undefined && award.rank <= 20)
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
  for (const award of speakers) {
    out.push({
      kind: "speaker",
      label: `${award.rank === 1 ? "Top" : ordinal(award.rank!)} speaker: ${cleanTeamName(award.speaker)}`,
    })
  }
  return out
}

/**
 * Builds the Elite 8 chart from the NDT school history.
 *
 * @param history - The NDT's school history.
 * @param table - The all-seasons table, when already built, to pick the top schools from.
 * @param options.count - Schools to follow ({@link ELITE_COUNT}).
 * @param options.seasons - Seasons back from the latest NDT ({@link ELITE_SEASONS}).
 * @param options.window - Trailing seasons each rank sums ({@link ELITE_WINDOW}).
 */
export function buildEliteSchools(
  history: NdtSchoolHistory[],
  table: NdtAllSeasonsTable = buildNdtAllSeasons(history),
  { count = ELITE_COUNT, seasons = ELITE_SEASONS, window = ELITE_WINDOW } = {},
): EliteSchoolsChart {
  const perSchool = new Map(history.map((school) => [school.school, seasonPointsByYear(school)]))
  let lastYear = -Infinity
  for (const points of perSchool.values()) for (const year of points.keys()) lastYear = Math.max(lastYear, year)
  if (!Number.isFinite(lastYear)) return { firstYear: 0, lastYear: 0, schools: [] }
  const firstYear = lastYear - seasons + 1

  const windowPoints = (points: Map<number, number>, year: number) => {
    let sum = 0
    for (let y = year - window + 1; y <= year; y++) sum += points.get(y) ?? 0
    return Math.round(sum * 100) / 100
  }

  // Each season's rank of every school with any points in the window.
  const ranksByYear = new Map<number, Map<string, number>>()
  for (let year = firstYear; year <= lastYear; year++) {
    const scored = [...perSchool]
      .map(([school, points]) => ({ school, points: windowPoints(points, year) }))
      .filter((row) => row.points > 0)
      .sort((a, b) => b.points - a.points)
    const ranks = new Map<string, number>()
    scored.forEach((row, index) => {
      const prev = scored[index - 1]
      ranks.set(row.school, prev && prev.points === row.points ? ranks.get(prev.school)! : index + 1)
    })
    ranksByYear.set(year, ranks)
  }

  const bySchool = new Map(history.map((school) => [school.school, school]))
  const schools = table.schools.slice(0, count).map((row, index): EliteSchool => {
    const school = bySchool.get(row.school)!
    const points = perSchool.get(row.school)!
    const list: EliteSeason[] = []
    for (let year = firstYear; year <= lastYear; year++) {
      const ranks = ranksByYear.get(year)!
      list.push({
        year,
        rank: ranks.get(row.school) ?? ranks.size + 1,
        windowPoints: windowPoints(points, year),
        seasonPoints: Math.round((points.get(year) ?? 0) * 100) / 100,
        accomplishments: eliteAccomplishments(school, year),
      })
    }
    return { school: row.school, allTimeRank: index + 1, total: row.total, seasons: list }
  })
  return { firstYear, lastYear, schools }
}

/**
 * A school's short name for an Elite 8 chip whose logo is missing or switched
 * off: drops "The", "University of" and trailing "University" / "College"
 * ("University of Kansas" → "Kansas", "Dartmouth College" → "Dartmouth").
 *
 * @param name - The school's display name.
 * @returns The short name, or the name itself when nothing is left to strip.
 */
export function eliteShortName(name: string): string {
  const short = name
    .replace(/^the\s+/i, "")
    .replace(/^university\s+of\s+/i, "")
    .replace(/\s+(university|college)$/i, "")
    .trim()
  return short || name
}

export { NDT_ERA_CUTOFF_YEAR, NDT_PRE_ERA_MULTIPLIER }
