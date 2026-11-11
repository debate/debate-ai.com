/**
 * @fileoverview Network calls for the word-count-round D1 sync. Kept apart
 * from `state/savedWordCountRounds.ts`'s pure validation so that stays
 * testable without mocking `fetch`, the same split as
 * `round/drill-sets-client.ts`.
 *
 * Talks to `apps/debate-web`'s `/api/word-count-rounds` routes, which need a
 * signed-in session. `listSavedWordCountRounds` resolves to `null` (rather
 * than throwing) on a `401`, so `hooks/useWordCountRounds.ts` falls back to
 * this browser's rounds only. The write calls throw on failure; the caller
 * already has the round saved locally either way.
 *
 * @module round/word-count-rounds-client
 */

import type { WordCountRoundRecord } from "@debate-ai/round/src/state/wordCountRounds";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Lists every word-count round saved to the current user's account. Returns `null` when signed out (a `401` response). */
export async function listSavedWordCountRounds(
  endpoint = "/api/word-count-rounds",
): Promise<WordCountRoundRecord[] | null> {
  const res = await fetch(endpoint);
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to load your saved word-count rounds."));
  }
  return (await res.json()) as WordCountRoundRecord[];
}

/** Saves (upserts, keyed by `record.roundId`) a word-count round to the current user's account. Throws on failure, `401` included. */
export async function saveWordCountRoundToAccount(
  record: WordCountRoundRecord,
  endpoint = "/api/word-count-rounds",
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(record.roundId)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ record }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to save this round to your account."));
  }
}

/** Deletes a word-count round from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedWordCountRoundFromAccount(
  roundId: string,
  endpoint = "/api/word-count-rounds",
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(roundId)}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to remove this round from your account."));
  }
}
