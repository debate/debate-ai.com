/**
 * @fileoverview Persistent storage for `judge/judge-profile.ts`'s
 * `JudgeRoundRecord`s — the raw per-ballot history behind a
 * `JudgeProfile`, which `state/judgeProfiles.ts` does not keep (that store
 * holds only the aggregate). Closes the "no profile editing/creation UI"
 * gap named in `docs/features/judge-profiles.md`: with the ballots
 * themselves persisted, a panel can log one round at a time and have the
 * judge's profile re-aggregate from the full history.
 *
 * A judge decides many rounds, so records aren't keyed by `judgeId` alone —
 * each logged round gets its own caller-assigned `id`, mirroring
 * `debate-data-sync`'s `tournamentResults.ts` wrapped-record convention
 * (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
 * rather than throwing). Re-aggregation runs the existing
 * `buildJudgeProfile` and persists through the existing `saveJudgeProfile`,
 * introducing no new profile-scoring logic here.
 *
 * @module state/judgeRoundRecords
 */

import type { JudgeProfile, JudgeRoundRecord } from "../judge/judge-profile";
import { buildJudgeProfile } from "../judge/judge-profile";
import { deleteJudgeProfile, saveJudgeProfile } from "./judgeProfiles";

/** A `JudgeRoundRecord` as persisted: a unique id, since a judge decides many rounds. */
export interface JudgeRoundRecordEntry extends JudgeRoundRecord {
  id: string;
}

const STORAGE_KEY = "judgeRoundRecords";

function readAll(): JudgeRoundRecordEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as JudgeRoundRecordEntry[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: JudgeRoundRecordEntry[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Lists every persisted judged-round record, across every judge. */
export function listJudgeRoundRecords(): JudgeRoundRecordEntry[] {
  return readAll();
}

/** Lists every persisted judged-round record for one judge. */
export function listJudgeRoundRecordsForJudge(judgeId: string): JudgeRoundRecordEntry[] {
  return readAll().filter((record) => record.judgeId === judgeId);
}

/**
 * Re-derives one judge's `JudgeProfile` from their persisted round records
 * and saves it. A judge with no records left has their derived profile
 * deleted instead of being left with a zero-round one; the deleted/absent
 * case returns `null`.
 */
export function rebuildJudgeProfileFromRecords(judgeId: string): JudgeProfile | null {
  const records = listJudgeRoundRecordsForJudge(judgeId);
  if (records.length === 0) {
    deleteJudgeProfile(judgeId);
    return null;
  }
  const profile = buildJudgeProfile(judgeId, records);
  saveJudgeProfile(profile);
  return profile;
}

/**
 * Logs one judged round: appends it to the persisted ballot history, then
 * re-aggregates and saves that judge's profile from the full history.
 * Returns the judge's updated profile.
 */
export function recordJudgeRound(record: JudgeRoundRecordEntry): JudgeProfile {
  const records = readAll();
  records.push(record);
  writeAll(records);
  const profile = buildJudgeProfile(
    record.judgeId,
    records.filter((existing) => existing.judgeId === record.judgeId),
  );
  saveJudgeProfile(profile);
  return profile;
}

/**
 * Deletes one persisted judged-round record by `id` and re-aggregates the
 * affected judge's profile; a no-op if the id isn't stored.
 */
export function deleteJudgeRoundRecord(id: string): void {
  const records = readAll();
  const removed = records.find((record) => record.id === id);
  if (!removed) return;
  writeAll(records.filter((record) => record.id !== id));
  rebuildJudgeProfileFromRecords(removed.judgeId);
}
