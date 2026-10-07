/**
 * @fileoverview Web UI entry point for the rankings.
 *
 * `packages/debate-rankings` is a git submodule of upstream
 * github.com/debate/debate-rankings, kept byte-for-byte as upstream ships it so
 * `git submodule update --remote` is all a refresh takes. Upstream ships only
 * the Python pipeline and its CSVs, so the typed dataset list and CSV loader
 * live here (see `upstream.ts`), as does what only this site needs — matching
 * a round video's team label to a rankings row. The web UI imports from this
 * package rather than the submodule directly. Ratings are also shifted here
 * (see `rating-offset.ts`).
 * @module debate-rankings-adapter
 */

export * from "./upstream";
// Takes precedence over the star re-export's loader: the site shows ratings
// shifted and scaled from upstream's (see rating-offset.ts).
export {
  RATING_DIVISOR,
  RATING_OFFSET,
  loadRankingDataset,
  offsetEntryRatings,
  offsetFieldStatistics,
} from "./rating-offset";
export {
  entryInitials,
  findTeamRanking,
  normalizeSchool,
  parseTeamLabel,
  schoolMatchScore,
  schoolSearchNames,
  teamSearchNames,
  type TeamLabel,
} from "./team-lookup";
export {
  GLICKO2_SCALE,
  majorityProbability,
  simulateMatchup,
  simulateRounds,
  upstreamRating,
  winProbability,
  type MatchupSimulation,
  type SimulatedRounds,
  type SimulationEntry,
} from "./match-simulation";
export {
  blendedRating,
  debaterKeys,
  fieldAffLogit,
  individualRating,
  modelMatchup,
  recommendSide,
  recommendWeights,
  schoolRating,
  teamSideTilt,
  type DebateSide,
  type MatchupModelResult,
  type MatchupWeights,
  type ModelDataset,
  type RatingBreakdown,
  type RoundStage,
  type SideOutcome,
} from "./matchup-model";
