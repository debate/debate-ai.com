/**
 * @fileoverview Network calls for the Learn review-log account sync (see
 * `learn-review-log-sync.ts`'s module doc and `apps/debate-ai.com`'s
 * `lib/database/schema.ts#savedLearnReviewLog` / `/api/learn-review-log`).
 * Kept separate from `learn-review-log-sync.ts` so the fetch calls stay
 * easy to mock, mirroring `learn-cards-client.ts`'s split.
 *
 * `listSavedReviewLogEntries` resolves to `null` (rather than throwing) on
 * a `401`, letting the caller fall back to local-only history. The write
 * calls throw on failure since the entry is already saved locally either
 * way — a failed cloud sync is reported but never blocks or rolls back the
 * local change. Unlike `learn-cards-client.ts`, there is no conflict
 * response to handle: a review-log entry never changes after it's logged
 * (see `reviewLogEntryId`), so a `PUT` is a plain idempotent upsert.
 *
 * @module editor/learn-review-log-client
 */

import { reviewLogEntryId, type ReviewLogEntry } from './learn-store.js';

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Lists every review-log entry synced to the current user's account. Returns `null` when signed out (a `401` response). */
export async function listSavedReviewLogEntries(
  endpoint = '/api/learn-review-log',
): Promise<ReviewLogEntry[] | null> {
  const res = await fetch(endpoint);
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Failed to load your synced review history.'));
  }
  return (await res.json()) as ReviewLogEntry[];
}

/** Saves (upserts, keyed by `reviewLogEntryId(entry)`) a review-log entry to the current user's account. Throws on failure, `401` included. */
export async function saveReviewLogEntryToAccount(
  entry: ReviewLogEntry,
  endpoint = '/api/learn-review-log',
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(reviewLogEntryId(entry))}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ entry }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Failed to sync this review to your account.'));
  }
}

/** Deletes a synced review-log entry from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedReviewLogEntryFromAccount(
  entryId: string,
  endpoint = '/api/learn-review-log',
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(entryId)}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Failed to remove this synced review.'));
  }
}
