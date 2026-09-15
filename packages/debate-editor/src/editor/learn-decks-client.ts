/**
 * @fileoverview Network calls for the Learn custom-deck account sync (see
 * `learn-decks-sync.ts`'s module doc and `apps/debate-ai.com`'s
 * `lib/database/schema.ts#savedLearnDecks` / `/api/learn-decks`). Kept
 * separate from `learn-decks-sync.ts` so the fetch calls stay easy to
 * mock, mirroring `learn-cards-client.ts`'s split.
 *
 * `listSavedLearnDecks` resolves to `null` (rather than throwing) on a
 * `401`, letting the caller fall back to local-only persistence. The write
 * calls throw on failure since the deck is already saved locally either
 * way — a failed cloud sync is reported but never blocks or rolls back the
 * local change.
 *
 * @module editor/learn-decks-client
 */

import type { CustomDeck } from './learn-store.js';

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Lists every custom deck synced to the current user's account. Returns `null` when signed out (a `401` response). */
export async function listSavedLearnDecks(
  endpoint = '/api/learn-decks',
): Promise<CustomDeck[] | null> {
  const res = await fetch(endpoint);
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Failed to load your synced decks.'));
  }
  return (await res.json()) as CustomDeck[];
}

/** Saves (upserts, keyed by `deck.deckId`) a custom deck to the current user's account. Throws on failure, `401` included. */
export async function saveLearnDeckToAccount(
  deck: CustomDeck,
  endpoint = '/api/learn-decks',
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(deck.deckId)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deck }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Failed to sync this deck to your account.'));
  }
}

/** Deletes a synced custom deck from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedLearnDeckFromAccount(
  deckId: string,
  endpoint = '/api/learn-decks',
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(deckId)}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Failed to remove this synced deck.'));
  }
}
