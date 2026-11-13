/**
 * @fileoverview A round video team's all-time NDT ranks: where its pair sits
 * among every partnership, and where each of its debaters sits among every
 * debater, in the "All seasons: NDT points" table ({@link buildNdtAllSeasons},
 * so with its current weights, the pre-2000 multiplier and the TOC/NDCA high
 * school credit). The Greatest of All Time round tooltip shows these, e.g.
 * "#1 debater of all time" and "#3 team of all time".
 *
 * A video names a team by school and initials (`"Northwestern MV"`). The
 * school is matched as the NDT spells it ({@link findNdtSchoolHistory}), the
 * initials against each partnership's last names in either order, and, when
 * two pairs share initials, the one debating nearest the round's year wins.
 * @module leaderboard/profile/ndtAllTimeRanks
 */

import type { NdtSchoolHistory } from "../../sync/ndt-school-history"
import { entryInitials, parseTeamLabel } from "../../team-lookup"
import { findNdtSchoolHistory, profileSlug } from "./rankingProfileHelpers"
import {
  buildNdtAllSeasons,
  cleanTeamName,
  rowRanks,
  type NdtAllSeasonsTable,
  type NdtPointsRow,
} from "./ndtAllSeasons"

/** One all-time rank: a debater or a partnership. */
export interface NdtAllTimeRank {
  /** The debater's or pair's names as the NDT spells them. */
  name: string
  /** 1-based; equal totals share a rank. */
  rank: number
  /** How many rows the rank is out of. */
  of: number
  /** All-seasons NDT points. */
  total: number
}

/** A team's all-time ranks. */
export interface NdtTeamAllTimeRanks {
  /** NDT school name, e.g. `"Northwestern University (IL)"`. */
  school: string
  /**
   * The pair's rank. `mode` says which table: `teams` (the default "teams,
   * with partners' points") when the pair is ranked there, else `strict`
   * (every partnership on only what it did together), since a pair that was
   * neither debater's best partnership is not its own row in `teams`.
   */
  team: (NdtAllTimeRank & { mode: "teams" | "strict" }) | null
  /** Each debater's individual rank, in the pair's name order. */
  debaters: NdtAllTimeRank[]
}

/** A pair whose seasons are more than this many years from the round's is someone else. */
const MAX_YEAR_GAP = 4

/** `"MV"` and `"VM"` name the same pair: speaking order varies. */
const sortedLetters = (code: string) => [...code.toUpperCase()].sort().join("")

/** Each row's rank by key. */
function rankIndex(rows: NdtPointsRow[]): Map<string, NdtAllTimeRank> {
  const ranks = rowRanks(rows)
  const index = new Map<string, NdtAllTimeRank>()
  rows.forEach((row, i) => index.set(row.key, { name: row.team, rank: ranks[i], of: rows.length, total: row.total }))
  return index
}

/**
 * Years between a round and a pair's NDT seasons. A fall tournament belongs
 * to the next spring's NDT, so a round the year before the pair's first NDT
 * still counts as its own.
 */
function yearGap(row: NdtPointsRow, year: number): number {
  if (year < row.firstYear - 1) return row.firstYear - 1 - year
  if (year > row.lastYear) return year - row.lastYear
  return 0
}

/**
 * Builds a lookup from a video team label to its all-time ranks.
 *
 * @param history - Parsed `ndt-school-history.json`.
 * @param table - The all-seasons table; built from `history` when omitted.
 * @returns `(label, year?) => ranks`, or `null` when the label names no NDT
 *   partnership (no initials, a school with no NDT record, or no pair with
 *   those initials near `year`).
 */
export function ndtAllTimeRankLookup(
  history: NdtSchoolHistory[],
  table: NdtAllSeasonsTable = buildNdtAllSeasons(history),
): (label: string | null | undefined, year?: number | null) => NdtTeamAllTimeRanks | null {
  const teams = rankIndex(table.teams)
  const strict = rankIndex(table.strictTeams)
  const debaters = rankIndex(table.debaters)
  const bySchool = new Map<string, NdtPointsRow[]>()
  for (const row of table.strictTeams) {
    const list = bySchool.get(row.school) ?? []
    list.push(row)
    bySchool.set(row.school, list)
  }
  const cache = new Map<string, NdtTeamAllTimeRanks | null>()

  return (label, year) => {
    const id = `${label ?? ""}|${year ?? ""}`
    if (cache.has(id)) return cache.get(id)!
    const result = lookup(label, year)
    cache.set(id, result)
    return result
  }

  function lookup(label: string | null | undefined, year?: number | null): NdtTeamAllTimeRanks | null {
    const parsed = parseTeamLabel(label)
    if (!parsed) return null
    const school = findNdtSchoolHistory(history, parsed.school)
    if (!school) return null
    const code = sortedLetters(parsed.code)
    const candidates = (bySchool.get(school.school) ?? []).filter(
      (row) => sortedLetters(entryInitials(row.team)) === code,
    )
    const ordered =
      typeof year === "number"
        ? candidates
            .filter((row) => yearGap(row, year) <= MAX_YEAR_GAP)
            .sort((a, b) => yearGap(a, year) - yearGap(b, year) || b.total - a.total)
        : candidates // already best first
    const pair = ordered[0]
    if (!pair) return null
    const inTeams = teams.get(pair.key)
    const own = inTeams ?? strict.get(pair.key)
    const names = cleanTeamName(pair.team)
      .split(/\s*(?:&|\/| and )\s*/i)
      .filter(Boolean)
    return {
      school: school.school,
      team: own ? { ...own, mode: inTeams ? "teams" : "strict" } : null,
      debaters: names
        .map((name) => debaters.get(`${pair.school}|${profileSlug(name)}`))
        .filter((rank): rank is NdtAllTimeRank => !!rank),
    }
  }
}

let loading: Promise<ReturnType<typeof ndtAllTimeRankLookup>> | null = null

/**
 * The lookup over the bundled NDT history, built once per page. The history
 * JSON is imported on first call, so pages that never show a tooltip don't
 * load it.
 */
export function loadNdtAllTimeRanks(): Promise<ReturnType<typeof ndtAllTimeRankLookup>> {
  loading ??= import("../../../data/ndt-school-history.json")
    .then((module) => ndtAllTimeRankLookup(module.default as NdtSchoolHistory[]))
    .catch((error) => {
      loading = null
      throw error
    })
  return loading
}

