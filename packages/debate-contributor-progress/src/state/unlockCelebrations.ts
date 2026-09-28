/**
 * @fileoverview Persisted "last-seen badges" per contributor, closing the
 * "🔓 Progress Unlocks" bullet's own next-named follow-up in TODO.md: "a
 * small unlock celebration toast when a tier/badge is earned." Stores each
 * contributor's last-seen badge list in localStorage, mirroring the existing
 * `reuseCheckHistory.ts`/`evidenceLibraryEntries.ts` persistence convention
 * (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty store
 * rather than throwing).
 *
 * A contributor seen for the first time ever (no baseline recorded yet)
 * never celebrates on that first sight —
 * `lib/unlock-celebration.ts#getNewlyEarnedBadges` treats an `undefined`
 * baseline as "nothing to compare, don't celebrate" so a contributor with
 * existing badges doesn't get a false "just earned" celebration the very
 * first time this baseline is recorded for them.
 *
 * Stored as an array of `{ id, badges }` records (`id` the contributor's
 * id) rather than the plain `Record<contributorId, string[]>` map this store
 * originally used — the reshape that closes the "per-browser localStorage,
 * not account-synced" gap `debate-data-sync`'s `toolRecordCollections.ts`
 * doc comment names: a `TOOL_RECORD_COLLECTIONS` entry requires a JSON array
 * under one key, each element carrying a stable string id field, and a plain
 * object map can't be keyed that way. `readAll` also accepts the legacy
 * object shape (reading it back as an array, one record per key) so a
 * baseline recorded before this reshape shipped isn't silently dropped —
 * the very next `markBadgesSeen`/`clearAllSeenBadges` call rewrites it in
 * the new array shape. The public API (`getSeenBadges`/`markBadgesSeen`/
 * `recordAndGetNewlyEarnedBadges`/`clearAllSeenBadges`) is unchanged, so
 * `panels/ProgressUnlocksPanel.tsx` needed no changes.
 *
 * @module state/unlockCelebrations
 */

import { getNewlyEarnedBadges } from "../lib/unlock-celebration";

const STORAGE_KEY = "unlockCelebrationSeenBadges";

/** One contributor's persisted "last-seen badges" baseline. */
export type UnlockCelebrationSeenBadgesRecord = {
  /**
   * Stable id this record is keyed by — the contributor's id — what lets it
   * join `debate-data-sync`'s account-sync allowlist (see
   * `state/toolRecordCollections.ts`'s `unlockCelebrations` entry).
   */
  id: string;
  badges: string[];
};

function isSeenBadgesRecord(value: unknown): value is UnlockCelebrationSeenBadgesRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string" &&
    Array.isArray((value as { badges?: unknown }).badges)
  );
}

/**
 * Reads the legacy `Record<contributorId, string[]>` shape back as an array
 * of records, one per key whose value is a string array — anything else
 * (a stray non-array value under a key) is skipped rather than throwing.
 */
function fromLegacyShape(legacy: Record<string, unknown>): UnlockCelebrationSeenBadgesRecord[] {
  return Object.entries(legacy)
    .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]))
    .map(([id, badges]) => ({ id, badges }));
}

function readAll(): UnlockCelebrationSeenBadgesRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(isSeenBadgesRecord);
    if (parsed && typeof parsed === "object") return fromLegacyShape(parsed as Record<string, unknown>);
    return [];
  } catch {
    return [];
  }
}

function writeAll(records: UnlockCelebrationSeenBadgesRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** The badge list last recorded as "seen" for a contributor, or `undefined` if never recorded. */
export function getSeenBadges(contributorId: string): string[] | undefined {
  return readAll().find((record) => record.id === contributorId)?.badges;
}

/** Records `badges` as the contributor's new "seen" baseline, overwriting any existing one. */
export function markBadgesSeen(contributorId: string, badges: string[]): void {
  const records = readAll();
  const index = records.findIndex((record) => record.id === contributorId);
  const withId: UnlockCelebrationSeenBadgesRecord = { id: contributorId, badges };
  if (index === -1) {
    records.push(withId);
  } else {
    records[index] = withId;
  }
  writeAll(records);
}

/**
 * Diffs `currentBadges` against the contributor's persisted "seen" baseline
 * to find newly earned badges, then immediately updates the baseline to
 * `currentBadges` so the same badges aren't reported again on a later call
 * (e.g. a re-render, or another tab's live-update refresh). This is the one
 * function callers should use — it composes
 * `lib/unlock-celebration.ts#getNewlyEarnedBadges` directly against this
 * store, mirroring `unlock-streak-status.ts`'s existing "compose the pure
 * function directly against the persisted store" convention.
 */
export function recordAndGetNewlyEarnedBadges(contributorId: string, currentBadges: string[]): string[] {
  const previousBadges = getSeenBadges(contributorId);
  const newlyEarned = getNewlyEarnedBadges(previousBadges, currentBadges);
  markBadgesSeen(contributorId, currentBadges);
  return newlyEarned;
}

/** Clears every contributor's persisted "seen" baseline. */
export function clearAllSeenBadges(): void {
  writeAll([]);
}
