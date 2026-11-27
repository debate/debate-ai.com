/**
 * @fileoverview Pins the written-down rating method (`src/rating-method.ts`
 * and the "How Team Ratings Are Computed" help docs section) to what the code
 * does: the upstream constants, ballot counting, the Elo expected score, the
 * site's 0–9.9 scale, the worked example, and that every LaTeX formula is
 * valid KaTeX and is printed verbatim in the docs.
 *
 * The Python behind the CSVs (`debate-rankings-sync-data/src/main.py`, a git
 * submodule that is not checked out here) fits the ratings; the worked-example
 * numbers below are what that script printed for the example tournament in the docs.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import katex from "katex";
import { describe, expect, it } from "vitest";
import {
  ADJUSTED_RATING_DEVIATIONS,
  ELO_BASE,
  ELO_SCALE,
  MAJOR_BALLOT_WEIGHT,
  RATING_FORMULAS,
  RATING_METHOD_DOCS_HREF,
  RATING_TOOLTIP_SUMMARY,
  SKILL_PRIOR_PRECISION,
  adjustedEloRating,
  countBallots,
  eloDeviationFromStandardError,
  eloExpectedScore,
  eloRatingFromSkill,
  extinctionToEloScale,
  isEliminationRound,
  siteScaleRating,
  toSiteRating,
  formatSiteRating,
  unratedTeam,
  weightedBallots,
} from "../src/index";
import { COLUMN_TOOLTIPS, COLUMN_TOOLTIP_LINKS, ELO_TOOLTIP } from "../src/leaderboard/leaderboardUtils";

const DOCS = readFileSync(
  join(__dirname, "../../debate-help-docs/content/docs/features/ai-coach.mdx"),
  "utf8",
);

describe("Elo scale constants", () => {
  it("puts 400 points at 10:1 odds around a 1500 average", () => {
    expect(ELO_BASE).toBe(1500);
    expect(ELO_SCALE).toBeCloseTo(173.7178, 4);
    expect(eloRatingFromSkill(0)).toBe(1500);
    // One logit of skill is 400 / ln 10 points, and 400 points is 10:1 odds.
    const odds = Math.exp((eloRatingFromSkill(1) - eloRatingFromSkill(0)) / ELO_SCALE);
    expect(odds).toBeCloseTo(Math.E, 10);
    expect(10 ** (400 / 400)).toBe(10);
    expect(eloExpectedScore(1900, 1500)).toBeCloseTo(10 / 11, 10);
  });

  it("converts a standard error and takes two deviations off", () => {
    expect(eloDeviationFromStandardError(1)).toBeCloseTo(173.7178, 4);
    expect(ADJUSTED_RATING_DEVIATIONS).toBe(2);
    expect(adjustedEloRating(1700, 20)).toBe(1660);
  });

  it("doubles ballots at majors", () => {
    expect(MAJOR_BALLOT_WEIGHT).toBe(2);
    expect(SKILL_PRIOR_PRECISION).toBe(1);
  });
});

describe("unrated teams", () => {
  it("sit at the prior: 1500 ± one logit, which shows as 2.2", () => {
    const team = unratedTeam();
    expect(team.rating).toBe(1500);
    expect(team.deviation).toBeCloseTo(173.7178, 4);
    expect(team.adjusted).toBeCloseTo(1152.5644, 3);
    expect(formatSiteRating(siteScaleRating(team.adjusted))).toBe("2.2");
  });
});

describe("expected score", () => {
  it("is 50% for equal ratings and sums to 1 for the two sides", () => {
    expect(eloExpectedScore(1500, 1500)).toBe(0.5);
    expect(eloExpectedScore(1650, 1500) + eloExpectedScore(1500, 1650)).toBeCloseTo(1, 12);
  });

  it("matches the logistic of the skill gap", () => {
    const skillA = 0.8;
    const skillB = -0.3;
    const logistic = 1 / (1 + Math.exp(-(skillA - skillB)));
    expect(eloExpectedScore(eloRatingFromSkill(skillA), eloRatingFromSkill(skillB))).toBeCloseTo(logistic, 12);
  });

  it("adds the aff advantage to whoever is aff", () => {
    const affEdge = 45.03;
    expect(eloExpectedScore(1500, 1500, affEdge)).toBeGreaterThan(0.5);
    expect(eloExpectedScore(1500, 1500, -affEdge)).toBeLessThan(0.5);
    expect(eloExpectedScore(1500, 1500, affEdge) + eloExpectedScore(1500, 1500, -affEdge)).toBeCloseTo(1, 12);
  });
});

describe("ballots", () => {
  it("counts a panel's votes token by token, Aff/Pro and Neg/Con alike", () => {
    expect(countBallots("Aff Neg Aff", true)).toEqual([2, 1]);
    expect(countBallots("pro CON  con", false)).toEqual([1, 2]);
  });

  it("falls back to one ballot for the winner without readable votes", () => {
    expect(countBallots(undefined, true)).toEqual([1, 0]);
    expect(countBallots(null, false)).toEqual([0, 1]);
    expect(countBallots("", true)).toEqual([1, 0]);
    expect(countBallots("bye forfeit", false)).toEqual([0, 1]);
  });

  it("doubles every ballot at a major only", () => {
    expect(weightedBallots("Pro Con Pro", true, false)).toEqual([2, 1]);
    expect(weightedBallots("Pro Con Pro", true, true)).toEqual([4, 2]);
    expect(weightedBallots(undefined, false, true)).toEqual([0, 2]);
  });

  it("splits out elimination rounds by name or by a panel's Judges and Votes columns", () => {
    expect(isEliminationRound("04-Finals", ["Aff", "Neg", "Win"])).toBe(true);
    expect(isEliminationRound("Quarterfinals", [])).toBe(true);
    expect(isEliminationRound("Tabroom-1529913", ["Aff", "Neg", "Judges", "Votes", "Win"])).toBe(true);
    expect(isEliminationRound("02-round-2", ["Aff", "Neg", "Judge", "Win"])).toBe(false);
  });
});

describe("site scale", () => {
  it("is the same shift, scale and clamp as toSiteRating", () => {
    for (const elo of [-500, 1000, 1152.56, 1406.18, 1700, 2300, 9000]) {
      expect(siteScaleRating(elo)).toBe(toSiteRating(elo));
    }
    expect(siteScaleRating(900)).toBe(0);
    expect(siteScaleRating(9000)).toBe(99);
  });

  it("takes 450 off an Extinction.GG Elo before that", () => {
    expect(extinctionToEloScale(2000)).toBe(1550);
  });
});

describe("worked example in the help docs", () => {
  // What `main.py` printed for the docs' three-team PF tournament.
  const teams = [
    { name: "Alpha", rating: 1595.975445, deviation: 94.899852, adjusted: 1406.18, shown: "5.9", site: 59.44 },
    { name: "Beta", rating: 1505.905668, deviation: 94.899852, adjusted: 1316.11, shown: "4.6", site: 46.26 },
    { name: "Gamma", rating: 1398.118888, deviation: 111.379952, adjusted: 1175.36, shown: "2.6", site: 25.66 },
  ];

  it.each(teams)("$name: adjusted rating, site scale and tier", (team) => {
    const adjusted = adjustedEloRating(team.rating, team.deviation);
    expect(adjusted).toBeCloseTo(team.adjusted, 2);
    expect(siteScaleRating(adjusted)).toBeCloseTo(team.site, 2);
    expect(formatSiteRating(siteScaleRating(adjusted))).toBe(team.shown);
    expect(DOCS).toContain(team.adjusted.toFixed(1));
    expect(DOCS).toContain(`**${team.shown}**`);
  });

  it("gives the quoted win chances for Alpha over Beta", () => {
    expect(eloExpectedScore(1595.975445, 1505.905668)).toBeCloseTo(0.627, 3);
    expect(eloExpectedScore(1595.975445, 1505.905668, 45.03)).toBeCloseTo(0.685, 3);
    expect(DOCS).toContain("62.7\\%");
    expect(DOCS).toContain("68.5\\%");
  });

  it("lists the ballots the final adds, doubled at a major", () => {
    expect(weightedBallots("Pro Con Pro", true, false)).toEqual([2, 1]);
    expect(weightedBallots("Pro Con Pro", true, true)).toEqual([4, 2]);
    expect(DOCS).toContain("| Final | Alpha | Beta | panel Pro, Con, Pro | 2–1 |");
  });
});

describe("formulas", () => {
  it("are unique and render as valid KaTeX", () => {
    expect(new Set(RATING_FORMULAS.map((f) => f.id)).size).toBe(RATING_FORMULAS.length);
    for (const formula of RATING_FORMULAS) {
      const html = katex.renderToString(formula.tex, { displayMode: true, throwOnError: true });
      expect(html, formula.id).toContain("katex");
      expect(html, formula.id).not.toContain("katex-error");
    }
  });

  it("are printed verbatim, as $$ blocks, in the help docs", () => {
    for (const formula of RATING_FORMULAS) {
      expect(DOCS, formula.id).toContain(`$$\n${formula.tex}\n$$`);
    }
  });

  it("use the constants the code uses", () => {
    const byId = Object.fromEntries(RATING_FORMULAS.map((f) => [f.id, f.tex]));
    expect(byId.rating).toContain("1500");
    expect(byId.rating).toContain("\\frac{400}{\\ln 10}");
    expect(byId.adjusted).toContain(`${ADJUSTED_RATING_DEVIATIONS}\\,D_i`);
    expect(byId.ballots).toContain(`${MAJOR_BALLOT_WEIGHT} & \\text{major`);
    expect(byId.fit).toContain(`\\tau = ${SKILL_PRIOR_PRECISION}`);
    expect(byId["expected-score"]).toContain("10^{(R_j - R_i)/400}");
    expect(byId["site-scale"]).toContain("A_i - 1000");
    expect(byId["site-scale"]).toContain("8.2/1.2");
  });
});

describe("Rating header tooltip", () => {
  it("keeps the original sentence at the front and links to the docs for the formulas", () => {
    const tip = COLUMN_TOOLTIPS.adjustedRating ?? "";
    expect(tip).toBe(RATING_TOOLTIP_SUMMARY);
    expect(tip.startsWith("Elo rating compiled from Tabroom round results; ranks are sorted on it.")).toBe(true);
    expect(ELO_TOOLTIP).toBe(RATING_TOOLTIP_SUMMARY);
    expect(tip).not.toContain("$");
    expect(COLUMN_TOOLTIP_LINKS.adjustedRating?.href).toBe(RATING_METHOD_DOCS_HREF);
  });

  it("links to a docs section that exists", () => {
    const [, anchor] = RATING_METHOD_DOCS_HREF.split("#");
    expect(DOCS).toContain(`[#${anchor}]`);
  });
});
