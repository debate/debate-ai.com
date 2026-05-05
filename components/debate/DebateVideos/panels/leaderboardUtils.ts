/**
 * @fileoverview Shared types, constants, and sort utilities for the leaderboard panel.
 * @module components/debate/DebateVideos/panels/leaderboardUtils
 */

import type { LeaderboardEntry } from "@/lib/sync-debate-rankings/sync-rankings-debatedrills"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** High-school and college debate division identifiers. */
export type Division = "VPF" | "VLD" | "VCX" | "NDT"

/** Set of valid division strings used for URL query-param validation. */
export const VALID_DIVISIONS = new Set<string>(["VPF", "VLD", "VCX", "NDT"])

/** Column keys available for sorting the leaderboard grid. */
export type SortKey =
  | "rank"
  | "state"
  | "bids"
  | "tocScore"
  | "debateElo"
  | "eloRank"
  | "eloToBid"
  | "eloTimesBid"

/** Sort direction for a leaderboard column. */
export type SortDir = "asc" | "desc"

/** Active sort state, or `null` when no column is sorted. */
export type SortState = { key: SortKey; dir: SortDir } | null

/** Champion and topic data for a single debate season. */
export type YearData = {
  ndt_topic?: string
  ndt_champion?: string
  policy_topic?: string
  policy_champion?: string
  ld_topic?: string
  ld_champion?: string
  pf_topic?: string
  pf_champion?: string
}

/** Historical champion/topic data indexed by four-digit year string (e.g. `"2026"`). */
export type DebateHistory = Record<string, YearData>

// ---------------------------------------------------------------------------
// Division config
// ---------------------------------------------------------------------------

/**
 * Per-division display metadata: label text, data field keys for the champion
 * banner, and the logo image path.
 */
export const DIVISION_CONFIG: {
  value: Division
  label: string
  topicKey: keyof YearData
  championKey: keyof YearData
  logoSrc: string
}[] = [
  {
    value: "VPF",
    label: "Public Forum",
    topicKey: "pf_topic",
    championKey: "pf_champion",
    logoSrc: "/images/logo-public-forum-format.png",
  },
  {
    value: "VLD",
    label: "LD",
    topicKey: "ld_topic",
    championKey: "ld_champion",
    logoSrc: "/images/logo-lincoln-douglas-format.png",
  },
  {
    value: "VCX",
    label: "Policy",
    topicKey: "policy_topic",
    championKey: "policy_champion",
    logoSrc: "/images/logo-policy-format.png",
  },
  {
    value: "NDT",
    label: "College NDT",
    topicKey: "ndt_topic",
    championKey: "ndt_champion",
    logoSrc: "/images/logo-college-policy-format.png",
  },
]

/**
 * Tooltip copy describing the Debate Elo rating formula shown on the Elo
 * column header inside the leaderboard table.
 */
export const ELO_TOOLTIP = `Debate Elo rating updates a team's skill score after each round using an Elo-style formula. The change in Elo for the winner is S = K · mv · (1 - wp), where S is the points gained (the loser loses roughly S). Here K is a scaling "drift factor" based on tournament bid level, mv is the margin of victory from judge ballots, and wp is the win probability implied by the pre-round Elo difference. Upsets against higher-rated opponents and larger margins give bigger Elo gains, while expected results change Elo only slightly. Debate Elo also adds a small outround bonus: e = b/2, where b is the number of bids, awarded to each team that wins an elimination round.`

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Converts a leaderboard cell value to a number for numeric comparison.
 * Returns `-Infinity` for `null`, `undefined`, the placeholder `"--"`, or `NaN`.
 *
 * @param val - Raw cell value from a {@link LeaderboardEntry} field.
 */
export function getNumericValue(val: unknown): number {
  if (val === undefined || val === null || val === "--") return -Infinity
  const n = Number(val)
  return isNaN(n) ? -Infinity : n
}

/**
 * Converts a leaderboard cell value to a lowercase string for locale comparison.
 * Returns `""` for `null` or `undefined`.
 *
 * @param val - Raw cell value.
 */
export function getStringValue(val: unknown): string {
  if (val === undefined || val === null) return ""
  return String(val).toLowerCase()
}

/**
 * Returns `true` when `val` is defined, non-null, and not the empty-cell
 * placeholder `"--"`.
 *
 * @param val - Raw cell value.
 */
export function hasValue(val: unknown): boolean {
  return val !== undefined && val !== null && val !== "--"
}

/**
 * Returns a sorted copy of `entries` according to `sort`.
 * Empty cells (`null` / `undefined` / `"--"`) always sort to the bottom
 * regardless of sort direction so that data-less rows don't crowd the top.
 *
 * @param entries - Leaderboard rows to sort.
 * @param sort - Active sort state, or `null` to return entries unsorted.
 */
export function sortEntries(
  entries: LeaderboardEntry[],
  sort: SortState,
): LeaderboardEntry[] {
  if (!sort) return entries
  const { key, dir } = sort
  const mul = dir === "asc" ? 1 : -1

  return [...entries].sort((a, b) => {
    if (key === "state") {
      return mul * getStringValue(a.state).localeCompare(getStringValue(b.state))
    }

    if (key === "eloToBid") {
      const aValid = hasValue(a.eloRank) && hasValue(a.rank)
      const bValid = hasValue(b.eloRank) && hasValue(b.rank)
      if (!aValid && !bValid) return 0
      if (!aValid) return 1
      if (!bValid) return -1
      return mul * (
        getNumericValue(a.eloRank) / getNumericValue(a.rank) -
        getNumericValue(b.eloRank) / getNumericValue(b.rank)
      )
    }

    if (key === "eloTimesBid") {
      const aValid = hasValue(a.eloRank) && hasValue(a.rank)
      const bValid = hasValue(b.eloRank) && hasValue(b.rank)
      if (!aValid && !bValid) return 0
      if (!aValid) return 1
      if (!bValid) return -1
      return mul * (
        getNumericValue(a.eloRank) * getNumericValue(a.rank) -
        getNumericValue(b.eloRank) * getNumericValue(b.rank)
      )
    }

    if (key === "rank" || key === "eloRank") {
      const aOk = hasValue(a[key])
      const bOk = hasValue(b[key])
      if (!aOk && !bOk) return 0
      if (!aOk) return 1
      if (!bOk) return -1
      return mul * (getNumericValue(a[key]) - getNumericValue(b[key]))
    }

    return mul * (getNumericValue(a[key]) - getNumericValue(b[key]))
  })
}

// ---------------------------------------------------------------------------
// Props interface (shared by the panel and its consumers)
// ---------------------------------------------------------------------------

/** Props for the {@link LeaderboardPanel} component. */
export interface LeaderboardPanelProps {
  /** When provided, the parent controls the active division. */
  controlledDivision?: Division
  /** When provided, the parent controls the active season year. */
  controlledYear?: string
  /** Callback for division changes when the parent is controlling it. */
  onControlledDivisionChange?: (v: Division) => void
  /** Callback for year changes when the parent is controlling it. */
  onControlledYearChange?: (v: string) => void
  /**
   * Pre-loaded champion and topic history data.
   * When omitted the panel fetches it from the `/history` API endpoint.
   */
  history?: DebateHistory | null
}
