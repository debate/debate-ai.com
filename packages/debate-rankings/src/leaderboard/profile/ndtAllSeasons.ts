/**
 * @fileoverview All-seasons NDT points table: every college policy team (a
 * pair of debaters at one school) and every school ranked by the points their
 * National Debate Tournament results earned across every NDT on record, 1947
 * on. Four things score, with the weights the program strength chart uses
 * ({@link STRENGTH_WEIGHTS}), each part then scaled by
 * {@link NDT_POINTS_MULTIPLIERS} (the Copeland Award counts 1.5×):
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
 * a debater with two partners is two teams. A team also gets a quarter of the
 * points each of its debaters scored with other partners (Miles &
 * Vellayappan get a quarter of Vellayappan & Lee's), and those side partnerships
 * are listed under it ({@link NdtPointsRow.sidePartnerships}). A partnership
 * is its own row only when it is both debaters' best; any other (Vellayappan &
 * Lee) is ranked only through the teams it feeds. A team's debaters also
 * score, at lower weights ({@link HS_TOC_POINTS}, {@link HS_NDCA_POINTS}, then
 * halved), for their high school Tournament of Champions and NDCA national
 * championship policy results with any partner, matched by full name
 * ({@link NdtPointsRow.highSchool}). Results from seasons before
 * {@link NDT_ERA_CUTOFF_YEAR} count {@link NDT_PRE_ERA_MULTIPLIER}× (40% less),
 * season by season, so a team with results on both sides of 2000 has only its
 * earlier ones reduced. A speaker award whose speaker isn't on exactly one of the
 * school's listed teams that year still counts for the school, just not for
 * any team.
 * @module leaderboard/profile/ndtAllSeasons
 */

import type { NdtSchoolHistory } from "../../sync/ndt-school-history"
import { profileSlug } from "./rankingProfileHelpers"
import { speakerPoints, STRENGTH_WEIGHTS } from "./programStrength"
import { TOC_RESULTS, type TocPlace, type TocResult } from "../../sync/toc-champions"
import { NDCA_POLICY_RESULTS, type NdcaPlace, type NdcaResult } from "../../sync/ndca-champions"

/** What a team's or school's NDT points came from. */
export type NdtPointsPart = "elims" | "copeland" | "bids" | "speakers" | "partners" | "highSchool"

/** Parts in the order the table lists them, with their labels. */
export const NDT_POINTS_PARTS: { key: NdtPointsPart; label: string; short: string }[] = [
  { key: "elims", label: "NDT elims", short: "Elims" },
  { key: "copeland", label: "Copeland Award", short: "Copeland" },
  { key: "bids", label: "First-round bids", short: "Bids" },
  { key: "speakers", label: "Speaker awards", short: "Speakers" },
  { key: "partners", label: "Points with other partners", short: "Other partners" },
  { key: "highSchool", label: "High school TOC & NDCA (policy)", short: "High school" },
]

/**
 * What each part's points are multiplied by in this table. A ranking of what a
 * partnership did together: its own NDT results count in full, the Copeland
 * Award (the season-long best team) counts extra, and results with other
 * partners or in high school are supplementary. The score is
 * `E + 1.5C + B + S + 0.25O + 0.5H`.
 */
export const NDT_POINTS_MULTIPLIERS: Record<NdtPointsPart, number> = {
  elims: 1,
  copeland: 1.5,
  bids: 1,
  speakers: 1,
  partners: 0.25,
  highSchool: 0.5,
}

/** Seasons (the year the NDT or high school championship was held) before this count at {@link NDT_PRE_ERA_MULTIPLIER}. */
export const NDT_ERA_CUTOFF_YEAR = 2000

/** What a result from a season before {@link NDT_ERA_CUTOFF_YEAR} is multiplied by: 40% less. */
export const NDT_PRE_ERA_MULTIPLIER = 0.6

/** The era multiplier for a result from `year`. */
export function ndtEraMultiplier(year: number): number {
  return year < NDT_ERA_CUTOFF_YEAR ? NDT_PRE_ERA_MULTIPLIER : 1
}

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
   * The team's debaters' high school TOC and NDCA policy results (with any partner),
   * oldest first, adding the `highSchool` part. Empty when none match.
   */
  highSchool?: NdtHighSchoolResult[]
}

/** The high school national championships a college debater's results come from. */
export type HighSchoolTournament = "TOC" | "NDCA"

/** One high school Tournament of Champions or NDCA policy result of a team's debater. */
export interface NdtHighSchoolResult {
  tournament: HighSchoolTournament
  year: number
  place: TocPlace
  school: string
  /** The team's debater the result belongs to. */
  debater: string
  /** Their high school partner(s), empty for a top speaker award. */
  partners: string[]
  /** What the result adds: its {@link HS_TOC_POINTS} / {@link HS_NDCA_POINTS} points times the `highSchool` multiplier. */
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

/**
 * Points for an NDCA national championship policy result: the same as a TOC
 * result, since the NDCA is the high school circuit's other national
 * championship. The NDCA list has no runners-up.
 */
export const HS_NDCA_POINTS: Record<NdcaPlace, number> = {
  Champion: HS_TOC_POINTS.Champion,
  "Co-champion": HS_TOC_POINTS["Co-champion"],
  "Top speaker": HS_TOC_POINTS["Top speaker"],
}

/** Another partnership of one of a team's debaters, credited at {@link SIDE_PARTNERSHIP_SHARE}. */
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
export const SIDE_PARTNERSHIP_SHARE = NDT_POINTS_MULTIPLIERS.partners

/**
 * How the table ranks people rather than schools:
 * - `debaters`: each debater on their own, with every partnership's NDT
 *   points in full, their own speaker awards and their own high school results;
 * - `teams`: each debater's best partnership, plus a share of their other
 *   partnerships ({@link SIDE_PARTNERSHIP_SHARE}) and their high school results;
 * - `strict`: every partnership on only what that pair did together at the
 *   NDT, with nothing from other partners or high school.
 */
export type NdtRankingMode = "debaters" | "teams" | "strict"

/** The modes in the order the picker lists them, with their labels. */
export const NDT_RANKING_MODES: { key: NdtRankingMode; label: string; noun: string }[] = [
  { key: "debaters", label: "Individual debaters", noun: "Debaters" },
  { key: "teams", label: "Teams, with partners' points", noun: "Teams" },
  { key: "strict", label: "Teams, strictly together", noun: "Teams" },
]

/** The ranked table: teams and schools, best first. */
export interface NdtAllSeasonsTable {
  /** Each debater's best partnership, with side partnerships and high school ({@link NdtRankingMode} `teams`). */
  teams: NdtPointsRow[]
  /** Every partnership on its own NDT results only (`strict`). */
  strictTeams: NdtPointsRow[]
  /**
   * Every debater on their own (`debaters`); `team` is the debater's name and
   * `sidePartnerships` lists every partnership they had, each credited in full.
   */
  debaters: NdtPointsRow[]
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
/** Two decimals: a quarter-credit side partnership can add 24.25. */
const round2 = (value: number) => Math.round(value * 100) / 100

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
 * @param tocResults - TOC results to credit debaters' high school policy record from.
 * @param ndcaResults - NDCA national championship policy results, likewise.
 * @returns Teams and schools, each sorted by points, highest first; ties
 *   break by more titles, then by name.
 */
export function buildNdtAllSeasons(
  history: NdtSchoolHistory[],
  tocResults: readonly TocResult[] = TOC_RESULTS,
  ndcaResults: readonly NdcaResult[] = NDCA_POLICY_RESULTS,
): NdtAllSeasonsTable {
  const teams = new Map<string, NdtPointsRow>()
  const schools: NdtPointsRow[] = []
  /** Each debater's own speaker awards, by `school|slug`, for the debater ranking. */
  const speakerByDebater = new Map<string, { points: number; count: number; years: number[] }>()

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
        const weighted = points * NDT_POINTS_MULTIPLIERS[part] * ndtEraMultiplier(year)
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
      const own = speakerByDebater.get(`${school.school}|${speaker}`) ?? { points: 0, count: 0, years: [] }
      own.count += 1
      own.points += speakerPoints(award.rank) * NDT_POINTS_MULTIPLIERS.speakers * ndtEraMultiplier(award.year)
      if (speakerPoints(award.rank)) own.years.push(award.year)
      speakerByDebater.set(`${school.school}|${speaker}`, own)
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
      row.total = round2(row.total)
      for (const { key } of NDT_POINTS_PARTS) row.parts[key] = round2(row.parts[key])
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
  // High school TOC and NDCA policy results by debater (full-name slug).
  const hsNames = (competitors: string) =>
    competitors
      .split(/\s*(?:&|,|\/| and )\s*/i)
      .map((name) => name.trim())
      .filter(Boolean)
  type HsResult = { tournament: HighSchoolTournament; year: number; place: TocPlace; school: string; competitors: string; points: number }
  const hsResults: HsResult[] = [
    ...tocResults
      .filter((result) => result.event === "Policy")
      .map((result) => ({ ...result, tournament: "TOC" as const, points: HS_TOC_POINTS[result.place] * NDT_POINTS_MULTIPLIERS.highSchool * ndtEraMultiplier(result.year) })),
    ...ndcaResults.map((result) => ({ ...result, tournament: "NDCA" as const, points: HS_NDCA_POINTS[result.place] * NDT_POINTS_MULTIPLIERS.highSchool * ndtEraMultiplier(result.year) })),
  ]
  const hsByDebater = new Map<string, HsResult[]>()
  for (const result of hsResults) {
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
          credit: round2(other.total * SIDE_PARTNERSHIP_SHARE),
          firstYear: other.firstYear,
          lastYear: other.lastYear,
        })
      }
    }
    const highSchool: NdtHighSchoolResult[] = []
    for (const name of debaterNames(row.team)) {
      for (const result of hsByDebater.get(profileSlug(name)) ?? []) {
        highSchool.push({
          tournament: result.tournament,
          year: result.year,
          place: result.place,
          school: result.school,
          debater: name,
          partners: hsNames(result.competitors).filter((other) => profileSlug(other) !== profileSlug(name)),
          points: result.points,
        })
      }
    }
    if (!sides.length && !highSchool.length) return row
    sides.sort((a, b) => b.total - a.total)
    highSchool.sort((a, b) => a.year - b.year || a.tournament.localeCompare(b.tournament) || a.debater.localeCompare(b.debater))
    const bonus = round2(sides.reduce((sum, side) => sum + side.credit, 0))
    const hsPoints = round2(highSchool.reduce((sum, result) => sum + result.points, 0))
    return {
      ...row,
      total: round2(row.total + bonus + hsPoints),
      parts: { ...row.parts, partners: bonus, highSchool: hsPoints },
      ...(sides.length ? { sidePartnerships: sides } : {}),
      ...(highSchool.length ? { highSchool } : {}),
    }
  })
  // Each debater on their own: every partnership's NDT results in full, but only their own speaker awards.
  const debaterRows = [...byDebater].map(([id, { name, rows }]) => {
    const parts = emptyParts()
    const counts = emptyCounts()
    let firstYear = Infinity
    let lastYear = -Infinity
    for (const team of rows) {
      for (const key of ["elims", "copeland", "bids"] as const) parts[key] += team.parts[key]
      for (const key of ["titles", "elims", "copeland", "bids"] as const) counts[key] += team.counts[key]
      if (team.parts.elims || team.parts.copeland || team.parts.bids) {
        firstYear = Math.min(firstYear, team.firstYear)
        lastYear = Math.max(lastYear, team.lastYear)
      }
    }
    const speakers = speakerByDebater.get(id)
    if (speakers) {
      parts.speakers = speakers.points
      counts.speakerAwards = speakers.count
      for (const year of speakers.years) {
        firstYear = Math.min(firstYear, year)
        lastYear = Math.max(lastYear, year)
      }
    }
    const highSchool: NdtHighSchoolResult[] = (hsByDebater.get(profileSlug(name)) ?? [])
      .map((result) => ({
        tournament: result.tournament,
        year: result.year,
        place: result.place,
        school: result.school,
        debater: name,
        partners: hsNames(result.competitors).filter((other) => profileSlug(other) !== profileSlug(name)),
        points: result.points,
      }))
      .sort((a, b) => a.year - b.year || a.tournament.localeCompare(b.tournament))
    parts.highSchool = highSchool.reduce((sum, result) => sum + result.points, 0)
    const school = rows[0].school
    const row: NdtPointsRow = {
      key: id,
      school,
      team: name,
      total: NDT_POINTS_PARTS.reduce((sum, { key }) => sum + parts[key], 0),
      parts,
      counts,
      firstYear,
      lastYear,
      sidePartnerships: rows.map((team) => ({
        key: team.key,
        school: team.school,
        team: team.team,
        debater: name,
        total: team.total,
        credit: team.total,
        firstYear: team.firstYear,
        lastYear: team.lastYear,
      })),
      ...(highSchool.length ? { highSchool } : {}),
    }
    return row
  })

  return {
    teams: finish(withSides),
    strictTeams: teamRows,
    debaters: finish(debaterRows.filter((row) => row.total > 0)),
    schools: finish(schools),
  }
}

/** 1-based ranks for sorted rows; equal totals share a rank. */
export function rowRanks(rows: NdtPointsRow[]): number[] {
  const ranks: number[] = []
  rows.forEach((row, index) => {
    ranks.push(index > 0 && rows[index - 1].total === row.total ? ranks[index - 1] : index + 1)
  })
  return ranks
}
