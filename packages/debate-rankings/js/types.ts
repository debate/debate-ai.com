/**
 * @fileoverview Types for the rankings produced by `src/main.py`.
 *
 * Each field mirrors one column of `output/<prefix>full_rankings.csv` and
 * `output/<prefix>field_statistics.csv`.
 * @module debate-rankings/types
 */

/** Identifier of one generated rankings dataset (the CSV filename prefix). */
export type RankingDatasetId = "hspf" | "hsld" | "hsld_sepoct" | "hscx" | "cpd";

/**
 * Aff/neg win rates, as percentages (0–100). `null` means no rounds were
 * debated on that side (the Python writes NaN, which lands as an empty cell).
 */
export interface SideWinRates {
  /** "Aff Win Rate" — share of all aff rounds won. */
  affWinRate: number | null;
  /** "Neg Win Rate" — share of all neg rounds won. */
  negWinRate: number | null;
  /** "Aff Elim Win Rate" — share of aff elimination rounds won. */
  affElimWinRate: number | null;
  /** "Neg Elim Win Rate" — share of neg elimination rounds won. */
  negElimWinRate: number | null;
}

/** One ranked competitor (a team, or a single debater in LD). */
export interface RankingEntry extends SideWinRates {
  /** "Rank" — 1-based position, ordered by adjusted rating. */
  rank: number;
  /** "School" — the entry's institution. */
  school: string;
  /** "Name" — team code (`Last & Last`) or debater name. */
  name: string;
  /** "Adjusted Rating" — `rating − 2 × deviation`; what the rank is sorted on. */
  adjustedRating: number;
  /** "Deviation" — Glicko-2 rating deviation (φ); lower means more certain. */
  deviation: number;
  /** "Matches" — number of rated matches (majors count twice). */
  matches: number;
  /** "Rating" — raw Glicko-2 rating (μ). */
  rating: number;
  /** "Hash" — stable SHA-256 id of the entry across tournaments. */
  hash: string;
}

/** Field-wide side bias across every round in a dataset. */
export type FieldStatistics = SideWinRates;

/** Static description of a dataset, available without loading its CSVs. */
export interface RankingDatasetInfo {
  id: RankingDatasetId;
  /** Human label, e.g. "HS Lincoln-Douglas". */
  label: string;
  /** Narrower scope note, e.g. "Sep–Oct topic", when the dataset is a slice. */
  scope?: string;
  /** Tournament slugs (folders under `tournaments/<format>/`) that fed the ratings. */
  tournaments: string[];
  /** Tournaments whose rounds are weighted double. */
  majors: string[];
}

/** A fully loaded dataset. */
export interface RankingDataset extends RankingDatasetInfo {
  entries: RankingEntry[];
  field: FieldStatistics | null;
}
