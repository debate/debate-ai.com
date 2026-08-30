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
