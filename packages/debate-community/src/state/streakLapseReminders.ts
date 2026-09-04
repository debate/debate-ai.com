/**
 * @fileoverview Persistent storage for a contributor's opt-in "remind me
 * before my streak lapses" preference — the "🎮 Gamified Quests" bullet's "an
 * opt-in reminder notification before a streak lapses" follow-up in TODO.md.
 * Stores just the set of contributor ids who've opted in, keyed by
 * `contributorId`, mirroring `streakFreezes.ts`'s persistence convention
 * (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
 * rather than throwing). There is no scheduled-job/push-notification
 * infrastructure in this repo (the same known gap as the rest of this
 * feature's "Run today's mission check" trigger), so "reminder" here means an
 * in-app banner shown on `QuestStreaksPanel` itself, not a push
 * notification — a contributor sees it when they visit the panel while their
 * streak is at risk, computed via `lib/gamified-quests.ts#getStreakLapseRiskLength`.
 *
 * @module state/streakLapseReminders
 */

import { getStreakLapseRiskLength } from "../lib/gamified-quests";
import { listDailyMissionResultsForContributor } from "./dailyMissionResults";

const STORAGE_KEY = "streakLapseReminders";

function readAll(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function writeAll(contributorIds: string[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contributorIds));
}

/** Lists every contributor id who has opted in to the streak-lapse reminder. */
export function listStreakLapseReminderContributorIds(): string[] {
  return readAll();
}

/** Whether a contributor has opted in to the streak-lapse reminder. */
export function isStreakLapseReminderEnabled(contributorId: string): boolean {
  return readAll().includes(contributorId);
}

/**
 * Sets a contributor's streak-lapse reminder opt-in on or off. Enabling an
 * already-enabled contributor (or disabling an already-disabled one) is a
 * no-op write — the stored list never grows duplicate entries.
 */
export function setStreakLapseReminderEnabled(contributorId: string, enabled: boolean): void {
  const contributorIds = readAll();
  const alreadyEnabled = contributorIds.includes(contributorId);
  if (enabled === alreadyEnabled) return;

  writeAll(
    enabled
      ? [...contributorIds, contributorId]
      : contributorIds.filter((id) => id !== contributorId),
  );
}

/** A contributor's streak-lapse reminder standing: whether they've opted in, and their current risk (if any). */
export interface StreakLapseReminderInfo {
  enabled: boolean;
  riskLength: number | null;
}

/**
 * Builds a contributor's streak-lapse reminder standing directly from their
 * persisted mission-result history and opt-in preference — composing
 * `getStreakLapseRiskLength` against the real persisted store, mirroring
 * `streakFreezes.ts#buildContributorQuestStreakWithFreezes`'s "compose the
 * pure function directly against the persisted stores" convention. When
 * `enabled` is `false`, `riskLength` is still computed (a caller may want to
 * show the risk regardless of opt-in), but the panel itself only renders the
 * reminder banner when `enabled` is `true`.
 */
export function getPersistedStreakLapseReminderInfo(contributorId: string, asOfDayKey: string): StreakLapseReminderInfo {
  return {
    enabled: isStreakLapseReminderEnabled(contributorId),
    riskLength: getStreakLapseRiskLength(listDailyMissionResultsForContributor(contributorId), asOfDayKey),
  };
}
