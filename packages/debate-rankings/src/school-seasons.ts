/**
 * @fileoverview Each high school's best ranked teams, season by season, from
 * Extinction.GG's ratings (2015-16 on), and the yearly program score a school
 * page charts from them.
 *
 * For every season and event (Policy, Lincoln-Douglas, Public Forum) a school
 * keeps its best {@link SCHOOL_SEASON_TEAMS_PER_EVENT} entries by Extinction
 * rank. Finished seasons never change, so the app's server builds that table
 * once per season from its saved Extinction.GG files and serves one school's
 * rows from `/api/rankings/school-seasons` ({@link fetchSchoolSeasons}); the
 * current season comes from the rankings the page has already loaded
 * ({@link schoolSeasonsFromEntries}).
 *
 * {@link schoolSeasonScores} turns those teams plus the school's Tournament
 * of Champions finishes into one score per season, weighted by
 * {@link HS_STRENGTH_WEIGHTS}.
 * @module @debate-ai/rankings/school-seasons
 */

import { EXTINCTION_FIRST_SEASON_YEAR, extinctionEntries, type CombinedDebateData, type DebateFormat } from "./extinction";
import { tocSchoolMatcher, type TocSchoolRecord } from "./sync/toc-champions";
import type { RankingDatasetId, RankingEntry } from "./types";

/** The debate events a high school's seasons are listed and scored by. */
export type SchoolSeasonEvent = "Policy" | "Lincoln-Douglas" | "Public Forum";

/** Each event's Extinction.GG format and rankings dataset, in page order. */
export const SCHOOL_SEASON_FORMATS: readonly {
  format: DebateFormat;
  datasetId: RankingDatasetId;
  event: SchoolSeasonEvent;
}[] = [
  { format: "hspolicy", datasetId: "hscx", event: "Policy" },
  { format: "hsld", datasetId: "hsld", event: "Lincoln-Douglas" },
  { format: "hspf", datasetId: "hspf", event: "Public Forum" },
];

/** How many of a school's entries count per event and season. */
export const SCHOOL_SEASON_TEAMS_PER_EVENT = 2;

/** First season with ranked teams: 2015-16. */
export const SCHOOL_SEASON_FIRST_YEAR = EXTINCTION_FIRST_SEASON_YEAR;

/** One of a school's best entries in an event and season. */
export interface SchoolSeasonTeam {
  /** 1-based rank among every entry Extinction.GG rated that season. */
  rank: number;
  /** Entries ranked that season. */
  fieldSize: number;
  /** `"Last & Last"`, or the LD debater's name. */
  name: string;
  /** TOC bids the entry earned that season. */
  bids: number;
}

/** A school's best entries in one event and season, best first. */
export interface SchoolSeason {
  /** Season year: the year the season ends in (2024-25 is 2025). */
  year: number;
  event: SchoolSeasonEvent;
  teams: SchoolSeasonTeam[];
}

/**
 * The key a school's rows are stored under: its `@handle`, the same as
 * `profileSlug` in the profile helpers (kept in step by a test).
 */
export function schoolSeasonKey(school: string): string {
  return (school ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Season year of a `"YY-YY"` Extinction.GG season code: `"25-26"` → 2026. */
export function schoolSeasonYear(season: string): number {
  return 2000 + Number(season.slice(-2));
}

/**
 * Every school's best entries in one Extinction.GG season, keyed by
 * {@link schoolSeasonKey}.
 *
 * @param data - One format and season, from `getDebateData` or `combineDebateData`.
 */
export function bestTeamsBySchool(
  data: CombinedDebateData,
  perSchool = SCHOOL_SEASON_TEAMS_PER_EVENT,
): Map<string, SchoolSeasonTeam[]> {
  const entries = extinctionEntries(data);
  const best = new Map<string, SchoolSeasonTeam[]>();
  // Entries come ranked, so the first `perSchool` of a school are its best.
  for (const entry of entries) {
    const key = schoolSeasonKey(entry.school);
    if (!key) continue;
    const teams = best.get(key) ?? [];
    if (teams.length >= perSchool) continue;
    teams.push({ rank: entry.rank, fieldSize: entries.length, name: entry.name, bids: entry.tocBids?.length ?? 0 });
    best.set(key, teams);
  }
  return best;
}

/** The event for an Extinction.GG format, if it is one a school page lists. */
export function schoolSeasonEvent(format: DebateFormat): SchoolSeasonEvent | null {
  return SCHOOL_SEASON_FORMATS.find((f) => f.format === format)?.event ?? null;
}

/**
 * A school's best entries in the season the page has loaded, from its rows in
 * the current rankings.
 *
 * @param entries - The school's rows: dataset, field size and entry.
 * @param year - The loaded season's year.
 */
export function schoolSeasonsFromEntries(
  entries: readonly { datasetId: RankingDatasetId; fieldSize: number; entry: Pick<RankingEntry, "rank" | "name" | "tocBids"> }[],
  year: number,
): SchoolSeason[] {
  const seasons: SchoolSeason[] = [];
  for (const { datasetId, event } of SCHOOL_SEASON_FORMATS) {
    const teams = entries
      .filter((row) => row.datasetId === datasetId)
      .sort((a, b) => a.entry.rank - b.entry.rank)
      .slice(0, SCHOOL_SEASON_TEAMS_PER_EVENT)
      .map((row) => ({
        rank: row.entry.rank,
        fieldSize: row.fieldSize,
        name: row.entry.name,
        bids: row.entry.tocBids?.length ?? 0,
      }));
    if (teams.length) seasons.push({ year, event, teams });
  }
  return seasons;
}

// ---------------------------------------------------------------------------
// Score
// ---------------------------------------------------------------------------

/** Points per achievement in a high school's season. Mirrors the college weights. */
export const HS_STRENGTH_WEIGHTS = {
  /** Each counted entry in the top 100: `(101 - rank) / 20`, so #1 is 5 points and #100 is 0.05. */
  rankingDivisor: 20,
  /** Each counted entry that qualified for the TOC (two or more bids). */
  tocQualified: 4,
  /** Bids a TOC qualification takes. */
  qualifyingBids: 2,
  /** TOC finishes in Policy, LD and PF, by place. */
  toc: { Champion: 30, "Co-champion": 30, "Runner-up": 18, "Top speaker": 10 } as Record<string, number>,
};

/** What a high school season's points came from. */
export type SchoolStrengthComponent = "rankings" | "qualified" | "toc";

/** Components in the order the page lists them, with their labels. */
export const SCHOOL_STRENGTH_COMPONENTS: { key: SchoolStrengthComponent; label: string }[] = [
  { key: "toc", label: "TOC finishes" },
  { key: "qualified", label: "TOC qualifiers" },
  { key: "rankings", label: "Top-100 entries" },
];

/** One season of a high school: its score, where it came from and its best entries. */
export interface SchoolStrengthSeason {
  year: number;
  total: number;
  parts: Record<SchoolStrengthComponent, number>;
  /** Points per event. */
  byEvent: Record<SchoolSeasonEvent, number>;
  /** The best entries per event that season. */
  seasons: SchoolSeason[];
}

/** Points for a counted entry at `rank`. */
export function schoolRankingPoints(rank: number): number {
  return rank >= 1 && rank <= 100 ? (101 - rank) / HS_STRENGTH_WEIGHTS.rankingDivisor : 0;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * One score per season from `from` to `to`, zero-filled so gaps show:
 * points for each event's best entries plus the school's TOC finishes in
 * Policy, LD and PF that season.
 *
 * @param seasons - The school's best entries, any order.
 * @param toc - The school's TOC record, if it has one.
 */
export function schoolSeasonScores(
  seasons: readonly SchoolSeason[],
  toc: Pick<TocSchoolRecord, "results"> | null,
  from: number,
  to: number,
): SchoolStrengthSeason[] {
  const out: SchoolStrengthSeason[] = [];
  const events = new Set<string>(SCHOOL_SEASON_FORMATS.map((f) => f.event));
  for (let year = from; year <= to; year++) {
    const season: SchoolStrengthSeason = {
      year,
      total: 0,
      parts: { rankings: 0, qualified: 0, toc: 0 },
      byEvent: { Policy: 0, "Lincoln-Douglas": 0, "Public Forum": 0 },
      seasons: SCHOOL_SEASON_FORMATS.flatMap(({ event }) =>
        seasons.filter((s) => s.year === year && s.event === event).slice(0, 1),
      ),
    };
    const add = (event: SchoolSeasonEvent, part: SchoolStrengthComponent, points: number) => {
      season.parts[part] += points;
      season.byEvent[event] += points;
      season.total += points;
    };
    for (const { event, teams } of season.seasons) {
      for (const team of teams) {
        add(event, "rankings", schoolRankingPoints(team.rank));
        if (team.bids >= HS_STRENGTH_WEIGHTS.qualifyingBids) add(event, "qualified", HS_STRENGTH_WEIGHTS.tocQualified);
      }
    }
    for (const result of toc?.results ?? []) {
      if (result.year !== year || !events.has(result.event)) continue;
      add(result.event as SchoolSeasonEvent, "toc", HS_STRENGTH_WEIGHTS.toc[result.place] ?? 0);
    }
    season.total = round1(season.total);
    for (const key of Object.keys(season.parts) as SchoolStrengthComponent[]) season.parts[key] = round1(season.parts[key]);
    for (const key of Object.keys(season.byEvent) as SchoolSeasonEvent[]) season.byEvent[key] = round1(season.byEvent[key]);
    out.push(season);
  }
  return out;
}

/** TOC points per season from a school's record (Policy, LD and PF only). */
export function tocSeasonPoints(toc: Pick<TocSchoolRecord, "results">): Map<number, number> {
  const events = new Set<string>(SCHOOL_SEASON_FORMATS.map((f) => f.event));
  const points = new Map<number, number>();
  for (const result of toc.results) {
    if (!events.has(result.event)) continue;
    points.set(result.year, (points.get(result.year) ?? 0) + (HS_STRENGTH_WEIGHTS.toc[result.place] ?? 0));
  }
  return points;
}

/** A school's ranked-entry points in one season, as the server sums them. */
export interface SchoolSeasonPoints {
  /** {@link schoolSeasonKey}. */
  school: string;
  year: number;
  points: number;
}

/** Where one high school stands over a span of seasons. */
export interface SchoolStrengthRank {
  /** 1-based; schools with equal scores share a rank. */
  rank: number;
  score: number;
  /** Schools that scored in the span. */
  of: number;
}

/**
 * Every high school's score per season: its ranked-entry points plus its TOC
 * finishes. A TOC school that never had a ranked entry is its own row, keyed
 * `toc:<name>`.
 *
 * @param rows - Ranked-entry points per school and season.
 * @param tocRecords - TOC records to match by school key.
 */
export function schoolStrengthTable(
  rows: readonly SchoolSeasonPoints[],
  tocRecords?: TocSchoolRecord[],
): Map<string, Map<number, number>> {
  const table = new Map<string, Map<number, number>>();
  const add = (key: string, year: number, points: number) => {
    if (!points) return;
    const seasons = table.get(key) ?? new Map<number, number>();
    table.set(key, seasons);
    seasons.set(year, (seasons.get(year) ?? 0) + points);
  };
  for (const row of rows) add(row.school, row.year, row.points);

  const match = tocSchoolMatcher(tocRecords);
  const matched = new Set<TocSchoolRecord>();
  for (const key of [...table.keys()]) {
    const record = match(key.replace(/-/g, " "));
    if (!record || matched.has(record)) continue;
    matched.add(record);
    for (const [year, points] of tocSeasonPoints(record)) add(key, year, points);
  }
  for (const record of tocRecords ?? []) {
    if (matched.has(record)) continue;
    for (const [year, points] of tocSeasonPoints(record)) add(`toc:${record.school}`, year, points);
  }
  return table;
}

/**
 * Rank of school `key` among every school scoring over `from`–`to`
 * (inclusive), or `null` when it scored nothing then.
 */
export function rankSchoolStrength(
  table: Map<string, Map<number, number>>,
  key: string,
  from = -Infinity,
  to = Infinity,
): SchoolStrengthRank | null {
  const score = (seasons: Map<number, number>) => {
    let total = 0;
    for (const [year, points] of seasons) if (year >= from && year <= to) total += points;
    return round1(total);
  };
  const own = table.get(key);
  const ownScore = own ? score(own) : 0;
  if (!ownScore) return null;
  let of = 0;
  let above = 0;
  for (const seasons of table.values()) {
    const s = score(seasons);
    if (s <= 0) continue;
    of++;
    if (s > ownScore) above++;
  }
  return { rank: above + 1, score: ownScore, of };
}

/**
 * {@link rankSchoolStrength} for every school at once: one sort per span.
 * Schools that scored nothing in the span are left out.
 */
export function rankAllSchoolStrengths(
  table: Map<string, Map<number, number>>,
  from = -Infinity,
  to = Infinity,
): Map<string, SchoolStrengthRank> {
  const scores: { key: string; score: number }[] = [];
  for (const [key, seasons] of table) {
    let total = 0;
    for (const [year, points] of seasons) if (year >= from && year <= to) total += points;
    const score = round1(total);
    if (score > 0) scores.push({ key, score });
  }
  scores.sort((a, b) => b.score - a.score);
  const ranks = new Map<string, SchoolStrengthRank>();
  let rank = 0;
  scores.forEach(({ key, score }, i) => {
    if (i === 0 || score < scores[i - 1].score) rank = i + 1;
    ranks.set(key, { rank, score, of: scores.length });
  });
  return ranks;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/** Same-origin route serving one school's finished seasons. */
export const SCHOOL_SEASONS_PATH = "/api/rankings/school-seasons";

/** Body of {@link SCHOOL_SEASONS_PATH}. */
export interface SchoolSeasonsResponse {
  school: string;
  seasons: SchoolSeason[];
  /**
   * The school's rank among every high school over all finished seasons (TOC
   * results back to 1972, rankings from 2015-16) and the last ten seasons;
   * precomputed daily, so while seasons are still pending they cover only the
   * seasons built so far.
   */
  ranks?: { allTime: SchoolStrengthRank | null; decade: SchoolStrengthRank | null; decadeFrom: number };
  /** Finished seasons that failed to build last time, with why. */
  failures?: { format: string; year: number; error: string }[];
  /** Finished seasons the server has not built yet; ask again to get them. */
  pending: number;
}

/** What {@link fetchSchoolSeasons} resolves with. */
export interface SchoolSeasonsResult {
  seasons: SchoolSeason[];
  ranks: SchoolSeasonsResponse["ranks"] | null;
  /** Finished seasons still unbuilt when loading stopped. */
  pending: number;
}

const loads = new Map<string, Promise<SchoolSeasonsResult>>();

/**
 * One school's best entries for every finished season. The server builds
 * missing seasons a few per request, so this asks again (up to a limit) while
 * any are pending, and resolves with whatever it has by then.
 *
 * @param school - School name or `@handle`.
 */
export function fetchSchoolSeasons(school: string, maxRequests = 12): Promise<SchoolSeasonsResult> {
  const key = schoolSeasonKey(school);
  let pending = loads.get(key);
  if (!pending) {
    pending = (async () => {
      let result: SchoolSeasonsResult = { seasons: [], ranks: null, pending: 0 };
      for (let attempt = 0; attempt < maxRequests; attempt++) {
        const res = await fetch(`${SCHOOL_SEASONS_PATH}?school=${encodeURIComponent(key)}`);
        if (!res.ok) throw new Error(`School seasons failed: ${res.status}`);
        const body = (await res.json()) as SchoolSeasonsResponse;
        result = { seasons: body.seasons ?? [], ranks: body.ranks ?? null, pending: body.pending ?? 0 };
        // Seasons that keep failing wait for the daily rebuild instead of more requests.
        if (!body.pending || body.pending <= (body.failures?.length ?? 0)) break;
      }
      return result;
    })();
    loads.set(key, pending);
    pending.catch(() => loads.delete(key));
  }
  return pending;
}
