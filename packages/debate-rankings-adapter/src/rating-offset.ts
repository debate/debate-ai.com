/**
 * @fileoverview Shifts the Glicko-2 ratings `debate-rankings` computes onto the
 * scale this site shows. The upstream CSVs keep Glicko-2's 1500 baseline; the
 * site displays every rating 500 points lower. Only the display scale moves:
 * ranks, deviations and orderings are unchanged.
 * @module debate-rankings-adapter/rating-offset
 */

import { loadRankingDataset as loadUpstreamDataset } from "./upstream";
import type { RankingDataset, RankingDatasetId, RankingEntry } from "./upstream";

/** Points subtracted from every Glicko-2 rating before it reaches the UI. */
export const RATING_OFFSET = 500;

/** `entry` with {@link RATING_OFFSET} subtracted from its rating and adjusted rating. */
export function offsetEntryRatings(entry: RankingEntry): RankingEntry {
  return {
    ...entry,
    rating: entry.rating - RATING_OFFSET,
    adjustedRating: entry.adjustedRating - RATING_OFFSET,
  };
}

/**
 * Loads a dataset like the upstream loader, with every entry's ratings shifted
 * by {@link RATING_OFFSET}.
 */
export async function loadRankingDataset(id: RankingDatasetId): Promise<RankingDataset> {
  const dataset = await loadUpstreamDataset(id);
  return { ...dataset, entries: dataset.entries.map(offsetEntryRatings) };
}
