/**
 * @fileoverview Persistent storage for `revision-incentives.ts`'s `CardRevision`
 * events — the "(a) wiring actual card-edit events into a persisted revision
 * history" follow-up named in the "Revision Incentives" bullet in TODO.md's
 * Research Crowdsourcing Organizer Features list. Unlike this package's other
 * persistence stores, a card can be revised many times, so records aren't
 * keyed by `cardId`/`contributorId` alone — each recorded revision gets its
 * own synthetic `id` and `revisedAt` timestamp (assigned by the caller), and
 * saving appends a new history entry rather than overwriting a prior one for
 * the same card, mirroring the existing `drillSets.ts` wrapped-record
 * convention (SSR/no-storage-safe, corrupt or missing JSON degrades to an
 * empty list rather than throwing). Since `CardRevisionRecord` is a superset
 * of `CardRevision`, a list of records can be passed directly into
 * `revision-incentives.ts`'s scoring functions (`evaluateRevision`,
 * `buildRevisionIncentiveLeaderboard`, etc.) without stripping the extra
 * fields.
 *
 * @module state/revisionHistory
 */

import type { CardRevision, ContributorRevisionStats, RevisionRewardWeights } from "../lib/revision-incentives";
import { buildRevisionIncentiveLeaderboard, DEFAULT_REVISION_REWARD_WEIGHTS } from "../lib/revision-incentives";
import { getUtcDayKey } from "../lib/daily-best-card";

/** A `CardRevision` as persisted: a unique id plus when it was recorded. */
export interface CardRevisionRecord extends CardRevision {
  /** Unique id for this revision event, distinct from `cardId` since a card can be revised many times. */
  id: string;
  /** ISO timestamp of when this revision was recorded. */
  revisedAt: string;
}

const STORAGE_KEY = "revisionHistory";

function readAll(): CardRevisionRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CardRevisionRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: CardRevisionRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function byRevisedAtAscending(a: CardRevisionRecord, b: CardRevisionRecord): number {
  return a.revisedAt.localeCompare(b.revisedAt);
}

/** Lists every persisted revision record, across all cards and contributors, oldest first. */
export function listRevisionHistory(): CardRevisionRecord[] {
  return readAll().sort(byRevisedAtAscending);
}

/** Lists every persisted revision record for one card, oldest first. */
export function listRevisionHistoryForCard(cardId: string): CardRevisionRecord[] {
  return readAll()
    .filter((record) => record.cardId === cardId)
    .sort(byRevisedAtAscending);
}

/** Lists every persisted revision record attributed to one contributor, oldest first. */
export function listRevisionHistoryForContributor(contributorId: string): CardRevisionRecord[] {
  return readAll()
    .filter((record) => record.contributorId === contributorId)
    .sort(byRevisedAtAscending);
}

/** Looks up a single persisted revision record by id, if any. */
export function getRevisionRecord(id: string): CardRevisionRecord | undefined {
  return readAll().find((record) => record.id === id);
}

/** Saves a revision record, overwriting any existing record with the same id, appending otherwise. */
export function saveRevisionRecord(record: CardRevisionRecord): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.id === record.id);
  if (index === -1) {
    records.push(record);
  } else {
    records[index] = record;
  }
  writeAll(records);
}

/** Deletes a persisted revision record by id; a no-op if it isn't stored. */
export function deleteRevisionRecord(id: string): void {
  writeAll(readAll().filter((record) => record.id !== id));
}

/**
 * Builds the Revision Incentives leaderboard directly from every persisted
 * revision record, composing this store with `revision-incentives.ts`'s pure
 * `buildRevisionIncentiveLeaderboard` rather than requiring a caller to hold
 * and pass in the full revision list themselves — mirroring the existing
 * `contributions.ts` `buildPersistedLeaderboard` "compose the pure function
 * directly against the persisted store" convention. An empty store returns
 * an empty leaderboard rather than throwing.
 */
export function buildPersistedRevisionIncentiveLeaderboard(
  weights: RevisionRewardWeights = DEFAULT_REVISION_REWARD_WEIGHTS,
): ContributorRevisionStats[] {
  return buildRevisionIncentiveLeaderboard(readAll(), weights);
}

/** One UTC day's top Revision Incentives earner, derived from that day's persisted revisions. */
export interface DailyTopReviserAnnouncement {
  dayKey: string;
  topContributor: ContributorRevisionStats;
}

/**
 * Finds each UTC calendar day's top Revision Incentives earner, derived
 * directly from that day's persisted revision records — the "revision
 * incentive standings" News Stream category noted as unwired in
 * `news-stream.md`'s Known gaps. Groups every persisted record by the UTC
 * day of its `revisedAt`, scores each day's group independently via
 * `buildRevisionIncentiveLeaderboard`, and keeps only the #1 contributor per
 * day that earned a nonzero reward — a day with no rewarded revision is
 * excluded rather than reported as a zero-point "winner". Purely derived, no
 * separate announcement store needed: replaying the same persisted history
 * always regroups into the same daily standings. Sorted newest day first.
 */
export function buildDailyTopReviserAnnouncements(
  weights: RevisionRewardWeights = DEFAULT_REVISION_REWARD_WEIGHTS,
): DailyTopReviserAnnouncement[] {
  const byDay = new Map<string, CardRevisionRecord[]>();
  for (const record of readAll()) {
    const dayKey = getUtcDayKey(Date.parse(record.revisedAt));
    const group = byDay.get(dayKey);
    if (group) {
      group.push(record);
    } else {
      byDay.set(dayKey, [record]);
    }
  }

  const announcements: DailyTopReviserAnnouncement[] = [];
  for (const [dayKey, records] of byDay) {
    const top = buildRevisionIncentiveLeaderboard(records, weights)[0];
    if (top && top.totalRewardPoints > 0) announcements.push({ dayKey, topContributor: top });
  }

  return announcements.sort((a, b) => b.dayKey.localeCompare(a.dayKey));
}
