/**
 * @fileoverview Season-by-season strength of a college policy program, and
 * where it ranks among every program for the latest season, the last decade
 * and all time. Each season's score is a weighted sum of what the program did
 * that year: NDT attendance, first-round at-large bids, the Copeland Award,
 * NDT elim runs (by round reached), NDT speaker awards, CEDA national titles
 * and its teams in debatedata's top-100 table. The weights are
 * {@link STRENGTH_WEIGHTS}; the school page prints them beside the chart.
 *
 * A season is named by the year it ends in (2024-25 is 2025), the year its
 * NDT and CEDA nationals are held.
 * @module panels/leaderboard/profile/programStrength
 */

import type { CedaSchoolTitles } from "@debate-ai/data-sync/src/rankings/ceda-champions"
import { findCedaSchoolTitles } from "@debate-ai/data-sync/src/rankings/ceda-champions"
import type { NdtSchoolHistory } from "@debate-ai/data-sync/src/rankings/ndt-school-history"
import { collegeSchoolKey, type CollegeHistoryEntry } from "../../college-history"
import { findNdtSchoolHistory } from "./rankingProfileHelpers"

/** What a season's points came from. */
export type StrengthComponent = "elims" | "copeland" | "ceda" | "speakers" | "bids" | "rankings" | "attendance"

/** Components in the order the page lists them, with their labels. */
export const STRENGTH_COMPONENTS: { key: StrengthComponent; label: string }[] = [
  { key: "elims", label: "NDT elims" },
  { key: "copeland", label: "Copeland Award" },
  { key: "ceda", label: "CEDA title" },
  { key: "speakers", label: "NDT speakers" },
  { key: "bids", label: "First-round bids" },
  { key: "rankings", label: "Top-100 teams" },
  { key: "attendance", label: "NDT attendance" },
]

/** Points per achievement. An NDT title is the single biggest result. */
export const STRENGTH_WEIGHTS = {
  /** Each team's deepest NDT elim round. A title is Champion, not Finals + bonus. */
  ndtElim: { Doubles: 3, Octas: 5, Quarters: 8, Semis: 12, Finals: 18, Champion: 30 } as Record<string, number>,
  /** The Copeland Award: the NDT's top first-round at-large seed, the regular season's best team. */
  copeland: 12,
  /** A CEDA national championship. */
  ceda: 20,
  /** NDT speaker awards by place: the top speaker, 2nd-5th, 6th-10th, 11th-20th. */
  speaker: [
    { maxRank: 1, points: 10 },
    { maxRank: 5, points: 5 },
    { maxRank: 10, points: 3 },
    { maxRank: 20, points: 1 },
  ],
  /** Each first-round at-large bid (a top-16 regular season team). */
  firstRoundBid: 4,
  /** Each team in debatedata's top-100: `(101 - rank) / 20`, so #1 is 5 points and #100 is 0.05. */
  rankingDivisor: 20,
  /** Attending the NDT at all. */
  ndtAttendance: 2,
}

/** Points for a top-100 team at `rank`. */
export function rankingPoints(rank: number): number {
  return rank >= 1 && rank <= 100 ? (101 - rank) / STRENGTH_WEIGHTS.rankingDivisor : 0
}

/** Points for an NDT speaker award at `rank`; unranked awards count as 20th. */
export function speakerPoints(rank: number | undefined): number {
  const place = rank ?? 20
  return STRENGTH_WEIGHTS.speaker.find((tier) => place <= tier.maxRank)?.points ?? 0
}

/** One program's season: its score and what the score came from. */
export interface ProgramSeason {
  year: number
  total: number
  parts: Record<StrengthComponent, number>
}

/** One college program and every season it scored in. */
export interface ProgramStrength {
  /** Stable id: the NDT name, else the CEDA name, else the rankings' school key. */
  key: string
  /** Display name, without a state tag. */
  name: string
  seasons: Map<number, ProgramSeason>
}

/** The histories a score is built from. */
export interface StrengthSources {
  ndt: NdtSchoolHistory[]
  ceda: CedaSchoolTitles[]
  /** debatedata's top-100 tables, one per season year. */
  rankings: { year: number; entries: readonly CollegeHistoryEntry[] }[]
}

/** `2025` → `"2024–25"`. */
export function seasonLabel(year: number): string {
  return `${year - 1}–${String(year % 100).padStart(2, "0")}`
}

const emptyParts = (): Record<StrengthComponent, number> => ({
  elims: 0,
  copeland: 0,
  ceda: 0,
  speakers: 0,
  bids: 0,
  rankings: 0,
  attendance: 0,
})

const round1 = (value: number) => Math.round(value * 10) / 10

/**
 * Resolves any spelling of a college (the NDT's, CEDA's, the rankings') to
 * one program id, the way the school page matches its sections: the NDT
 * history first, then CEDA's winners, then the rankings' school key.
 */
export function programResolver(ndt: NdtSchoolHistory[], ceda: CedaSchoolTitles[]) {
  const cache = new Map<string, { key: string; name: string }>()
  return (school: string): { key: string; name: string } => {
    const cached = cache.get(school)
    if (cached) return cached
    const ndtMatch = findNdtSchoolHistory(ndt, school)
    const cedaMatch = ndtMatch ? null : findCedaSchoolTitles(school, ceda)
    const resolved = ndtMatch
      ? { key: `ndt:${ndtMatch.school}`, name: ndtMatch.school.replace(/\s*\([^)]*\)\s*$/, "") }
      : cedaMatch
        ? { key: `ceda:${cedaMatch.school}`, name: cedaMatch.school }
        : { key: `rank:${collegeSchoolKey(school)}`, name: school }
    cache.set(school, resolved)
    return resolved
  }
}

/**
 * Every program's season scores, from every source in `sources`.
 *
 * @returns One entry per program that scored at least once.
 */
export function buildProgramStrengths(sources: StrengthSources): ProgramStrength[] {
  const resolve = programResolver(sources.ndt, sources.ceda)
  const programs = new Map<string, ProgramStrength>()

  const add = (program: { key: string; name: string }, year: number, part: StrengthComponent, points: number) => {
    if (!points) return
    const entry = programs.get(program.key) ?? { ...program, seasons: new Map<number, ProgramSeason>() }
    programs.set(program.key, entry)
    const season = entry.seasons.get(year) ?? { year, total: 0, parts: emptyParts() }
    entry.seasons.set(year, season)
    season.parts[part] += points
    season.total += points
  }

  for (const school of sources.ndt) {
    const program = resolve(school.school)
    for (const year of new Set(school.years)) add(program, year, "attendance", STRENGTH_WEIGHTS.ndtAttendance)
    const elims = school.elims.map((elim) => ({ ...elim }))
    // A title is an elim run too; count one the elim list missed.
    for (const title of school.championships) {
      if (!elims.some((elim) => elim.year === title.year && elim.team === title.team)) {
        elims.push({ ...title, round: "Champion" })
      }
    }
    for (const elim of elims) add(program, elim.year, "elims", STRENGTH_WEIGHTS.ndtElim[elim.round ?? ""] ?? 0)
    for (const bid of school.atLargeBids) add(program, bid.year, "bids", STRENGTH_WEIGHTS.firstRoundBid)
    for (const winner of school.copelandWinners) add(program, winner.year, "copeland", STRENGTH_WEIGHTS.copeland)
    for (const award of school.speakerAwards) add(program, award.year, "speakers", speakerPoints(award.rank))
  }

  for (const school of sources.ceda) {
    const program = resolve(school.school)
    for (const title of school.titles) add(program, title.year, "ceda", STRENGTH_WEIGHTS.ceda)
  }

  for (const { year, entries } of sources.rankings) {
    for (const entry of entries) add(resolve(entry.school), year, "rankings", rankingPoints(entry.rank))
  }

  for (const program of programs.values()) {
    for (const season of program.seasons.values()) {
      season.total = round1(season.total)
      for (const { key } of STRENGTH_COMPONENTS) season.parts[key] = round1(season.parts[key])
    }
  }
  return [...programs.values()]
}

/** The latest season any source has a result for. */
export function latestStrengthYear(programs: ProgramStrength[]): number {
  let latest = 0
  for (const program of programs) for (const year of program.seasons.keys()) latest = Math.max(latest, year)
  return latest
}

/** A program's summed score over seasons `from`–`to` (inclusive). */
export function programScore(program: ProgramStrength, from = -Infinity, to = Infinity): number {
  let total = 0
  for (const season of program.seasons.values()) if (season.year >= from && season.year <= to) total += season.total
  return round1(total)
}

/** Where one program stands over a span of seasons. */
export interface ProgramRank {
  /** 1-based; programs with equal scores share a rank. */
  rank: number
  score: number
  /** Programs that scored in the span. */
  of: number
}

/**
 * Rank of program `key` among every program scoring over `from`–`to`, or
 * `null` when it scored nothing then.
 */
export function rankProgram(programs: ProgramStrength[], key: string, from = -Infinity, to = Infinity): ProgramRank | null {
  const scores = programs.map((program) => ({ key: program.key, score: programScore(program, from, to) }))
  const scored = scores.filter((entry) => entry.score > 0)
  const own = scored.find((entry) => entry.key === key)
  if (!own) return null
  return { rank: 1 + scored.filter((entry) => entry.score > own.score).length, score: own.score, of: scored.length }
}

/**
 * Every season from a program's first scored season to `lastYear`, with
 * zero-score seasons filled in so gaps show on the chart.
 */
export function programSeasonSeries(program: ProgramStrength, lastYear: number): ProgramSeason[] {
  const years = [...program.seasons.keys()]
  if (!years.length) return []
  const series: ProgramSeason[] = []
  for (let year = Math.min(...years); year <= lastYear; year++) {
    series.push(program.seasons.get(year) ?? { year, total: 0, parts: emptyParts() })
  }
  return series
}
