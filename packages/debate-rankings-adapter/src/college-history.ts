/**
 * @fileoverview Past-season college policy (NDT/CEDA) team ratings, scraped
 * from debatedata.weebly.com (one page per season, e.g. `/2024-25.html`).
 *
 * `debate-rankings` only rates the current season, so these tables are the
 * only per-team history the site has. They are a different model from the
 * site's Bradley-Terry ratings — a TrueSkill-style skill (`mu`) with an
 * uncertainty (`sigma`), ranked on a conservative `rating` below `mu` — so
 * they are kept on their own scale and never mixed with `RankingEntry` rows.
 * Each season lists the top 100 teams as the site published them. The
 * current season (2025-26) is the source's home page rather than a season
 * page, and comes with the tournaments it rates and per-division season stats
 * ({@link COLLEGE_SEASON_DETAILS}).
 *
 * `history/cpd-debatedata.csv` holds every season, newest first, with columns
 * `Season,Rank,School,Team,Rating,Mu,Sigma`. School names follow the source
 * page, which used short names ("Georgetown", "Cal State Fullerton") from
 * 2010-11 through 2012-13 and full names otherwise.
 * @module @debate/rankings-adapter/college-history
 */

/// <reference path="./raw.d.ts" />
import { parseCsv } from "./parse";

/** One team's row in a past season's debatedata.weebly.com table. */
export interface CollegeHistoryEntry {
  /** 1-based position in that season's table. */
  rank: number;
  /** Institution, as the source page spelled it. */
  school: string;
  /** Team code, `Last & Last`. */
  name: string;
  /** Conservative skill estimate the table is ranked on (below `mu`). */
  rating: number;
  /** Estimated skill. */
  mu: number;
  /** Uncertainty of `mu`; lower means more certain. */
  sigma: number;
}

/** First and last season year (the year a season ends in) with history. */
export const COLLEGE_HISTORY_FIRST_YEAR = 2010;
export const COLLEGE_HISTORY_LAST_YEAR = 2026;

/** Where the history was scraped from. */
export const COLLEGE_HISTORY_SOURCE_URL = "https://debatedata.weebly.com";

/** Season pages whose path is not the plain season label. */
const SOURCE_PAGE_OVERRIDES: Record<number, string> = {
  2015: "/2014-151.html",
  2016: "/2015-161.html",
  2026: "/",
};

/** The debatedata page season `year`'s table was taken from. */
export function collegeHistorySourceUrl(year: string | number): string {
  const y = Number(year);
  return `${COLLEGE_HISTORY_SOURCE_URL}${SOURCE_PAGE_OVERRIDES[y] ?? `/${seasonKey(y)}.html`}`;
}

/** One division's season totals, as debatedata's sidebar lists them. */
export interface CollegeSeasonStats {
  /** `"All divisions"`, `"Open"`, `"Junior Varsity"` or `"Novice"`. */
  division: string;
  schools: number;
  teams: number;
  participants: number;
  rounds: number;
  /** Share of all rounds the affirmative won, in percent. */
  affWinPct: number;
  /** Share of elimination rounds the affirmative won, in percent. */
  elimAffWinPct: number;
  /** Median speaker points; not given for all divisions combined. */
  medianPoints?: number;
  /** Interquartile range of speaker points, `[low, high]`. */
  pointsIqr?: [number, number];
}

/** What debatedata publishes alongside a season's table, when we have it. */
export interface CollegeSeasonDetails {
  /** Short names of the tournaments the ratings are computed from. */
  tournaments: string[];
  /** All divisions first, then Open, Junior Varsity and Novice. */
  stats: CollegeSeasonStats[];
}

/** Season details by season year; only the current season has them. */
export const COLLEGE_SEASON_DETAILS: Record<number, CollegeSeasonDetails> = {
  2026: {
    tournaments: [
      "ASU", "Bing", "BTO", "CSUN", "DartRR", "GMU", "Gonzaga", "Gtown", "Indiana",
      "IowaRR", "KSU", "KU", "Monmouth", "MoState", "Navy", "NU", "OU", "Roch",
      "RutgersRR", "Texas", "UH", "UK", "UKRR", "UMN", "UTSA", "WFU", "WP",
    ],
    stats: [
      { division: "All divisions", schools: 70, teams: 656, participants: 850, rounds: 5671, affWinPct: 47.2, elimAffWinPct: 40.5 },
      { division: "Open", schools: 63, teams: 366, participants: 523, rounds: 3972, affWinPct: 47.4, elimAffWinPct: 43.4, medianPoints: 28.9, pointsIqr: [28.7, 29.2] },
      { division: "Junior Varsity", schools: 45, teams: 126, participants: 197, rounds: 661, affWinPct: 46.5, elimAffWinPct: 43.1, medianPoints: 28.8, pointsIqr: [28.5, 29.0] },
      { division: "Novice", schools: 40, teams: 217, participants: 291, rounds: 1038, affWinPct: 47.0, elimAffWinPct: 32.0, medianPoints: 28.6, pointsIqr: [28.3, 28.9] },
    ],
  },
};

/** Season `year`'s tournaments and stats, or `null` when debatedata's aren't stored. */
export function collegeSeasonDetails(year: string | number): CollegeSeasonDetails | null {
  return COLLEGE_SEASON_DETAILS[Number(year)] ?? null;
}

/**
 * Per-round performance noise debatedata adds to each team's `sigma` (25/6,
 * TrueSkill's default beta for a 25-point initial mu).
 */
export const COLLEGE_PERFORMANCE_SIGMA = 25 / 6;

/** Standard normal CDF via the Abramowitz–Stegun 7.1.26 erf approximation (error < 1.5e-7). */
function standardNormalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-x * x);
  return 0.5 * (1 + (z < 0 ? -erf : erf));
}

/**
 * Probability that `aff` beats `neg` in one round, the way debatedata's
 * calculator works it out: each side's performance is normal around its `mu`
 * with variance `sigma² + β²`, and aff wins when its draw is higher.
 */
export function collegeWinProbability(
  aff: Pick<CollegeHistoryEntry, "mu" | "sigma">,
  neg: Pick<CollegeHistoryEntry, "mu" | "sigma">,
): number {
  const beta2 = COLLEGE_PERFORMANCE_SIGMA ** 2;
  const spread = Math.sqrt(aff.sigma ** 2 + neg.sigma ** 2 + 2 * beta2);
  return standardNormalCdf((aff.mu - neg.mu) / spread);
}

/** True when a past-season college policy table exists for season `year`. */
export function hasCollegeHistory(year: string | number): boolean {
  const y = Number(year);
  return Number.isInteger(y) && y >= COLLEGE_HISTORY_FIRST_YEAR && y <= COLLEGE_HISTORY_LAST_YEAR;
}

/** Season year `2025` as the CSV's `Season` label, `"2024-25"`. */
function seasonKey(year: number): string {
  return `${year - 1}-${String(year % 100).padStart(2, "0")}`;
}

/**
 * Parses `history/cpd-debatedata.csv` into rows keyed by season label
 * (`"2024-25"`), each list in rank order.
 */
export function parseCollegeHistory(text: string): Map<string, CollegeHistoryEntry[]> {
  const [header, ...rows] = parseCsv(text);
  const col = (name: string) => header.indexOf(name);
  const [season, rank, school, team, rating, mu, sigma] = [
    "Season",
    "Rank",
    "School",
    "Team",
    "Rating",
    "Mu",
    "Sigma",
  ].map(col);
  const bySeason = new Map<string, CollegeHistoryEntry[]>();
  for (const row of rows) {
    const list = bySeason.get(row[season]) ?? [];
    list.push({
      rank: Number(row[rank]),
      school: row[school],
      name: row[team],
      rating: Number(row[rating]),
      mu: Number(row[mu]),
      sigma: Number(row[sigma]),
    });
    bySeason.set(row[season], list);
  }
  for (const list of bySeason.values()) list.sort((a, b) => a.rank - b.rank);
  return bySeason;
}

let cache: Promise<Map<string, CollegeHistoryEntry[]>> | null = null;

/**
 * Loads season `year`'s college policy table (top 100 teams), or an empty
 * list when the year is outside {@link hasCollegeHistory}. The CSV is its own
 * chunk, fetched once.
 */
export async function loadCollegeHistory(year: string | number): Promise<CollegeHistoryEntry[]> {
  if (!hasCollegeHistory(year)) return [];
  cache ??= import("./history/cpd-debatedata.csv?raw").then((m) => parseCollegeHistory(m.default));
  const all = await cache.catch((err) => {
    cache = null;
    throw err;
  });
  return all.get(seasonKey(Number(year))) ?? [];
}
