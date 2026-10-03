/**
 * @fileoverview Reads a team's current Glicko rating for a rating market, from
 * the `debate-rankings` CSVs bundled with this build.
 *
 * The rankings only change when a deploy ships refreshed CSVs, so a loaded
 * dataset is kept for the life of the isolate.
 *
 * @module lib/predictions/ratings
 */

import { getRankingDatasetInfo, loadRankingDataset, type RankingDataset, type RankingDatasetId } from "@debate/rankings-adapter";
import type { PresetTeam } from "@debate/predictions";

const datasets = new Map<string, Promise<RankingDataset>>();

function dataset(id: RankingDatasetId): Promise<RankingDataset> {
  let loading = datasets.get(id);
  if (!loading) {
    loading = loadRankingDataset(id);
    // A failed load is not cached, so the next read tries again.
    loading.catch(() => datasets.delete(id));
    datasets.set(id, loading);
  }
  return loading;
}

/** A rankings entry as a rating market records it. */
export interface RatedTeam {
  dataset: string;
  datasetLabel: string;
  hash: string;
  name: string;
  school: string;
  /** The site-scale rating (see `debate-rankings-adapter`'s rating offset). */
  rating: number;
}

/** The entry with `hash` in `datasetId`, or `null` for an unknown dataset or a team no longer ranked. */
export async function findRatedTeam(datasetId: string, hash: string): Promise<RatedTeam | null> {
  const info = getRankingDatasetInfo(datasetId);
  if (!info) return null;
  const loaded = await dataset(info.id);
  const entry = loaded.entries.find((candidate) => candidate.hash.toLowerCase() === hash.toLowerCase());
  if (!entry) return null;
  return {
    dataset: info.id,
    datasetLabel: info.scope ? `${info.label} (${info.scope})` : info.label,
    hash: entry.hash.toLowerCase(),
    name: entry.name,
    school: entry.school,
    rating: entry.rating,
  };
}

/** The current rating for a rating market's resolver; `null` when the team has left the rankings. */
export async function currentRating(datasetId: string, hash: string): Promise<number | null> {
  return (await findRatedTeam(datasetId, hash))?.rating ?? null;
}

/** Every team in a dataset, as the preset markets need them; empty for an unknown dataset. */
export async function rankedTeams(datasetId: string): Promise<PresetTeam[]> {
  const info = getRankingDatasetInfo(datasetId);
  if (!info) return [];
  const loaded = await dataset(info.id);
  return loaded.entries.map((entry) => ({
    hash: entry.hash.toLowerCase(),
    name: entry.name,
    school: entry.school,
    rating: entry.rating,
    rank: entry.rank,
  }));
}
