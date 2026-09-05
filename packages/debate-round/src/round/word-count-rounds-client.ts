/**
 * @fileoverview Network calls for the word-count-round history D1 sync
 * (TODO.md idea #2's "account-sync round history itself... so the trend
 * view follows a signed-in user across devices" follow-up). Kept separate
 * from `state/savedWordCountRounds.ts`'s pure validation helpers so those
 * stay unit-testable without mocking the API client, mirroring
 * `round/saved-flows-client.ts`'s split.
 *
 * Talks to `apps/debate-ai.com`'s `/api/word-count-rounds` routes (via
 * `debate-api-client`), which require an authenticated session —
 * `listSavedWordCountRounds` resolves to `null` (rather than throwing) on a
 * `401`, letting the caller (`hooks/useWordCountRounds.ts`) fall back to
 * local-storage-only history instead of showing an error. The write calls
 * (`saveWordCountRoundToAccount`, `deleteSavedWordCountRoundFromAccount`)
 * throw on failure since the caller already has the round in local state
 * either way — a failed cloud sync is reported but never blocks local
 * saving.
 *
 * @module round/word-count-rounds-client
 */

import {
  deleteAllWordCountRounds,
  deleteWordCountRound,
  listWordCountRounds,
  syncWordCountRound,
  type Client,
} from "debate-api-client";
import { apiClient, httpStatus } from "../lib/api-client";
import type { WordCountRoundRecord } from "../state/wordCountRounds";

/** Lists every word-count round synced to the current user's account. Returns `null` when signed out (a `401` response). */
export async function listSavedWordCountRounds(client: Client = apiClient): Promise<WordCountRoundRecord[] | null> {
  const { data, error } = await listWordCountRounds({}, { client });
  if (error) {
    if (httpStatus(error) === 401) return null;
    throw new Error("Failed to load your synced word-count rounds.");
  }
  return (data ?? []) as WordCountRoundRecord[];
}

/** Saves (upserts, keyed by `record.roundId`) a word-count round to the current user's account. Throws on failure, `401` included. */
export async function saveWordCountRoundToAccount(
  record: WordCountRoundRecord,
  client: Client = apiClient,
): Promise<void> {
  const { error } = await syncWordCountRound({ path: { roundId: record.roundId }, body: { record } }, { client });
  if (error) {
    throw new Error("Failed to sync this round to your account.");
  }
}

/** Deletes a synced word-count round from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedWordCountRoundFromAccount(
  roundId: string,
  client: Client = apiClient,
): Promise<void> {
  const { error } = await deleteWordCountRound({ path: { roundId } }, { client });
  if (error) {
    throw new Error("Failed to remove this synced round.");
  }
}

/**
 * Deletes every word-count round synced to the current user's account at
 * once — the "delete all my synced history" bulk action. Throws on failure,
 * `401` included.
 */
export async function deleteAllSavedWordCountRoundsFromAccount(client: Client = apiClient): Promise<void> {
  const { error } = await deleteAllWordCountRounds({}, { client });
  if (error) {
    throw new Error("Failed to clear your synced round history.");
  }
}
