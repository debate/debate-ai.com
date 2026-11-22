/**
 * @fileoverview Loads the NDT school-history JSON once and summarizes a
 * school's record for the profile page and the Schools table's NDT column.
 * @module leaderboard/profile/ndtHistory
 */

"use client"

import { useEffect, useState } from "react"
import type { NdtSchoolHistory, NdtTeamResult } from "../../sync/ndt-school-history"

/** Elim rounds, deepest first. */
const ROUND_DEPTH = ["Champion", "Finals", "Semis", "Quarters", "Octas", "Doubles"]

/** Elim rounds by depth: Doubles is 1, Champion is 6. */
const ELIM_DEPTH: Record<string, number> = Object.fromEntries(
  ROUND_DEPTH.map((round, index) => [round, ROUND_DEPTH.length - index]),
)

/** Deepest possible elim depth (Champion). */
export const MAX_ELIM_DEPTH = ROUND_DEPTH.length

let historyPromise: Promise<NdtSchoolHistory[]> | null = null

/** Loads the 360KB history once, on the first page that needs it. */
export function loadNdtHistory(): Promise<NdtSchoolHistory[]> {
  historyPromise ??= import("../../../data/ndt-school-history.json").then(
    (module) => module.default as NdtSchoolHistory[],
  )
  return historyPromise
}

/**
 * The parsed history, or `null` until it loads (and if it fails to).
 *
 * @param enabled - Load it at all; `false` keeps returning `null`.
 */
export function useNdtHistory(enabled = true): NdtSchoolHistory[] | null {
  const [schools, setSchools] = useState<NdtSchoolHistory[] | null>(null)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    loadNdtHistory()
      .then((loaded) => !cancelled && setSchools(loaded))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [enabled])
  return enabled ? schools : null
}

/** Deepest elim round a school reached, or `undefined` if it never broke. */
export function bestNdtFinish(history: NdtSchoolHistory): string | undefined {
  if (history.championships.length) return "Champion"
  return ROUND_DEPTH.find((round) => history.elims.some((elim) => elim.round === round))
}

/** A school's average elim placement over some span of NDTs. */
export interface NdtElimAverage {
  /** Mean depth, Doubles = 1 … Champion = 6, to one decimal. */
  depth: number
  /** The round the mean rounds to, e.g. "Octas". */
  round: string
  /** Elim entries averaged. */
  elims: number
}

/**
 * Average elim round a school's teams reached at the NDT, counting every elim
 * entry (a title counts as Champion, so a year with two teams in elims counts
 * twice). Rounds are scored by depth, Doubles 1 through Champion 6; the mean is
 * reported both as a number and as the round it rounds to.
 *
 * @param sinceYear - Only count elims from this year on (inclusive).
 * @returns `undefined` when no elim in the span has a round.
 */
export function averageNdtElim(history: NdtSchoolHistory, sinceYear = -Infinity): NdtElimAverage | undefined {
  const depths = history.elims
    .filter((elim) => elim.year >= sinceYear)
    .map((elim) => (elim.round ? ELIM_DEPTH[elim.round] : undefined))
    .filter((depth): depth is number => depth !== undefined)
  if (!depths.length) return undefined
  const mean = depths.reduce((sum, depth) => sum + depth, 0) / depths.length
  return {
    depth: Math.round(mean * 10) / 10,
    round: ROUND_DEPTH[ROUND_DEPTH.length - Math.round(mean)],
    elims: depths.length,
  }
}

/** Most recent NDT year anywhere in the history: the end of "the last decade". */
export function latestNdtYear(schools: NdtSchoolHistory[]): number {
  return schools.reduce((latest, school) => Math.max(latest, ...school.years), 0)
}

/** Points an elim team earns for how deep it went: deep runs count far more than a Doubles exit. */
export const ELIM_FINISH_POINTS: Record<string, number> = {
  Champion: 10,
  Finals: 7,
  Semis: 5,
  Quarters: 3,
  Octas: 2,
  Doubles: 1,
}

/** Share of a season's score from the school's three best elim teams that year. */
export const ELIM_TOP_TEAMS_WEIGHT = 0.7
/** Share of a season's score from the average of all its elim teams that year. */
export const ELIM_ALL_TEAMS_WEIGHT = 0.3
/** Best teams a season's top-teams part counts. */
export const ELIM_TOP_TEAMS = 3
/** All-years score: weight of a season before the last decade (the last decade counts 1). */
export const ELIM_OLDER_SEASON_WEIGHT = 0.5

/** Fewest elims a school needs in a span to be ranked there. */
export const MIN_RANKED_ELIMS = 1

/** Where a school's elim finish score stands among every school's. */
export interface NdtElimRank {
  /** 1-based integer position; equal scores share a rank. */
  rank: number
  /** Schools ranked in the span. */
  of: number
}

/** A school's elim finish score over a span. */
export interface NdtElimScore {
  /** Summed season scores, to one decimal. */
  score: number
  /** Elim entries counted. */
  elims: number
}

/**
 * A school's elim finish score: the sum, over every NDT in the span, of
 * 70% × the points of its three best elim teams that year plus 30% × the
 * average points of all its elim teams that year ({@link ELIM_FINISH_POINTS}).
 * Summing seasons and counting up to three teams a year rewards programs that
 * put many teams deep into elims, so one lucky run can't top the table.
 * Seasons before `recentFromYear` count {@link ELIM_OLDER_SEASON_WEIGHT}.
 *
 * @param sinceYear - Only count elims from this year on (inclusive).
 * @param recentFromYear - First year of "the last decade"; earlier seasons are discounted.
 * @returns `undefined` when no elim in the span has a round.
 */
export function ndtElimScore(
  history: NdtSchoolHistory,
  sinceYear = -Infinity,
  recentFromYear = -Infinity,
): NdtElimScore | undefined {
  const byYear = new Map<number, number[]>()
  let elims = 0
  for (const elim of history.elims) {
    const points = elim.round ? ELIM_FINISH_POINTS[elim.round] : undefined
    if (elim.year < sinceYear || points === undefined) continue
    const list = byYear.get(elim.year) ?? []
    list.push(points)
    byYear.set(elim.year, list)
    elims += 1
  }
  if (!elims) return undefined
  let score = 0
  for (const [year, points] of byYear) {
    points.sort((a, b) => b - a)
    const top = points.slice(0, ELIM_TOP_TEAMS).reduce((sum, value) => sum + value, 0)
    const average = points.reduce((sum, value) => sum + value, 0) / points.length
    const season = ELIM_TOP_TEAMS_WEIGHT * top + ELIM_ALL_TEAMS_WEIGHT * average
    score += year >= recentFromYear ? season : season * ELIM_OLDER_SEASON_WEIGHT
  }
  return { score: Math.round(score * 10) / 10, elims }
}

/** One school's row in the full elim finish ranking. */
export interface NdtElimRankRow {
  school: string
  rank: number
  elims: number
  score: number
}

/**
 * Every school with at least {@link MIN_RANKED_ELIMS} elims in the span,
 * ranked by {@link ndtElimScore} (equal scores share a rank), best first.
 */
export function rankAllNdtElimScores(
  schools: NdtSchoolHistory[],
  sinceYear = -Infinity,
  recentFromYear = -Infinity,
): NdtElimRankRow[] {
  const rows = schools
    .map((school) => ({ school: school.school, result: ndtElimScore(school, sinceYear, recentFromYear) }))
    .filter((row): row is { school: string; result: NdtElimScore } => !!row.result && row.result.elims >= MIN_RANKED_ELIMS)
    .sort((a, b) => b.result.score - a.result.score || b.result.elims - a.result.elims || a.school.localeCompare(b.school))
  const ranked: NdtElimRankRow[] = []
  rows.forEach((row, index) => {
    const tied = index > 0 && rows[index - 1].result.score === row.result.score
    ranked.push({
      school: row.school,
      rank: tied ? ranked[index - 1].rank : index + 1,
      elims: row.result.elims,
      score: row.result.score,
    })
  })
  return ranked
}

/**
 * Integer position of `history`'s {@link ndtElimScore} among every school's
 * in the same span, the same rank {@link rankAllNdtElimScores} lists.
 *
 * @returns `undefined` when the school has no elims in the span.
 */
export function rankNdtElimScore(
  schools: NdtSchoolHistory[],
  history: NdtSchoolHistory,
  sinceYear = -Infinity,
  recentFromYear = -Infinity,
): NdtElimRank | undefined {
  const rows = rankAllNdtElimScores(schools, sinceYear, recentFromYear)
  const own = rows.find((row) => row.school === history.school)
  return own ? { rank: own.rank, of: rows.length } : undefined
}

/** An elim qualifier or first-round bid row in a school's merged NDT list. */
export interface NdtElimOrBid extends NdtTeamResult {
  /** The team held a first-round at-large bid that year. */
  firstRound: boolean
  /** Its first-round bid rank, when the NDT printed one. */
  bidRank?: number
}

/** `"Robin Jacobsohn & Tom Lyon (Rank: 13 )"` → `"jacobsohn|lyon"`: one pair, any spelling of first names. */
function pairKey(year: number, team: string): string {
  const names = team
    .replace(/\([^)]*\)/g, " ")
    .split(/\s*(?:&|\/|,| and )\s*/i)
    .map((name) => name.trim().split(/\s+/).at(-1)?.toLowerCase() ?? "")
    .filter(Boolean)
    .sort()
  return `${year}|${names.join("|")}`
}

/**
 * A school's elim qualifiers with its first-round at-large bids merged in,
 * newest first: an elim team that held a bid that year is marked
 * `firstRound`, and a bid team that missed elims gets its own row (no round).
 */
export function mergeElimsAndBids(history: NdtSchoolHistory): NdtElimOrBid[] {
  const bids = new Map<string, number | undefined>()
  for (const bid of history.atLargeBids) {
    const printed = /\(\s*Rank:\s*(\d+)\s*\)/i.exec(bid.team)
    bids.set(pairKey(bid.year, bid.team), bid.rank ?? (printed ? Number(printed[1]) : undefined))
  }
  const rows: NdtElimOrBid[] = history.elims.map((elim) => {
    const key = pairKey(elim.year, elim.team)
    const firstRound = bids.has(key)
    const row: NdtElimOrBid = { ...elim, firstRound, bidRank: bids.get(key) }
    bids.delete(key)
    return row
  })
  for (const bid of history.atLargeBids) {
    const key = pairKey(bid.year, bid.team)
    if (!bids.has(key)) continue
    rows.push({
      year: bid.year,
      team: bid.team.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim(),
      firstRound: true,
      bidRank: bids.get(key),
    })
    bids.delete(key)
  }
  return rows.sort((a, b) => b.year - a.year || (a.round ? 0 : 1) - (b.round ? 0 : 1))
}
