/**
 * @fileoverview All-time Parli (parliamentary) rankings: the greatest
 * National Parliamentary Debate League teams and schools since the league's
 * first ranked season (2017-18), scored by the same program-strength formula
 * the high school events use for their all-time Schools list
 * ({@link module:school-seasons}).
 *
 * Each season a school keeps its best {@link SCHOOL_SEASON_TEAMS_PER_EVENT}
 * entries by published rank, and an entry in the top 100 scores
 * {@link schoolRankingPoints} (`(101 - rank) / 20`, so #1 is 5 points and #100
 * is 0.05). A school's all-time score is the sum over seasons, rounded and
 * ranked by {@link rankAllSchoolStrengths} (equal scores share a rank), exactly
 * as for Policy, LD and PF. A team (the pair, at one school, across every
 * season it was ranked) scores the same per-entry points. The league has no
 * TOC, NDCA or other national-finish records in the app, so those components
 * of the high school score are absent for Parli.
 * @module sync/npdl-all-time
 */

import {
  SCHOOL_SEASON_TEAMS_PER_EVENT,
  rankAllSchoolStrengths,
  schoolRankingPoints,
  schoolSeasonKey,
} from "../school-seasons";
import { npdlSeasonEndYear, type NpdlRankingRow, type NpdlSeasonRankings } from "./sync-npdl-rankings";

/** How many teams and schools each all-time list keeps. */
export const NPDL_ALL_TIME_COUNT = 100;

/** Same-origin route serving the all-time lists. */
export const NPDL_ALL_TIME_PATH = "/api/rankings/npdl/all-time";

/** One team in the all-time Parli list. */
export interface NpdlAllTimeTeam {
  /** 1-based; equal scores share a rank. */
  rank: number;
  school: string;
  /** `"Chien & Suto"`: the two debaters' names as the sheet gives them. */
  debaters: string;
  /** All-time points: {@link schoolRankingPoints} summed over the seasons ranked. */
  score: number;
  /** Seasons the team scored in. */
  seasons: number;
  /** Season years (the year each season ends in) of the first and last seasons scored. */
  firstYear: number;
  lastYear: number;
  /** Best published rank in any season. */
  bestRank: number;
  /** Seasons the team finished #1 nationally. */
  firstPlaces: number;
}

/** One school in the all-time Parli list. */
export interface NpdlAllTimeSchool {
  /** 1-based; equal scores share a rank. */
  rank: number;
  school: string;
  /** All-time program points: its best entries' {@link schoolRankingPoints} summed over the seasons. */
  score: number;
  /** Seasons the school scored in. */
  seasons: number;
  /** Best published rank of any of its entries in any season. */
  bestRank: number;
  /** Seasons its best entry finished #1 nationally. */
  firstPlaces: number;
}

/** Body of {@link NPDL_ALL_TIME_PATH}. */
export interface NpdlAllTimeResponse {
  /** Seasons the lists cover, newest first (`"2024-25"`). */
  seasons: string[];
  teams: NpdlAllTimeTeam[];
  schools: NpdlAllTimeSchool[];
  /** `"database"` when every season came from D1, `"snapshot"` when any came from the bundled file. */
  source: "database" | "snapshot";
}

const round1 = (value: number) => Math.round(value * 10) / 10;

const nameKey = (name: string) => name.toLowerCase().replace(/[^a-z]/g, "");

/** `"Chien & Suto"`, or `null` for a row with no debater names. */
function pairNames(row: Pick<NpdlRankingRow, "debater1" | "debater2">): string | null {
  const names = [row.debater1, row.debater2].map((n) => n?.trim()).filter((n): n is string => Boolean(n));
  return names.length ? names.join(" & ") : null;
}

interface TeamBuilding {
  school: string;
  /** Spelling of the newest season seen. */
  debaters: string;
  newestYear: number;
  points: Map<number, number>;
  ranks: Map<number, number>;
}

interface SchoolBuilding {
  school: string;
  newestYear: number;
  /** The best entries' ranks per season year, best first. */
  entries: Map<number, number[]>;
}

/**
 * The all-time Parli teams and schools over the given seasons.
 *
 * @param seasons - Season rankings by season (`"2024-25"`); seasons with no team rows are skipped.
 * @param options.lastYear - Last season year (the year a season ends in) to count; later seasons are unfinished and left out.
 * @param options.count - Rows per list ({@link NPDL_ALL_TIME_COUNT}).
 */
export function buildNpdlAllTime(
  seasons: Readonly<Record<string, NpdlSeasonRankings | null | undefined>>,
  { lastYear = Infinity, count = NPDL_ALL_TIME_COUNT }: { lastYear?: number; count?: number } = {},
): Pick<NpdlAllTimeResponse, "seasons" | "teams" | "schools"> {
  const counted = Object.keys(seasons)
    .filter((season) => (seasons[season]?.teams.length ?? 0) > 0 && Number(npdlSeasonEndYear(season)) <= lastYear)
    .sort((a, b) => Number(npdlSeasonEndYear(b)) - Number(npdlSeasonEndYear(a)));

  const teams = new Map<string, TeamBuilding>();
  const schools = new Map<string, SchoolBuilding>();

  for (const season of counted) {
    const year = Number(npdlSeasonEndYear(season));
    const seasonTeams = [...seasons[season]!.teams].sort((a, b) => a.rank - b.rank);
    const perSchool = new Map<string, number>();
    for (const row of seasonTeams) {
      const schoolKey = schoolSeasonKey(row.school);
      if (!schoolKey) continue;

      const building = schools.get(schoolKey) ?? { school: row.school.trim(), newestYear: year, entries: new Map() };
      if (year > building.newestYear) {
        building.newestYear = year;
        building.school = row.school.trim();
      }
      const kept = building.entries.get(year) ?? [];
      if (kept.length < SCHOOL_SEASON_TEAMS_PER_EVENT) {
        kept.push(row.rank);
        building.entries.set(year, kept);
      }
      schools.set(schoolKey, building);
      perSchool.set(schoolKey, (perSchool.get(schoolKey) ?? 0) + 1);

      const debaters = pairNames(row);
      if (!debaters) continue;
      const surnames = debaters
        .split(" & ")
        .map(nameKey)
        .sort()
        .join("+");
      const teamKey = `${schoolKey}|${surnames}`;
      const team =
        teams.get(teamKey) ??
        ({ school: row.school.trim(), debaters, newestYear: year, points: new Map(), ranks: new Map() } satisfies TeamBuilding);
      if (year > team.newestYear) {
        team.newestYear = year;
        team.debaters = debaters;
        team.school = row.school.trim();
      }
      // Rows come best first, so a team listed twice in a season keeps its better entry.
      if (!team.ranks.has(year)) {
        team.ranks.set(year, row.rank);
        team.points.set(year, schoolRankingPoints(row.rank));
      }
      teams.set(teamKey, team);
    }
  }

  const table = new Map<string, Map<number, number>>();
  for (const [key, building] of schools) {
    const points = new Map<number, number>();
    for (const [year, ranks] of building.entries) {
      const sum = ranks.reduce((total, rank) => total + schoolRankingPoints(rank), 0);
      if (sum) points.set(year, sum);
    }
    if (points.size) table.set(key, points);
  }

  const ranked = rankAllSchoolStrengths(table, -Infinity, lastYear);
  const schoolRows: NpdlAllTimeSchool[] = [...ranked]
    .sort((a, b) => a[1].rank - b[1].rank || a[0].localeCompare(b[0]))
    .slice(0, count)
    .map(([key, rank]) => {
      const building = schools.get(key)!;
      const bests = [...building.entries.values()].map((ranks) => Math.min(...ranks));
      return {
        rank: rank.rank,
        school: building.school,
        score: rank.score,
        seasons: table.get(key)!.size,
        bestRank: Math.min(...bests),
        firstPlaces: bests.filter((best) => best === 1).length,
      };
    });

  const teamRows = [...teams.values()]
    .map((team) => {
      const years = [...team.points.keys()];
      const scored = years.filter((year) => team.points.get(year)! > 0);
      const ranks = [...team.ranks.values()];
      return {
        school: team.school,
        debaters: team.debaters,
        score: round1(years.reduce((sum, year) => sum + team.points.get(year)!, 0)),
        seasons: scored.length,
        firstYear: Math.min(...years),
        lastYear: Math.max(...years),
        bestRank: Math.min(...ranks),
        firstPlaces: ranks.filter((rank) => rank === 1).length,
      };
    })
    .filter((team) => team.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.bestRank - b.bestRank ||
        b.lastYear - a.lastYear ||
        a.debaters.localeCompare(b.debaters),
    )
    .slice(0, count)
    .map((team): NpdlAllTimeTeam => ({ ...team, rank: 0 }));
  // Equal scores share a rank, as for schools (the list is sorted by score first).
  teamRows.forEach((team, i) => {
    team.rank = i > 0 && teamRows[i - 1].score === team.score ? teamRows[i - 1].rank : i + 1;
  });

  return { seasons: counted, teams: teamRows, schools: schoolRows };
}
