/**
 * @fileoverview Persistent storage for `ndca-standings.ts`'s `TournamentResult`
 * records. A team can attend many tournaments, so records aren't keyed by
 * `teamId` alone — each recorded result gets its own synthetic `id`
 * (assigned by the caller), mirroring `debate-card-search`'s
 * `revisionHistory.ts` wrapped-record convention (SSR/no-storage-safe,
 * corrupt or missing JSON degrades to an empty list rather than throwing).
 * `buildStandingsFromStore` groups every persisted result by `teamId` and
 * runs it directly through the existing `buildStandings`/`rankStandings`
 * computation, introducing no new standings logic here.
 *
 * @module state/tournamentResults
 */

import type {
  BuildStandingsOptions,
  RankedTeamStanding,
  TournamentResult,
} from "../rankings/ndca-standings";
import { buildStandings, rankStandings } from "../rankings/ndca-standings";
import { getEffectiveQualificationPointsTable } from "./qualificationPointsTable";
import { parseTournamentResultsCsv } from "../rankings/tournament-results-csv-import";

/** A `TournamentResult` as persisted: a unique id, since a team can attend many tournaments. */
export interface TournamentResultRecord extends TournamentResult {
  id: string;
}

const STORAGE_KEY = "tournamentResults";

function readAll(): TournamentResultRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TournamentResultRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: TournamentResultRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Lists every persisted tournament result, across every team. */
export function listTournamentResults(): TournamentResultRecord[] {
  return readAll();
}

/** Lists every persisted tournament result for one team. */
export function listTournamentResultsForTeam(teamId: string): TournamentResultRecord[] {
  return readAll().filter((record) => record.teamId === teamId);
}

/** Saves a new tournament result record, appending it to the persisted history. */
export function saveTournamentResult(record: TournamentResultRecord): void {
  const records = readAll();
  records.push(record);
  writeAll(records);
}

/** Deletes a persisted tournament result by `id`; a no-op if it isn't stored. */
export function deleteTournamentResult(id: string): void {
  writeAll(readAll().filter((record) => record.id !== id));
}

/** Result of a bulk CSV import of tournament results. */
export interface TournamentResultCsvImportResult {
  importedCount: number;
  skippedCount: number;
  errors: string[];
}

/**
 * Parses a bulk CSV of tournament results (`rankings/tournament-results-csv-import.ts#parseTournamentResultsCsv`)
 * and appends every well-formed row to the persisted history in one pass,
 * mirroring `opponentRoundRecords.ts#bulkImportOpponentRoundRecords`'s
 * generated-id convention (`teamId-tournamentName-date-importedAt-index`, so
 * a result can be told apart from another row imported in the same batch for
 * the same team/tournament/date).
 */
export function bulkImportTournamentResults(rawCsv: string): TournamentResultCsvImportResult {
  const { entries, skippedCount, errors } = parseTournamentResultsCsv(rawCsv);
  if (entries.length === 0) {
    return { importedCount: 0, skippedCount, errors };
  }

  const records = readAll();
  const importedAt = Date.now();
  const newEntries: TournamentResultRecord[] = entries.map((entry, index) => ({
    ...entry,
    id: `${entry.teamId}-${entry.tournamentName}-${entry.date}-${importedAt}-${index}`,
  }));
  records.push(...newEntries);
  writeAll(records);

  return { importedCount: newEntries.length, skippedCount, errors };
}

/** Groups every persisted tournament result by `teamId`, in the shape `buildStandings` expects. */
function groupResultsByTeam(
  records: TournamentResultRecord[],
): Record<string, TournamentResult[]> {
  const byTeam: Record<string, TournamentResult[]> = {};
  for (const record of records) {
    (byTeam[record.teamId] ??= []).push(record);
  }
  return byTeam;
}

/**
 * Builds ranked season standings directly from every persisted tournament
 * result — groups records by `teamId` and runs them through the existing
 * `buildStandings`/`rankStandings` computation. This is the ready-to-render
 * order for a standings dashboard.
 *
 * Scores with `options.pointsTable` if the caller supplies one; otherwise
 * defaults to `qualificationPointsTable.ts`'s persisted custom table (falling
 * back to `DEFAULT_QUALIFICATION_POINTS_TABLE` when none is saved).
 */
export function buildStandingsFromStore(
  options: BuildStandingsOptions = {},
): RankedTeamStanding[] {
  const byTeam = groupResultsByTeam(readAll());
  const pointsTable = options.pointsTable ?? getEffectiveQualificationPointsTable();
  return rankStandings(buildStandings(byTeam, { ...options, pointsTable }));
}
