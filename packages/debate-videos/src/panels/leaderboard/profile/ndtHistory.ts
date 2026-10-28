/**
 * @fileoverview Loads the NDT school-history JSON once and summarizes a
 * school's record for the profile page and the Schools table's NDT column.
 * @module panels/leaderboard/profile/ndtHistory
 */

"use client"

import { useEffect, useState } from "react"
import type { NdtSchoolHistory } from "@debate-ai/data-sync/src/rankings/ndt-school-history"

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
  historyPromise ??= import("@debate-ai/data-sync/data/metadata/ndt-school-history.json").then(
    (module) => module.default as NdtSchoolHistory[],
  )
  return historyPromise
}

/** The parsed history, or `null` until it loads (and if it fails to). */
export function useNdtHistory(): NdtSchoolHistory[] | null {
  const [schools, setSchools] = useState<NdtSchoolHistory[] | null>(null)
  useEffect(() => {
    let cancelled = false
    loadNdtHistory()
      .then((loaded) => !cancelled && setSchools(loaded))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return schools
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
