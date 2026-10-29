/**
 * @fileoverview The watch page's simulated matchup: who the rankings expect
 * to win a round, given the side each team actually debated and whether the
 * round was a prelim (one judge) or an elim (a panel).
 *
 * The numbers are the matchup simulator's (`modelMatchup` in
 * `@debate-ai/rankings`) with the aff team as side A, so the side term —
 * the field's aff edge plus each team's own aff/neg tilt — is the round's real
 * one. The rating mix is the average of the two teams' recommended weights,
 * so a team with few rounds leans on its school as it does in the simulator.
 * A seeded Monte Carlo run shows the variance a percentage hides and stays
 * the same on every render.
 * @module lib/watch-matchup-prediction
 */

import {
  modelMatchup,
  recommendWeights,
  simulateRounds,
  type MatchupWeights,
  type RankingDataset,
  type RankingEntry,
  type RoundStage,
  type SimulatedRounds,
} from "@debate-ai/rankings"
import {
  formatRoundLevel,
  standardizeRoundLevel,
} from "../data/round-level"

/** Rounds the Monte Carlo run plays. */
export const PREDICTION_SIM_ROUNDS = 1000

/** Everything the watch page shows for one round's predicted outcome. */
export interface WatchMatchupPrediction {
  stage: RoundStage
  /** `false` when the round label didn't parse; the round is then treated as a prelim. */
  stageKnown: boolean
  /** E.g. `"R4"`, `"Quarters"`, or `null` when unknown. */
  roundLabel: string | null
  /** Judges deciding the round: 1 in prelims, 3 in elims, 5 in finals. */
  panel: 1 | 3 | 5
  /** Aff's chance of winning the round (the panel majority in elims). */
  affWin: number
  negWin: number
  /** Side the model favors; `null` when the two are within half a point. */
  favorite: "aff" | "neg" | null
  /** Monte Carlo rounds at {@link affWin}; `aWins` are aff wins. */
  simulated: SimulatedRounds
  /** Side that actually won, when the round's decision is recorded. */
  actual: "aff" | "neg" | null
  /** Whether the actual winner was the underdog; `null` without a decision or a favorite. */
  upset: boolean | null
  weights: MatchupWeights
}

/** Deterministic PRNG (mulberry32), so a round's simulation never changes between renders. */
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let state = h >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round2 = (x: number) => Math.round(x * 20) / 20

/**
 * Predicts a round between `aff` and `neg`, both rows of `dataset`.
 *
 * @param datasets - Every loaded dataset, for the debaters' individual ratings.
 * @param roundLevel - The video's round label (`video[8]`), e.g. `"Quarters"` or `"R3"`.
 * @param affWon - The video's recorded decision (`video[11]`); anything but a boolean means unknown.
 * @param seed - Keeps the Monte Carlo run stable, e.g. the video id.
 */
export function predictWatchMatchup(
  aff: RankingEntry,
  neg: RankingEntry,
  dataset: RankingDataset,
  datasets: readonly RankingDataset[],
  roundLevel: string | null | undefined,
  affWon: unknown,
  seed = "",
): WatchMatchupPrediction {
  const level = standardizeRoundLevel(roundLevel ?? null)
  const stageKnown = level !== "UNKNOWN"
  const stage: RoundStage =
    stageKnown && (!level.startsWith("R") || level === "RUNOFFS") ? "elim" : "prelim"
  const panel = stage === "prelim" ? 1 : level === "FINALS" ? 5 : 3

  // The breakdowns don't depend on the weights, so a first pass at zero gives
  // what each team's recommendation needs.
  const probe = modelMatchup(aff, neg, dataset, datasets, { school: 0, individual: 0 })
  const ra = recommendWeights(aff, probe.a)
  const rb = recommendWeights(neg, probe.b)
  const weights = {
    school: round2((ra.school + rb.school) / 2),
    individual: round2((ra.individual + rb.individual) / 2),
  }
  const [affSide] = modelMatchup(aff, neg, dataset, datasets, weights).sides
  const affWin = panel === 1 ? affSide.prelim : panel === 3 ? affSide.elim3 : affSide.elim5
  const negWin = 1 - affWin
  const favorite = Math.abs(affWin - negWin) < 0.005 ? null : affWin > negWin ? "aff" : "neg"
  const actual = typeof affWon === "boolean" ? (affWon ? "aff" : "neg") : null

  return {
    stage,
    stageKnown,
    roundLabel: formatRoundLevel(level) || null,
    panel,
    affWin,
    negWin,
    favorite,
    simulated: simulateRounds(
      affWin,
      PREDICTION_SIM_ROUNDS,
      seededRandom(`${seed}|${aff.hash || aff.name}|${neg.hash || neg.name}`),
    ),
    actual,
    upset: actual && favorite ? actual !== favorite : null,
    weights,
  }
}
