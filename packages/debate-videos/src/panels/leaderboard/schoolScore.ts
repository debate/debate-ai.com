/**
 * @fileoverview The Schools table's balanced score, kept free of imports so it
 * can be unit-tested without the rankings data.
 * @module components/debate/DebateVideos/panels/schoolScore
 */

/** Share of the score that comes from the school's top three entries. */
export const TOP_THREE_WEIGHT = 0.7;

/** Scale applied to the blended score, lifting strong programs into the 70s–90s. */
export const BALANCED_SCALE = 1.1;

/** Highest balanced score shown, matching the team ratings' cap. */
export const BALANCED_MAX = 109;

/** Team count at which {@link depthScore} reaches 100. */
const FULL_DEPTH_TEAMS = 15;

/**
 * Multiplier that dilutes schools with fewer than four ranked entries (one or
 * two strong entries say little about a program): ×0.80 / 0.87 / 0.93 for
 * 1 / 2 / 3 teams, ×1 from four up.
 *
 * @param teams - Number of ranked entries.
 */
export function smallSchoolFactor(teams: number): number {
  if (teams < 1) return 0;
  if (teams >= 4) return 1;
  return 1 - (0.2 * (4 - teams)) / 3;
}

/**
 * Depth on the rating scale, 0–100: grows with the log of the team count and
 * tops out at {@link FULL_DEPTH_TEAMS} teams. 1 team ≈ 25, 5 ≈ 65, 10 ≈ 86.
 *
 * @param teams - Number of ranked entries.
 */
export function depthScore(teams: number): number {
  if (teams < 1) return 0;
  return 100 * Math.min(1, Math.log(1 + teams) / Math.log(1 + FULL_DEPTH_TEAMS));
}

/**
 * Mean of the three highest ratings in `ratings` (fewer if the school has
 * fewer entries), or 0 when there are none.
 */
export function topThreeAverage(ratings: readonly number[]): number {
  const top = [...ratings].sort((a, b) => b - a).slice(0, 3);
  return top.length === 0 ? 0 : top.reduce((sum, r) => sum + r, 0) / top.length;
}

/**
 * A school's balanced score. 70% is the average of its top three entries;
 * the other 30% splits evenly between its average entry rating and its
 * {@link depthScore}. The blend is scaled by {@link BALANCED_SCALE}, diluted
 * by {@link smallSchoolFactor} for schools under four teams, and capped at
 * {@link BALANCED_MAX}.
 *
 * @param ratings - Adjusted rating of every ranked entry from the school.
 */
export function balancedSchoolScore(ratings: readonly number[]): number {
  const teams = ratings.length;
  if (teams < 1) return 0;
  const average = ratings.reduce((sum, r) => sum + r, 0) / teams;
  const support = 0.5 * average + 0.5 * depthScore(teams);
  const blend = TOP_THREE_WEIGHT * topThreeAverage(ratings) + (1 - TOP_THREE_WEIGHT) * support;
  return Math.min(BALANCED_MAX, BALANCED_SCALE * blend * smallSchoolFactor(teams));
}
