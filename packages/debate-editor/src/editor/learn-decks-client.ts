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
 * `applyLearnDeckOpToAccount` is the op-based alternative to
 * `saveLearnDeckToAccount`'s whole-deck replace — see `learn-deck-op.ts`'s
 * module doc and `learn-decks-sync.ts#pushDeckChange`.
 *
 * @module editor/learn-decks-client
 */

import type { CustomDeck } from './learn-store.js';
import type { LearnDeckOp } from './learn-deck-op.js';

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

/**
 * Applies a single add-card/remove-card/rename op to a synced deck,
 * resolved server-side against the account's *current* stored deck rather
 * than a client-computed whole-deck replace — the fix for the "two devices
 * edit the same deck at once" lost-update race `saveLearnDeckToAccount`'s
 * whole-deck `PUT` is exposed to.
 *
 * Returns `false` (rather than throwing) on a `404`: the deck hasn't
 * reached the account yet (e.g. this device's own create push is still in
 * flight), so the caller should fall back to a full `saveLearnDeckToAccount`
 * push instead. Throws on any other failure.
 */
export async function applyLearnDeckOpToAccount(
  deckId: string,
  op: LearnDeckOp,
  endpoint = '/api/learn-decks',
): Promise<boolean> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(deckId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(op),
  });
  if (res.status === 404) return false;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Failed to sync this deck change to your account.'));
  }
  return true;
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
