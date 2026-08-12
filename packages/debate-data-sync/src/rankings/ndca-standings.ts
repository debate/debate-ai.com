/**
 * NDCA-style qualification points and standings.
 *
 * Turns a season's worth of individual tournament results into cumulative,
 * ranked team standings — the computation layer behind a future NDCA-style
 * standings dashboard. This does not encode the *actual* NDCA point table
 * (which varies by circuit/season and isn't public data this repo has); the
 * exported `DEFAULT_QUALIFICATION_POINTS_TABLE` is an illustrative default
 * only. Callers who need accurate qualification points should supply their
 * own `QualificationPointsTable`.
 */

/** Furthest elimination round reached at a single tournament. */
export type OutroundFinish =
  | "champion"
  | "finalist"
  | "semifinalist"
  | "quarterfinalist"
  | "octofinalist"
  | "doubleOctofinalist"
  | "tripleOctofinalist"
  | "prelims";

/** Best-to-worst ordering of every outround finish, for comparison. */
const FINISH_RANK: Record<OutroundFinish, number> = {
  champion: 8,
  finalist: 7,
  semifinalist: 6,
  quarterfinalist: 5,
  octofinalist: 4,
  doubleOctofinalist: 3,
  tripleOctofinalist: 2,
  prelims: 1,
};

/** A single team's result at a single tournament. */
export interface TournamentResult {
  teamId: string;
  tournamentName: string;
  date: string;
  division: string;
  /** Tournament competitiveness tier (0 = no-bid, higher = more prestigious). */
  bidLevel: number;
  finish: OutroundFinish;
  prelimWins: number;
  prelimLosses: number;
}

/** Configurable point weights used to score a `TournamentResult`. */
export interface QualificationPointsTable {
  outroundPoints: Record<OutroundFinish, number>;
  pointsPerPrelimWin: number;
  /** Fractional bonus applied per `bidLevel`, e.g. 0.1 = +10% per level. */
  bidLevelBonusRate: number;
}

/**
 * Illustrative default point table modeled loosely on public bid-tournament
 * point structures. Not an authoritative NDCA table — override with a
 * circuit-specific table for real qualification decisions.
 */
export const DEFAULT_QUALIFICATION_POINTS_TABLE: QualificationPointsTable = {
  outroundPoints: {
    champion: 30,
    finalist: 25,
    semifinalist: 20,
    quarterfinalist: 16,
    octofinalist: 12,
    doubleOctofinalist: 8,
    tripleOctofinalist: 4,
    prelims: 0,
  },
  pointsPerPrelimWin: 1,
  bidLevelBonusRate: 0.1,
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Returns the best-to-worst rank of a finish (higher = further in outrounds). */
export function getFinishRank(finish: OutroundFinish): number {
  return FINISH_RANK[finish];
}

/** Compares two finishes: positive if `a` is further than `b`, negative if not, 0 if tied. */
export function compareFinishes(a: OutroundFinish, b: OutroundFinish): number {
  return getFinishRank(a) - getFinishRank(b);
}

/**
 * Scores a single tournament result: base points for the outround reached,
 * plus per-prelim-win points, scaled up by the tournament's bid level.
 */
export function computeTournamentPoints(
  result: Pick<TournamentResult, "finish" | "prelimWins" | "bidLevel">,
  table: QualificationPointsTable = DEFAULT_QUALIFICATION_POINTS_TABLE,
): number {
  const basePoints = table.outroundPoints[result.finish] ?? 0;
  const prelimPoints = Math.max(0, result.prelimWins) * table.pointsPerPrelimWin;
  const bidMultiplier = 1 + Math.max(0, result.bidLevel) * table.bidLevelBonusRate;
  return round2((basePoints + prelimPoints) * bidMultiplier);
}

export interface ScoredTournamentResult extends TournamentResult {
  points: number;
}

export interface TeamStanding {
  teamId: string;
  totalPoints: number;
  tournamentsAttended: number;
  tournamentsCounted: number;
  record: { wins: number; losses: number };
  bestFinish: OutroundFinish;
  results: ScoredTournamentResult[];
}

export interface BuildStandingsOptions {
  /** Only the best N tournaments (by points) count toward `totalPoints`. Omit to count all. */
  countBestN?: number;
  pointsTable?: QualificationPointsTable;
}

/**
 * Aggregates one team's tournament results into a cumulative standing:
 * total qualification points (from its best N tournaments, if capped),
 * overall prelim record across every tournament attended, and best finish.
 */
export function buildTeamStanding(
  teamId: string,
  results: TournamentResult[],
  options: BuildStandingsOptions = {},
): TeamStanding {
  const table = options.pointsTable ?? DEFAULT_QUALIFICATION_POINTS_TABLE;
  const scored: ScoredTournamentResult[] = results.map((result) => ({
    ...result,
    points: computeTournamentPoints(result, table),
  }));

  const sortedByPoints = [...scored].sort((a, b) => b.points - a.points);
  const countedResults =
    options.countBestN != null
      ? sortedByPoints.slice(0, Math.max(0, options.countBestN))
      : sortedByPoints;

  const totalPoints = round2(
    countedResults.reduce((sum, result) => sum + result.points, 0),
  );

  const record = results.reduce(
    (acc, result) => ({
      wins: acc.wins + Math.max(0, result.prelimWins),
      losses: acc.losses + Math.max(0, result.prelimLosses),
    }),
    { wins: 0, losses: 0 },
  );

  const bestFinish = results.reduce<OutroundFinish>(
    (best, result) =>
      getFinishRank(result.finish) > getFinishRank(best) ? result.finish : best,
    "prelims",
  );

  return {
    teamId,
    totalPoints,
    tournamentsAttended: results.length,
    tournamentsCounted: countedResults.length,
    record,
    bestFinish,
    results: scored,
  };
}

/** Builds a `TeamStanding` for every team keyed in `resultsByTeam`. */
export function buildStandings(
  resultsByTeam: Record<string, TournamentResult[]>,
  options: BuildStandingsOptions = {},
): TeamStanding[] {
  return Object.entries(resultsByTeam).map(([teamId, results]) =>
    buildTeamStanding(teamId, results, options),
  );
}

export interface RankedTeamStanding extends TeamStanding {
  rank: number;
}

/**
 * Ranks standings by total points (descending), tie-broken by team id for a
 * stable, deterministic order. Ties share no rank number ("dense" ranking is
 * not applied) — each row gets the next sequential rank.
 */
export function rankStandings(standings: TeamStanding[]): RankedTeamStanding[] {
  const sorted = [...standings].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return a.teamId.localeCompare(b.teamId);
  });
  return sorted.map((standing, index) => ({ ...standing, rank: index + 1 }));
}

export interface QualificationOptions {
  minPoints?: number;
  maxQualifiers?: number;
}

/** Filters ranked standings down to teams that meet a points threshold and/or field cap. */
export function getQualifiedTeams(
  standings: RankedTeamStanding[],
  options: QualificationOptions = {},
): RankedTeamStanding[] {
  let qualified = standings;
  if (options.minPoints != null) {
    const minPoints = options.minPoints;
    qualified = qualified.filter((standing) => standing.totalPoints >= minPoints);
  }
  if (options.maxQualifiers != null) {
    qualified = qualified.slice(0, Math.max(0, options.maxQualifiers));
  }
  return qualified;
}
