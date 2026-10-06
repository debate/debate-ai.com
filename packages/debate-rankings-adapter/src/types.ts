/**
 * @fileoverview Types for the rankings produced by `debate-rankings`'
 * `src/main.py`.
 *
 * Each field mirrors one column of `output/<prefix>full_rankings.csv` and
 * `output/<prefix>field_statistics.csv`. Ratings come from a ballot-level
 * Bradley-Terry model, reported on the Elo scale (1500 = field average,
 * 400 points = 10:1 odds).
 * @module @debate/rankings-adapter/types
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
  /** "Deviation" — standard error of the Bradley-Terry skill, in rating points; lower means more certain. */
  deviation: number;
  /** "Matches" — rounds with a decision (aff + neg rounds). */
  matches: number;
  /** "Rating" — Bradley-Terry skill on the Elo scale: `1500 + 400 / ln 10 × ability`. */
  rating: number;
  /** "Hash" — stable SHA-256 id of the entry across tournaments. */
  hash: string;
}

/** Field-wide side bias across every round in a dataset. */
export interface FieldStatistics extends SideWinRates {
  /**
   * "Aff Rating Advantage" — rating points the aff side is worth, from the
   * model's side term. `null` in CSVs written before the column existed.
   */
  affRatingAdvantage: number | null;
  /**
   * Ballot weights the model gave each side so that aff and neg carry equal
   * weight, separately in prelims and elims — the favored side's ballots
   * weigh less than 1, the other side's more. `null` in CSVs written before
   * the columns existed.
   */
  sideWeights: SideWeights | null;
}

/** "Aff/Neg (Elim) Side Weight" — per-ballot weights from the side-balanced fit. */
export interface SideWeights {
  /** "Aff Side Weight" — weight of an aff ballot in a prelim. */
  aff: number;
  /** "Neg Side Weight" — weight of a neg ballot in a prelim. */
  neg: number;
  /** "Aff Elim Side Weight" — weight of an aff ballot in an elim. */
  affElim: number;
  /** "Neg Elim Side Weight" — weight of a neg ballot in an elim. */
  negElim: number;
}

/** Static description of a dataset, available without loading its CSVs. */
export interface RankingDatasetInfo {
  id: RankingDatasetId;
  /** Human label, e.g. "HS Lincoln-Douglas". */
  label: string;
  /** Narrower scope note, e.g. "Sep–Oct topic", when the dataset is a slice. */
  scope?: string;
  /** Tournament slugs (folders under `tournaments/<format>/`) that fed the ratings. */
  tournaments: string[];
  /** Tournaments whose ballots are weighted double. */
  majors: string[];
}

/** A fully loaded dataset. */
export interface RankingDataset extends RankingDatasetInfo {
  entries: RankingEntry[];
  field: FieldStatistics | null;
}
