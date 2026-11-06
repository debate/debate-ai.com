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
 * a debater with two partners is two teams. Each debater's results with other
 * partners are also listed separately at half weight, credited to that debater,
 * so multi-partnership careers (e.g. Morales with different partners) are
 * reflected. A speaker award whose speaker isn't on exactly one of the
 * school's listed teams that year still counts for the school, just not for
 * any team.
 * @module leaderboard/profile/ndtAllSeasons
 */

import type { NdtSchoolHistory } from "../../sync/ndt-school-history"
import { profileSlug } from "./rankingProfileHelpers"
import { speakerPoints, STRENGTH_WEIGHTS } from "./programStrength"

/** What a team's or school's NDT points came from. */
export type NdtPointsPart = "elims" | "copeland" | "bids" | "speakers"

/** Parts in the order the table lists them, with their labels. */
export const NDT_POINTS_PARTS: { key: NdtPointsPart; label: string; short: string }[] = [
  { key: "elims", label: "NDT elims", short: "Elims" },
  { key: "copeland", label: "Copeland Award", short: "Copeland" },
  { key: "bids", label: "First-round bids", short: "Bids" },
  { key: "speakers", label: "Speaker awards", short: "Speakers" },
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
   * When set, this row is half-weight credit for a debater's results with
   * another partner (listed separately from the primary partnership row).
   * Names the debater and the partnership those points came from.
   */
  crossPartner?: { debater: string; withPartner: string; sourceTeam: string; weight: number }
}

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

const emptyParts = (): Record<NdtPointsPart, number> => ({ elims: 0, copeland: 0, bids: 0, speakers: 0 })
const emptyCounts = (): NdtPointsCounts => ({ titles: 0, elims: 0, copeland: 0, bids: 0, speakerAwards: 0 })
const round1 = (value: number) => Math.round(value * 10) / 10
const half = (value: number) => round1(value * 0.5)

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
export function buildNdtAllSeasons(history: NdtSchoolHistory[]): NdtAllSeasonsTable {
  const teams = new Map<string, NdtPointsRow>()
  const schools: NdtPointsRow[] = []

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
        row.parts[part] += points
        row.total += points
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

  const teamRows = [...teams.values()].filter((row) => row.total > 0)
  // Cross-partner credit: for each debater on multiple partnerships, list
  // their results with other partners separately at half weight.
  const nameSpellings = new Map<string, string>()
  const byDebater = new Map<string, NdtPointsRow[]>()
  for (const row of teamRows) {
    for (const name of debaterNames(row.team)) {
      const k = profileSlug(name)
      if (!nameSpellings.has(k) || name.length > (nameSpellings.get(k)?.length ?? 0)) nameSpellings.set(k, name)
      const list = byDebater.get(k) ?? []
      list.push(row)
      byDebater.set(k, list)
    }
  }
  const cross: NdtPointsRow[] = []
  for (const [debKey, rows] of byDebater) {
    if (rows.length < 2) continue
    const debater = nameSpellings.get(debKey) ?? debKey
    for (const source of rows) {
      const partners = debaterNames(source.team).filter((n) => profileSlug(n) !== debKey)
      const partnerText = partners.join(" & ")
      cross.push({
        key: `${source.key}|cross|${debKey}`,
        school: source.school,
        team: `${debater} (w/ ${partnerText}, ½ credit)`,
        total: half(source.total),
        parts: {
          elims: half(source.parts.elims),
          copeland: half(source.parts.copeland),
          bids: half(source.parts.bids),
          speakers: half(source.parts.speakers),
        },
        counts: { ...source.counts },
        firstYear: source.firstYear,
        lastYear: source.lastYear,
        crossPartner: { debater, withPartner: partnerText, sourceTeam: source.team, weight: 0.5 },
      })
    }
  }
  return { teams: finish([...teamRows, ...cross]), schools: finish(schools) }
}

/** 1-based ranks for sorted rows; equal totals share a rank. */
export function rowRanks(rows: NdtPointsRow[]): number[] {
  const ranks: number[] = []
  rows.forEach((row, index) => {
    ranks.push(index > 0 && rows[index - 1].total === row.total ? ranks[index - 1] : index + 1)
  })
  return ranks
}
