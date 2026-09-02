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
 * @module state/unlockCelebrations
 */

import { getNewlyEarnedBadges } from "../lib/unlock-celebration";

const STORAGE_KEY = "unlockCelebrationSeenBadges";

type SeenBadgesStore = Record<string, string[]>;

function readStore(): SeenBadgesStore {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as SeenBadgesStore) : {};
  } catch {
    return {};
  }
}

function writeStore(store: SeenBadgesStore): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

/** The badge list last recorded as "seen" for a contributor, or `undefined` if never recorded. */
export function getSeenBadges(contributorId: string): string[] | undefined {
  return readStore()[contributorId];
}

/** Records `badges` as the contributor's new "seen" baseline. */
export function markBadgesSeen(contributorId: string, badges: string[]): void {
  const store = readStore();
  store[contributorId] = badges;
  writeStore(store);
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
  writeStore({});
}
