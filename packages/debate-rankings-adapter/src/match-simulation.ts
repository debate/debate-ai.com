/**
 * @fileoverview Head-to-head simulation between two ranked entries — a port of
 * upstream's `src/simulate_round.py`, which asks skelo's `Glicko2Model` for
 * the win probability of one rating tuple against another.
 *
 * The rankings the site shows are shifted and scaled (see `rating-offset.ts`),
 * so every function here undoes that first: Glicko-2's expected score only
 * means anything on its own 1500-baseline scale.
 * @module @debate/rankings-adapter/match-simulation
 */

import { RATING_DIVISOR, RATING_OFFSET } from "./rating-offset";
import type { RankingEntry } from "./upstream";

/** Glicko-2's conversion factor between the Glicko and Glicko-2 scales (400 / ln 10). */
export const GLICKO2_SCALE = 173.7178;

/** The fields of a ranking row a simulation needs. */
export type SimulationEntry = Pick<RankingEntry, "rating" | "deviation">;

/** Raw Glicko-2 rating (1500 baseline) behind a rating the site shows. */
export function upstreamRating(displayRating: number): number {
  return displayRating * RATING_DIVISOR + RATING_OFFSET;
}

/** Glicko-2's `g(φ)`: how much an opponent's uncertainty flattens the expected score. */
function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

/**
 * Probability that `a` beats `b` in a single round, from their site-scale
 * ratings and deviations.
 *
 * Same formula as skelo's `Glicko2Model.compute_prob`: Glicko-2's expected
 * score `E = 1 / (1 + exp(−g(φ_b) · (μ_a − μ_b)))`. As in `simulate_round.py`,
 * `b`'s chance is `1 − E`, so the two always sum to one.
 */
export function winProbability(a: SimulationEntry, b: SimulationEntry): number {
  const muA = (upstreamRating(a.rating) - 1500) / GLICKO2_SCALE;
  const muB = (upstreamRating(b.rating) - 1500) / GLICKO2_SCALE;
  const phiB = b.deviation / GLICKO2_SCALE;
  return 1 / (1 + Math.exp(-g(phiB) * (muA - muB)));
}

/**
 * Probability of winning a majority of `panel` independent ballots (or rounds)
 * when each is won with probability `p` — e.g. a 3-judge elim panel, or a
 * best-of-5 series. `panel` is rounded up to the next odd number.
 */
export function majorityProbability(p: number, panel: number): number {
  const n = Math.max(1, Math.floor(panel)) | 1;
  const need = (n + 1) / 2;
  let total = 0;
  let choose = 1; // C(n, k), built up incrementally
  for (let k = 0; k <= n; k++) {
    if (k > 0) choose = (choose * (n - k + 1)) / k;
    if (k >= need) total += choose * p ** k * (1 - p) ** (n - k);
  }
  return total;
}

/** Outcome of {@link simulateRounds}. */
export interface SimulatedRounds {
  rounds: number;
  /** Rounds won by `a`. */
  aWins: number;
  /** Rounds won by `b`. */
  bWins: number;
}

/**
 * Plays `rounds` rounds at a fixed per-round win probability, so a user can
 * see the variance a percentage hides. `random` is injectable for tests.
 */
export function simulateRounds(
  pA: number,
  rounds: number,
  random: () => number = Math.random,
): SimulatedRounds {
  const n = Math.max(0, Math.floor(rounds));
  let aWins = 0;
  for (let i = 0; i < n; i++) if (random() < pA) aWins++;
  return { rounds: n, aWins, bWins: n - aWins };
}

/** Everything the matchup simulator shows for one pairing. */
export interface MatchupSimulation {
  /** Single-round win probability for `a` (and `1 − aWin` for `b`). */
  aWin: number;
  bWin: number;
  /** `a`'s chance of taking a 3-judge elimination panel. */
  aPanel3: number;
  /** `a`'s chance of taking a 5-judge panel (late elims). */
  aPanel5: number;
  /** Raw Glicko-2 rating minus the opponent's, on upstream's scale. */
  ratingGap: number;
}

/** Computes every number in {@link MatchupSimulation} for `a` vs. `b`. */
export function simulateMatchup(a: SimulationEntry, b: SimulationEntry): MatchupSimulation {
  const aWin = winProbability(a, b);
  return {
    aWin,
    bWin: 1 - aWin,
    aPanel3: majorityProbability(aWin, 3),
    aPanel5: majorityProbability(aWin, 5),
    ratingGap: upstreamRating(a.rating) - upstreamRating(b.rating),
  };
}
