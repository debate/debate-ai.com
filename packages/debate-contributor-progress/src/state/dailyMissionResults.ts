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
 * `computeAndSavePersistedDailyMissionResult` closes that same bullet's
 * follow-up (a) — "wiring a real end-of-day computation (UI action or
 * scheduled job) that calls `computeDailyMissionResult` against that day's
 * persisted contributions and saves it via `saveDailyMissionResult`" — by
 * reading a contributor's real, persisted contributions directly from
 * `state/contributions.ts` instead of requiring a caller-supplied
 * contribution list, mirroring this file's own `buildPersistedContributorQuestStreak`
 * "compose the pure function directly against the persisted store"
 * convention, this time on the write side.
 *
 * `buildPersistedQuestStreakRoster` closes that same bullet's remaining
 * follow-up — "a streak/badge widget UI that renders `buildContributorQuestStreak`/
 * `getEarnedStreakBadges`" — by listing every contributor with at least one
 * persisted mission result (via this module's own `listDailyMissionResults`)
 * and building each one's streak status via `buildPersistedContributorQuestStreak`,
 * mirroring `lib/unlock-streak-status.ts`'s `buildUnlockStatusRoster` "single
 * call that renders the whole roster" convention, so a panel doesn't need to
 * already know every contributor id.
 *
 * @module state/dailyMissionResults
 */

import type { AttributedContribution } from "debate-research-evidence/src/lib/contribution-leaderboard";
import { buildDailyQuestBoard, type QuestContribution, type QuestTemplate } from "debate-team-collaboration/src/lib/daily-quests";
import { getUtcDayKey } from "debate-research-evidence/src/lib/daily-best-card";
import {
  buildContributorQuestStreak,
  computeDailyMissionResult,
  deriveEarnedStreakMilestoneEvents,
  DEFAULT_STREAK_MILESTONES,
  type ContributorQuestStreak,
  type DailyMissionResult,
  type StreakMilestone,
  type StreakMilestoneEvent,
} from "../lib/gamified-quests";
import { listContributionsByContributor } from "debate-research-evidence/src/state/contributions";

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

/** Whether a persisted contribution carries the `submittedAt` timestamp `daily-quests.ts` needs to match it to a calendar day. */
function hasSubmittedAt(
  contribution: AttributedContribution,
): contribution is AttributedContribution & { submittedAt: number } {
  return typeof (contribution as { submittedAt?: unknown }).submittedAt === "number";
}

/**
 * Computes a contributor's mission result for the UTC calendar day of `now`
 * directly from their real, persisted contributions (`state/contributions.ts`)
 * — rather than a caller-held in-memory list — and saves it here, upserting
 * any existing record for that day. Contributions without a `submittedAt`
 * timestamp (added by `daily-quests.ts`'s `QuestContribution`, a superset of
 * the persisted `AttributedContribution`) are excluded rather than throwing,
 * since not every contribution kind is necessarily quest-tracked. Returns
 * the saved record.
 */
export function computeAndSavePersistedDailyMissionResult(
  contributorId: string,
  quests: QuestTemplate[],
  now: number,
): DailyMissionResultRecord {
  const contributions = listContributionsByContributor(contributorId).filter(hasSubmittedAt) as QuestContribution[];
  const dayKey = getUtcDayKey(now);
  const board = buildDailyQuestBoard(quests, contributions, now);
  const result = computeDailyMissionResult(board, dayKey);
  const record: DailyMissionResultRecord = { contributorId, ...result };
  saveDailyMissionResult(record);
  return record;
}

/**
 * Builds the full streak+badge roster: every contributor with at least one
 * persisted mission result, each resolved through
 * `buildPersistedContributorQuestStreak`, sorted alphabetically by
 * `contributorId` for a stable, deterministic roster order. An empty store
 * returns an empty roster rather than throwing.
 */
export function buildPersistedQuestStreakRoster(
  asOfDayKey: string,
  milestones: StreakMilestone[] = DEFAULT_STREAK_MILESTONES,
): ContributorQuestStreak[] {
  const contributorIds = Array.from(new Set(readAll().map((record) => record.contributorId))).sort();

  return contributorIds.map((contributorId) =>
    buildPersistedContributorQuestStreak(contributorId, asOfDayKey, milestones),
  );
}

/** A contributor's streak-milestone crossing, as derived from their persisted mission-result history. */
export type ContributorStreakMilestoneEvent = StreakMilestoneEvent & { contributorId: string };

/**
 * Finds every contributor's streak-milestone crossings across their full
 * persisted mission-result history — the "quest streak milestones" News
 * Stream category noted as unwired in `news-stream.md`'s Known gaps. Reuses
 * `listDailyMissionResultsForContributor`'s already-persisted history
 * directly (no new store), grouped by contributor and run through
 * `gamified-quests.ts`'s `deriveEarnedStreakMilestoneEvents`, sorted newest
 * day first, tied-broken by `contributorId` for a stable, deterministic
 * order.
 */
export function buildQuestStreakMilestoneEvents(
  milestones: StreakMilestone[] = DEFAULT_STREAK_MILESTONES,
): ContributorStreakMilestoneEvent[] {
  const contributorIds = Array.from(new Set(readAll().map((record) => record.contributorId))).sort();

  const events = contributorIds.flatMap((contributorId) =>
    deriveEarnedStreakMilestoneEvents(listDailyMissionResultsForContributor(contributorId), milestones).map(
      (event): ContributorStreakMilestoneEvent => ({ ...event, contributorId }),
    ),
  );

  return events.sort((a, b) => b.dayKey.localeCompare(a.dayKey) || a.contributorId.localeCompare(b.contributorId));
}

/** A contributor's fully completed Daily Quests board for one day, as derived from their persisted mission-result history. */
export interface DailyQuestCompletionEvent {
  contributorId: string;
  dayKey: string;
}

/**
 * Finds every persisted day where a contributor completed their whole Daily
 * Quests board — the "a completion celebration posted to the News Stream
 * feed" follow-up named under the "🎯 Daily Quests and Targets" bullet in
 * TODO.md. Unlike `buildQuestStreakMilestoneEvents` (which only fires on a
 * milestone-length streak crossing), this fires on every completed day, so
 * `state/newsStream.ts` caps how many of these it renders — same convention
 * as `sprintNoteNews()`/`argumentLibraryNews()`. Sorted newest day first,
 * tie-broken by `contributorId` for a stable, deterministic order.
 */
export function buildDailyQuestCompletionEvents(): DailyQuestCompletionEvent[] {
  return readAll()
    .filter((record) => record.isComplete)
    .map((record): DailyQuestCompletionEvent => ({ contributorId: record.contributorId, dayKey: record.dayKey }))
    .sort((a, b) => b.dayKey.localeCompare(a.dayKey) || a.contributorId.localeCompare(b.contributorId));
}
