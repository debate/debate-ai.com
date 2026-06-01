/**
 * @fileoverview Utility functions and display constants for the leaderboard panel.
 * Types live in {@link leaderboardTypes}; this module re-exports them so existing
 * importers continue to work without changes.
 * @module components/debate/DebateVideos/panels/leaderboardUtils
 */

import type { LeaderboardEntry } from "@/packages/debate-data-sync/rankings/sync-rankings-debatedrills";
import type { Division, SortState, YearData } from "./leaderboardTypes";

// Re-export all types and the VALID_DIVISIONS set for backward compatibility.
export type {
  Division,
  SortKey,
  SortDir,
  SortState,
  YearData,
  DebateHistory,
  LeaderboardPanelProps,
} from "./leaderboardTypes";
export { VALID_DIVISIONS } from "./leaderboardTypes";

// ---------------------------------------------------------------------------
// Division config
// ---------------------------------------------------------------------------

/**
 * Per-division display metadata: label text, data field keys for the champion
 * banner, and the logo image path.
 */
export const DIVISION_CONFIG: {
  value: Division;
  label: string;
  topicKey: keyof YearData;
  championKey: keyof YearData;
  logoSrc: string;
}[] = [
  {
    value: "VPF",
    label: "Public Forum",
    topicKey: "pf_topic",
    championKey: "pf_champion",
    logoSrc: "https://i.imgur.com/92V0FBF.png",
  },
  {
    value: "VLD",
    label: "LD",
    topicKey: "ld_topic",
    championKey: "ld_champion",
    logoSrc: "https://i.imgur.com/3xFjCvO.png",
  },
  {
    value: "VCX",
    label: "Policy",
    topicKey: "policy_topic",
    championKey: "policy_champion",
    logoSrc: "https://i.imgur.com/CMuiSKj.png",
  },
  {
    value: "NDT",
    label: "College NDT",
    topicKey: "ndt_topic",
    championKey: "ndt_champion",
    logoSrc: "https://i.imgur.com/cFmTAdJ.png",
  },
];

/**
 * Tooltip copy describing the Debate Elo rating formula shown on the Elo
 * column header inside the leaderboard table.
 */
export const ELO_TOOLTIP = `Debate Elo rating updates a team's skill score after each round using an Elo-style formula. The change in Elo for the winner is S = K · mv · (1 - wp), where S is the points gained (the loser loses roughly S). Here K is a scaling "drift factor" based on tournament bid level, mv is the margin of victory from judge ballots, and wp is the win probability implied by the pre-round Elo difference. Upsets against higher-rated opponents and larger margins give bigger Elo gains, while expected results change Elo only slightly. Debate Elo also adds a small outround bonus: e = b/2, where b is the number of bids, awarded to each team that wins an elimination round.`;

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
  if (val === undefined || val === null || val === "--") return -Infinity;
  const n = Number(val);
  return isNaN(n) ? -Infinity : n;
}

/**
 * Converts a leaderboard cell value to a lowercase string for locale comparison.
 * Returns `""` for `null` or `undefined`.
 *
 * @param val - Raw cell value.
 */
export function getStringValue(val: unknown): string {
  if (val === undefined || val === null) return "";
  return String(val).toLowerCase();
}

/**
 * Returns `true` when `val` is defined, non-null, and not the empty-cell
 * placeholder `"--"`.
 *
 * @param val - Raw cell value.
 */
export function hasValue(val: unknown): boolean {
  return val !== undefined && val !== null && val !== "--";
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
  if (!sort) return entries;
  const { key, dir } = sort;
  const mul = dir === "asc" ? 1 : -1;

  return [...entries].sort((a, b) => {
    if (key === "state") {
      return (
        mul * getStringValue(a.state).localeCompare(getStringValue(b.state))
      );
    }

    if (key === "eloToBid") {
      const aValid = hasValue(a.eloRank) && hasValue(a.rank);
      const bValid = hasValue(b.eloRank) && hasValue(b.rank);
      if (!aValid && !bValid) return 0;
      if (!aValid) return 1;
      if (!bValid) return -1;
      return (
        mul *
        (getNumericValue(a.eloRank) / getNumericValue(a.rank) -
          getNumericValue(b.eloRank) / getNumericValue(b.rank))
      );
    }

    if (key === "eloTimesBid") {
      const aValid = hasValue(a.eloRank) && hasValue(a.rank);
      const bValid = hasValue(b.eloRank) && hasValue(b.rank);
      if (!aValid && !bValid) return 0;
      if (!aValid) return 1;
      if (!bValid) return -1;
      return (
        mul *
        (getNumericValue(a.eloRank) * getNumericValue(a.rank) -
          getNumericValue(b.eloRank) * getNumericValue(b.rank))
      );
    }

    if (key === "rank" || key === "eloRank") {
      const aOk = hasValue(a[key]);
      const bOk = hasValue(b[key]);
      if (!aOk && !bOk) return 0;
      if (!aOk) return 1;
      if (!bOk) return -1;
      return mul * (getNumericValue(a[key]) - getNumericValue(b[key]));
    }

    return mul * (getNumericValue(a[key]) - getNumericValue(b[key]));
  });
}
