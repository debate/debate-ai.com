/**
 * @fileoverview Championship side bias: how often the aff (PF: pro) side won
 * at each format's championship tournament, overall and in elimination
 * rounds, per season — the Tournament of Champions for high school PF, LD and
 * Policy, the National Debate Tournament for college policy.
 *
 * The per-round counts live in `data/championship-side-bias.json`, written by
 * `sync/championship-side-bias-sync.ts` from Tabroom's published ballots. Only
 * counts are stored; every rate and average is derived here, so a season with
 * no synced ballots simply has no row and the UI hides it.
 * @module side-bias
 */

import sideBiasData from "../data/championship-side-bias.json";
import type { RankingDatasetId } from "./types";

/** The formats with a championship side-bias series. */
export type SideBiasFormat = "pf" | "ld" | "policy" | "college";

export const SIDE_BIAS_FORMATS: readonly SideBiasFormat[] = ["pf", "ld", "policy", "college"];

export const SIDE_BIAS_FORMAT_LABELS: Record<SideBiasFormat, string> = {
  pf: "Public Forum",
  ld: "Lincoln-Douglas",
  policy: "HS Policy",
  college: "College Policy",
};

/** The championship each format's side bias is measured at. */
export const SIDE_BIAS_CHAMPIONSHIP_NAMES: Record<SideBiasFormat, string> = {
  pf: "Tournament of Champions",
  ld: "Tournament of Champions",
  policy: "Tournament of Champions",
  college: "National Debate Tournament",
};

/** The affirmative side's name in each format (PF's is "pro"). */
export const SIDE_BIAS_AFF_LABELS: Record<SideBiasFormat, string> = {
  pf: "pro",
  ld: "aff",
  policy: "aff",
  college: "aff",
};

/** The rankings dataset that shares a format's season (`hsld_sepoct` is a slice of `hsld`, so it has none). */
export const SIDE_BIAS_FORMAT_BY_DATASET: Partial<Record<RankingDatasetId, SideBiasFormat>> = {
  hspf: "pf",
  hsld: "ld",
  hscx: "policy",
  cpd: "college",
};

/** How many seasons the statistics chart looks back (the current one included). */
export const SIDE_BIAS_YEARS = 10;

/**
 * Tabroom tournament ids of the championships, by season year (the year the
 * season ends in). Ids come from Tabroom's public tournament list; the
 * ballots behind them need a signed-in session to read (see the sync).
 */
export const SIDE_BIAS_CHAMPIONSHIPS: Record<"toc" | "ndt", Record<number, { tabroomId: number; name: string }>> = {
  toc: {
    2017: { tabroomId: 5441, name: "Tournament of Champions" },
    2018: { tabroomId: 8965, name: "Tournament of Champions" },
    2019: { tabroomId: 11772, name: "Tournament of Champions" },
    2020: { tabroomId: 13038, name: "Tournament of Champions" },
    2021: { tabroomId: 16714, name: "Tournament of Champions" },
    2022: { tabroomId: 22381, name: "Tournament of Champions" },
    2023: { tabroomId: 24340, name: "Tournament of Champions" },
    2024: { tabroomId: 29559, name: "52nd Annual Tournament of Champions" },
    2025: { tabroomId: 34644, name: "53rd Annual Tournament of Champions" },
    2026: { tabroomId: 36156, name: "54th Annual Tournament of Champions" },
  },
  ndt: {
    2017: { tabroomId: 7069, name: "71st National Debate Tournament at Kansas" },
    2018: { tabroomId: 9542, name: "72nd National Debate Tournament at Wichita State" },
    2019: { tabroomId: 12448, name: "73rd National Debate Tournament" },
    2020: { tabroomId: 15597, name: "74th National Debate Tournament" },
    2021: { tabroomId: 19550, name: "75th National Debate Tournament" },
    2022: { tabroomId: 23226, name: "76th National Debate Tournament" },
    2023: { tabroomId: 26828, name: "77th National Debate Tournament" },
    2024: { tabroomId: 30785, name: "78th National Debate Tournament" },
    2025: { tabroomId: 34926, name: "79th National Debate Tournament" },
    2026: { tabroomId: 39306, name: "80th National Debate Tournament" },
  },
};

/** The championship tournament of a format and season, or `undefined` outside the registry. */
export function championshipTournament(format: SideBiasFormat, year: number) {
  return SIDE_BIAS_CHAMPIONSHIPS[format === "college" ? "ndt" : "toc"][year];
}

/** One decided round: which side won, and whether it was an elimination round. */
export interface ChampionshipRound {
  winner: "aff" | "neg";
  elim: boolean;
}

/** Stored round counts for one format's championship in one season. */
export interface SideBiasCounts {
  /** Decided rounds (prelims and elims). */
  rounds: number;
  /** Rounds the aff side won. */
  affWins: number;
  /** Decided elimination rounds. */
  elimRounds: number;
  /** Elimination rounds the aff side won. */
  elimAffWins: number;
}

/** A {@link SideBiasCounts} row for a format and season, as stored. */
export interface SideBiasRecord extends SideBiasCounts {
  format: SideBiasFormat;
  /** Season year (the year the season ends in). */
  year: number;
  /** Tabroom tournament the ballots were read from. */
  tabroomId: number;
}

/** The bundled file's shape. */
export interface SideBiasDataset {
  /** ISO time of the last sync, or `null` when nothing has been synced yet. */
  generatedAt: string | null;
  records: SideBiasRecord[];
}

/** A row's win rates, in percent to two decimals like `field_statistics.csv`; `null` where there are no rounds. */
export interface SideBiasRates extends SideBiasCounts {
  affWinRate: number | null;
  negWinRate: number | null;
  elimAffWinRate: number | null;
  negElimWinRate: number | null;
}

const percent = (wins: number, total: number): number | null =>
  total > 0 ? Math.round((wins / total) * 10_000) / 100 : null;

/** Counts decided rounds. */
export function countRounds(rounds: readonly ChampionshipRound[]): SideBiasCounts {
  let affWins = 0;
  let elimRounds = 0;
  let elimAffWins = 0;
  for (const round of rounds) {
    if (round.winner === "aff") affWins++;
    if (round.elim) {
      elimRounds++;
      if (round.winner === "aff") elimAffWins++;
    }
  }
  return { rounds: rounds.length, affWins, elimRounds, elimAffWins };
}

/** Turns counts into the aff/neg win rates (overall and elim). */
export function sideBiasRates(counts: SideBiasCounts): SideBiasRates {
  const aff = percent(counts.affWins, counts.rounds);
  const elimAff = percent(counts.elimAffWins, counts.elimRounds);
  return {
    ...counts,
    affWinRate: aff,
    negWinRate: aff === null ? null : Math.round((100 - aff) * 100) / 100,
    elimAffWinRate: elimAff,
    negElimWinRate: elimAff === null ? null : Math.round((100 - elimAff) * 100) / 100,
  };
}

/** Adds up several seasons' counts, so an average weighs each round equally. */
export function sumCounts(rows: readonly SideBiasCounts[]): SideBiasCounts {
  return rows.reduce<SideBiasCounts>(
    (sum, row) => ({
      rounds: sum.rounds + row.rounds,
      affWins: sum.affWins + row.affWins,
      elimRounds: sum.elimRounds + row.elimRounds,
      elimAffWins: sum.elimAffWins + row.elimAffWins,
    }),
    { rounds: 0, affWins: 0, elimRounds: 0, elimAffWins: 0 },
  );
}

const bundled = sideBiasData as SideBiasDataset;

/** Seasons from `endYear - years + 1` to `endYear`, oldest first. */
export function sideBiasYearRange(endYear: number, years = SIDE_BIAS_YEARS): number[] {
  return Array.from({ length: years }, (_, i) => endYear - years + 1 + i);
}

/**
 * The championship side bias of a format and season, or `null` when no
 * ballots were synced for it (the rankings page then shows nothing).
 */
export function championshipSideBias(
  format: SideBiasFormat,
  year: number,
  dataset: SideBiasDataset = bundled,
): (SideBiasRates & { year: number; tabroomId: number }) | null {
  const record = dataset.records.find((r) => r.format === format && r.year === year && r.rounds > 0);
  if (!record) return null;
  return { ...sideBiasRates(record), year, tabroomId: record.tabroomId };
}

/** One season's point on a format's side-bias series. */
export interface SideBiasSeriesPoint extends SideBiasRates {
  year: number;
}

/** A format's synced seasons within the window, oldest first, plus the all-season average. */
export interface SideBiasSeries {
  format: SideBiasFormat;
  label: string;
  points: SideBiasSeriesPoint[];
  /** All rounds in the window pooled; `null` when the format has no synced season. */
  average: SideBiasRates | null;
}

/**
 * The side-bias series of every format over the last {@link SIDE_BIAS_YEARS}
 * seasons ending at `endYear`. A format with no synced season has empty points
 * and a `null` average.
 */
export function sideBiasSeries(
  endYear: number,
  dataset: SideBiasDataset = bundled,
  years = SIDE_BIAS_YEARS,
): SideBiasSeries[] {
  const window = new Set(sideBiasYearRange(endYear, years));
  return SIDE_BIAS_FORMATS.map((format) => {
    const records = dataset.records
      .filter((r) => r.format === format && window.has(r.year) && r.rounds > 0)
      .sort((a, b) => a.year - b.year);
    return {
      format,
      label: SIDE_BIAS_FORMAT_LABELS[format],
      points: records.map((r) => ({ ...sideBiasRates(r), year: r.year })),
      average: records.length > 0 ? sideBiasRates(sumCounts(records)) : null,
    };
  });
}

/** Whether any format has a synced season in the window. */
export function hasSideBiasData(series: readonly SideBiasSeries[]): boolean {
  return series.some((s) => s.points.length > 0);
}

/** The bundled dataset (for the sync, which merges into it). */
export function bundledSideBiasDataset(): SideBiasDataset {
  return bundled;
}
