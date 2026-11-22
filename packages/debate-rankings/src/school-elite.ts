/**
 * @fileoverview The high school "Top 10" per event (Policy, Lincoln-Douglas,
 * Public Forum): the ten programs with the most program-strength points in
 * that event over the last {@link HS_ELITE_RANK_SEASONS} seasons (the last
 * decade), ordered by those points so #1 is the decade's leader
 * ({@link schoolStrengthTable}: TOC finishes back to 1972, plus top-100
 * entries and TOC qualifiers from 2015-16 on), and where each ranked among
 * every program in the event season by season, so the Schools tab can draw
 * the same bump chart it draws for the NDT. The chart covers the last
 * {@link HS_ELITE_SEASONS} seasons (twenty years) of available data. A
 * season's rank is by the points over a trailing window of
 * {@link HS_ELITE_WINDOW} seasons (one high school career). Each season also
 * lists what the school did that year (TOC finishes, its best ranked entries)
 * for the tooltip.
 *
 * The app's server builds this from the stored season rows
 * (`/api/rankings/school-elite`), since the ranked entries live in D1.
 * @module @debate-ai/rankings/school-elite
 */

import type {
  EliteAccomplishment,
  EliteSchool,
  EliteSchoolsChart,
  EliteSeason,
} from "./leaderboard/profile/ndtEliteSchools";
import {
  rankAllSchoolStrengths,
  schoolStrengthTable,
  type SchoolSeason,
  type SchoolSeasonEvent,
  type SchoolSeasonPoints,
  type SchoolStrengthRank,
} from "./school-seasons";
import { tocRecordsBySchool, tocSchoolMatcher, type TocSchoolRecord } from "./sync/toc-champions";

/** How many top programs each event's chart follows. */
export const HS_ELITE_COUNT = 10;

/** How many seasons back the chart goes at most, the latest included: the last twenty years. */
export const HS_ELITE_SEASONS = 20;

/** Seasons, the latest included, whose points pick and order the top programs: the last decade. */
export const HS_ELITE_RANK_SEASONS = 10;

/** Seasons in each season's trailing points window: a four-year high school career. */
export const HS_ELITE_WINDOW = 4;

/** Same-origin route serving one event's chart. */
export const SCHOOL_ELITE_PATH = "/api/rankings/school-elite";

/** Body of {@link SCHOOL_ELITE_PATH}. */
export interface SchoolEliteResponse extends EliteSchoolsChart {
  event: SchoolSeasonEvent;
  /** Finished seasons of ranked entries the server has not built yet; the chart covers the rest. */
  pending: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** `"harker"` / `"toc:The Harker School (CA)"`: the name to show. */
function displayName(key: string, record: TocSchoolRecord | null): string {
  if (record) return record.school;
  if (key.startsWith("toc:")) return key.slice(4);
  return key
    .split("-")
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * The TOC record behind each table key, matched exactly as
 * {@link schoolStrengthTable} matches them.
 */
function recordsByKey(
  table: Map<string, Map<number, number>>,
  records: TocSchoolRecord[],
): Map<string, TocSchoolRecord> {
  const match = tocSchoolMatcher(records);
  const byKey = new Map<string, TocSchoolRecord>();
  const matched = new Set<TocSchoolRecord>();
  for (const key of table.keys()) {
    if (key.startsWith("toc:")) continue;
    const record = match(key.replace(/-/g, " "));
    if (!record || matched.has(record)) continue;
    matched.add(record);
    byKey.set(key, record);
  }
  for (const record of records) if (!matched.has(record)) byKey.set(`toc:${record.school}`, record);
  return byKey;
}

/**
 * The table's top programs by points over the decade ending `lastYear`, #1
 * first; equal points fall back to all-time points, then the key.
 */
function topByDecade(
  table: Map<string, Map<number, number>>,
  lastYear: number,
  count: number,
  rankSeasons: number,
): [string, SchoolStrengthRank][] {
  const allTime = rankAllSchoolStrengths(table, -Infinity, lastYear);
  return [...rankAllSchoolStrengths(table, lastYear - rankSeasons + 1, lastYear)]
    .sort(
      (a, b) =>
        a[1].rank - b[1].rank ||
        (allTime.get(a[0])?.rank ?? Infinity) - (allTime.get(b[0])?.rank ?? Infinity) ||
        a[0].localeCompare(b[0]),
    )
    .slice(0, count);
}

/**
 * The event's top programs by points over the last decade up to `lastYear`:
 * the keys the server then loads ranked entries for.
 */
export function hsEliteKeys(
  rows: readonly SchoolSeasonPoints[],
  event: SchoolSeasonEvent,
  lastYear: number,
  count = HS_ELITE_COUNT,
  records: TocSchoolRecord[] = tocRecordsBySchool(),
  rankSeasons = HS_ELITE_RANK_SEASONS,
): string[] {
  const table = schoolStrengthTable(rows, records, event);
  return topByDecade(table, lastYear, count, rankSeasons).map(([key]) => key);
}

/** What a high school did in one event and season, biggest first. */
export function hsEliteAccomplishments(
  event: SchoolSeasonEvent,
  year: number,
  record: TocSchoolRecord | null,
  seasons: readonly SchoolSeason[],
): EliteAccomplishment[] {
  const out: EliteAccomplishment[] = [];
  const toc = (record?.results ?? []).filter((r) => r.event === event && r.year === year);
  for (const r of toc.filter((r) => r.place === "Champion" || r.place === "Co-champion")) {
    out.push({ kind: "title", label: `TOC ${r.place === "Co-champion" ? "co-champion" : "champion"}: ${r.competitors}` });
  }
  for (const r of toc.filter((r) => r.place === "Runner-up")) out.push({ kind: "elim", label: `TOC runner-up: ${r.competitors}` });
  for (const r of toc.filter((r) => r.place === "Top speaker")) out.push({ kind: "speaker", label: `TOC top speaker: ${r.competitors}` });
  const teams = seasons.find((s) => s.year === year && s.event === event)?.teams ?? [];
  for (const team of [...teams].sort((a, b) => a.rank - b.rank)) {
    if (team.rank > 100) continue;
    const bids = team.bids ? ` · ${team.bids} TOC bid${team.bids === 1 ? "" : "s"}` : "";
    out.push({ kind: "entry", label: `#${team.rank} nationally: ${team.name}${bids}` });
  }
  return out;
}

/**
 * Builds one event's Top 10 chart.
 *
 * @param rows - Ranked-entry points per school, season and event (as the server sums them).
 * @param event - The event to chart.
 * @param lastYear - The last finished season.
 * @param teams - The top schools' best entries per season, by key, for the tooltips.
 * @param options.seasons - Seasons back from `lastYear` the chart draws ({@link HS_ELITE_SEASONS}).
 * @param options.rankSeasons - Seasons back from `lastYear` whose points pick and order the programs ({@link HS_ELITE_RANK_SEASONS}).
 * @param options.records - TOC records ({@link tocRecordsBySchool}).
 */
export function buildHsEliteSchools(
  rows: readonly SchoolSeasonPoints[],
  event: SchoolSeasonEvent,
  lastYear: number,
  teams: ReadonlyMap<string, readonly SchoolSeason[]> = new Map(),
  {
    count = HS_ELITE_COUNT,
    seasons = HS_ELITE_SEASONS,
    rankSeasons = HS_ELITE_RANK_SEASONS,
    window = HS_ELITE_WINDOW,
    records = tocRecordsBySchool(),
  }: { count?: number; seasons?: number; rankSeasons?: number; window?: number; records?: TocSchoolRecord[] } = {},
): EliteSchoolsChart {
  const table = schoolStrengthTable(rows, records, event);
  let earliest = Infinity;
  for (const points of table.values()) for (const year of points.keys()) if (year <= lastYear) earliest = Math.min(earliest, year);
  if (!Number.isFinite(earliest)) return { firstYear: 0, lastYear: 0, schools: [] };
  const firstYear = Math.max(earliest, lastYear - seasons + 1);
  const rankFromYear = lastYear - rankSeasons + 1;

  const windowPoints = (points: Map<number, number>, year: number) => {
    let sum = 0;
    for (let y = year - window + 1; y <= year; y++) sum += points.get(y) ?? 0;
    return round2(sum);
  };

  const ranksByYear = new Map<number, Map<string, number>>();
  for (let year = firstYear; year <= lastYear; year++) {
    const scored = [...table]
      .map(([key, points]) => ({ key, points: windowPoints(points, year) }))
      .filter((row) => row.points > 0)
      .sort((a, b) => b.points - a.points);
    const ranks = new Map<string, number>();
    scored.forEach((row, index) => {
      const prev = scored[index - 1];
      ranks.set(row.key, prev && prev.points === row.points ? ranks.get(prev.key)! : index + 1);
    });
    ranksByYear.set(year, ranks);
  }

  const byKey = recordsByKey(table, records);
  const top = topByDecade(table, lastYear, count, rankSeasons);
  const schools = top.map(([key, total], index): EliteSchool => {
    const points = table.get(key)!;
    const record = byKey.get(key) ?? null;
    const own = teams.get(key) ?? [];
    const list: EliteSeason[] = [];
    for (let year = firstYear; year <= lastYear; year++) {
      const ranks = ranksByYear.get(year)!;
      list.push({
        year,
        rank: ranks.get(key) ?? ranks.size + 1,
        windowPoints: windowPoints(points, year),
        seasonPoints: round2(points.get(year) ?? 0),
        accomplishments: hsEliteAccomplishments(event, year, record, own),
      });
    }
    return {
      school: displayName(key, record),
      handle: key.startsWith("toc:") ? undefined : key,
      decadeRank: index + 1,
      total: total.score,
      seasons: list,
    };
  });
  return { firstYear, lastYear, rankFromYear, schools };
}

const loads = new Map<SchoolSeasonEvent, Promise<SchoolEliteResponse>>();

/** One event's chart from {@link SCHOOL_ELITE_PATH}, loaded once per page. */
export function fetchSchoolElite(event: SchoolSeasonEvent): Promise<SchoolEliteResponse> {
  let pending = loads.get(event);
  if (!pending) {
    pending = fetch(`${SCHOOL_ELITE_PATH}?event=${encodeURIComponent(event)}`).then(async (res) => {
      if (!res.ok) throw new Error(`School Top 10 failed: ${res.status}`);
      return (await res.json()) as SchoolEliteResponse;
    });
    loads.set(event, pending);
    pending.catch(() => loads.delete(event));
  }
  return pending;
}
