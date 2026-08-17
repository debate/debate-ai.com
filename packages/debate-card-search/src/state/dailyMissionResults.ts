/**
 * @fileoverview Persistent storage for `gamified-quests.ts`'s
 * `DailyMissionResult`, keyed by `contributorId` + `dayKey` — the "(a)
 * wiring real, persisted daily contributions into `computeDailyMissionResult`
 * per contributor per day" follow-up named under the "🎮 Gamified Quests"
 * bullet in TODO.md. `contributions.ts` already persists the real,
 * attributed contributions that `computeDailyMissionResult` is derived from
 * (via `daily-quests.ts`'s `buildDailyQuestBoard`); this store lets a caller
 * persist that per-day derived result once computed, so
 * `buildContributorQuestStreak` can be fed a contributor's real
 * mission-result history across sessions instead of a caller-held in-memory
 * list. Stores records in localStorage, mirroring the existing
 * `coachingSessions.ts`/`contributorAvailability.ts` persistence convention
 * (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
 * rather than throwing). One record per contributor per day — saving an
 * already-recorded day upserts rather than duplicating it, since a day's
 * mission result can be recomputed (e.g. after a late-arriving contribution)
 * without corrupting the streak history. This is a persistence slice only —
 * `gamified-quests.ts`'s pure streak/badge computation is unchanged and
 * still takes a caller-supplied `DailyMissionResult[]` history; no
 * quest-board/streak UI in this repo yet reads or writes through this store.
 *
 * @module state/dailyMissionResults
 */

import {
  buildContributorQuestStreak,
  DEFAULT_STREAK_MILESTONES,
  type ContributorQuestStreak,
  type DailyMissionResult,
  type StreakMilestone,
} from "../lib/gamified-quests";

/** A contributor's mission result for one UTC calendar day. */
export type DailyMissionResultRecord = DailyMissionResult & {
  contributorId: string;
};

const STORAGE_KEY = "dailyMissionResults";

function readAll(): DailyMissionResultRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DailyMissionResultRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: DailyMissionResultRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function matches(record: DailyMissionResultRecord, contributorId: string, dayKey: string): boolean {
  return record.contributorId === contributorId && record.dayKey === dayKey;
}

/** Lists every persisted daily mission result, across all contributors and days. */
export function listDailyMissionResults(): DailyMissionResultRecord[] {
  return readAll();
}

/** Lists a single contributor's persisted mission-result history, across all days. */
export function listDailyMissionResultsForContributor(contributorId: string): DailyMissionResultRecord[] {
  return readAll().filter((record) => record.contributorId === contributorId);
}

/** Looks up a contributor's persisted mission result for a specific day, if any. */
export function getDailyMissionResult(contributorId: string, dayKey: string): DailyMissionResultRecord | undefined {
  return readAll().find((record) => matches(record, contributorId, dayKey));
}

/** Saves a contributor's mission result for a day, overwriting any existing record for that pair. */
export function saveDailyMissionResult(record: DailyMissionResultRecord): void {
  const records = readAll();
  const index = records.findIndex((existing) => matches(existing, record.contributorId, record.dayKey));
  if (index === -1) {
    records.push(record);
  } else {
    records[index] = record;
  }
  writeAll(records);
}

/** Deletes a contributor's persisted mission result for a day; a no-op if it isn't stored. */
export function deleteDailyMissionResult(contributorId: string, dayKey: string): void {
  writeAll(readAll().filter((record) => !matches(record, contributorId, dayKey)));
}

/**
 * Builds a contributor's full streak status and earned badges directly from
 * their persisted mission-result history, reusing `buildContributorQuestStreak`
 * directly rather than requiring the caller to pass in a history list.
 */
export function buildPersistedContributorQuestStreak(
  contributorId: string,
  asOfDayKey: string,
  milestones: StreakMilestone[] = DEFAULT_STREAK_MILESTONES,
): ContributorQuestStreak {
  return buildContributorQuestStreak(
    contributorId,
    listDailyMissionResultsForContributor(contributorId),
    asOfDayKey,
    milestones,
  );
}
