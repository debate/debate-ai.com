/**
 * @fileoverview Shared types and interfaces for the leaderboard panel and its sub-components.
 * @module components/debate/DebateVideos/panels/leaderboardTypes
 */

/** High-school and college debate division identifiers. */
export type Division = "VPF" | "VLD" | "VCX" | "NDT";

/** Set of valid division strings used for URL query-param validation. */
export const VALID_DIVISIONS = new Set<string>(["VPF", "VLD", "VCX", "NDT"]);

/** Column keys available for sorting the leaderboard grid. */
export type SortKey =
  | "rank"
  | "state"
  | "bids"
  | "tocScore"
  | "debateElo"
  | "eloRank"
  | "eloToBid"
  | "eloTimesBid";

/** Sort direction for a leaderboard column. */
export type SortDir = "asc" | "desc";

/** Active sort state, or `null` when no column is sorted. */
export type SortState = { key: SortKey; dir: SortDir } | null;

/** Champion and topic data for a single debate season. */
export type YearData = {
  ndt_topic?: string;
  ndt_champion?: string;
  policy_topic?: string;
  policy_champion?: string;
  ld_topic?: string;
  ld_champion?: string;
  pf_topic?: string;
  pf_champion?: string;
};

/** Historical champion/topic data indexed by four-digit year string (e.g. `"2026"`). */
export type DebateHistory = Record<string, YearData>;

/** Props for the {@link LeaderboardPanel} component. */
export interface LeaderboardPanelProps {
  /** When provided, the parent controls the active division. */
  controlledDivision?: Division;
  /** When provided, the parent controls the active season year. */
  controlledYear?: string;
  /** Callback for division changes when the parent is controlling it. */
  onControlledDivisionChange?: (v: Division) => void;
  /** Callback for year changes when the parent is controlling it. */
  onControlledYearChange?: (v: string) => void;
  /**
   * Pre-loaded champion and topic history data.
   * When omitted the panel fetches it from the `/history` API endpoint.
   */
  history?: DebateHistory | null;
}
