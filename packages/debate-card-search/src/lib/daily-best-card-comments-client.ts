/**
 * @fileoverview Network calls for the Daily Best Card comment-thread D1 sync
 * (the "🕵️ Daily Best Card Challenge" bullet's "a comment thread on each
 * day's winner" follow-up in TODO.md). Kept separate from
 * `state/dailyBestCardComments.ts`'s pure validation/storage helpers so
 * those stay unit-testable without mocking the API client, mirroring
 * `debate-round`'s `round/judge-decisions-client.ts` split.
 *
 * Talks to `apps/debate-ai.com`'s `/api/daily-best-card-comments` routes
 * (via `debate-api-client`), which require an authenticated session —
 * `listSavedDailyBestCardComments` resolves to `null` (rather than
 * throwing) on a `401`, letting the caller
 * (`hooks/useDailyBestCardComments.ts`) fall back to local-storage-only
 * comments instead of showing an error. The write calls
 * (`saveDailyBestCardCommentToAccount`, `deleteSavedDailyBestCardCommentFromAccount`)
 * throw on failure since the caller already has the comment in local state
 * either way — a failed cloud sync is reported but never blocks posting.
 *
 * @module lib/daily-best-card-comments-client
 */

import {
  deleteDailyBestCardComment,
  listDailyBestCardComments,
  syncDailyBestCardComment,
  type Client,
} from "debate-api-client";
import { apiClient, httpStatus } from "./api-client";
import type { DailyBestCardComment } from "../state/dailyBestCardComments";

/** Lists every Daily Best Card comment synced to the current user's account, across every day. Returns `null` when signed out (a `401` response). */
export async function listSavedDailyBestCardComments(
  client: Client = apiClient,
): Promise<DailyBestCardComment[] | null> {
  const { data, error } = await listDailyBestCardComments({}, { client });
  if (error) {
    if (httpStatus(error) === 401) return null;
    throw new Error("Failed to load your synced comments.");
  }
  return (data ?? []) as unknown as DailyBestCardComment[];
}

/** Saves (upserts, keyed by `comment.id`) a comment to the current user's account. Throws on failure, `401` included. */
export async function saveDailyBestCardCommentToAccount(
  comment: DailyBestCardComment,
  client: Client = apiClient,
): Promise<void> {
  const { error } = await syncDailyBestCardComment(
    { path: { commentId: comment.id }, body: { comment: comment as unknown as Record<string, unknown> & { id: string } } },
    { client },
  );
  if (error) {
    throw new Error("Failed to sync this comment to your account.");
  }
}

/** Deletes a synced comment from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedDailyBestCardCommentFromAccount(
  id: string,
  client: Client = apiClient,
): Promise<void> {
  const { error } = await deleteDailyBestCardComment({ path: { commentId: id } }, { client });
  if (error) {
    throw new Error("Failed to remove this synced comment.");
  }
}
