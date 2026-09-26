/**
 * @fileoverview Pure helpers behind the `/teams/[team]` and `/schools/[school]`
 * profile pages: the URL slugs a rankings row links to, the lookups that turn
 * a slug back into rows across every `debate-rankings` dataset, the stats a
 * school profile aggregates, and the video-search query each profile runs.
 * @module panels/leaderboard/profile/rankingProfileHelpers
 */

import type { RankingDataset, RankingDatasetId, RankingEntry } from "debate-rankings";

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
  entry: RankingEntry;
}

/** Rows of `datasets` matching `predicate`, tagged with their dataset. */
function collect(
  datasets: RankingDataset[],
  predicate: (entry: RankingEntry) => boolean,
): ProfileEntry[] {
  const out: ProfileEntry[] = [];
  for (const dataset of datasets) {
    for (const entry of dataset.entries) {
      if (predicate(entry)) {
        out.push({
          datasetId: dataset.id,
          datasetLabel: dataset.label,
          fieldSize: dataset.entries.length,
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

/**
 * Words for a video search. The library search requires every whitespace
 * token to appear, so separators like `&` that titles rarely repeat verbatim
 * are dropped.
 */
function searchWords(text: string): string {
  return text
    .replace(/[&/,()]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

/** Video search for a team: its debaters' names ("Falk & Sabnani" → "Falk Sabnani"). */
export function teamVideoQuery(entry: Pick<RankingEntry, "name">): string {
  return searchWords(entry.name);
}

/** Video search for a school: its name. */
export function schoolVideoQuery(school: string): string {
  return searchWords(school);
}
