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
 *
 * A round is predicted whenever either team is found. The missing team plays
 * as a stand-in ({@link standInEntry}): its school's average entry when the
 * label names a school the rankings know, else the field's median team. Past
 * seasons use that season's full rankings for high school; for college,
 * debatedata's top-100 table only has skill and uncertainty (no side
 * records), so {@link predictCollegeHistoryMatchup} plays a TrueSkill win
 * chance, with an unmatched team just below the table's last row.
 * @module lib/watch-matchup-prediction
 */

import {
  majorityProbability,
  modelMatchup,
  normalizeSchool,
  recommendWeights,
  simulateRounds,
  type CollegeHistoryEntry,
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
  /** Rating mix used; both zero for a debatedata prediction. */
  weights: MatchupWeights
  /**
   * Where the ratings came from: the Extinction.GG / bundled rankings, or
   * debatedata's past college tables (skill and uncertainty only).
   */
  basis: "rankings" | "debatedata"
  /** The season the ratings are from when it isn't the current one, else `null`. */
  season: number | null
  /** Side whose team no ranking named and that played as a stand-in; `null` when both were found. */
  standIn: "aff" | "neg" | null
  /** The stand-in's school, when the rankings know it (its rating is then that school's average). */
  standInSchool: string | null
}

/** Marks a {@link standInEntry} row, so a prediction can say which side it filled. */
const STAND_IN_HASH = "stand-in:"

/** Whether `entry` is a {@link standInEntry} rather than a ranked team. */
export function isStandInEntry(entry: Pick<RankingEntry, "hash">): boolean {
  return entry.hash.startsWith(STAND_IN_HASH)
}

/**
 * A team the rankings don't name, for simulating a round against one that
 * they do: no side record and no rounds of its own, the field's median
 * deviation, and the mean rating of `school`'s entries in the division when
 * it has any (the rankings' spelling, from `resolveRankedSchool`), else the
 * field's median rating. `null` for an empty dataset.
 *
 * @param dataset - The division and season the round is predicted in.
 * @param label - The video's team label, kept for the simulation seed.
 * @param school - The team's school as the rankings spell it, when known.
 */
export function standInEntry(
  dataset: Pick<RankingDataset, "entries">,
  label: string | null | undefined,
  school?: string | null,
): RankingEntry | null {
  if (dataset.entries.length === 0) return null
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]
  }
  const key = school?.trim() ? normalizeSchool(school) : ""
  const mates = key ? dataset.entries.filter((e) => normalizeSchool(e.school) === key) : []
  const rating = mates.length > 0
    ? mates.reduce((sum, e) => sum + e.rating, 0) / mates.length
    : median(dataset.entries.map((e) => e.rating))
  const deviation = median(dataset.entries.map((e) => e.deviation))
  return {
    rank: dataset.entries.length + 1,
    school: school?.trim() ?? "",
    // No debaters, so the individual signal never borrows a stranger's rating.
    name: "",
    adjustedRating: rating - 2 * deviation,
    deviation,
    matches: 0,
    rating,
    hash: `${STAND_IN_HASH}${label?.trim() ?? ""}`,
    affWinRate: null,
    negWinRate: null,
    affElimWinRate: null,
    negElimWinRate: null,
  }
}

/** The round's stage and panel from its label; an unparsed label is a prelim. */
function roundStage(roundLevel: string | null | undefined) {
  const level = standardizeRoundLevel(roundLevel ?? null)
  const stageKnown = level !== "UNKNOWN"
  const stage: RoundStage =
    stageKnown && (!level.startsWith("R") || level === "RUNOFFS") ? "elim" : "prelim"
  const panel: 1 | 3 | 5 = stage === "prelim" ? 1 : level === "FINALS" ? 5 : 3
  return { stage, stageKnown, panel, roundLabel: formatRoundLevel(level) || null }
}

/** Favorite, actual winner and upset from aff's chance and the recorded decision. */
function outcome(affWin: number, affWon: unknown) {
  const negWin = 1 - affWin
  const favorite: "aff" | "neg" | null =
    Math.abs(affWin - negWin) < 0.005 ? null : affWin > negWin ? "aff" : "neg"
  const actual: "aff" | "neg" | null = typeof affWon === "boolean" ? (affWon ? "aff" : "neg") : null
  return { affWin, negWin, favorite, actual, upset: actual && favorite ? actual !== favorite : null }
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
 * @param season - The season `dataset` is from, when it isn't the current one.
 */
export function predictWatchMatchup(
  aff: RankingEntry,
  neg: RankingEntry,
  dataset: RankingDataset,
  datasets: readonly RankingDataset[],
  roundLevel: string | null | undefined,
  affWon: unknown,
  seed = "",
  season: number | null = null,
): WatchMatchupPrediction {
  const round = roundStage(roundLevel)

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
  const affWin = round.panel === 1 ? affSide.prelim : round.panel === 3 ? affSide.elim3 : affSide.elim5
  const standIn = isStandInEntry(aff) ? "aff" : isStandInEntry(neg) ? "neg" : null
  const standInRow = standIn === "aff" ? aff : standIn === "neg" ? neg : null

  return {
    ...round,
    ...outcome(affWin, affWon),
    simulated: simulateRounds(
      affWin,
      PREDICTION_SIM_ROUNDS,
      seededRandom(`${seed}|${aff.hash || aff.name}|${neg.hash || neg.name}`),
    ),
    weights,
    basis: "rankings",
    season,
    standIn,
    standInSchool: standInRow?.school || null,
  }
}

/**
 * TrueSkill's performance spread (β) on debatedata's scale: its ratings start
 * at μ = 25, σ = 25/3, and TrueSkill's default β is half that σ.
 */
export const DEBATEDATA_BETA = 25 / 6

/** Standard normal CDF (Abramowitz–Stegun 7.1.26 erf, error < 1.5e-7). */
function normalCdf(x: number): number {
  const z = Math.abs(x) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * z)
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  const erf = 1 - poly * Math.exp(-z * z)
  return x >= 0 ? (1 + erf) / 2 : (1 - erf) / 2
}

/**
 * Predicts a past college policy round from debatedata's table for its
 * season: TrueSkill's chance that aff out-performs neg on one ballot,
 * `Φ((μa − μb) / √(2β² + σa² + σb²))`, as a panel majority in elims.
 * debatedata has no side records, so there is no side term. A side the table
 * doesn't name plays as a team just below its last row (that row's μ, twice
 * its σ). `null` when neither team is found or both name the same row.
 *
 * @param aff - Aff's row in that season's table, if found.
 * @param neg - Neg's row in that season's table, if found.
 * @param rows - That season's whole table, for the stand-in.
 * @param season - The round's season year.
 */
export function predictCollegeHistoryMatchup(
  aff: CollegeHistoryEntry | null,
  neg: CollegeHistoryEntry | null,
  rows: readonly CollegeHistoryEntry[],
  season: number,
  roundLevel: string | null | undefined,
  affWon: unknown,
  seed = "",
): WatchMatchupPrediction | null {
  if ((!aff && !neg) || aff === neg) return null
  const last = rows.reduce<CollegeHistoryEntry | null>((low, row) => (!low || row.mu < low.mu ? row : low), null)
  const standInRow = last ? { mu: last.mu, sigma: last.sigma * 2 } : null
  const a = aff ?? standInRow
  const b = neg ?? standInRow
  if (!a || !b) return null
  const round = roundStage(roundLevel)
  const ballot = normalCdf((a.mu - b.mu) / Math.sqrt(2 * DEBATEDATA_BETA ** 2 + a.sigma ** 2 + b.sigma ** 2))
  const affWin = round.panel === 1 ? ballot : majorityProbability(ballot, round.panel)
  return {
    ...round,
    ...outcome(affWin, affWon),
    simulated: simulateRounds(
      affWin,
      PREDICTION_SIM_ROUNDS,
      seededRandom(`${seed}|${aff?.name ?? "stand-in"}|${neg?.name ?? "stand-in"}`),
    ),
    weights: { school: 0, individual: 0 },
    basis: "debatedata",
    season,
    standIn: aff ? (neg ? null : "neg") : "aff",
    standInSchool: null,
  }
}
