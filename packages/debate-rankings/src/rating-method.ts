/**
 * @fileoverview How the rankings' "Elo" rating is made, written down once so the
 * header tooltip, the help docs page and the tests agree.
 *
 * Two sources feed the Rating column (see `extinction.ts`):
 *
 * - **Bundled CSVs** (`debate-rankings-sync-data`, a git submodule of
 *   github.com/shreerammodi/debate-rankings). Its `src/main.py` is not a
 *   round-by-round Elo/Glicko updater: it fits one Bradley-Terry model to
 *   every decided ballot of the season at once (library `fisher-scoring`,
 *   `BradleyTerry(use_bias=True, l2=1.0)`) and reports the fitted skills on
 *   the familiar Elo scale. There is no K-factor and no decay. The constants and
 *   helpers below mirror that script so they can be tested here; the Python
 *   itself is not part of this workspace.
 * - **Extinction.GG** (`OverallELO`, 2015-16 to now). Its algorithm is not in
 *   this repository; the site only subtracts {@link EXTINCTION_ELO_SHIFT}
 *   points and applies the display scale of `rating-offset.ts`.
 *
 * Everything here is React-free so the Worker and the Vitest suite can import it.
 * @module @debate-ai/rankings/rating-method
 */

import { EXTINCTION_ELO_SHIFT } from "./extinction";
import { RATING_DIVISOR, RATING_MAX, RATING_MIN, RATING_OFFSET } from "./rating-offset";

/** Rating of a team whose fitted skill is 0 (the field average): upstream `RATING_BASE`. */
export const ELO_BASE = 1500;

/** Elo points per unit of log-odds, `400 / ln 10`: upstream `RATING_SCALE`. 400 points = 10:1 odds. */
export const ELO_SCALE = 400 / Math.log(10);

/**
 * Ridge strength on every fitted parameter (team skills and the aff advantage),
 * upstream `SKILL_PRIOR_PRECISION`. 1 is a N(0, 1) prior on the logit scale.
 */
export const SKILL_PRIOR_PRECISION = 1;

/** Ballot multiplier for a tournament listed under `majors` in the format's config. */
export const MAJOR_BALLOT_WEIGHT = 2;

/** How many deviations are taken off the rating to get the adjusted rating that ranks are sorted on. */
export const ADJUSTED_RATING_DEVIATIONS = 2;

/** Where the full method is written up, with the formulas rendered. */
export const RATING_METHOD_DOCS_HREF = "/docs/features/ai-coach#bradley-terry-debate-rankings";

/** The header tooltip's short summary; the formulas live at {@link RATING_METHOD_DOCS_HREF}. */
export const RATING_TOOLTIP_SUMMARY =
  "Elo rating compiled from Tabroom round results; ranks are sorted on it. " +
  "Every decided ballot of the season is fitted at once (Bradley-Terry, with an aff side effect; majors count double), " +
  "and the rating shown is the Elo less 2 × its uncertainty, rescaled to 0–9.9.";

/** One formula of the method: LaTeX source plus what it is. */
export interface RatingFormula {
  id: string;
  title: string;
  /** KaTeX-compatible LaTeX, without delimiters. The help docs page prints each as a `$$` block. */
  tex: string;
}

/**
 * Every formula of the method, in reading order. The help docs page
 * (`packages/debate-help-docs/content/docs/features/ai-coach.mdx`) contains each `tex`
 * verbatim; a test keeps them in step.
 */
export const RATING_FORMULAS: readonly RatingFormula[] = [
  {
    id: "ballots",
    title: "Ballots a round contributes",
    tex: String.raw`n^{\mathrm{aff}}_k = w_k\,a_k, \qquad n^{\mathrm{neg}}_k = w_k\,b_k, \qquad w_k = \begin{cases} 2 & \text{major tournament} \\ 1 & \text{otherwise} \end{cases}`,
  },
  {
    id: "win-probability",
    title: "Win probability, with the aff side effect",
    tex: String.raw`p_k = P(\text{aff wins round } k) = \frac{1}{1 + e^{-(\lambda_i - \lambda_j + \beta)}}`,
  },
  {
    id: "fit",
    title: "Penalized maximum-likelihood fit",
    tex: String.raw`(\hat\lambda, \hat\beta) = \arg\max_{\lambda,\beta} \; \sum_k \Bigl[ n^{\mathrm{aff}}_k \ln p_k + n^{\mathrm{neg}}_k \ln (1 - p_k) \Bigr] - \frac{\tau}{2} \Bigl( \beta^2 + \sum_i \lambda_i^2 \Bigr), \qquad \tau = 1`,
  },
  {
    id: "rating",
    title: "Rating and deviation on the Elo scale",
    tex: String.raw`R_i = 1500 + \frac{400}{\ln 10}\,\hat\lambda_i, \qquad D_i = \frac{400}{\ln 10}\,\mathrm{SE}(\hat\lambda_i)`,
  },
  {
    id: "adjusted",
    title: "Adjusted rating (what ranks sort on)",
    tex: String.raw`A_i = R_i - 2\,D_i`,
  },
  {
    id: "expected-score",
    title: "Expected score (side-neutral)",
    tex: String.raw`E_{ij} = \frac{1}{1 + 10^{(R_j - R_i)/400}}`,
  },
  {
    id: "expected-score-aff",
    title: "Expected score for the aff team",
    tex: String.raw`E^{\mathrm{aff}}_{ij} = \frac{1}{1 + 10^{-(R_i - R_j + \Delta_{\mathrm{aff}})/400}}, \qquad \Delta_{\mathrm{aff}} = \frac{400}{\ln 10}\,\hat\beta`,
  },
  {
    id: "site-scale",
    title: "Site scale (0–9.9)",
    tex: String.raw`S_i = \min\!\Bigl(99,\ \max\!\Bigl(0,\ \frac{A_i - 1000}{8.2/1.2}\Bigr)\Bigr), \qquad \text{shown as } S_i / 10`,
  },
  {
    id: "simulator",
    title: "Matchup simulator win probability",
    tex: String.raw`P(a \text{ beats } b) = \frac{1}{1 + \exp\!\bigl(-g(\varphi_b)\,(\mu_a - \mu_b)\bigr)}, \qquad g(\varphi) = \frac{1}{\sqrt{1 + 3\varphi^2/\pi^2}}`,
  },
];

/** `1500 + 400/ln 10 · skill`: a fitted log-odds skill on the Elo scale. */
export function eloRatingFromSkill(skill: number): number {
  return ELO_BASE + ELO_SCALE * skill;
}

/** `400/ln 10 · se`: a skill's standard error on the Elo scale. */
export function eloDeviationFromStandardError(standardError: number): number {
  return ELO_SCALE * standardError;
}

/** The rating ranks are sorted on: `rating − 2 · deviation`. */
export function adjustedEloRating(rating: number, deviation: number): number {
  return rating - ADJUSTED_RATING_DEVIATIONS * deviation;
}

/**
 * A team with no decided round sits at the prior: skill 0, standard error
 * `τ^(-1/2)`. Its rating, deviation and adjusted rating on the Elo scale.
 */
export function unratedTeam(): { rating: number; deviation: number; adjusted: number } {
  const rating = eloRatingFromSkill(0);
  const deviation = eloDeviationFromStandardError(SKILL_PRIOR_PRECISION ** -0.5);
  return { rating, deviation, adjusted: adjustedEloRating(rating, deviation) };
}

/**
 * Chance that rating `a` beats rating `b` in one round: the Elo expected score.
 * `affAdvantage` is the fitted aff edge in Elo points (`Aff Rating Advantage`
 * in `field_statistics.csv`), added to whoever is aff; pass a negative value
 * when `a` is the neg team, or leave 0 for a side-neutral estimate.
 */
export function eloExpectedScore(a: number, b: number, affAdvantage = 0): number {
  return 1 / (1 + 10 ** (-(a - b + affAdvantage) / 400));
}

/**
 * The (aff, neg) ballots a round row adds, before the major multiplier,
 * as upstream's `_count_ballots`: a panel's `Votes` cell
 * (`"Aff Neg Aff"`, `Pro`/`Con` too) is counted token by token; with no
 * readable votes the round is one ballot for whoever the `Win` column named.
 */
export function countBallots(votes: string | null | undefined, affWon: boolean): [aff: number, neg: number] {
  if (typeof votes === "string") {
    const tokens = votes.toLowerCase().split(/\s+/).filter(Boolean);
    const aff = tokens.filter((t) => t === "aff" || t === "pro").length;
    const neg = tokens.filter((t) => t === "neg" || t === "con").length;
    if (aff + neg > 0) return [aff, neg];
  }
  return affWon ? [1, 0] : [0, 1];
}

/** Ballots each side adds to the fit: {@link countBallots} times 2 at a major, 1 elsewhere. */
export function weightedBallots(
  votes: string | null | undefined,
  affWon: boolean,
  major: boolean,
): [aff: number, neg: number] {
  const [aff, neg] = countBallots(votes, affWon);
  const weight = major ? MAJOR_BALLOT_WEIGHT : 1;
  return [aff * weight, neg * weight];
}

/**
 * Whether a round file counts as an elimination round when win rates are split,
 * as upstream's `_is_elimination_round`: a panel round (`Judges` and `Votes`
 * columns) or a round name containing an elimination word. Elims still count
 * the same in the rating.
 */
export function isEliminationRound(roundName: string, columns: readonly string[]): boolean {
  const terms = ["runoff", "double", "triple", "quad", "octo", "quarter", "semi", "final"];
  const name = roundName.toLowerCase();
  return (columns.includes("Judges") && columns.includes("Votes")) || terms.some((t) => name.includes(t));
}

/**
 * An Elo-scale rating as the site shows it, before the one-decimal print:
 * shifted by {@link RATING_OFFSET}, divided by {@link RATING_DIVISOR} and
 * clamped to [{@link RATING_MIN}, {@link RATING_MAX}]. Same as `toSiteRating`.
 */
export function siteScaleRating(eloRating: number): number {
  return Math.min(RATING_MAX, Math.max(RATING_MIN, (eloRating - RATING_OFFSET) / RATING_DIVISOR));
}

/** An Extinction.GG `OverallELO` on the Elo scale the CSV ratings use. */
export function extinctionToEloScale(overallElo: number): number {
  return overallElo - EXTINCTION_ELO_SHIFT;
}
