/**
 * @fileoverview All-seasons NDT points table: every college policy team (a
 * pair of debaters at one school) and every school ranked by the points their
 * National Debate Tournament results earned across every NDT on record, 1947
 * on. Four things score, with the same weights the program strength chart
 * uses ({@link STRENGTH_WEIGHTS}):
 *
 * - each NDT the team broke at, by the deepest elim round it reached (a title
 *   is Champion, not Finals plus a bonus);
 * - the Copeland Award (the season's top first-round at-large seed);
 * - each first-round at-large bid (a Copeland winner holds one too, so it
 *   scores both);
 * - each NDT speaker award, by place, credited to the team the speaker
 *   debated on that year.
 *
 * A pair is the same team across seasons whatever order its names come in;
 * a debater with two partners is two teams. A team also gets the full
 * points each of its debaters scored with other partners (Miles &
 * Vellayappan get Vellayappan & Lee's), and those side partnerships
 * are listed under it ({@link NdtPointsRow.sidePartnerships}). A partnership
 * is its own row only when it is both debaters' best; any other (Vellayappan &
 * Lee) is ranked only through the teams it feeds. A team's debaters also
 * score, at lower weights ({@link HS_TOC_POINTS}), for their high school
 * Tournament of Champions policy results with any partner, matched by full
 * name ({@link NdtPointsRow.highSchool}). A speaker award whose speaker isn't on exactly one of the
 * school's listed teams that year still counts for the school, just not for
 * any team.
 * @module leaderboard/profile/ndtAllSeasons
 */

import type { NdtSchoolHistory } from "../../sync/ndt-school-history"
import { profileSlug } from "./rankingProfileHelpers"
import { speakerPoints, STRENGTH_WEIGHTS } from "./programStrength"
import { TOC_RESULTS, type TocPlace, type TocResult } from "../../sync/toc-champions"

/**
 * How much each NDT season's points count, so recent teams rank above older
 * ones: results before {@link NDT_ERA_WEIGHTS.legacyBefore} are multiplied by
 * `legacyMultiplier`, and every season is worth `yearlyGrowth` more than the
 * season before it, compounding back from the latest NDT (which counts 1×).
 */
export const NDT_ERA_WEIGHTS = {
  /** Seasons before this NDT year are the legacy era. */
  legacyBefore: 2000,
  /** Multiplier on every legacy-era result. */
  legacyMultiplier: 0.3,
  /** Each newer season counts this much more than the one before it (2.5%). */
  yearlyGrowth: 0.025,
}

/**
 * Multiplier on a result from the NDT held in `year`, when the latest NDT in
 * the history is `latestYear`: `(1 + yearlyGrowth)^(year − latestYear)`, times
 * `legacyMultiplier` before 2000. 2025 is 1, 2015 about 0.78, 2000 about 0.54,
 * 1999 about 0.16.
 */
export function ndtEraWeight(year: number, latestYear: number): number {
  const w = NDT_ERA_WEIGHTS
  const recency = Math.pow(1 + w.yearlyGrowth, Math.min(0, year - latestYear))
  return year < w.legacyBefore ? recency * w.legacyMultiplier : recency
}

/** What a team's or school's NDT points came from. */
export type NdtPointsPart = "elims" | "copeland" | "bids" | "speakers" | "partners" | "highSchool"

/** Parts in the order the table lists them, with their labels. */
export const NDT_POINTS_PARTS: { key: NdtPointsPart; label: string; short: string }[] = [
  { key: "elims", label: "NDT elims", short: "Elims" },
  { key: "copeland", label: "Copeland Award", short: "Copeland" },
  { key: "bids", label: "First-round bids", short: "Bids" },
  { key: "speakers", label: "Speaker awards", short: "Speakers" },
  { key: "partners", label: "Points with other partners", short: "Other partners" },
  { key: "highSchool", label: "High school TOC (policy)", short: "High school" },
]

/** Counts behind a row's points, for the breakdown. */
export interface NdtPointsCounts {
  titles: number
  elims: number
  copeland: number
  bids: number
  speakerAwards: number
}

/** One ranked row: a team or a school. */
export interface NdtPointsRow {
  /** Stable id: the school for a school row, school plus last names for a team. */
  key: string
  /** NDT school name, e.g. `"Georgetown University (DC)"`. */
  school: string
  /** The debaters as the NDT spells them (`"Andrew Arsht & Andrew Markoff"`); empty for a school row. */
  team: string
  total: number
  parts: Record<NdtPointsPart, number>
  counts: NdtPointsCounts
  /** First and last NDT season the row scored in (the year the NDT was held). */
  firstYear: number
  lastYear: number
  /**
   * A team's debaters' partnerships with other partners, best first, each
   * adding all its points to this team (the `partners` part). Empty for a
   * school row or a pair who only debated together.
   */
  sidePartnerships?: NdtSidePartnership[]
  /**
   * The team's debaters' high school TOC policy results (with any partner),
   * oldest first, adding the `highSchool` part. Empty when none match.
   */
  highSchool?: NdtHighSchoolResult[]
}

/** One high school Tournament of Champions policy result of a team's debater. */
export interface NdtHighSchoolResult {
  year: number
  place: TocPlace
  school: string
  /** The team's debater the result belongs to. */
  debater: string
  /** Their high school partner(s), empty for a top speaker award. */
  partners: string[]
  /** Points after the season weighting. */
  points: number
}

/**
 * Points for a TOC policy result, well under the NDT's (an NDT title is 30):
 * the high school circuit's national championship counts a third as much.
 */
export const HS_TOC_POINTS: Record<TocPlace, number> = {
  Champion: 10,
  "Co-champion": 10,
  "Runner-up": 6,
  "Top speaker": 4,
}

/** Another partnership of one of a team's debaters, credited in full. */
export interface NdtSidePartnership {
  key: string
  school: string
  /** The side pair as the NDT spells them, e.g. `"Peyton Lee & Arjun Vellayappan"`. */
  team: string
  /** The debater the two teams share. */
  debater: string
  /** The side pair's own points. */
  total: number
  /** {@link total} times {@link SIDE_PARTNERSHIP_SHARE}: what it adds to the team. */
  credit: number
  firstYear: number
  lastYear: number
}

/** Share of a side partnership's points a debater's other team gets. */
export const SIDE_PARTNERSHIP_SHARE = 1

/** The ranked table: teams and schools, best first. */
export interface NdtAllSeasonsTable {
  teams: NdtPointsRow[]
  schools: NdtPointsRow[]
}

/** `"Kieran Lawless & Zidao Wang (Rank: 11 )"` → `"Kieran Lawless & Zidao Wang"`. */
export function cleanTeamName(team: string): string {
  return team.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim()
}

/** Debater display names from `"A B & C D"`. */
function debaterNames(team: string): string[] {
  return cleanTeamName(team)
    .split(/\s*(?:&|\/| and )\s*/i)
    .map((name) => name.trim())
    .filter(Boolean)
}

/** The debaters of `"A B & C D"`, each normalized to a slug: `["a-b", "c-d"]`. */
function debaters(team: string): string[] {
  return debaterNames(team).map((name) => profileSlug(name)).filter(Boolean)
}

/** Id of a pair at a school, the same whichever order the names come in. */
export function ndtTeamKey(school: string, team: string): string {
  const lasts = debaters(team).map((name) => name.split("-").at(-1) ?? name)
  return `${school}|${lasts.sort().join("+")}`
}

const emptyParts = (): Record<NdtPointsPart, number> => ({ elims: 0, copeland: 0, bids: 0, speakers: 0, partners: 0, highSchool: 0 })
const emptyCounts = (): NdtPointsCounts => ({ titles: 0, elims: 0, copeland: 0, bids: 0, speakerAwards: 0 })
const round1 = (value: number) => Math.round(value * 10) / 10

/** School name without its state tag, for display: `"Harvard University (MA)"` → `"Harvard University"`. */
export function ndtSchoolDisplayName(school: string): string {
  return school.replace(/\s*\([^)]*\)\s*$/, "")
}

/** Points for a team's deepest round at one NDT. */
export function ndtElimPoints(round: string | undefined): number {
  return STRENGTH_WEIGHTS.ndtElim[round ?? ""] ?? 0
}

/**
 * Ranks every team and school in the NDT history by all-seasons points.
 *
 * @param history - The NDT's school history (`data/ndt-school-history.json`).
 * @returns Teams and schools, each sorted by points, highest first; ties
 *   break by more titles, then by name.
 */
export function buildNdtAllSeasons(
  history: NdtSchoolHistory[],
  tocResults: readonly TocResult[] = TOC_RESULTS,
): NdtAllSeasonsTable {
  const teams = new Map<string, NdtPointsRow>()
  const schools: NdtPointsRow[] = []

  const latestYear = history.reduce(
    (latest, school) =>
      Math.max(latest, ...school.years, ...school.elims.map((elim) => elim.year), ...school.championships.map((t) => t.year)),
    0,
  )

  for (const school of history) {
    const schoolRow: NdtPointsRow = {
      key: school.school,
      school: school.school,
      team: "",
      total: 0,
      parts: emptyParts(),
      counts: emptyCounts(),
      firstYear: Infinity,
      lastYear: -Infinity,
    }
    /** Team keys per year, with each debater's slug, for crediting speaker awards. */
    const rosters = new Map<number, Map<string, string[]>>()

    const teamRow = (team: string, year: number): NdtPointsRow => {
      const key = ndtTeamKey(school.school, team)
      const roster = rosters.get(year) ?? new Map<string, string[]>()
      rosters.set(year, roster)
      roster.set(key, debaters(team))
      let row = teams.get(key)
      if (!row) {
        row = {
          key,
          school: school.school,
          team: cleanTeamName(team),
          total: 0,
          parts: emptyParts(),
          counts: emptyCounts(),
          firstYear: Infinity,
          lastYear: -Infinity,
        }
        teams.set(key, row)
      }
      return row
    }

    const score = (rows: NdtPointsRow[], year: number, part: NdtPointsPart, points: number, count: keyof NdtPointsCounts) => {
      for (const row of rows) {
        row.counts[count] += 1
        if (!points) continue
        const weighted = points * ndtEraWeight(year, latestYear)
        row.parts[part] += weighted
        row.total += weighted
        row.firstYear = Math.min(row.firstYear, year)
        row.lastYear = Math.max(row.lastYear, year)
      }
    }

    // A team's deepest round at each NDT; a title the elim list missed is a Champion elim.
    const deepest = new Map<string, { team: string; year: number; round: string }>()
    const elims = [
      ...school.elims.map((elim) => ({ ...elim, round: elim.round ?? "" })),
      ...school.championships.map((title) => ({ ...title, round: "Champion" })),
    ]
    for (const elim of elims) {
      const id = `${elim.year}|${ndtTeamKey(school.school, elim.team)}`
      const seen = deepest.get(id)
      if (!seen || ndtElimPoints(elim.round) > ndtElimPoints(seen.round)) deepest.set(id, elim)
    }
    for (const elim of deepest.values()) {
      const rows = [teamRow(elim.team, elim.year), schoolRow]
      score(rows, elim.year, "elims", ndtElimPoints(elim.round), "elims")
      if (elim.round === "Champion") for (const row of rows) row.counts.titles += 1
    }
    for (const winner of school.copelandWinners) {
      score([teamRow(winner.team, winner.year), schoolRow], winner.year, "copeland", STRENGTH_WEIGHTS.copeland, "copeland")
    }
    for (const bid of school.atLargeBids) {
      score([teamRow(bid.team, bid.year), schoolRow], bid.year, "bids", STRENGTH_WEIGHTS.firstRoundBid, "bids")
    }
    for (const award of school.speakerAwards) {
      const speaker = profileSlug(award.speaker)
      const onTeams = [...(rosters.get(award.year) ?? new Map<string, string[]>())].filter(([, names]) =>
        names.includes(speaker),
      )
      const rows = onTeams.length === 1 ? [teams.get(onTeams[0][0])!, schoolRow] : [schoolRow]
      score(rows, award.year, "speakers", speakerPoints(award.rank), "speakerAwards")
    }

    if (schoolRow.total > 0) schools.push(schoolRow)
  }

  const finish = (rows: NdtPointsRow[]) => {
    for (const row of rows) {
      row.total = round1(row.total)
      for (const { key } of NDT_POINTS_PARTS) row.parts[key] = round1(row.parts[key])
    }
    return rows.sort(
      (a, b) =>
        b.total - a.total ||
        b.counts.titles - a.counts.titles ||
        a.school.localeCompare(b.school) ||
        a.team.localeCompare(b.team),
    )
  }

  const teamRows = finish([...teams.values()].filter((row) => row.total > 0))
  // Every partnership each debater had (at one school), from their own points.
  const byDebater = new Map<string, { name: string; rows: NdtPointsRow[] }>()
  for (const row of teamRows) {
    for (const name of debaterNames(row.team)) {
      const id = `${row.school}|${profileSlug(name)}`
      const entry = byDebater.get(id) ?? { name, rows: [] }
      entry.rows.push(row)
      byDebater.set(id, entry)
    }
  }
  const debaterIds = (row: NdtPointsRow) => debaterNames(row.team).map((name) => `${row.school}|${profileSlug(name)}`)
  // A partnership is ranked only when it is the best one (rows are already sorted) of both its debaters;
  // any other shows under the ranked teams it adds to.
  // High school TOC policy results by debater (full-name slug).
  const hsNames = (competitors: string) =>
    competitors
      .split(/\s*(?:&|,|\/| and )\s*/i)
      .map((name) => name.trim())
      .filter(Boolean)
  const hsByDebater = new Map<string, TocResult[]>()
  for (const result of tocResults) {
    if (result.event !== "Policy") continue
    for (const name of hsNames(result.competitors)) {
      const list = hsByDebater.get(profileSlug(name)) ?? []
      list.push(result)
      hsByDebater.set(profileSlug(name), list)
    }
  }
  const ranked = teamRows.filter((row) => debaterIds(row).every((id) => byDebater.get(id)?.rows[0] === row))
  const withSides = ranked.map((row) => {
    const sides: NdtSidePartnership[] = []
    for (const id of debaterIds(row)) {
      const entry = byDebater.get(id)
      for (const other of entry?.rows ?? []) {
        if (other === row || sides.some((side) => side.key === other.key)) continue
        sides.push({
          key: other.key,
          school: other.school,
          team: other.team,
          debater: entry!.name,
          total: other.total,
          credit: round1(other.total * SIDE_PARTNERSHIP_SHARE),
          firstYear: other.firstYear,
          lastYear: other.lastYear,
        })
      }
    }
    const highSchool: NdtHighSchoolResult[] = []
    for (const name of debaterNames(row.team)) {
      for (const result of hsByDebater.get(profileSlug(name)) ?? []) {
        highSchool.push({
          year: result.year,
          place: result.place,
          school: result.school,
          debater: name,
          partners: hsNames(result.competitors).filter((other) => profileSlug(other) !== profileSlug(name)),
          points: HS_TOC_POINTS[result.place] * ndtEraWeight(result.year, latestYear),
        })
      }
    }
    if (!sides.length && !highSchool.length) return row
    sides.sort((a, b) => b.total - a.total)
    highSchool.sort((a, b) => a.year - b.year || a.debater.localeCompare(b.debater))
    const bonus = round1(sides.reduce((sum, side) => sum + side.credit, 0))
    const hsPoints = round1(highSchool.reduce((sum, result) => sum + result.points, 0))
    for (const result of highSchool) result.points = round1(result.points)
    return {
      ...row,
      total: round1(row.total + bonus + hsPoints),
      parts: { ...row.parts, partners: bonus, highSchool: hsPoints },
      ...(sides.length ? { sidePartnerships: sides } : {}),
      ...(highSchool.length ? { highSchool } : {}),
    }
  })
  return { teams: finish(withSides), schools: finish(schools) }
}

/** 1-based ranks for sorted rows; equal totals share a rank. */
export function rowRanks(rows: NdtPointsRow[]): number[] {
  const ranks: number[] = []
  rows.forEach((row, index) => {
    ranks.push(index > 0 && rows[index - 1].total === row.total ? ranks[index - 1] : index + 1)
  })
  return ranks
}
