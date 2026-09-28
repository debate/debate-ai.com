/**
 * @fileoverview Shifts the Glicko-2 ratings `debate-rankings` computes onto the
 * scale this site shows. The upstream CSVs keep Glicko-2's 1500 baseline; the
 * site subtracts {@link RATING_OFFSET} and then divides by {@link RATING_DIVISOR}.
 * Both steps preserve order (they're a shift and a positive scale), so ranks
 * are unchanged — only the displayed magnitude moves.
 * @module debate-rankings-adapter/rating-offset
 */

import { loadRankingDataset as loadUpstreamDataset } from "./upstream";
import type { RankingDataset, RankingDatasetId, RankingEntry } from "./upstream";

/** Points subtracted from every Glicko-2 rating before it reaches the UI. */
export const RATING_OFFSET = 500;

/** What every offset Glicko-2 rating is then divided by before it reaches the UI. */
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
 * Loads a dataset like the upstream loader, with every entry's ratings shifted
 * by {@link RATING_OFFSET} and scaled by {@link RATING_DIVISOR}.
 */
export async function loadRankingDataset(id: RankingDatasetId): Promise<RankingDataset> {
  const dataset = await loadUpstreamDataset(id);
  return { ...dataset, entries: dataset.entries.map(offsetEntryRatings) };
}
