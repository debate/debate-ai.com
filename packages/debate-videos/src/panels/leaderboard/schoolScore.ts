/**
 * @fileoverview The Schools table's balanced score, kept free of imports so it
 * can be unit-tested without the rankings data.
 * @module components/debate/DebateVideos/panels/schoolScore
 */

/**
 * A school's balanced score: 60% average entry rating plus 40% best entry
 * rating, scaled by a team-count bonus with diminishing returns. The bonus is
 * 0% for one team, ~6.7% for five, ~9.6% for ten and never reaches 15%, so a
 * strong small school can outscore a large one and size alone can't dominate.
 *
 * @param best - Best entry's adjusted rating.
 * @param average - Mean adjusted rating across the school's entries.
 * @param teams - Number of ranked entries.
 */
export function balancedSchoolScore(best: number, average: number, teams: number): number {
  if (teams < 1) return 0;
  const quality = 0.6 * average + 0.4 * best;
  const depthBonus = (0.15 * (teams - 1)) / (teams + 4);
  return quality * (1 + depthBonus);
}
