/**
 * @fileoverview Persistent storage for a small history log of "Check this
 * page" lookups — closes idea #7's ("On Page Card Reuse Search") first
 * still-open follow-up in TODO.md's Product Feature Ideas list: "Surface
 * each check's result inline in a small history list on `/cards/library`
 * instead of a one-shot lookup." Before this, `EvidenceLibraryPanel`'s
 * `reuseCheckResult`/`remoteReuseCheckResult` state held only the *latest*
 * check, overwritten on every new lookup. Stores records in localStorage,
 * mirroring the existing `evidenceLibraryEntries.ts`/`contributions.ts`
 * persistence convention (SSR/no-storage-safe, corrupt or missing JSON
 * degrades to an empty list rather than throwing).
 *
 * Records only the local (`checkPersistedPageForExistingCards`) outcome —
 * this browser's own evidence repository — not the async team-wide shared
 * index result (`checkRemotePageForExistingCards`), mirroring how the "Check
 * this page" box's local check already runs synchronously ahead of the
 * remote one. A future run could append a second record once the remote
 * check resolves, if that turns out to be useful.
 *
 * Follows `judgeDecisions.ts`'s append-only-with-cap shape rather than
 * upserting by URL, so re-checking the same page twice keeps both entries in
 * the log instead of collapsing them.
 *
 * @module state/reuseCheckHistory
 */

import type { PageReuseCheckResult } from "../lib/shared-evidence-library";

export type ReuseCheckHistoryRecord = {
  /** Generated once when the check is recorded; the record's stable identity. */
  id: string;
  url: string;
  alreadyCut: boolean;
  matchCount: number;
  checkedAt: number;
};

const STORAGE_KEY = "reuseCheckHistory";

/**
 * Once the log exceeds this many entries, the oldest ones beyond the cap are
 * trimmed away, mirroring `judgeDecisions.ts`'s `MAX_JUDGE_DECISIONS_PER_ROUND`
 * cap-constant convention.
 */
export const MAX_REUSE_CHECK_HISTORY = 20;

function readAll(): ReuseCheckHistoryRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ReuseCheckHistoryRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: ReuseCheckHistoryRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function generateReuseCheckHistoryId(): string {
  return `reuse-check-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Every persisted "Check this page" record, newest-first. */
export function listReuseCheckHistory(): ReuseCheckHistoryRecord[] {
  return readAll().sort((a, b) => b.checkedAt - a.checkedAt);
}

/**
 * Records a completed local reuse check, assigning it a fresh `id`. Once the
 * log exceeds `MAX_REUSE_CHECK_HISTORY` entries, the oldest ones beyond the
 * cap are trimmed away.
 */
export function appendReuseCheckHistory(
  result: PageReuseCheckResult,
  checkedAt: number = Date.now(),
): ReuseCheckHistoryRecord {
  const record: ReuseCheckHistoryRecord = {
    id: generateReuseCheckHistoryId(),
    url: result.url,
    alreadyCut: result.alreadyCut,
    matchCount: result.matches.length,
    checkedAt,
  };
  const trimmed = [...readAll(), record]
    .sort((a, b) => b.checkedAt - a.checkedAt)
    .slice(0, MAX_REUSE_CHECK_HISTORY);
  writeAll(trimmed);
  return record;
}

/** Clears the entire history log (a "Clear history" action). */
export function clearReuseCheckHistory(): void {
  writeAll([]);
}
