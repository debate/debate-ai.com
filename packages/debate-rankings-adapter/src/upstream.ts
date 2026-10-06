/**
 * @fileoverview The one place this package reaches into the submodule.
 *
 * `packages/debate-rankings` is a git submodule of upstream
 * (github.com/debate/debate-rankings). Its Python pipeline and generated CSVs
 * have their own toolchain, so it stays out of the bun workspace and only its
 * data — `config/*.json` and `output/*.csv` — is read here, by path: a bare
 * `workspace:*` dependency would make `bun install` fail outright whenever the
 * submodule has not been checked out. Upstream ships no TypeScript, so the
 * dataset list and the lazy CSV loader live here; an upstream reorganization
 * is a one-file fix.
 *
 * The CSVs are imported with Vite's `?raw` suffix through dynamic `import()`,
 * so each dataset is its own chunk and nothing is copied or regenerated —
 * bumping the submodule is all it takes to refresh the site.
 * @module @debate/rankings-adapter/upstream
 */

/// <reference path="./raw.d.ts" />
import cpdConfig from "../../debate-rankings/config/cpd-config.json";
import hscxConfig from "../../debate-rankings/config/hscx-config.json";
import hsldConfig from "../../debate-rankings/config/hsld-config.json";
import hspfConfig from "../../debate-rankings/config/hspf-config.json";
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
    import("../../debate-rankings/output/hspf_full_rankings.csv?raw"),
    import("../../debate-rankings/output/hspf_field_statistics.csv?raw"),
  ],
  hsld: () => [
    import("../../debate-rankings/output/hsld_full_rankings.csv?raw"),
    import("../../debate-rankings/output/hsld_field_statistics.csv?raw"),
  ],
  hsld_sepoct: () => [
    import("../../debate-rankings/output/hsld_sepoct_full_rankings.csv?raw"),
    import("../../debate-rankings/output/hsld_sepoct_field_statistics.csv?raw"),
  ],
  hscx: () => [
    import("../../debate-rankings/output/hscx_full_rankings.csv?raw"),
    import("../../debate-rankings/output/hscx_field_statistics.csv?raw"),
  ],
  cpd: () => [
    import("../../debate-rankings/output/cpd_full_rankings.csv?raw"),
    import("../../debate-rankings/output/cpd_field_statistics.csv?raw"),
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
