/**
 * @fileoverview Version history for a `CoachingSessionRecord` that gets
 * regenerated in place — the "a coaching-session history timeline per
 * round" follow-up named under the "🎙️ AI Coach Mode" bullet in TODO.md's
 * Research Crowdsourcing Organizer Features list. Stores a snapshot of a
 * round+side's coaching session every time `state/coachingSessions.ts`'s
 * `saveCoachingSession` overwrites an existing record for that
 * roundId+sideKey pair, mirroring `debate-speech-writer`'s
 * `state/coachMaterialVersions.ts` pattern exactly (same snapshot-on-
 * overwrite shape, same per-key cap, same `listVersionsFor.../delete
 * VersionsFor.../...FromVersion` helper trio). Local-only, matching the
 * base `state/coachingSessions.ts` store itself — no account sync exists
 * for coaching sessions yet.
 *
 * @module state/coachingSessionHistory
 */

import type { CoachingPrompt } from "debate-round/src/flow/coach-mode";

/** The fields of a `CoachingSessionRecord` a snapshot needs — kept independent of that module's own type to avoid a circular import. */
export type CoachingSessionSnapshotInput = {
  roundId: string;
  sideKey: string;
  prompts: CoachingPrompt[];
  aiFeedback?: string;
  createdAt?: number;
};

/** A snapshot of a round+side's coaching session as it stood just before being overwritten. */
export interface CoachingSessionHistoryEntry {
  id: string;
  roundId: string;
  sideKey: string;
  prompts: CoachingPrompt[];
  aiFeedback?: string;
  /** The snapshotted session's own generation time, if it had one. */
  createdAt?: number;
  /** When this snapshot was superseded by the save that captured it. */
  replacedAt: number;
}

const STORAGE_KEY = "coachingSessionHistory";

/** Oldest versions beyond this count are dropped per roundId+sideKey pair, newest kept. */
export const MAX_COACHING_SESSION_VERSIONS = 10;

function readAll(): CoachingSessionHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CoachingSessionHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function writeAll(entries: CoachingSessionHistoryEntry[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function forPair(
  entries: CoachingSessionHistoryEntry[],
  roundId: string,
  sideKey: string,
): CoachingSessionHistoryEntry[] {
  return entries.filter((entry) => entry.roundId === roundId && entry.sideKey === sideKey);
}

/**
 * Snapshots `previous` as a version of its roundId+sideKey pair, called by
 * `state/coachingSessions.ts`'s `saveCoachingSession` right before it
 * overwrites an existing record. Trims the oldest snapshot for that pair
 * once its count exceeds `MAX_COACHING_SESSION_VERSIONS`.
 */
export function appendCoachingSessionVersion(
  previous: CoachingSessionSnapshotInput,
  replacedAt: number = Date.now(),
): CoachingSessionHistoryEntry {
  const entries = readAll();
  // Suffix with the count of versions already stored for this pair (not
  // just `replacedAt`) so two overwrites within the same millisecond still
  // get distinct ids.
  const priorCount = forPair(entries, previous.roundId, previous.sideKey).length;
  const entry: CoachingSessionHistoryEntry = {
    id: `${previous.roundId}-${previous.sideKey}-v${replacedAt}-${priorCount}`,
    roundId: previous.roundId,
    sideKey: previous.sideKey,
    prompts: previous.prompts,
    aiFeedback: previous.aiFeedback,
    createdAt: previous.createdAt,
    replacedAt,
  };

  entries.push(entry);

  const pairEntries = forPair(entries, previous.roundId, previous.sideKey);
  if (pairEntries.length > MAX_COACHING_SESSION_VERSIONS) {
    const oldest = pairEntries.slice(0, pairEntries.length - MAX_COACHING_SESSION_VERSIONS);
    const oldestIds = new Set(oldest.map((existing) => existing.id));
    writeAll(entries.filter((existing) => !oldestIds.has(existing.id)));
  } else {
    writeAll(entries);
  }

  return entry;
}

/**
 * Every persisted version of a roundId+sideKey pair, newest first.
 * Reverses storage (insertion) order rather than sorting by `replacedAt`
 * directly, since two overwrites in the same millisecond would otherwise
 * tie and fall back to an arbitrary order.
 */
export function listVersionsForCoachingSession(roundId: string, sideKey: string): CoachingSessionHistoryEntry[] {
  return forPair(readAll(), roundId, sideKey).reverse();
}

/**
 * Deletes every persisted version of a roundId+sideKey pair — called when
 * that pair's current coaching session itself is cleared, so "Clear" fully
 * resets the session rather than leaving orphaned history behind. Returns
 * the ids that were actually removed so a future account-sync caller knows
 * exactly which ids to also remove from the account; an empty array if none
 * were stored.
 */
export function deleteVersionsForCoachingSession(roundId: string, sideKey: string): string[] {
  const all = readAll();
  const removedIds = forPair(all, roundId, sideKey).map((entry) => entry.id);
  if (removedIds.length > 0) {
    writeAll(all.filter((entry) => !(entry.roundId === roundId && entry.sideKey === sideKey)));
  }
  return removedIds;
}

/** Rebuilds a `CoachingSessionSnapshotInput` from a snapshot, ready to pass back to `saveCoachingSession` to restore it. */
export function coachingSessionFromVersion(entry: CoachingSessionHistoryEntry): CoachingSessionSnapshotInput {
  return {
    roundId: entry.roundId,
    sideKey: entry.sideKey,
    prompts: entry.prompts,
    aiFeedback: entry.aiFeedback,
    createdAt: entry.createdAt,
  };
}
