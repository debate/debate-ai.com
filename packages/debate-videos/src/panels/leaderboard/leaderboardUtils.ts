/**
 * @fileoverview Utility functions and display constants for the leaderboard panel.
 * Types live in {@link leaderboardTypes}; this module re-exports them so existing
 * importers continue to work without changes.
 * @module components/debate/DebateVideos/panels/leaderboardUtils
 */

import { normalizeSchool } from "debate-rankings-adapter";
import type { RankingDataset, RankingDatasetId, RankingEntry } from "debate-rankings-adapter";
import type { SeasonalTopic } from "../../lib/debate-topics";
import type {
  Division,
  LeaderboardTab,
  SchoolRanking,
  SchoolSortState,
  SortKey,
  SortState,
  YearData,
} from "./leaderboardTypes";

// Re-export all types and the VALID_DIVISIONS set for backward compatibility.
export type {
  Division,
  SortKey,
  SortDir,
  SortState,
  YearData,
  DebateHistory,
  LeaderboardPanelProps,
  LeaderboardTab,
  SchoolRanking,
  SchoolSortKey,
  SchoolSortState,
} from "./leaderboardTypes";
export { VALID_DIVISIONS, VALID_LEADERBOARD_TABS } from "./leaderboardTypes";

// ---------------------------------------------------------------------------
// Division config
// ---------------------------------------------------------------------------

/**
 * Per-division display metadata: label text, data field keys for the champion
 * banner, and the logo image path.
 */
export const DIVISION_CONFIG: {
  value: Division;
  label: string;
  topicKey: keyof YearData;
  topicNameKey?: keyof YearData;
  championKey: keyof YearData;
  logoSrc: string;
  /**
   * `debate-rankings` datasets for this division, first one shown by default.
   * More than one renders a scope switcher (LD's full season vs. Sep–Oct topic).
   */
  datasets: RankingDatasetId[];
}[] = [
  {
    value: "VPF",
    label: "Public Forum",
    topicKey: "pf_topics",
    championKey: "pf_champion",
    logoSrc: "https://i.imgur.com/92V0FBF.png",
    datasets: ["hspf"],
  },
  {
    value: "VLD",
    label: "LD",
    topicKey: "ld_topics",
    championKey: "ld_champion",
    logoSrc: "https://i.imgur.com/3xFjCvO.png",
    datasets: ["hsld", "hsld_sepoct"],
  },
  {
    value: "VCX",
    label: "Policy",
    topicKey: "policy_topic",
    topicNameKey: "policy_topic_name",
    championKey: "policy_champion",
    logoSrc: "https://i.imgur.com/CMuiSKj.png",
    datasets: ["hscx"],
  },
  {
    value: "NDT",
    label: "College NDT",
    topicKey: "ndt_topic",
    topicNameKey: "ndt_topic_name",
    championKey: "ndt_champion",
    logoSrc: "https://i.imgur.com/cFmTAdJ.png",
    datasets: ["cpd"],
  },
];

/**
 * Every tab of the rankings page, in display order: the four divisions
 * followed by the Schools table.
 */
export const LEADERBOARD_TABS: { value: LeaderboardTab; label: string }[] = [
  ...DIVISION_CONFIG.map(({ value, label }) => ({ value, label })),
  { value: "SCHOOLS", label: "Schools" },
];

/** Short event label for each division, used in the Schools table. */
export const DIVISION_SHORT_LABELS: Record<Division, string> = {
  VPF: "PF",
  VLD: "LD",
  VCX: "Policy",
  NDT: "NDT",
};

/**
 * Datasets the Schools table rolls up: each division's full-season rankings
 * (LD's Sep–Oct slice would count its debaters twice), in display order.
 */
export const SCHOOL_DATASETS: { division: Division; datasetId: RankingDatasetId }[] =
  DIVISION_CONFIG.map(({ value, datasets }) => ({ division: value, datasetId: datasets[0] }));

/**
 * Season year (the year a season ends in) for `now`. Seasons roll over on
 * July 1: from then on the upcoming season is current, so September 2026 is
 * the 2026-27 season, `2027`.
 *
 * @param now - Date to evaluate; defaults to the current time.
 */
export function currentSeasonYear(now: Date = new Date()): number {
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
}

/**
 * Selectable season years, newest (the current season) first, back to 2002.
 *
 * @param now - Date to evaluate; defaults to the current time.
 */
export function seasonYears(now: Date = new Date()): string[] {
  const maxYear = currentSeasonYear(now);
  return Array.from({ length: maxYear - 2001 }, (_, i) => String(maxYear - i));
}

/**
 * Display label for a season year: `"2027"` becomes `"2026-27"`.
 *
 * @param year - Season year (the year the season ends in).
 */
export function seasonLabel(year: string | number): string {
  const end = Number(year);
  return `${end - 1}-${String(end % 100).padStart(2, "0")}`;
}

/**
 * Resolves the banner topic for a division/year, including the legacy
 * `ld_topic` / `pf_topic` HTML strings from older debate-topics.json.
 */
export function resolveDivisionTopic(
  yearData: YearData | undefined,
  division: Division,
): string | SeasonalTopic[] | undefined {
  if (!yearData) return undefined;
  const config = DIVISION_CONFIG.find((d) => d.value === division);
  if (!config) return undefined;
  const current = yearData[config.topicKey];
  if (Array.isArray(current) && current.length > 0) return current;
  if (typeof current === "string" && current) return current;
  if (division === "VPF" && yearData.pf_topic) return yearData.pf_topic;
  if (division === "VLD" && yearData.ld_topic) return yearData.ld_topic;
  return undefined;
}

/**
 * The `debate-rankings` datasets behind `division`, per {@link DIVISION_CONFIG}.
 * Empty for an unrecognized value.
 */
export function divisionDatasets(division: Division): RankingDatasetId[] {
  return DIVISION_CONFIG.find((d) => d.value === division)?.datasets ?? [];
}

/**
 * Returns true if the division has a live per-team leaderboard dataset.
 * NDT and VCX only show historical champions.
 */
export function hasLiveLeaderboard(division: Division): boolean {
  return division === "VPF" || division === "VLD";
}

/**
 * Header tooltips for the columns of `output/<prefix>full_rankings.csv`,
 * describing how `debate-rankings/src/main.py` computes each one.
 */
export const COLUMN_TOOLTIPS: Partial<Record<SortKey, string>> = {
  rank: "Position by adjusted rating.",
  adjustedRating:
    "Rating − 2 × Deviation. A conservative Glicko-2 estimate that keeps entries with only a few rounds from topping the list; ranks are sorted on it.",
  matches: "Rated matches played. Rounds at major tournaments count twice.",
  affWinRate: "Share of rounds won on the affirmative (Pro in PF).",
  negWinRate: "Share of rounds won on the negative (Con in PF).",
  affElimWinRate: "Share of elimination rounds won on the affirmative.",
  negElimWinRate: "Share of elimination rounds won on the negative.",
};

/**
 * Tooltip text for the Elo column.
 */
export const ELO_TOOLTIP =
  "Glicko-2 rating adjusted for the debate field. Higher values indicate stronger teams. Rounds at major tournaments count twice toward the rating.";

/**
 * Checks if a value is present and not a placeholder.
 */
export function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "--" && value !== "";
}

/**
 * Converts a value to a number, returning 0 if not a valid number.
 */
export function getNumericValue(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

/**
 * Returns a sorted copy of `entries` according to `sort`. Text columns sort
 * alphabetically; `null` win rates (no rounds on that side) always sort last
 * regardless of direction.
 *
 * @param entries - Rankings rows to sort.
 * @param sort - Active sort state, or `null` to return entries unsorted.
 */
export function sortEntries(
  entries: RankingEntry[],
  sort: SortState,
): RankingEntry[] {
  if (!sort) return entries;
  const { key, dir } = sort;
  const mul = dir === "asc" ? 1 : -1;

  return [...entries].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    if (typeof av === "string" || typeof bv === "string") {
      return mul * String(av).localeCompare(String(bv));
    }
    return mul * (av - bv);
  });
}

/**
 * Case-insensitive filter on school or name.
 *
 * @param entries - Rankings rows.
 * @param query - Free-text query; blank returns `entries` unchanged.
 */
export function filterEntries(
  entries: RankingEntry[],
  query: string,
): RankingEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(
    (e) => e.name.toLowerCase().includes(q) || e.school.toLowerCase().includes(q),
  );
}

/** Generational suffixes kept attached to the surname ("Smith Jr."). */
const NAME_SUFFIXES = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "v"]);

/**
 * Reduces a full debater name ("Jane Smith") to the surname ("Smith").
 * Names joined with `&` are shortened one by one.
 *
 * @param name - Name as it appears in the rankings CSV.
 */
export function lastName(name: string): string {
  return name
    .split("&")
    .map((part) => {
      const words = part.trim().split(/\s+/).filter(Boolean);
      if (words.length <= 1) return words.join("");
      const last = words[words.length - 1];
      if (words.length > 2 && NAME_SUFFIXES.has(last.toLowerCase())) {
        return `${words[words.length - 2]} ${last}`;
      }
      return last;
    })
    .join(" & ");
}

/**
 * Name shown in the rankings table: LD entries show only the debater's last
 * name; team divisions already list surnames and are left as-is.
 *
 * @param name - Name as it appears in the rankings CSV.
 * @param division - Active division.
 */
export function displayEntryName(name: string, division: Division): string {
  return division === "VLD" ? lastName(name) : name;
}

/**
 * Rolls ranked entries up by school. Spellings that {@link normalizeSchool}
 * treats as the same school are merged, and the table shows the spelling most
 * entries use. Schools rank by their best entry's adjusted rating, ties broken
 * by the average adjusted rating across all of the school's entries.
 *
 * @param groups - Each dataset's entries with the short event label to show for it.
 */
export function aggregateSchools(
  groups: { event: string; entries: RankingEntry[] }[],
): SchoolRanking[] {
  type Acc = {
    spellings: Map<string, number>;
    best: RankingEntry;
    bestEvent: string;
    total: number;
    teams: number;
    events: string[];
  };
  const bySchool = new Map<string, Acc>();

  for (const { event, entries } of groups) {
    for (const entry of entries) {
      const school = entry.school.trim();
      const key = normalizeSchool(school);
      if (!key) continue;
      let acc = bySchool.get(key);
      if (!acc) {
        acc = { spellings: new Map(), best: entry, bestEvent: event, total: 0, teams: 0, events: [] };
        bySchool.set(key, acc);
      }
      acc.spellings.set(school, (acc.spellings.get(school) ?? 0) + 1);
      if (entry.adjustedRating > acc.best.adjustedRating) {
        acc.best = entry;
        acc.bestEvent = event;
      }
      acc.total += entry.adjustedRating;
      acc.teams += 1;
      if (!acc.events.includes(event)) acc.events.push(event);
    }
  }

  const rows = [...bySchool.values()].map((acc) => {
    const school = [...acc.spellings].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    return {
      rank: 0,
      school,
      bestRating: acc.best.adjustedRating,
      bestEntry: acc.best.name,
      bestEvent: acc.bestEvent,
      avgRating: acc.total / acc.teams,
      teams: acc.teams,
      events: acc.events,
    };
  });
  rows.sort(
    (a, b) =>
      b.bestRating - a.bestRating || b.avgRating - a.avgRating || a.school.localeCompare(b.school),
  );
  rows.forEach((row, i) => {
    row.rank = i + 1;
  });
  return rows;
}

/**
 * Builds the Schools table rows from loaded datasets, limited to `scope`.
 *
 * @param datasets - Loaded full-season dataset per division (missing ones are skipped).
 * @param scope - `"all"` for every division, or one division.
 */
export function schoolRankingsFor(
  datasets: Partial<Record<Division, RankingDataset>>,
  scope: "all" | Division,
): SchoolRanking[] {
  return aggregateSchools(
    SCHOOL_DATASETS.filter(({ division }) => scope === "all" || scope === division).flatMap(
      ({ division }) => {
        const dataset = datasets[division];
        return dataset ? [{ event: DIVISION_SHORT_LABELS[division], entries: dataset.entries }] : [];
      },
    ),
  );
}

/**
 * Returns a sorted copy of the Schools table rows.
 *
 * @param rows - Rows from {@link aggregateSchools}.
 * @param sort - Active sort state.
 */
export function sortSchools(rows: SchoolRanking[], sort: SchoolSortState): SchoolRanking[] {
  const { key, dir } = sort;
  const mul = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (typeof av === "string" || typeof bv === "string") {
      return mul * String(av).localeCompare(String(bv));
    }
    return mul * (av - bv);
  });
}

/**
 * Case-insensitive filter on school name or its best entry's name.
 *
 * @param rows - Schools table rows.
 * @param query - Free-text query; blank returns `rows` unchanged.
 */
export function filterSchools(rows: SchoolRanking[], query: string): SchoolRanking[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (r) => r.school.toLowerCase().includes(q) || r.bestEntry.toLowerCase().includes(q),
  );
}
