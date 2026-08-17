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

import type { CardRevision } from "../lib/revision-incentives";

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
