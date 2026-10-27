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
