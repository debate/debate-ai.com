/**
 * @fileoverview Network calls for the Daily Best Card comment-thread D1 sync
 * (the "🕵️ Daily Best Card Challenge" bullet's "a comment thread on each
 * day's winner" follow-up in TODO.md). Kept separate from
 * `state/dailyBestCardComments.ts`'s pure validation/storage helpers so
 * those stay unit-testable without mocking `fetch`, mirroring
 * `debate-round`'s `round/judge-decisions-client.ts` split.
 *
 * Talks to `apps/debate-ai.com`'s `/api/daily-best-card-comments` routes,
 * which require an authenticated session — `listSavedDailyBestCardComments`
 * resolves to `null` (rather than throwing) on a `401`, letting the caller
 * (`hooks/useDailyBestCardComments.ts`) fall back to local-storage-only
 * comments instead of showing an error. The write calls
 * (`saveDailyBestCardCommentToAccount`, `deleteSavedDailyBestCardCommentFromAccount`)
 * throw on failure since the caller already has the comment in local state
 * either way — a failed cloud sync is reported but never blocks posting.
 *
 * @module lib/daily-best-card-comments-client
 */

import type { DailyBestCardComment } from "../state/dailyBestCardComments";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Lists every Daily Best Card comment synced to the current user's account, across every day. Returns `null` when signed out (a `401` response). */
export async function listSavedDailyBestCardComments(
  endpoint = "/api/daily-best-card-comments",
): Promise<DailyBestCardComment[] | null> {
  const res = await fetch(endpoint);
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to load your synced comments."));
  }
  return (await res.json()) as DailyBestCardComment[];
}

/** Saves (upserts, keyed by `comment.id`) a comment to the current user's account. Throws on failure, `401` included. */
export async function saveDailyBestCardCommentToAccount(
  comment: DailyBestCardComment,
  endpoint = "/api/daily-best-card-comments",
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(comment.id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ comment }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to sync this comment to your account."));
  }
}

/** Deletes a synced comment from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedDailyBestCardCommentFromAccount(
  id: string,
  endpoint = "/api/daily-best-card-comments",
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to remove this synced comment."));
  }
}
