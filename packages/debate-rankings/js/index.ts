/// <reference path="./raw.d.ts" />
/**
 * @fileoverview Public entry point: the list of generated rankings datasets
 * and a lazy loader that reads their CSVs from `output/`.
 *
 * The CSVs are imported with Vite's `?raw` suffix through dynamic `import()`,
 * so each dataset is its own chunk and nothing is copied or regenerated —
 * re-running `src/main.py` is all it takes to refresh the site.
 * @module debate-rankings
 */

import cpdConfig from "../config/cpd-config.json";
import hscxConfig from "../config/hscx-config.json";
import hsldConfig from "../config/hsld-config.json";
import hspfConfig from "../config/hspf-config.json";
import { parseFieldStatistics, parseFullRankings } from "./parse";
import type { RankingDataset, RankingDatasetId, RankingDatasetInfo } from "./types";

export type * from "./types";
export { parseCsv, parseFieldStatistics, parseFullRankings } from "./parse";

/** Tournaments in `hsld` up to and including the Sep–Oct topic boundary. */
function sepOctTournaments(): string[] {
  const end = hsldConfig.tournaments.indexOf(hsldConfig.topic_boundaries.sepoct_end);
  return end === -1 ? hsldConfig.tournaments : hsldConfig.tournaments.slice(0, end + 1);
}

/** Every dataset `src/main.py` writes to `output/`, in display order. */
export const RANKING_DATASETS: readonly RankingDatasetInfo[] = [
  { id: "hspf", label: "HS Public Forum", tournaments: hspfConfig.tournaments, majors: hspfConfig.majors },
  { id: "hsld", label: "HS Lincoln-Douglas", tournaments: hsldConfig.tournaments, majors: hsldConfig.majors },
  {
    id: "hsld_sepoct",
    label: "HS Lincoln-Douglas",
    scope: "Sep–Oct topic",
    tournaments: sepOctTournaments(),
    majors: hsldConfig.majors,
  },
  { id: "hscx", label: "HS Policy", tournaments: hscxConfig.tournaments, majors: hscxConfig.majors },
  { id: "cpd", label: "College Policy", tournaments: cpdConfig.tournaments, majors: cpdConfig.majors },
];

type CsvPair = [Promise<{ default: string }>, Promise<{ default: string }>];

/** Literal import paths, so the bundler can see and split every CSV. */
const CSV_LOADERS: Record<RankingDatasetId, () => CsvPair> = {
  hspf: () => [
    import("../output/hspf_full_rankings.csv?raw"),
    import("../output/hspf_field_statistics.csv?raw"),
  ],
  hsld: () => [
    import("../output/hsld_full_rankings.csv?raw"),
    import("../output/hsld_field_statistics.csv?raw"),
  ],
  hsld_sepoct: () => [
    import("../output/hsld_sepoct_full_rankings.csv?raw"),
    import("../output/hsld_sepoct_field_statistics.csv?raw"),
  ],
  hscx: () => [
    import("../output/hscx_full_rankings.csv?raw"),
    import("../output/hscx_field_statistics.csv?raw"),
  ],
  cpd: () => [
    import("../output/cpd_full_rankings.csv?raw"),
    import("../output/cpd_field_statistics.csv?raw"),
  ],
};

/** Metadata for `id`, or `undefined` for an unknown id. */
export function getRankingDatasetInfo(id: string): RankingDatasetInfo | undefined {
  return RANKING_DATASETS.find((d) => d.id === id);
}

/** Loads and parses one dataset's full rankings and field statistics. */
export async function loadRankingDataset(id: RankingDatasetId): Promise<RankingDataset> {
  const info = getRankingDatasetInfo(id);
  if (!info) throw new Error(`Unknown rankings dataset: ${id}`);
  const [rankings, field] = await Promise.all(CSV_LOADERS[id]());
  return {
    ...info,
    entries: parseFullRankings(rankings.default),
    field: parseFieldStatistics(field.default),
  };
}
