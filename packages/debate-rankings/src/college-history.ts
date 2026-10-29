/**
 * @fileoverview Past-season college policy (NDT/CEDA) team ratings, scraped
 * from debatedata.weebly.com (one page per season, e.g. `/2024-25.html`).
 *
 * `debate-rankings-sync-data` only rates the current season, so these tables are the
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
 * @module @debate-ai/rankings/college-history
 */

/// <reference path="./raw.d.ts" />
import { parseCsv } from "./parse";
import { parseTeamLabel } from "./team-lookup";
import { matchTournamentEntry, type TournamentEntryQuery } from "./tournament-lookup";

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

/**
 * Season year (the year a season ends in) of a date: a season runs July to
 * June, so `"2019-11-02"` is in 2020 (2019-20). `null` for an unparseable
 * date. Only the year and month are read, so a time zone can't move a date
 * across the line.
 */
export function collegeSeasonYearOf(date: string | null | undefined): number | null {
  const match = /^(\d{4})-(\d{2})/.exec((date ?? "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  return Number(match[2]) >= 7 ? year + 1 : year;
}

/**
 * College shorthand videos and tab use for a school, and the short names the
 * 2010-11 to 2012-13 tables use, each mapped to one key. Keys and values are
 * {@link collegeSchoolKey}'s cleaned form, before this table is applied.
 */
const COLLEGE_SCHOOL_ALIASES: Record<string, string> = {
  ku: "kansas",
  ou: "oklahoma",
  uco: "central oklahoma",
  nu: "northwestern",
  msu: "michigan state",
  gmu: "george mason",
  jmu: "james madison",
  gtown: "georgetown",
  wake: "wake forest",
  uk: "kentucky",
  uga: "georgia",
  gsu: "georgia state",
  uwg: "west georgia",
  unt: "north texas",
  usc: "southern california",
  pitt: "pittsburgh",
  minn: "minnesota",
  bing: "binghamton",
  binghamton: "binghamton",
  "state new york binghamton": "binghamton",
  asu: "arizona state",
  nyu: "new york",
  wvu: "west virginia",
  umw: "mary washington",
  gw: "george washington",
  umkc: "missouri kansas city",
  "mo state": "missouri state",
  mostate: "missouri state",
  utd: "texas dallas",
  "ut dallas": "texas dallas",
  utsa: "texas san antonio",
  "ut san antonio": "texas san antonio",
  unlv: "nevada las vegas",
  cal: "california berkeley",
  berkeley: "california berkeley",
  "uc berkeley": "california berkeley",
  csulb: "california state long beach",
  "csu long beach": "california state long beach",
  "cal state long beach": "california state long beach",
  "long beach": "california state long beach",
  csuf: "california state fullerton",
  "cal state fullerton": "california state fullerton",
  "california state fullerton": "california state fullerton",
  kckcc: "kansas city kansas",
  "kansas city kansas cc": "kansas city kansas",
  "kansas city kansas community": "kansas city kansas",
  jccc: "johnson county",
  jcc: "johnson county",
  "johnson county community": "johnson county",
  bc: "boston",
  vandy: "vanderbilt",
  "west ga": "west georgia",
  "san fran state": "san francisco state",
  sfsu: "san francisco state",
};

/**
 * A school name reduced to what tells colleges apart: `"University of Texas
 * - Dallas"`, `"UT Dallas"` and `"UTD"` all become `"texas dallas"`, and
 * `"State University of New York - Binghamton"` becomes `"binghamton"`. The
 * rankings' own school matching drops the part after `" - "` as a city,
 * which for colleges is the campus, so the tables' names are rewritten here
 * before matching.
 */
export function collegeSchoolKey(school: string): string {
  const cleaned = school
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !["university", "of", "the", "at", "college"].includes(w))
    .join(" ")
    // "Kansas St", "Wichita St".
    .replace(/ st$/, " state");
  return COLLEGE_SCHOOL_ALIASES[cleaned] ?? cleaned;
}

/** Speech and round names a video tacks onto a team, e.g. `"Baylor CM 1AC"`. */
const LABEL_SUFFIX = /[\s-]+(?:[12](?:ac|nc|ar|nr)|block|cx|disclosure|prelims?|r\d+|round \d+)\s*$/i;
const LABEL_PREFIX = /^(?:[12](?:ac|nc|ar|nr)\s*-+\s*|round \d+\s+|(?:finals|semis|quarters|octos|octas|doubles)\s+)/i;

/**
 * A video's team label with what isn't the team cut away: a file extension,
 * a judge, a round or speech name (`"Emory GN -1AR.MP4"` → `"Emory GN"`,
 * `"Cal MS - R6"` → `"Cal MS"`, `"Octos Emory GH"` → `"Emory GH"`).
 */
export function cleanCollegeTeamLabel(label: string): string {
  let text = label.split(/\s+-\s+|\s*\(|,|\s+judge:|\.mp4/i)[0].trim();
  for (let prev = ""; prev !== text; ) {
    prev = text;
    text = text.replace(LABEL_SUFFIX, "").replace(LABEL_PREFIX, "").trim();
  }
  return text;
}

/**
 * The row a team code (`"Kansas LS"`) or tournament entry names in one past
 * season's table, or `null` when no row or more than one matches — two teams
 * from the same school with the same initials are left unmatched rather
 * than guessed. Matching is {@link matchTournamentEntry}'s — debaters' last
 * names when the query has them, else the school loosely and the initials
 * exactly, in either order — over {@link collegeSchoolKey}'s school names, on
 * the label {@link cleanCollegeTeamLabel} leaves.
 *
 * @param entries - One season's table, from {@link loadCollegeHistory}.
 * @param query - A video's team label, or a tournament entry's code, names and school.
 */
export function findCollegeHistoryTeam(
  entries: readonly CollegeHistoryEntry[],
  query: string | TournamentEntryQuery | null | undefined,
): CollegeHistoryEntry | null {
  const q: TournamentEntryQuery = typeof query === "string" ? { code: query } : (query ?? {});
  const code = q.code ? cleanCollegeTeamLabel(q.code) : "";
  const label = parseTeamLabel(code);
  if (!label && !q.name) return null;
  const keyed = entries.map((entry) => ({ entry, name: entry.name, school: collegeSchoolKey(entry.school) }));
  const match = matchTournamentEntry(keyed, {
    code: label ? `${collegeSchoolKey(label.school)} ${label.code}` : null,
    name: q.name,
    school: q.school ? collegeSchoolKey(q.school) : null,
  });
  return match?.entry ?? null;
}
