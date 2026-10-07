/**
 * @fileoverview Pure helpers behind the `/teams/[team]` and `/schools/[school]`
 * profile pages: the URL slugs a rankings row links to, the lookups that turn
 * a slug back into rows across every `debate-rankings` dataset, the stats a
 * school profile aggregates, and the video-search query each profile runs.
 * @module panels/leaderboard/profile/rankingProfileHelpers
 */

import {
  entryInitials,
  findTeamRanking,
  schoolSearchNames,
  teamSearchNames,
  type RankingDataset,
  type RankingDatasetId,
  type RankingEntry,
} from "@debate/rankings-adapter";
import type { DebateStyle } from "../../../types/videos";

/**
 * Lowercase, dash-separated URL segment for a school or team name. Accents are
 * folded to ASCII and every run of other characters becomes one `-`.
 *
 * @param text - School name, or school plus team name.
 */
export function profileSlug(text: string): string {
  return (text ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Slug identifying one team (or LD debater): its school plus its name. */
export function teamSlug(entry: Pick<RankingEntry, "school" | "name">): string {
  return profileSlug(`${entry.school} ${entry.name}`);
}

/** Path of the team profile page for a rankings row. */
export function teamHref(entry: Pick<RankingEntry, "school" | "name">): string {
  return `/teams/${teamSlug(entry)}`;
}

/** Path of the school profile page for a school name. */
export function schoolHref(school: string): string {
  return `/schools/${profileSlug(school)}`;
}

/** One rankings row together with the dataset it was ranked in. */
export interface ProfileEntry {
  datasetId: RankingDatasetId;
  /** Dataset label, e.g. "HS Public Forum". */
  datasetLabel: string;
  /** Number of entries ranked in that dataset. */
  fieldSize: number;
  /** Most rated matches any entry in that dataset played. */
  maxMatches: number;
  entry: RankingEntry;
}

/** Rows of `datasets` matching `predicate`, tagged with their dataset. */
function collect(
  datasets: RankingDataset[],
  predicate: (entry: RankingEntry) => boolean,
): ProfileEntry[] {
  const out: ProfileEntry[] = [];
  for (const dataset of datasets) {
    let maxMatches: number | null = null;
    for (const entry of dataset.entries) {
      if (predicate(entry)) {
        maxMatches ??= dataset.entries.reduce((max, e) => Math.max(max, e.matches), 0);
        out.push({
          datasetId: dataset.id,
          datasetLabel: dataset.label,
          fieldSize: dataset.entries.length,
          maxMatches,
          entry,
        });
      }
    }
  }
  return out;
}

/**
 * Every row whose {@link teamSlug} is `slug`. Usually one; more when the same
 * school and name are ranked in several divisions.
 */
export function findTeamEntries(datasets: RankingDataset[], slug: string): ProfileEntry[] {
  const target = profileSlug(decodeSlug(slug));
  if (!target) return [];
  return collect(datasets, (entry) => teamSlug(entry) === target);
}

/** Every row whose school slugifies to `slug`, across all datasets, best rank first. */
export function findSchoolEntries(datasets: RankingDataset[], slug: string): ProfileEntry[] {
  const target = profileSlug(decodeSlug(slug));
  if (!target) return [];
  return collect(datasets, (entry) => profileSlug(entry.school) === target).sort(
    (a, b) => a.datasetId.localeCompare(b.datasetId) || a.entry.rank - b.entry.rank,
  );
}

/**
 * The team's school in the team's division: every row of that school in the
 * same dataset, the team itself included, for the school-average overlay on a
 * team's radar. Pass the result to {@link schoolDivisionRadarData}.
 *
 * @param item - One of the team's rows, from {@link findTeamEntries}.
 */
export function findSchoolDivisionEntries(datasets: RankingDataset[], item: ProfileEntry): ProfileEntry[] {
  return findSchoolEntries(datasets, profileSlug(item.entry.school)).filter(
    (other) => other.datasetId === item.datasetId,
  );
}

/** A route param may arrive still percent-encoded; a malformed one is used as-is. */
function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug ?? "");
  } catch {
    return slug ?? "";
  }
}

/** Per-division line of a school profile. */
export interface SchoolDivisionSummary {
  datasetId: RankingDatasetId;
  datasetLabel: string;
  fieldSize: number;
  teams: number;
  bestRank: number;
}

/** Aggregate stats shown at the top of a school profile. */
export interface SchoolSummary {
  /** School name as the rankings spell it. */
  school: string;
  teams: number;
  totalMatches: number;
  bestRank: number | null;
  /** Mean adjusted rating across the school's entries. */
  averageAdjustedRating: number | null;
  divisions: SchoolDivisionSummary[];
}

/**
 * Aggregates a school's ranked entries.
 *
 * @param entries - Output of {@link findSchoolEntries}.
 */
export function summarizeSchool(entries: ProfileEntry[]): SchoolSummary {
  const divisions = new Map<RankingDatasetId, SchoolDivisionSummary>();
  let totalMatches = 0;
  let ratingSum = 0;
  let bestRank: number | null = null;

  for (const { datasetId, datasetLabel, fieldSize, entry } of entries) {
    totalMatches += entry.matches;
    ratingSum += entry.adjustedRating;
    if (bestRank === null || entry.rank < bestRank) bestRank = entry.rank;
    const division = divisions.get(datasetId);
    if (division) {
      division.teams += 1;
      division.bestRank = Math.min(division.bestRank, entry.rank);
    } else {
      divisions.set(datasetId, { datasetId, datasetLabel, fieldSize, teams: 1, bestRank: entry.rank });
    }
  }

  return {
    school: entries[0]?.entry.school ?? "",
    teams: entries.length,
    totalMatches,
    bestRank,
    averageAdjustedRating: entries.length ? ratingSum / entries.length : null,
    divisions: [...divisions.values()],
  };
}

/** Video library style (1 Policy, 2 PF, 3 LD, 4 College) each rankings dataset covers. */
const DATASET_VIDEO_STYLE: Record<string, DebateStyle> = {
  hscx: 1,
  hspf: 2,
  hsld: 3,
  hsld_sepoct: 3,
  cpd: 4,
};

/**
 * Full-season dataset each video style is ranked in — the reverse of
 * {@link DATASET_VIDEO_STYLE}, leaving out the Sep–Oct LD slice so a team is
 * matched against the whole season.
 */
const VIDEO_STYLE_DATASET: Record<number, RankingDatasetId> = {
  1: "hscx",
  2: "hspf",
  3: "hsld",
  4: "cpd",
};

/** The full-season dataset a round of `style` is ranked in, or `null` for a lecture. */
export function videoStyleDatasetId(style: unknown): RankingDatasetId | null {
  return typeof style === "number" ? (VIDEO_STYLE_DATASET[style] ?? null) : null;
}

/**
 * The rankings row behind a round video's aff or neg team label, looked up in
 * the dataset for the round's style. `null` when the style has no dataset,
 * that dataset is not among `datasets`, or no entry matches the label (see
 * `findTeamRanking` for how loosely the school and initials match).
 *
 * @param datasets - Loaded datasets, e.g. from `useAllRankingDatasets`.
 * @param style - The video's style (`video[6]`).
 * @param label - The video's aff or neg team, e.g. `"Harker LL"`.
 */
export function findVideoTeamRanking(
  datasets: readonly RankingDataset[],
  style: unknown,
  label: string | null | undefined,
): RankingEntry | null {
  const id = videoStyleDatasetId(style);
  if (!id || !label?.trim()) return null;
  const dataset = datasets.find((d) => d.id === id);
  return dataset ? findTeamRanking(dataset.entries, label) : null;
}

/** What a profile's Videos section searches for. */
export interface ProfileVideoSearch {
  /** Phrases matched against a round's aff/neg team, or its title when it has none. */
  competitors: string[];
  /** Only rounds in the divisions the team or school is ranked in. */
  styles: DebateStyle[];
  /** Shown as "N matching …". */
  label: string;
}

/** Video styles of the divisions `entries` are ranked in, in ascending order. */
function profileStyles(entries: Pick<ProfileEntry, "datasetId">[]): DebateStyle[] {
  const styles = new Set<DebateStyle>();
  for (const { datasetId } of entries) {
    const style = DATASET_VIDEO_STYLE[datasetId];
    if (style) styles.add(style);
  }
  return [...styles].sort((a, b) => a - b);
}

/**
 * Video search for a team: rounds whose aff or neg team is the team's school
 * plus its initials (`"Strake Jesuit FS"`), in the divisions it is ranked in.
 *
 * @param entries - Output of {@link findTeamEntries}; the first row names the team.
 */
export function teamVideoSearch(entries: ProfileEntry[]): ProfileVideoSearch {
  const entry = entries[0]?.entry;
  if (!entry) return { competitors: [], styles: [], label: "" };
  return {
    competitors: teamSearchNames(entry),
    styles: profileStyles(entries),
    label: `${entry.school} ${entryInitials(entry.name)}`.trim(),
  };
}

/**
 * Video search for a school: rounds whose aff or neg team is from the school,
 * in the divisions it has ranked entries in.
 *
 * @param school - School as the rankings spell it.
 * @param entries - Output of {@link findSchoolEntries}.
 */
export function schoolVideoSearch(school: string, entries: ProfileEntry[]): ProfileVideoSearch {
  return { competitors: schoolSearchNames(school), styles: profileStyles(entries), label: school };
}

/** One spoke of a team's radar chart. */
export interface TeamRadarPoint {
  /** Axis label. */
  metric: string;
  /** Position on the spoke, 0 (center) to 100 (edge); higher is better. */
  score: number;
  /** The real value, as shown in the tooltip. */
  display: string;
}

const radarPercent = (n: number | null) =>
  n === null ? "no rounds" : `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

/**
 * The six spokes of a team's radar chart, each scaled to 0–100 so they share
 * one axis: the four win rates as-is (a side with no rounds sits at 0), rank as
 * a field percentile (1st is 100, last is 0), and matches relative to the
 * busiest entry in the same division.
 *
 * @param item - One of the team's rows, from {@link findTeamEntries}.
 */
export function teamRadarData(item: ProfileEntry): TeamRadarPoint[] {
  const { entry, fieldSize, maxMatches } = item;
  const clamp = (n: number) => Math.min(100, Math.max(0, n));
  const rankScore = fieldSize <= 1 ? 100 : ((fieldSize - entry.rank) / (fieldSize - 1)) * 100;
  return [
    { metric: "Aff win", score: clamp(entry.affWinRate ?? 0), display: radarPercent(entry.affWinRate) },
    { metric: "Neg win", score: clamp(entry.negWinRate ?? 0), display: radarPercent(entry.negWinRate) },
    {
      metric: "Elim neg",
      score: clamp(entry.negElimWinRate ?? 0),
      display: radarPercent(entry.negElimWinRate),
    },
    {
      metric: "Elim aff",
      score: clamp(entry.affElimWinRate ?? 0),
      display: radarPercent(entry.affElimWinRate),
    },
    { metric: "Ranking", score: clamp(rankScore), display: `#${entry.rank} of ${fieldSize}` },
    {
      metric: "Matches",
      score: clamp(maxMatches > 0 ? (entry.matches / maxMatches) * 100 : 0),
      display: `${entry.matches} of ${maxMatches} max`,
    },
  ];
}

const WIN_RATE_KEYS = ["affWinRate", "negWinRate", "affElimWinRate", "negElimWinRate"] as const;

/**
 * Averages the four win-rate spokes across every entry in the group. A spoke
 * where every team recorded no rounds (null) collapses to "no rounds";
 * otherwise null is treated as 0, matching {@link teamRadarData}.
 */
function averagedWinRate(
  items: ProfileEntry[],
  key: (typeof WIN_RATE_KEYS)[number],
): { score: number; display: string } {
  const clamp = (n: number) => Math.min(100, Math.max(0, n));
  const raw = items.map((i) => i.entry[key]);
  const allNull = raw.every((v) => v === null);
  const avg = raw.reduce<number>((sum, v) => sum + (v ?? 0), 0) / items.length;
  return {
    score: clamp(avg),
    display: allNull ? "no rounds" : `${Number.isInteger(avg) ? avg : avg.toFixed(1)}%`,
  };
}

/**
 * Mean of each team's rank-score spoke across the group — i.e. the average
 * field percentile of the school's entries in this division.
 */
function averagedRankScore(items: ProfileEntry[], fieldSize: number): number {
  const clamp = (n: number) => Math.min(100, Math.max(0, n));
  const total = items.reduce((sum, item) => {
    const rankScore = fieldSize <= 1 ? 100 : ((fieldSize - item.entry.rank) / (fieldSize - 1)) * 100;
    return sum + clamp(rankScore);
  }, 0);
  return total / items.length;
}

/**
 * Mean of each team's matches-score spoke, expressed as a share of the
 * division's busiest entry.
 */
function averagedMatchesScore(items: ProfileEntry[], maxMatches: number): number {
  const clamp = (n: number) => Math.min(100, Math.max(0, n));
  const total = items.reduce(
    (sum, item) => sum + clamp(maxMatches > 0 ? (item.entry.matches / maxMatches) * 100 : 0),
    0,
  );
  return total / items.length;
}

/**
 * Six-spoke radar for a whole school in one division: the mean of every team's
 * individual {@link teamRadarData} scores, so the polygon shows the school's
 * collective profile rather than any single roster.
 *
 * @param items - All of the school's ranked rows in that division (from
 *   {@link findSchoolEntries}, filtered to one `datasetId`).
 */
export function schoolDivisionRadarData(items: ProfileEntry[]): TeamRadarPoint[] {
  const n = items.length;
  if (n === 0) return [];

  const fieldSize = items[0].fieldSize;
  const maxMatches = items[0].maxMatches;
  const bestRank = Math.min(...items.map((i) => i.entry.rank));
  const avgMatches = items.reduce((sum, i) => sum + i.entry.matches, 0) / n;

  const aff = averagedWinRate(items, "affWinRate");
  const neg = averagedWinRate(items, "negWinRate");
  const elimAff = averagedWinRate(items, "affElimWinRate");
  const elimNeg = averagedWinRate(items, "negElimWinRate");

  const clamp = (x: number) => Math.min(100, Math.max(0, x));

  return [
    { metric: "Aff win", score: aff.score, display: aff.display },
    { metric: "Neg win", score: neg.score, display: neg.display },
    { metric: "Elim neg", score: elimNeg.score, display: elimNeg.display },
    { metric: "Elim aff", score: elimAff.score, display: elimAff.display },
    { metric: "Ranking", score: clamp(averagedRankScore(items, fieldSize)), display: `#${bestRank} of ${fieldSize}` },
    {
      metric: "Matches",
      score: clamp(averagedMatchesScore(items, maxMatches)),
      display: `${Number.isInteger(avgMatches) ? avgMatches : avgMatches.toFixed(1)} of ${maxMatches} max`,
    },
  ];
}
