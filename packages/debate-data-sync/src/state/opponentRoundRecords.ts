/**
 * @fileoverview Persistent storage for `rankings/opponent-team-profile.ts`'s
 * `OpponentRoundRecord`s — the raw scouted-round history behind an
 * `OpponentTeamProfile`, which `state/opponentTeamProfiles.ts` does not keep
 * (that store holds only the aggregate). Closes the "no profile
 * editing/creation UI" gap named in
 * `docs/features/opponent-team-profiles.md`: with the rounds themselves
 * persisted, a panel can log one scouted round at a time and have the team's
 * profile re-aggregate from the full history.
 *
 * A team competes in many rounds, so records aren't keyed by `teamId` alone —
 * each logged round gets its own caller-assigned `id`, mirroring
 * `debate-speech-writer`'s `judgeRoundRecords.ts` and this package's own
 * `tournamentResults.ts` wrapped-record convention (SSR/no-storage-safe,
 * corrupt or missing JSON degrades to an empty list rather than throwing).
 * Re-aggregation runs the existing `buildOpponentTeamProfile` and persists
 * through the existing `saveOpponentTeamProfile`, introducing no new scouting
 * logic here.
 *
 * This store is scoped to *opposing* teams. `debate-round`'s
 * `state/ownRoundHistory.ts` persists the same record type from this team's
 * own perspective for pre-round briefings, and is deliberately separate — a
 * team's own rounds shouldn't appear as an opponent's scouting profile.
 *
 * @module state/opponentRoundRecords
 */

import type {
  OpponentRoundRecord,
  OpponentTeamProfile,
} from "../rankings/opponent-team-profile";
import { buildOpponentTeamProfile } from "../rankings/opponent-team-profile";
import { deleteOpponentTeamProfile, saveOpponentTeamProfile } from "./opponentTeamProfiles";

/** An `OpponentRoundRecord` as persisted: a unique id, since a team plays many rounds. */
export interface OpponentRoundRecordEntry extends OpponentRoundRecord {
  id: string;
}

const STORAGE_KEY = "opponentRoundRecords";

function readAll(): OpponentRoundRecordEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OpponentRoundRecordEntry[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: OpponentRoundRecordEntry[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Lists every persisted scouted-round record, across every opposing team. */
export function listOpponentRoundRecords(): OpponentRoundRecordEntry[] {
  return readAll();
}

/** Lists every persisted scouted-round record for one opposing team. */
export function listOpponentRoundRecordsForTeam(teamId: string): OpponentRoundRecordEntry[] {
  return readAll().filter((record) => record.teamId === teamId);
}

/** Every distinct opposing-team id with at least one logged round, sorted alphabetically. */
export function listOpponentTeamIds(): string[] {
  return Array.from(new Set(readAll().map((record) => record.teamId))).sort();
}

/** Levenshtein edit distance between two strings, case-insensitive. */
function editDistance(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  const rows: number[][] = Array.from({ length: x.length + 1 }, () => new Array(y.length + 1).fill(0));
  for (let i = 0; i <= x.length; i++) rows[i]![0] = i;
  for (let j = 0; j <= y.length; j++) rows[0]![j] = j;
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      rows[i]![j] = Math.min(
        rows[i - 1]![j]! + 1,
        rows[i]![j - 1]! + 1,
        rows[i - 1]![j - 1]! + cost,
      );
    }
  }
  return rows[x.length]![y.length]!;
}

/**
 * The known opposing-team id closest to `query` by edit distance, for a "did
 * you mean" suggestion when a typed filter matches no logged round. Returns
 * `null` when there are no logged team ids or `query` is blank.
 */
export function findNearestOpponentTeamId(query: string): string | null {
  const trimmed = query.trim();
  if (trimmed === "") return null;
  const ids = listOpponentTeamIds();
  if (ids.length === 0) return null;
  return ids.reduce((closest, id) =>
    editDistance(trimmed, id) < editDistance(trimmed, closest) ? id : closest,
  );
}

/**
 * Re-derives one team's `OpponentTeamProfile` from its persisted scouted-round
 * records and saves it. A team with no records left has its derived profile
 * deleted instead of being left with a zero-round one; the deleted/absent case
 * returns `null`.
 */
export function rebuildOpponentTeamProfileFromRecords(
  teamId: string,
): OpponentTeamProfile | null {
  const records = listOpponentRoundRecordsForTeam(teamId);
  if (records.length === 0) {
    deleteOpponentTeamProfile(teamId);
    return null;
  }
  const profile = buildOpponentTeamProfile(teamId, records);
  saveOpponentTeamProfile(profile);
  return profile;
}

/**
 * Logs one scouted round: appends it to the persisted round history, then
 * re-aggregates and saves that team's profile from the full history. Returns
 * the team's updated profile.
 */
export function recordOpponentRound(record: OpponentRoundRecordEntry): OpponentTeamProfile {
  const records = readAll();
  records.push(record);
  writeAll(records);
  const profile = buildOpponentTeamProfile(
    record.teamId,
    records.filter((existing) => existing.teamId === record.teamId),
  );
  saveOpponentTeamProfile(profile);
  return profile;
}

/**
 * Replaces one persisted scouted-round record by `id`, keeping its position in
 * the history, then re-aggregates the affected team's profile. Reassigning a
 * round to a different team re-aggregates the previous team too (dropping its
 * derived profile when that was its last round). Returns the profile for the
 * updated record's team, or `null` if the id isn't stored.
 */
export function updateOpponentRoundRecord(
  record: OpponentRoundRecordEntry,
): OpponentTeamProfile | null {
  const records = readAll();
  const index = records.findIndex((existing) => existing.id === record.id);
  if (index === -1) return null;
  const previousTeamId = records[index]!.teamId;
  records[index] = record;
  writeAll(records);
  if (previousTeamId !== record.teamId) {
    rebuildOpponentTeamProfileFromRecords(previousTeamId);
  }
  return rebuildOpponentTeamProfileFromRecords(record.teamId);
}

/**
 * Deletes one persisted scouted-round record by `id` and re-aggregates the
 * affected team's profile; a no-op if the id isn't stored.
 */
export function deleteOpponentRoundRecord(id: string): void {
  const records = readAll();
  const removed = records.find((record) => record.id === id);
  if (!removed) return;
  writeAll(records.filter((record) => record.id !== id));
  rebuildOpponentTeamProfileFromRecords(removed.teamId);
}
