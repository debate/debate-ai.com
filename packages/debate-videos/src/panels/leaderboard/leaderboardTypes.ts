/**
 * @fileoverview Shared types and interfaces for the leaderboard panel and its sub-components.
 * @module components/debate/DebateVideos/panels/leaderboardTypes
 */

/** High-school and college debate division identifiers. */
export type Division = "VPF" | "VLD" | "VCX" | "NDT";

/** Set of valid division strings used for URL query-param validation. */
export const VALID_DIVISIONS = new Set<string>(["VPF", "VLD", "VCX", "NDT"]);

/**
 * A tab of the rankings page: one of the four divisions, or `"SCHOOLS"` —
 * a separate table that rolls every division's teams up by school.
 */
export type LeaderboardTab = Division | "SCHOOLS";

/** Set of valid tab strings used for `?format=` URL query-param validation. */
export const VALID_LEADERBOARD_TABS = new Set<string>([...VALID_DIVISIONS, "SCHOOLS"]);

import type { RankingEntry } from "debate-rankings-adapter";

/** Column keys available for sorting the rankings grid — every CSV field. */
export type SortKey = keyof RankingEntry;

/** One school in the Schools table, aggregated over its ranked entries. */
export interface SchoolRanking {
  /** Position by best rating (1-based). */
  rank: number;
  /** School name as most of its entries spell it. */
  school: string;
  /** Highest adjusted rating among the school's entries. */
  bestRating: number;
  /** Name of the entry holding {@link bestRating}. */
  bestEntry: string;
  /** Short event label of that entry ("PF", "LD", "Policy", "NDT"). */
  bestEvent: string;
  /** Mean adjusted rating over all the school's entries. */
  avgRating: number;
  /** Number of ranked entries (teams, or debaters in LD). */
  teams: number;
  /** Short labels of the events the school has entries in, in display order. */
  events: string[];
}

/** Column keys available for sorting the Schools table. */
export type SchoolSortKey = Exclude<keyof SchoolRanking, "events" | "bestEvent">;

/** Active sort state of the Schools table. */
export type SchoolSortState = { key: SchoolSortKey; dir: SortDir };

/** Sort direction for a leaderboard column. */
export type SortDir = "asc" | "desc";

/** Active sort state, or `null` when no column is sorted. */
export type SortState = { key: SortKey; dir: SortDir } | null;

import type { SeasonalTopic } from "../../lib/debate-topics";

export type { SeasonalTopic };

/** Champion and topic data for a single debate season. */
export type YearData = {
  ndt_topic?: string;
  ndt_topic_name?: string;
  ndt_champion?: string;
  policy_topic?: string;
  policy_topic_name?: string;
  policy_champion?: string;
  ld_topics?: SeasonalTopic[];
  ld_champion?: string;
  pf_topics?: SeasonalTopic[];
  pf_champion?: string;
  /** Legacy HTML strings from older debate-topics.json. */
  ld_topic?: string;
  pf_topic?: string;
};

/** Historical champion/topic data indexed by four-digit year string (e.g. `"2026"`). */
export type DebateHistory = Record<string, YearData>;

/** Props for the {@link LeaderboardPanel} component. */
export interface LeaderboardPanelProps {
  /** When provided, the parent controls the active division. */
  controlledDivision?: LeaderboardTab;
  /** When provided, the parent controls the active season year. */
  controlledYear?: string;
  /** Callback for division changes when the parent is controlling it. */
  onControlledDivisionChange?: (v: LeaderboardTab) => void;
  /** Callback for year changes when the parent is controlling it. */
  onControlledYearChange?: (v: string) => void;
  /**
   * Pre-loaded champion and topic history data.
   * When omitted the panel fetches it from the `/history` API endpoint.
   */
  history?: DebateHistory | null;
}
