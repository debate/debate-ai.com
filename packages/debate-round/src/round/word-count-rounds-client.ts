/**
 * @fileoverview Network calls for the word-count-round history D1 sync
 * (TODO.md idea #2's "account-sync round history itself... so the trend
 * view follows a signed-in user across devices" follow-up). Kept separate
 * from `state/savedWordCountRounds.ts`'s pure validation helpers so those
 * stay unit-testable without mocking `fetch`, mirroring
 * `round/saved-flows-client.ts`'s split.
 *
 * Talks to `apps/debate-ai.com`'s `/api/word-count-rounds` routes, which
 * require an authenticated session — `listSavedWordCountRounds` resolves to
 * `null` (rather than throwing) on a `401`, letting the caller
 * (`hooks/useWordCountRounds.ts`) fall back to local-storage-only history
 * instead of showing an error. The write calls
 * (`saveWordCountRoundToAccount`, `deleteSavedWordCountRoundFromAccount`)
 * throw on failure since the caller already has the round in local state
 * either way — a failed cloud sync is reported but never blocks local
 * saving.
 *
 * @module round/word-count-rounds-client
 */

import type { WordCountRoundRecord } from "../state/wordCountRounds";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Lists every word-count round synced to the current user's account. Returns `null` when signed out (a `401` response). */
export async function listSavedWordCountRounds(
  endpoint = "/api/word-count-rounds",
): Promise<WordCountRoundRecord[] | null> {
  const res = await fetch(endpoint);
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to load your synced word-count rounds."));
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
    throw new Error(await readErrorMessage(res, "Failed to sync this round to your account."));
  }
}

/** Deletes a synced word-count round from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedWordCountRoundFromAccount(
  roundId: string,
  endpoint = "/api/word-count-rounds",
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(roundId)}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to remove this synced round."));
  }
}
