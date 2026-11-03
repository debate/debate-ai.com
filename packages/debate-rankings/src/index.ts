/**
 * @fileoverview Web UI entry point for the rankings.
 *
 * `packages/debate-rankings-sync-data` is a git submodule of upstream
 * github.com/debate/debate-rankings, kept byte-for-byte as upstream ships it so
 * `git submodule update --remote` is all a refresh takes. Upstream ships only
 * the Python pipeline and its CSVs, so the typed dataset list and CSV loader
 * live here (see `upstream.ts`), as does what only this site needs — matching
 * a round video's team label to a rankings row. The web UI imports from this
 * package rather than the submodule directly. Ratings are also shifted here
 * (see `rating-offset.ts`).
 * @module debate-rankings
 */

export * from "./upstream";
// The site shows ratings shifted and scaled from upstream's (see rating-offset.ts).
// `loadCsvRankingDataset` is the bundled-CSV loader; the official
// `loadRankingDataset` below (from extinction.ts) takes precedence over the
// star re-export's.
export {
  RATING_DIVISOR,
  RATING_MAX,
  RATING_MIN,
  RATING_OFFSET,
  loadCsvRankingDataset,
  offsetEntryRatings,
  offsetFieldStatistics,
  toSiteRating,
  formatSiteRating,
  RATING_DISPLAY_DIVISOR,
} from "./rating-offset";
// The official rankings: Extinction.GG Elo + TOC bids, 2015-16 to now, with the
// CSVs' aff/neg win rates merged into the current season (see extinction.ts).
export {
  EXTINCTION_ATTRIBUTION_URL,
  EXTINCTION_BASE_URL,
  EXTINCTION_DATASET_FORMAT,
  EXTINCTION_ELO_SHIFT,
  EXTINCTION_FIRST_SEASON_YEAR,
  EXTINCTION_FORMAT_PREFIX,
  EXTINCTION_PROXY_PATH,
  clearExtinctionCache,
  currentRankingSeasonYear,
  extinctionEntries,
  extinctionFileName,
  extinctionFileUrl,
  extinctionSeasonCode,
  getDebateData,
  getDebateDataCached,
  hasExtinctionSeason,
  loadRankingDataset,
  mergeSideWinRates,
  parseSchoolTeamCode,
  type BidTournament,
  type BidsResponse,
  type CombinedDebateData,
  type CombinedTeam,
  type DebateFormat,
  type ExtinctionFileKind,
  type PendingTournament,
  type RatingTeam,
  type RatingsResponse,
  type SchoolTeamCodeParts,
} from "./extinction";
export {
  COLLEGE_HISTORY_FIRST_YEAR,
  COLLEGE_HISTORY_LAST_YEAR,
  COLLEGE_HISTORY_SOURCE_URL,
  COLLEGE_PERFORMANCE_SIGMA,
  COLLEGE_SEASON_DETAILS,
  collegeHistorySourceUrl,
  collegeSchoolKey,
  collegeSeasonYearOf,
  cleanCollegeTeamLabel,
  collegeSeasonDetails,
  collegeWinProbability,
  findCollegeHistoryTeam,
  hasCollegeHistory,
  loadCollegeHistory,
  parseCollegeHistory,
  type CollegeHistoryEntry,
  type CollegeSeasonDetails,
  type CollegeSeasonStats,
} from "./college-history";
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
export { teamDisplayParts, type TeamDisplayInput, type TeamDisplayParts } from "./team-display";
export {
  debaterLastNames,
  debaterNameKey,
  matchTournamentEntry,
  rankingDatasetsForEvent,
  type TournamentEntryQuery,
  type TournamentEventFormat,
} from "./tournament-lookup";
