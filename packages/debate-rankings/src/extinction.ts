/**
 * @fileoverview The official rankings source: Extinction.GG's live team Elo
 * ratings and TOC bid lists, for HS Policy, HS LD, HS PF and College Policy,
 * from the 2015-16 season to now.
 *
 * Each season and format is two public JSON files. Extinction.GG sends no
 * CORS headers, so the browser reads them through the app's caching proxy at
 * `/api/extinction/<kind>/<file>` ({@link EXTINCTION_PROXY_PATH}), which serves
 * past seasons from the database and only fetches the current season live;
 * the Worker and tests fetch them directly:
 *
 * - `https://extinction.gg/live/teams/<Prefix><YY><YY>.json` — every team's
 *   `OverallELO`, debater names and `SchoolTeamCode` (`"Whitney Young BM:
 *   Boss & Mohan"`). The `teams` field is a JSON *string* holding the array.
 * - `https://extinction.gg/live/bids/<Prefix><YY><YY>.json` — the season's
 *   bid tournaments and, per team, the tournament codes it earned TOC bids at.
 *   College Policy has no TOC, so its bids file does not exist (403).
 *
 * {@link getDebateData} joins the two on `SchoolTeamCode`. Teams that appear
 * only on the bid list are kept with `null` names and Elo rather than dropped.
 *
 * {@link loadRankingDataset} turns that into the site's {@link RankingDataset}.
 * For the current season it also merges in the aff/neg win rates (and round
 * counts and field-wide side bias) from the bundled Bradley-Terry CSVs of
 * `debate-rankings-sync-data`, which Extinction.GG does not publish. Past
 * seasons come from Extinction.GG alone.
 * @module @debate-ai/rankings/extinction
 */

import { loadCsvRankingDataset, offsetEntryRatings } from "./rating-offset";
import { debatersKey, schoolSimilarity } from "./sync/sync-toc-bids-sheet";
import { getRankingDatasetInfo } from "./upstream";
import type { RankingDataset, RankingDatasetId, RankingEntry } from "./types";

// ---------------------------------------------------------------------------
// Raw API
// ---------------------------------------------------------------------------

/** The four formats Extinction.GG rates. */
export type DebateFormat = "hspolicy" | "hsld" | "hspf" | "collegepolicy";

/** One row of the ratings file's `teams` array. */
export interface RatingTeam {
  FullName1: string;
  FullName2?: string;
  /** Elo as a string, e.g. `"1987"`. */
  OverallELO: string;
  SchoolTeamCode: string;
}

/** Body of `/live/teams/<file>.json`. */
export interface RatingsResponse {
  attribution: string;
  /** The team array, usually JSON-encoded as a string. */
  teams: string | RatingTeam[];
}

/** A tournament that awarded TOC bids this season. */
export interface BidTournament {
  code: string;
  name: string;
  date: string;
  /** The elim round that earns a bid, e.g. `"Quarters"`. */
  bid: string;
  tabroomId: string;
  /** How many bids the tournament awards (not a team's count). */
  bids: number;
  ghostBids?: number;
  source: string;
}

/** A bid tournament whose results are not in yet. */
export interface PendingTournament {
  code: string;
  name: string;
  date: string;
  bid: string;
  tabroomId: string;
  why: string;
}

/** Body of `/live/bids/<file>.json`. */
export interface BidsResponse {
  generated: string;
  tournaments: BidTournament[];
  pending: PendingTournament[];
  teams: { team: string; bids: string[] }[];
}

/** One team after joining ratings and bids on `SchoolTeamCode`. */
export interface CombinedTeam {
  SchoolTeamCode: string;
  FullName1: string | null;
  FullName2: string | null;
  OverallELO: number | null;
  /** Distinct tournament codes the team earned a bid at. */
  tocBidCount: number;
  tocBidTournamentCodes: string[];
}

/** Everything Extinction.GG publishes for one format and season. */
export interface CombinedDebateData {
  format: DebateFormat;
  /** `"YY-YY"`, e.g. `"26-27"`. */
  season: string;
  attribution: string;
  /** Date the bid list was generated; `""` when the format has no bid list. */
  generated: string;
  /** Sorted by bids, then Elo, then code. */
  teams: CombinedTeam[];
  tournaments: BidTournament[];
  pending: PendingTournament[];
}

/** Base URL of the live data. */
export const EXTINCTION_BASE_URL = "https://extinction.gg/live";

/**
 * Same-origin path of the app's proxy for {@link EXTINCTION_BASE_URL}, used in
 * the browser because Extinction.GG does not allow cross-origin reads.
 */
export const EXTINCTION_PROXY_PATH = "/api/extinction";

/** Extinction.GG file kinds the proxy serves. */
export type ExtinctionFileKind = "teams" | "bids";

/**
 * Where to fetch one Extinction.GG file from: the same-origin proxy in a
 * browser, Extinction.GG itself on the server.
 */
export function extinctionFileUrl(kind: ExtinctionFileKind, filename: string): string {
  const inBrowser = typeof window !== "undefined" && typeof document !== "undefined";
  return `${inBrowser ? EXTINCTION_PROXY_PATH : EXTINCTION_BASE_URL}/${kind}/${filename}`;
}

/** File-name prefix per format; `CollegePolicy` casing verified against the live API. */
export const EXTINCTION_FORMAT_PREFIX: Record<DebateFormat, string> = {
  hspolicy: "HSPolicy",
  hsld: "HSLD",
  hspf: "HSPF",
  collegepolicy: "CollegePolicy",
};

/** First season Extinction.GG covers, as a season year (the year it ends in): 2015-16. */
export const EXTINCTION_FIRST_SEASON_YEAR = 2016;

/** Formats with no Tournament of Champions, so no bids file. */
const FORMATS_WITHOUT_BIDS = new Set<DebateFormat>(["collegepolicy"]);

/** `"26-27"` for season year 2027. */
export function extinctionSeasonCode(seasonYear: number): string {
  const end = seasonYear % 100;
  const start = (seasonYear - 1) % 100;
  return `${String(start).padStart(2, "0")}-${String(end).padStart(2, "0")}`;
}

/** `"HSPolicy2627.json"` for hspolicy, `"26-27"`. */
export function extinctionFileName(format: DebateFormat, season: string): string {
  if (!Object.prototype.hasOwnProperty.call(EXTINCTION_FORMAT_PREFIX, format)) {
    throw new Error(`Unsupported debate format: ${format}`);
  }
  const match = /^(\d{2})-(\d{2})$/.exec(season);
  if (!match) throw new Error('Season must use "YY-YY", such as "26-27".');
  const startYear = 2000 + Number(match[1]);
  const endYear = 2000 + Number(match[2]);
  const latestStart = new Date().getFullYear();
  if (startYear < EXTINCTION_FIRST_SEASON_YEAR - 1 || startYear > latestStart || endYear !== startYear + 1) {
    throw new Error(`Season must be consecutive and start between 2015 and ${latestStart}.`);
  }
  return `${EXTINCTION_FORMAT_PREFIX[format]}${match[1]}${match[2]}.json`;
}

/** Thrown for a non-OK response, so callers can tell a missing file apart. */
class HttpError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
    statusText: string,
  ) {
    super(`Failed to fetch ${url}: ${status} ${statusText}`);
  }
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new HttpError(url, response.status, response.statusText);
  return (await response.json()) as T;
}

/**
 * Match full team names, ignoring case and repeated whitespace. Punctuation
 * and competitor names are kept so different teams never merge.
 */
function teamKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** An empty bid list, for formats (College Policy) that have none. */
const NO_BIDS: BidsResponse = { generated: "", tournaments: [], pending: [], teams: [] };

/**
 * Fetches one format and season from Extinction.GG and joins the ratings with
 * the TOC bid list on `SchoolTeamCode`.
 *
 * `tocBidCount` counts the distinct tournament codes in a team's `bids` —
 * not the tournament-level `bids` value. Teams found only in the ratings get
 * 0; teams found only in the bid list are kept with `null` names and Elo.
 *
 * @param format - Which format.
 * @param season - `"YY-YY"`, from `"15-16"` to the season starting this year.
 * @param signal - Aborts both requests.
 */
export async function getDebateData(
  format: DebateFormat,
  season: string,
  signal?: AbortSignal,
): Promise<CombinedDebateData> {
  const filename = extinctionFileName(format, season);

  const [ratings, bidData] = await Promise.all([
    fetchJson<RatingsResponse>(extinctionFileUrl("teams", filename), signal),
    FORMATS_WITHOUT_BIDS.has(format)
      ? NO_BIDS
      : fetchJson<BidsResponse>(extinctionFileUrl("bids", filename), signal).catch((err: unknown) => {
          // A season with no bid list yet is not an error for the ratings.
          if (err instanceof HttpError && (err.status === 403 || err.status === 404)) return NO_BIDS;
          throw err;
        }),
  ]);

  return combineDebateData(format, season, ratings, bidData);
}

/**
 * Joins one season's ratings file and bid list on `SchoolTeamCode`, the way
 * {@link getDebateData} does after fetching them. The server uses it on its
 * saved copies of past seasons.
 *
 * @param bidData - The bid list, or `null` for a format or season without one.
 */
export function combineDebateData(
  format: DebateFormat,
  season: string,
  ratings: RatingsResponse,
  bidData: BidsResponse | null,
): CombinedDebateData {
  bidData ??= NO_BIDS;
  const parsedTeams: unknown = typeof ratings.teams === "string" ? JSON.parse(ratings.teams) : ratings.teams;
  if (!Array.isArray(parsedTeams)) {
    throw new Error("Expected the ratings teams field to contain an array.");
  }

  const combined = new Map<string, CombinedTeam>();
  for (const team of parsedTeams as RatingTeam[]) {
    const raw = String(team.OverallELO ?? "").trim();
    const elo = raw === "" ? NaN : Number(raw);
    combined.set(teamKey(team.SchoolTeamCode), {
      SchoolTeamCode: team.SchoolTeamCode,
      FullName1: team.FullName1,
      FullName2: team.FullName2 || null,
      OverallELO: Number.isFinite(elo) ? elo : null,
      tocBidCount: 0,
      tocBidTournamentCodes: [],
    });
  }

  for (const bidTeam of bidData.teams ?? []) {
    const key = teamKey(bidTeam.team);
    let team = combined.get(key);
    if (!team) {
      team = {
        SchoolTeamCode: bidTeam.team,
        FullName1: null,
        FullName2: null,
        OverallELO: null,
        tocBidCount: 0,
        tocBidTournamentCodes: [],
      };
      combined.set(key, team);
    }
    // Deduplicate tournament codes, including across repeated team entries.
    team.tocBidTournamentCodes = [...new Set([...team.tocBidTournamentCodes, ...bidTeam.bids])];
    team.tocBidCount = team.tocBidTournamentCodes.length;
  }

  return {
    format,
    season,
    attribution: ratings.attribution,
    generated: bidData.generated,
    teams: [...combined.values()].sort(
      (a, b) =>
        b.tocBidCount - a.tocBidCount ||
        (b.OverallELO ?? -Infinity) - (a.OverallELO ?? -Infinity) ||
        a.SchoolTeamCode.localeCompare(b.SchoolTeamCode),
    ),
    tournaments: bidData.tournaments ?? [],
    pending: bidData.pending ?? [],
  };
}

// ---------------------------------------------------------------------------
// Onto the site's rankings model
// ---------------------------------------------------------------------------

/** The Extinction.GG format behind each full-season dataset. */
export const EXTINCTION_DATASET_FORMAT: Partial<Record<RankingDatasetId, DebateFormat>> = {
  hspf: "hspf",
  hsld: "hsld",
  hscx: "hspolicy",
  cpd: "collegepolicy",
};

/**
 * Elo points taken off every Extinction.GG rating before the site's usual
 * shift and scale ({@link toSiteRating}). Extinction.GG's field sits higher
 * than the Bradley-Terry CSVs' (median ≈ 1670, the best teams 2150–2340), so
 * without this dozens of teams a season would pile up at the cap. With it, and
 * the 20%-higher {@link RATING_DIVISOR}, the best teams of every season from
 * 2015-16 on read at or near the 109 (10.9) cap.
 * A constant shift keeps every rating gap, so win probabilities are unchanged.
 */
export const EXTINCTION_ELO_SHIFT = 450;

/** `SchoolTeamCode` split into its parts. */
export interface SchoolTeamCodeParts {
  /** `"Whitney Young"`. */
  school: string;
  /** `"BM"`, or `""` when the code has no initials. */
  code: string;
  /** `"Boss & Mohan"` (or one surname in LD). */
  names: string;
}

/** Splits `"Whitney Young BM: Boss & Mohan"` into school, code and names. */
export function parseSchoolTeamCode(value: string): SchoolTeamCodeParts {
  const trimmed = value.trim().replace(/\s+/g, " ");
  const colon = trimmed.lastIndexOf(":");
  if (colon === -1) return { school: trimmed, code: "", names: "" };
  const head = trimmed.slice(0, colon).trim();
  const names = trimmed.slice(colon + 1).trim();
  const codeMatch = /^(.*\S)\s+(\S{1,5})$/u.exec(head);
  return codeMatch
    ? { school: codeMatch[1], code: codeMatch[2], names }
    : { school: head, code: "", names };
}

/** Lowercase hex FNV-1a of `text`: a stable id for an entry within a season. */
function stableHash(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
  }
  return ((h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0"));
}

/**
 * Turns joined Extinction.GG teams into rankings entries, on the upstream
 * (pre-{@link toSiteRating}) scale and ranked by Elo.
 *
 * LD entries are named by the debater's full name, as the CSVs name them;
 * team formats by the `"Last & Last"` from the team code. Bid-only teams have
 * no Elo, so they are ranked last, at the floor.
 *
 * @param data - Output of {@link getDebateData}.
 */
export function extinctionEntries(data: CombinedDebateData): RankingEntry[] {
  const floor = Math.min(0, ...data.teams.map((t) => t.OverallELO ?? 0));
  const rows = data.teams.map((team): RankingEntry => {
    const parts = parseSchoolTeamCode(team.SchoolTeamCode);
    const debaters = [team.FullName1, team.FullName2].filter((n): n is string => !!n && !!n.trim());
    const name = data.format === "hsld" && debaters.length === 1 ? debaters[0] : parts.names || debaters.join(" & ");
    const rating = (team.OverallELO ?? floor) - EXTINCTION_ELO_SHIFT;
    return {
      rank: 0,
      school: parts.school,
      name,
      adjustedRating: rating,
      deviation: 0,
      matches: 0,
      rating,
      hash: stableHash(`${data.format}|${data.season}|${teamKey(team.SchoolTeamCode)}`),
      affWinRate: null,
      negWinRate: null,
      affElimWinRate: null,
      negElimWinRate: null,
      teamCode: parts.code || undefined,
      debaters,
      tocBids: team.tocBidTournamentCodes,
    };
  });
  rows.sort((a, b) => b.rating - a.rating || b.tocBids!.length - a.tocBids!.length || a.school.localeCompare(b.school));
  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}

/**
 * Copies aff/neg win rates and round counts from the Bradley-Terry CSV
 * entries onto matching Extinction.GG entries; ratings stay Extinction.GG's.
 *
 * An entry matches when its debaters are the same (in either order) and the
 * schools look alike, or when only one CSV entry is that pair. Each CSV row is
 * used at most once. Unmatched entries keep `null` rates.
 *
 * @param entries - From {@link extinctionEntries}.
 * @param csvEntries - The current season's bundled CSV rows.
 */
export function mergeSideWinRates(entries: readonly RankingEntry[], csvEntries: readonly RankingEntry[]): RankingEntry[] {
  const byPair = new Map<string, RankingEntry[]>();
  for (const csv of csvEntries) {
    const key = debatersKey(csv.name);
    if (!key) continue;
    byPair.set(key, [...(byPair.get(key) ?? []), csv]);
  }
  const used = new Set<RankingEntry>();
  return entries.map((entry) => {
    const candidates = (byPair.get(debatersKey(entry.name)) ?? []).filter((c) => !used.has(c));
    let best: RankingEntry | undefined;
    let bestScore = 0;
    for (const c of candidates) {
      const score = schoolSimilarity(c.school, entry.school);
      if (score > bestScore) {
        best = c;
        bestScore = score;
      }
    }
    if (!best && candidates.length === 1 && (byPair.get(debatersKey(entry.name)) ?? []).length === 1) best = candidates[0];
    if (!best) return entry;
    used.add(best);
    return {
      ...entry,
      matches: best.matches,
      affWinRate: best.affWinRate,
      negWinRate: best.negWinRate,
      affElimWinRate: best.affElimWinRate,
      negElimWinRate: best.negElimWinRate,
    };
  });
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/** Season year (the year a season ends in) for `now`; seasons roll over on July 1. */
export function currentRankingSeasonYear(now: Date = new Date()): number {
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
}

/** Whether Extinction.GG has `id` for `seasonYear`. */
export function hasExtinctionSeason(id: RankingDatasetId, seasonYear: number): boolean {
  return (
    EXTINCTION_DATASET_FORMAT[id] !== undefined &&
    seasonYear >= EXTINCTION_FIRST_SEASON_YEAR &&
    seasonYear <= currentRankingSeasonYear()
  );
}

const fetches = new Map<string, Promise<CombinedDebateData>>();

/** {@link getDebateData}, shared between callers for the rest of the visit; failures are not kept. */
export function getDebateDataCached(format: DebateFormat, season: string): Promise<CombinedDebateData> {
  const key = `${format}|${season}`;
  let pending = fetches.get(key);
  if (!pending) {
    pending = getDebateData(format, season);
    fetches.set(key, pending);
    pending.catch(() => fetches.delete(key));
  }
  return pending;
}

/** Drops cached Extinction.GG responses (for tests). */
export function clearExtinctionCache(): void {
  fetches.clear();
}

/**
 * Loads a rankings dataset on the site's scale. This is the official loader.
 *
 * - `hspf`, `hsld`, `hscx`, `cpd` come from Extinction.GG for any season from
 *   2015-16 to now. The current season (the default) also gets the aff/neg
 *   win rates, round counts and field-wide side bias from the bundled CSVs;
 *   if Extinction.GG cannot be reached, the current season falls back to the
 *   CSVs alone so the site keeps working.
 * - `hsld_sepoct` (a topic slice Extinction.GG does not publish) and any
 *   other dataset come from the bundled CSVs, current season only.
 *
 * @param id - Dataset id.
 * @param seasonYear - Season year (the year it ends in); defaults to the current season.
 */
export async function loadRankingDataset(id: RankingDatasetId, seasonYear?: number): Promise<RankingDataset> {
  const info = getRankingDatasetInfo(id);
  if (!info) throw new Error(`Unknown rankings dataset: ${id}`);
  const current = currentRankingSeasonYear();
  const year = seasonYear ?? current;
  const format = EXTINCTION_DATASET_FORMAT[id];

  if (!format || !hasExtinctionSeason(id, year)) {
    if (year !== current) throw new Error(`No ${info.label} rankings for ${extinctionSeasonCode(year)}.`);
    return loadCsvRankingDataset(id);
  }

  const isCurrent = year === current;
  const [data, csv] = await Promise.all([
    getDebateDataCached(format, extinctionSeasonCode(year)).catch((err: unknown) => {
      if (isCurrent) return null;
      throw err;
    }),
    isCurrent ? loadCsvRankingDataset(id).catch(() => null) : null,
  ]);
  if (!data) {
    if (csv) return csv;
    throw new Error(`Failed to load ${info.label} rankings.`);
  }

  const entries = extinctionEntries(data);
  return {
    ...info,
    tournaments: [],
    majors: [],
    seasonYear: year,
    source: "extinction",
    bidTournaments: data.tournaments,
    entries: (csv ? mergeSideWinRates(entries, csv.entries) : entries).map(offsetEntryRatings),
    field: csv?.field ?? null,
  };
}
