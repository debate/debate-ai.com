/**
 * @fileoverview Shifts the Bradley-Terry ratings `debate-rankings` computes onto
 * the scale this site shows. The upstream CSVs report ratings on the Elo scale
 * (1500 = field average); the site subtracts {@link RATING_OFFSET} and then
 * divides by {@link RATING_DIVISOR}. Both steps preserve order (they're a
 * shift and a positive scale), so ranks are unchanged — only the displayed
 * magnitude moves.
 * @module @debate/rankings-adapter/rating-offset
 */

import { loadRankingDataset as loadUpstreamDataset } from "./upstream";
import type { FieldStatistics, RankingDataset, RankingDatasetId, RankingEntry } from "./upstream";

/** Points subtracted from every rating before it reaches the UI. */
export const RATING_OFFSET = 500;

/** What every offset rating is then divided by before it reaches the UI. */
export const RATING_DIVISOR = 15;

/** `entry` with its rating and adjusted rating shifted by {@link RATING_OFFSET} and scaled by {@link RATING_DIVISOR}. */
export function offsetEntryRatings(entry: RankingEntry): RankingEntry {
  return {
    ...entry,
    rating: (entry.rating - RATING_OFFSET) / RATING_DIVISOR,
    adjustedRating: (entry.adjustedRating - RATING_OFFSET) / RATING_DIVISOR,
  };
}

/**
 * `field` with its aff rating advantage scaled by {@link RATING_DIVISOR}. It is
 * a difference between two ratings, so the offset cancels out.
 */
export function offsetFieldStatistics(field: FieldStatistics): FieldStatistics {
  return {
    ...field,
    affRatingAdvantage:
      field.affRatingAdvantage === null ? null : field.affRatingAdvantage / RATING_DIVISOR,
  };
}

/**
 * Loads a dataset like the upstream loader, with every entry's ratings shifted
 * by {@link RATING_OFFSET} and scaled by {@link RATING_DIVISOR}.
 */
export async function loadRankingDataset(id: RankingDatasetId): Promise<RankingDataset> {
  const dataset = await loadUpstreamDataset(id);
  return {
    ...dataset,
    entries: dataset.entries.map(offsetEntryRatings),
    field: dataset.field && offsetFieldStatistics(dataset.field),
  };
}
