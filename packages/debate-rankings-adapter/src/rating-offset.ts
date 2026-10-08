/**
 * @fileoverview Shifts the Bradley-Terry ratings `debate-rankings` computes onto
 * the scale this site shows. The upstream CSVs report ratings on the Elo scale
 * (1500 = field average); the site subtracts {@link RATING_OFFSET}, divides
 * by {@link RATING_DIVISOR}, and clamps the result to
 * [{@link RATING_MIN}, {@link RATING_MAX}]. On the current CSVs that puts the
 * top handful of teams in each event around 100 and the weakest near 0. The
 * shift and scale preserve order; the clamp only ties the few teams past
 * either end (and simulations treat a clamped team as sitting at the bound).
 * @module @debate/rankings-adapter/rating-offset
 */

import { loadRankingDataset as loadUpstreamDataset } from "./upstream";
import type { FieldStatistics, RankingDataset, RankingDatasetId, RankingEntry } from "./upstream";

/** Points subtracted from every rating before it reaches the UI. */
export const RATING_OFFSET = 1000;

/** What every offset rating is then divided by before it reaches the UI. */
export const RATING_DIVISOR = 8;

/** Lowest rating the UI shows; anything weaker is floored here. */
export const RATING_MIN = 0;

/** Highest rating the UI shows; anything stronger is capped here. */
export const RATING_MAX = 109;

/** An upstream rating on the site's scale: shifted, scaled, then clamped. */
export function toSiteRating(rating: number): number {
  return Math.min(RATING_MAX, Math.max(RATING_MIN, (rating - RATING_OFFSET) / RATING_DIVISOR));
}

/** `entry` with its rating and adjusted rating moved onto the site's scale ({@link toSiteRating}). */
export function offsetEntryRatings(entry: RankingEntry): RankingEntry {
  return {
    ...entry,
    rating: toSiteRating(entry.rating),
    adjustedRating: toSiteRating(entry.adjustedRating),
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
 * Loads a dataset like the upstream loader, with every entry's ratings moved
 * onto the site's scale ({@link toSiteRating}).
 */
export async function loadRankingDataset(id: RankingDatasetId): Promise<RankingDataset> {
  const dataset = await loadUpstreamDataset(id);
  return {
    ...dataset,
    entries: dataset.entries.map(offsetEntryRatings),
    field: dataset.field && offsetFieldStatistics(dataset.field),
  };
}
