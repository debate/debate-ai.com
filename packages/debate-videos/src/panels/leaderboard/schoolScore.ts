/**
 * @fileoverview The Schools table's balanced score, kept free of imports so it
 * can be unit-tested without the rankings data.
 * @module components/debate/DebateVideos/panels/schoolScore
 */

/**
 * Team-count multiplier for the balanced score. Schools under four teams are
 * diluted (one or two strong entries say little about a program), schools
 * with 5–20 teams get the full depth bonus, and very large schools taper back
 * toward a smaller bonus so size alone can't dominate.
 *
 * | Teams | Factor |
 * | --- | --- |
 * | 1 / 2 / 3 | 0.80 / 0.87 / 0.93 |
 * | 4 | 1.00 |
 * | 5–20 | 1.10 |
 * | 21–40 | tapers 1.10 → 1.05 |
 * | 40+ | 1.05 |
 *
 * @param teams - Number of ranked entries.
 */
export function teamCountFactor(teams: number): number {
  if (teams < 1) return 0;
  if (teams < 4) return 1 - (0.2 * (4 - teams)) / 3;
  if (teams < 5) return 1 + 0.1 * (teams - 4);
  if (teams <= 20) return 1.1;
  return Math.max(1.05, 1.1 - 0.0025 * (teams - 20));
}

/**
 * A school's balanced score: 70% average entry rating plus 30% best entry
 * rating, times {@link teamCountFactor}. Average quality counts most, small
 * schools (under four teams) are diluted so one standout pair can't top the
 * table, and schools with 5–20 teams that do well on average are preferred.
 *
 * @param best - Best entry's adjusted rating.
 * @param average - Mean adjusted rating across the school's entries.
 * @param teams - Number of ranked entries.
 */
export function balancedSchoolScore(best: number, average: number, teams: number): number {
  if (teams < 1) return 0;
  const quality = 0.7 * average + 0.3 * best;
  return quality * teamCountFactor(teams);
}
