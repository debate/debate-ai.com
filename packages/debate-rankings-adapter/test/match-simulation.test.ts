import { describe, expect, it } from "vitest";
import {
  RATING_DIVISOR,
  RATING_OFFSET,
  majorityProbability,
  simulateMatchup,
  simulateRounds,
  upstreamRating,
  winProbability,
} from "../src/index";

/** Site-scale rating for an upstream (1500-baseline) Glicko-2 rating. */
const site = (raw: number) => (raw - RATING_OFFSET) / RATING_DIVISOR;

describe("match simulation", () => {
  it("undoes the site's rating offset", () => {
    expect(upstreamRating(site(1832.5))).toBeCloseTo(1832.5);
  });

  it("gives evenly rated entries a coin flip", () => {
    const a = { rating: site(1700), deviation: 80 };
    expect(winProbability(a, a)).toBeCloseTo(0.5);
  });

  it("matches skelo's Glicko2Model.compute_prob", () => {
    // Top two hsld rows: 2260.84 (φ 82.35) vs 2210.38 (φ 77.93).
    const a = { rating: site(2260.844685061399), deviation: 82.35114468965546 };
    const b = { rating: site(2210.3836588899153), deviation: 77.93248127343384 };
    const p = winProbability(a, b);
    // E = 1 / (1 + exp(-g(φb)(μa-μb))) on the Glicko-2 scale.
    const phi = 77.93248127343384 / 173.7178;
    const gPhi = 1 / Math.sqrt(1 + (3 * phi * phi) / Math.PI ** 2);
    const expected = 1 / (1 + Math.exp(-gPhi * ((2260.844685061399 - 2210.3836588899153) / 173.7178)));
    expect(p).toBeCloseTo(expected, 10);
    expect(p).toBeGreaterThan(0.5);
    const sim = simulateMatchup(a, b);
    expect(sim.aWin + sim.bWin).toBeCloseTo(1);
    expect(sim.aPanel3).toBeGreaterThan(sim.aWin);
    expect(sim.aPanel5).toBeGreaterThan(sim.aPanel3);
  });

  it("computes majority-of-panel odds", () => {
    expect(majorityProbability(0.5, 3)).toBeCloseTo(0.5);
    expect(majorityProbability(0.7, 1)).toBeCloseTo(0.7);
    expect(majorityProbability(0.7, 3)).toBeCloseTo(0.784);
    expect(majorityProbability(1, 5)).toBeCloseTo(1);
  });

  it("plays out rounds with an injected random source", () => {
    const rolls = [0.1, 0.9, 0.5, 0.2];
    let i = 0;
    expect(simulateRounds(0.6, 4, () => rolls[i++])).toEqual({ rounds: 4, aWins: 3, bWins: 1 });
  });
});
