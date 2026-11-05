/**
 * @fileoverview The Schools table, precomputed: every scope's ranked rows for
 * one season plus each school's NDT/CEDA summary, in one JSON object.
 *
 * Rolling schools up means loading every division's full-season dataset
 * (several MB of ratings JSON) and fuzzy-matching every school against
 * the NDT history, which froze the page when it ran in the browser. The
 * Worker now builds this snapshot once (`apps/debate-web/lib/rankings/school-rankings-store.ts`),
 * saves it in D1, refreshes it daily and serves it from `/api/school-rankings`.
 * The browser keeps its own copy (`schoolRankingsCache.ts`).
 *
 * Kept free of React so the Worker can import it.
 * @module leaderboard/schoolRankingsSnapshot
 */

import { currentRankingSeasonYear, hasExtinctionSeason, loadRankingDataset, type RankingDataset } from "../index";
import { findCedaSchoolTitles } from "../sync/ceda-champions";
import type { NdtSchoolHistory } from "../sync/ndt-school-history";
import { DIVISION_CONFIG, SCHOOL_DATASETS, schoolRankingsFor } from "./leaderboardUtils";
import type { Division, SchoolRanking } from "./leaderboardTypes";
import { findNdtSchoolHistory } from "./profile/rankingProfileHelpers";

/** Bumped when the snapshot's shape changes, so old saved copies are rebuilt. */
export const SCHOOL_RANKINGS_SNAPSHOT_VERSION = 1;

/** The Schools tab's scope switcher: every event, or one division. */
export type SchoolScope = "all" | Division;

/** Every scope a snapshot holds rows for. */
export const SCHOOL_SCOPES: SchoolScope[] = ["all", ...DIVISION_CONFIG.map((d) => d.value)];

/** What the Schools table's NDT column shows for one school. */
export interface SchoolNdtSummary {
  /** The school's name in the NDT history (shown on hover). */
  ndtSchool: string;
  /** NDT championships. */
  ndtTitles: number;
  /** CEDA national championships. */
  cedaTitles: number;
  /** NDT elim appearances. */
  elims: number;
}

/** One season's Schools table, ready to render. */
export interface SchoolRankingsSnapshot {
  version: number;
  /** The season (the year it ends in). */
  seasonYear: number;
  /** When the rows were computed, ISO 8601. */
  builtAt: string;
  /** Hash of `scopes` and `ndt`: equal hashes mean nothing changed. */
  hash: string;
  /** Ranked rows per scope; a scope with no data is an empty list. */
  scopes: Record<SchoolScope, SchoolRanking[]>;
  /** NDT summary per row's `school`, only for schools that went to the NDT. */
  ndt: Record<string, SchoolNdtSummary>;
}

/** Ratings are shown to one decimal; two keep sorting exact enough and the JSON small. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function compactRow(row: SchoolRanking): SchoolRanking {
  return {
    ...row,
    bestRating: round2(row.bestRating),
    avgRating: round2(row.avgRating),
    balancedScore: round2(row.balancedScore),
  };
}

/** FNV-1a, 32-bit, as 8 hex digits. Not cryptographic; only detects change. */
export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** The NDT column's summary of one school's history. */
export function summarizeNdtHistory(history: NdtSchoolHistory, school: string): SchoolNdtSummary {
  return {
    ndtSchool: history.school,
    ndtTitles: history.championships.length,
    cedaTitles: findCedaSchoolTitles(school)?.titles.length ?? 0,
    elims: history.elims.length,
  };
}

/**
 * Builds the snapshot from loaded datasets. Matching each school to the NDT
 * history happens here, once, instead of on every render.
 *
 * @param datasets - Full-season dataset per division (missing ones are skipped).
 * @param seasonYear - The season the datasets are for.
 * @param ndtSchools - The NDT school history, or `null` to leave the NDT column out.
 * @param now - Build time.
 */
export function buildSchoolRankingsSnapshot(
  datasets: Partial<Record<Division, RankingDataset>>,
  seasonYear: number,
  ndtSchools: NdtSchoolHistory[] | null,
  now: Date = new Date(),
): SchoolRankingsSnapshot {
  const scopes = Object.fromEntries(
    SCHOOL_SCOPES.map((scope) => [scope, schoolRankingsFor(datasets, scope).map(compactRow)]),
  ) as Record<SchoolScope, SchoolRanking[]>;

  const ndt: Record<string, SchoolNdtSummary> = {};
  if (ndtSchools) {
    const seen = new Set<string>();
    for (const rows of Object.values(scopes)) {
      for (const { school } of rows) {
        if (seen.has(school)) continue;
        seen.add(school);
        const history = findNdtSchoolHistory(ndtSchools, school);
        if (history) ndt[school] = summarizeNdtHistory(history, school);
      }
    }
  }

  return {
    version: SCHOOL_RANKINGS_SNAPSHOT_VERSION,
    seasonYear,
    builtAt: now.toISOString(),
    hash: hashText(JSON.stringify({ v: SCHOOL_RANKINGS_SNAPSHOT_VERSION, scopes, ndt })),
    scopes,
    ndt,
  };
}

/** Whether `seasonYear` has school rankings at all (the Elo ratings start in 2015-16). */
export function hasSchoolRankingsSeason(seasonYear: number): boolean {
  return seasonYear === currentRankingSeasonYear() || hasExtinctionSeason("hspf", seasonYear);
}

/**
 * Loads every division's full-season dataset for `seasonYear` in parallel. A
 * division that fails is left out; throws only when every one fails.
 */
export async function loadSchoolRankingDatasets(
  seasonYear: number,
): Promise<Partial<Record<Division, RankingDataset>>> {
  const isCurrent = seasonYear === currentRankingSeasonYear();
  const results = await Promise.allSettled(
    SCHOOL_DATASETS.map(({ datasetId }) =>
      isCurrent ? loadRankingDataset(datasetId) : loadRankingDataset(datasetId, seasonYear),
    ),
  );
  const datasets: Partial<Record<Division, RankingDataset>> = {};
  results.forEach((result, i) => {
    if (result.status === "fulfilled") datasets[SCHOOL_DATASETS[i].division] = result.value;
  });
  if (Object.keys(datasets).length === 0) {
    const first = results.find((r) => r.status === "rejected");
    const reason = first?.status === "rejected" ? first.reason : null;
    throw reason instanceof Error ? reason : new Error("Failed to load rankings");
  }
  return datasets;
}

/** The NDT history JSON, or `null` if it can't be loaded. */
async function loadNdtSchools(): Promise<NdtSchoolHistory[] | null> {
  try {
    const module = await import("../../data/ndt-school-history.json");
    return module.default as NdtSchoolHistory[];
  } catch {
    return null;
  }
}

/**
 * Loads the sources and builds `seasonYear`'s snapshot. The Worker runs this
 * for the D1 copy; the browser runs it only when `/api/school-rankings` can't answer.
 */
export async function computeSchoolRankingsSnapshot(
  seasonYear: number = currentRankingSeasonYear(),
): Promise<SchoolRankingsSnapshot> {
  const [datasets, ndtSchools] = await Promise.all([loadSchoolRankingDatasets(seasonYear), loadNdtSchools()]);
  return buildSchoolRankingsSnapshot(datasets, seasonYear, ndtSchools);
}

/** Checks a parsed JSON value is a snapshot of the current version. */
export function isSchoolRankingsSnapshot(value: unknown): value is SchoolRankingsSnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<SchoolRankingsSnapshot>;
  return (
    v.version === SCHOOL_RANKINGS_SNAPSHOT_VERSION &&
    typeof v.seasonYear === "number" &&
    typeof v.hash === "string" &&
    !!v.scopes &&
    typeof v.scopes === "object" &&
    Array.isArray((v.scopes as Record<string, unknown>).all) &&
    !!v.ndt &&
    typeof v.ndt === "object"
  );
}
