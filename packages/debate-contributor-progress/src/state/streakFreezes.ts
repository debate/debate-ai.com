/**
 * @fileoverview Persistent storage for streak-freeze ("grace day") usage,
 * keyed by `contributorId` + `dayKey` — the "🎮 Gamified Quests" bullet's
 * "a streak-freeze/grace-day mechanic for a missed day" follow-up in
 * TODO.md. `lib/gamified-quests.ts`'s `applyStreakFreezes`/
 * `canApplyStreakFreeze`/`getAvailableStreakFreezes` are pure and take a
 * caller-supplied list of already-used freeze dayKeys; this store persists
 * that list per contributor in localStorage, mirroring
 * `dailyMissionResults.ts`'s persistence convention (SSR/no-storage-safe,
 * corrupt or missing JSON degrades to an empty list rather than throwing).
 * One record per contributor per day — a day can only be frozen once.
 *
 * `applyPersistedStreakFreeze` composes the pure validation
 * (`canApplyStreakFreeze`) directly against a contributor's persisted
 * mission-result history (`dailyMissionResults.ts`) and persisted freeze
 * history (this module), so a caller doesn't need to assemble that context
 * itself — mirroring `dailyMissionResults.ts#computeAndSavePersistedDailyMissionResult`'s
 * "compose the pure function directly against the persisted stores"
 * convention, this time gated by a validation result instead of always
 * succeeding.
 *
 * @module state/streakFreezes
 */

import {
  applyStreakFreezes,
  buildContributorQuestStreak,
  canApplyStreakFreeze,
  DEFAULT_STREAK_MILESTONES,
  getAvailableStreakFreezes,
  MAX_STREAK_FREEZES_PER_WINDOW,
  STREAK_FREEZE_WINDOW_DAYS,
  type ContributorQuestStreak,
  type StreakFreezeDenialReason,
  type StreakMilestone,
} from "../lib/gamified-quests";
import { listDailyMissionResults, listDailyMissionResultsForContributor } from "./dailyMissionResults";

/** One contributor's spent streak freeze, for a single UTC calendar day. */
export interface StreakFreezeRecord {
  contributorId: string;
  dayKey: string;
}

const STORAGE_KEY = "streakFreezes";

function readAll(): StreakFreezeRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StreakFreezeRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: StreakFreezeRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Lists every persisted streak freeze, across all contributors and days. */
export function listStreakFreezes(): StreakFreezeRecord[] {
  return readAll();
}

/** Lists a single contributor's persisted freeze dayKeys, across all days. */
export function listStreakFreezeDayKeysForContributor(contributorId: string): string[] {
  return readAll()
    .filter((record) => record.contributorId === contributorId)
    .map((record) => record.dayKey);
}

/** Result of attempting to apply a streak freeze: either it was saved, or it was denied with a reason. */
export type ApplyStreakFreezeResult =
  | { applied: true; record: StreakFreezeRecord }
  | { applied: false; reason: StreakFreezeDenialReason };

/**
 * Attempts to spend one of a contributor's streak freezes on `dayKey`,
 * validating against their real persisted mission-result history and
 * already-used freezes via `canApplyStreakFreeze` before saving. A denied
 * attempt is a no-op — nothing is written.
 */
export function applyPersistedStreakFreeze(
  contributorId: string,
  dayKey: string,
  asOfDayKey: string,
  maxFreezes: number = MAX_STREAK_FREEZES_PER_WINDOW,
  windowDays: number = STREAK_FREEZE_WINDOW_DAYS,
): ApplyStreakFreezeResult {
  const results = listDailyMissionResultsForContributor(contributorId);
  const usedFreezeDayKeys = listStreakFreezeDayKeysForContributor(contributorId);

  const denialReason = canApplyStreakFreeze(results, usedFreezeDayKeys, dayKey, asOfDayKey, maxFreezes, windowDays);
  if (denialReason) return { applied: false, reason: denialReason };

  const record: StreakFreezeRecord = { contributorId, dayKey };
  writeAll([...readAll(), record]);
  return { applied: true, record };
}

/**
 * Merges a contributor's remotely-synced freeze dayKeys into the local
 * store, adding only the ones not already present — mirroring
 * `newsStream.ts#mergeRemoteViewerState`'s "union, never remove" convention
 * for syncing an array from the account. Bypasses `canApplyStreakFreeze`
 * deliberately: these dayKeys were already validated and spent on another
 * device, so re-validating them against *this* device's copy of the mission
 * history could reject a freeze that's already real (e.g. if this device
 * hasn't synced the mission result that justified it yet). Returns whether
 * anything was actually added.
 */
export function mergeRemoteStreakFreezeDayKeys(contributorId: string, remoteDayKeys: string[]): boolean {
  const existingDayKeys = new Set(listStreakFreezeDayKeysForContributor(contributorId));
  const newRecords = remoteDayKeys
    .filter((dayKey) => !existingDayKeys.has(dayKey))
    .map((dayKey) => ({ contributorId, dayKey }));
  if (newRecords.length === 0) return false;

  writeAll([...readAll(), ...newRecords]);
  return true;
}

/**
 * How many streak freezes a contributor has left to spend, as of
 * `asOfDayKey`, directly from their persisted freeze-usage history.
 */
export function getPersistedAvailableStreakFreezes(
  contributorId: string,
  asOfDayKey: string,
  maxFreezes: number = MAX_STREAK_FREEZES_PER_WINDOW,
  windowDays: number = STREAK_FREEZE_WINDOW_DAYS,
): number {
  return getAvailableStreakFreezes(
    listStreakFreezeDayKeysForContributor(contributorId),
    asOfDayKey,
    maxFreezes,
    windowDays,
  );
}

/**
 * Builds a contributor's full streak status and earned badges from their
 * persisted mission-result history with their persisted streak freezes
 * applied on top (`lib/gamified-quests.ts#applyStreakFreezes`) — so a frozen
 * day bridges the streak the same way a real completed mission would.
 * Lives here rather than in `dailyMissionResults.ts` to avoid a circular
 * import (this module already depends on that one for the raw mission-result
 * history).
 */
export function buildContributorQuestStreakWithFreezes(
  contributorId: string,
  asOfDayKey: string,
  milestones: StreakMilestone[] = DEFAULT_STREAK_MILESTONES,
): ContributorQuestStreak {
  const effectiveResults = applyStreakFreezes(
    listDailyMissionResultsForContributor(contributorId),
    listStreakFreezeDayKeysForContributor(contributorId),
  );
  return buildContributorQuestStreak(contributorId, effectiveResults, asOfDayKey, milestones);
}

/**
 * Builds the full streak+badge roster with freezes applied: every
 * contributor with at least one persisted mission result or streak freeze,
 * sorted alphabetically by `contributorId` for a stable, deterministic
 * roster order — mirrors `dailyMissionResults.ts#buildPersistedQuestStreakRoster`,
 * composed through `buildContributorQuestStreakWithFreezes` instead.
 */
export function buildQuestStreakRosterWithFreezes(
  asOfDayKey: string,
  milestones: StreakMilestone[] = DEFAULT_STREAK_MILESTONES,
): ContributorQuestStreak[] {
  const contributorIds = Array.from(
    new Set([
      ...listDailyMissionResults().map((record) => record.contributorId),
      ...listStreakFreezes().map((record) => record.contributorId),
    ]),
  ).sort();

  return contributorIds.map((contributorId) =>
    buildContributorQuestStreakWithFreezes(contributorId, asOfDayKey, milestones),
  );
}
