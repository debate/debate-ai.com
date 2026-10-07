/**
 * @fileoverview The matchup simulator's richer model: Glicko-2's single-round
 * probability ({@link winProbability}) from a *blended* rating, then shifted
 * for the side each team debates on and the stage (prelim vs. elim).
 *
 * Blended rating — three signals, mixed by two weights the user sets:
 * - **Team**: the pairing's own rating.
 * - **Individual**: how each debater rates in the *other* entries they appear
 *   in (other partners, other divisions) at the same school, as a z-score in
 *   that dataset mapped onto this one's scale. A team that does well only
 *   together, or a debater who carries every partner, shows up here.
 * - **School**: the mean rating of every entry the school has in the
 *   division — program strength (coaching, shared files) rather than the pair.
 *
 * `rating = (1 − school) · [(1 − individual) · team + individual · indiv] + school · schoolMean`
 *
 * Side term, in log-odds: the field's aff advantage for the stage, plus each
 * team's own aff-vs-neg tilt beyond the field's, shrunk toward zero for teams
 * with few rounds (elim rates shrink harder — there are few elim rounds).
 * @module @debate/rankings-adapter/matchup-model
 */

import { majorityProbability, winProbability } from "./match-simulation";
import { RATING_DIVISOR } from "./rating-offset";
import { normalizeSchool } from "./team-lookup";
import type { FieldStatistics, RankingEntry } from "./upstream";

/** Which side a team debates. */
export type DebateSide = "aff" | "neg";
/** Prelim (one judge) or elim (a panel). */
export type RoundStage = "prelim" | "elim";

/** How much each non-team signal counts, each 0–1. */
export interface MatchupWeights {
  /** Share of the rating taken from the school's mean. */
  school: number;
  /** Share of the team part taken from the debaters' individual ratings. */
  individual: number;
}

/** The fields of a dataset the model reads. */
export interface ModelDataset {
  id: string;
  entries: RankingEntry[];
  field: FieldStatistics | null;
}

/** Each signal behind one team's blended rating, all on the site scale. */
export interface RatingBreakdown {
  team: number;
  /** `null` when neither debater appears in any other entry. */
  individual: number | null;
  /** Other entries the individual rating was drawn from. */
  individualSources: number;
  school: number;
  /** Entries the school has in the division, this one included. */
  schoolEntries: number;
  blended: number;
}

/** One side assignment's chances for team A. */
export interface SideOutcome {
  /** A's side; B debates the other. */
  side: DebateSide;
  prelim: number;
  elim3: number;
  elim5: number;
}

/** Everything the simulator shows for one pairing under one set of weights. */
export interface MatchupModelResult {
  a: RatingBreakdown;
  b: RatingBreakdown;
  /** A aff, then A neg. */
  sides: [SideOutcome, SideOutcome];
  /** A's tilt toward aff beyond the field's, in log-odds (negative favors neg). */
  aSideTilt: number;
  bSideTilt: number;
}

/** Rounds a team's side rates are shrunk by: `n / (n + k)`. */
const SIDE_SHRINK = 20;
/** Elo-scale points per unit of log-odds (400 / ln 10). */
const ELO_PER_LOGIT = 400 / Math.LN10;

const clampRate = (pct: number) => Math.min(0.95, Math.max(0.05, pct / 100));
const logit = (p: number) => Math.log(p / (1 - p));
const logistic = (x: number) => 1 / (1 + Math.exp(-x));
const clamp01 = (x: number) => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));

/** Debater surnames in a team code: `"Nahm & Tarnas"` → `["nahm", "tarnas"]`; an LD name → its last word. */
export function debaterKeys(name: string): string[] {
  const parts = name.split(/\s*(?:&|\/|\band\b)\s*/i).map((p) => p.trim()).filter(Boolean);
  return parts.map((p) => p.split(/\s+/).pop()!.toLowerCase().replace(/[^a-z0-9'-]/g, "")).filter(Boolean);
}

function stats(entries: RankingEntry[]): { mean: number; sd: number } {
  const n = entries.length;
  if (n === 0) return { mean: 0, sd: 1 };
  const mean = entries.reduce((s, e) => s + e.rating, 0) / n;
  const variance = entries.reduce((s, e) => s + (e.rating - mean) ** 2, 0) / n;
  return { mean, sd: Math.sqrt(variance) || 1 };
}

/**
 * Mean rating of the school's entries in `dataset`, and how many there are.
 * Falls back to the entry's own rating when the school has no other entries.
 */
export function schoolRating(entry: RankingEntry, dataset: ModelDataset): { rating: number; entries: number } {
  const key = normalizeSchool(entry.school);
  const mates = dataset.entries.filter((e) => normalizeSchool(e.school) === key);
  if (mates.length === 0) return { rating: entry.rating, entries: 1 };
  return { rating: mates.reduce((s, e) => s + e.rating, 0) / mates.length, entries: mates.length };
}

/**
 * The debaters' rating from their *other* entries at the same school, across
 * every dataset, mapped onto `dataset`'s scale. Each source counts by its
 * matches; each debater counts equally. `null` when there are no sources.
 */
export function individualRating(
  entry: RankingEntry,
  dataset: ModelDataset,
  allDatasets: readonly ModelDataset[],
): { rating: number | null; sources: number } {
  const school = normalizeSchool(entry.school);
  const keys = debaterKeys(entry.name);
  if (keys.length === 0) return { rating: null, sources: 0 };
  const perDebater: number[] = [];
  let sources = 0;
  for (const key of keys) {
    let weighted = 0;
    let weight = 0;
    for (const d of allDatasets) {
      const { mean, sd } = stats(d.entries);
      for (const e of d.entries) {
        if (e === entry || (e.hash && e.hash === entry.hash)) continue;
        if (normalizeSchool(e.school) !== school || !debaterKeys(e.name).includes(key)) continue;
        const w = Math.max(1, e.matches);
        weighted += ((e.rating - mean) / sd) * w;
        weight += w;
        sources++;
      }
    }
    if (weight > 0) perDebater.push(weighted / weight);
  }
  if (perDebater.length === 0) return { rating: null, sources: 0 };
  const z = perDebater.reduce((s, v) => s + v, 0) / perDebater.length;
  const { mean, sd } = stats(dataset.entries);
  return { rating: mean + z * sd, sources };
}

/** One team's blended rating and the signals behind it. */
export function blendedRating(
  entry: RankingEntry,
  dataset: ModelDataset,
  allDatasets: readonly ModelDataset[],
  weights: MatchupWeights,
): RatingBreakdown {
  const wSchool = clamp01(weights.school);
  const wIndividual = clamp01(weights.individual);
  const indiv = individualRating(entry, dataset, allDatasets);
  const school = schoolRating(entry, dataset);
  const teamPart = (1 - wIndividual) * entry.rating + wIndividual * (indiv.rating ?? entry.rating);
  return {
    team: entry.rating,
    individual: indiv.rating,
    individualSources: indiv.sources,
    school: school.rating,
    schoolEntries: school.entries,
    blended: (1 - wSchool) * teamPart + wSchool * school.rating,
  };
}

/** Field-wide aff advantage for `stage`, in log-odds. */
export function fieldAffLogit(field: FieldStatistics | null, stage: RoundStage): number {
  if (!field) return 0;
  if (stage === "prelim" && field.affRatingAdvantage != null) {
    return (field.affRatingAdvantage * RATING_DIVISOR) / ELO_PER_LOGIT;
  }
  const rate = stage === "elim" ? (field.affElimWinRate ?? field.affWinRate) : field.affWinRate;
  return rate == null ? 0 : logit(clampRate(rate));
}

/**
 * A team's own aff tilt beyond the field's, in log-odds — half the gap between
 * its aff and neg win rates, less the field's, shrunk by its round count.
 *
 * Always from the overall rates (which include elims): a team's elim rates
 * rest on a handful of rounds — one lost neg elim reads as 0% — and would
 * swamp the rating gap. The stage only changes the field term.
 */
export function teamSideTilt(entry: RankingEntry, field: FieldStatistics | null): number {
  const { affWinRate: aff, negWinRate: neg } = entry;
  if (aff == null || neg == null) return 0;
  const raw = (logit(clampRate(aff)) - logit(clampRate(neg))) / 2;
  // Measured the same way as the team's own gap — from win rates — so a team
  // that merely matches the field's aff edge has no tilt of its own.
  const fieldTilt = field?.affWinRate == null ? 0 : logit(clampRate(field.affWinRate));
  return (raw - fieldTilt) * (entry.matches / (entry.matches + SIDE_SHRINK));
}

/** A's single-round chance on `side` at `stage`, from blended ratings. */
function sideProbability(
  baseLogit: number,
  side: DebateSide,
  stage: RoundStage,
  a: RankingEntry,
  b: RankingEntry,
  field: FieldStatistics | null,
): number {
  const sign = side === "aff" ? 1 : -1;
  // A on aff gains the field's aff edge and its own aff tilt, and B — on neg —
  // loses whatever aff tilt it has (an aff-leaning B is weaker on neg).
  const shift = sign * (fieldAffLogit(field, stage) + teamSideTilt(a, field) + teamSideTilt(b, field));
  return logistic(baseLogit + shift);
}

/** Runs the model for A vs. B in `dataset`. */
export function modelMatchup(
  a: RankingEntry,
  b: RankingEntry,
  dataset: ModelDataset,
  allDatasets: readonly ModelDataset[],
  weights: MatchupWeights,
): MatchupModelResult {
  const ra = blendedRating(a, dataset, allDatasets, weights);
  const rb = blendedRating(b, dataset, allDatasets, weights);
  const base = winProbability({ rating: ra.blended, deviation: a.deviation }, { rating: rb.blended, deviation: b.deviation });
  const baseLogit = logit(Math.min(1 - 1e-9, Math.max(1e-9, base)));
  const outcome = (side: DebateSide): SideOutcome => {
    const elim = sideProbability(baseLogit, side, "elim", a, b, dataset.field);
    return {
      side,
      prelim: sideProbability(baseLogit, side, "prelim", a, b, dataset.field),
      elim3: majorityProbability(elim, 3),
      elim5: majorityProbability(elim, 5),
    };
  };
  return {
    a: ra,
    b: rb,
    sides: [outcome("aff"), outcome("neg")],
    aSideTilt: teamSideTilt(a, dataset.field),
    bSideTilt: teamSideTilt(b, dataset.field),
  };
}

/**
 * Which side A should pick on a coin flip at `stage`, and by how many
 * percentage points; `null` when the two are within half a point.
 */
export function recommendSide(
  result: MatchupModelResult,
  stage: RoundStage,
): { side: DebateSide; margin: number } | null {
  const [aff, neg] = result.sides;
  const pick = (o: SideOutcome) => (stage === "prelim" ? o.prelim : o.elim3);
  const margin = (pick(aff) - pick(neg)) * 100;
  if (Math.abs(margin) < 0.5) return null;
  return { side: margin > 0 ? "aff" : "neg", margin: Math.abs(margin) };
}

/**
 * Suggested weights for one team: lean on the school when the team has few
 * rounds of its own (`k / (matches + k)`, k = 15 — 15 rounds → 50%, 60 → 20%),
 * and on the debaters' other entries in proportion to how many there are,
 * capped at half.
 */
export function recommendWeights(entry: RankingEntry, breakdown: RatingBreakdown): MatchupWeights {
  const round2 = (x: number) => Math.round(x * 20) / 20;
  const school = breakdown.schoolEntries > 1 ? 15 / (entry.matches + 15) : 0;
  const sources = breakdown.individual === null ? 0 : breakdown.individualSources;
  const individual = Math.min(0.5, sources / (sources + 2));
  return { school: round2(Math.min(0.6, school)), individual: round2(individual) };
}
