/**
 * @fileoverview Past-season college policy (NDT/CEDA) team ratings, scraped
 * from debatedata.weebly.com (one page per season, e.g. `/2024-25.html`).
 *
 * `debate-rankings` only rates the current season, so these tables are the
 * only per-team history the site has. They are a different model from the
 * site's Bradley-Terry ratings — a TrueSkill-style skill (`mu`) with an
 * uncertainty (`sigma`), ranked on a conservative `rating` below `mu` — so
 * they are kept on their own scale and never mixed with `RankingEntry` rows.
 * Each season lists the top 100 teams as the site published them.
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
export const COLLEGE_HISTORY_LAST_YEAR = 2025;

/** Where the history was scraped from. */
export const COLLEGE_HISTORY_SOURCE_URL = "https://debatedata.weebly.com";

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
