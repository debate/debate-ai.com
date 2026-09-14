/**
 * @fileoverview Network calls for the Learn flashcard-content account sync
 * (see `learn-cards-sync.ts`'s module doc and `apps/debate-ai.com`'s
 * `lib/database/schema.ts#savedLearnCards` / `/api/learn-cards`). Kept
 * separate from `learn-cards-sync.ts` so the fetch calls stay easy to
 * mock, mirroring `quick-cards-client.ts`'s split.
 *
 * `listSavedLearnCards` resolves to `null` (rather than throwing) on a
 * `401`, letting the caller fall back to local-only persistence. The write
 * calls throw on failure since the card is already saved locally either
 * way — a failed cloud sync is reported but never blocks or rolls back the
 * local change.
 *
 * @module editor/learn-cards-client
 */

import type { CardDef } from './learn-store.js';

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Lists every flashcard (content only — no schedule/anchor) synced to the current user's account. Returns `null` when signed out (a `401` response). */
export async function listSavedLearnCards(
  endpoint = '/api/learn-cards',
): Promise<CardDef[] | null> {
  const res = await fetch(endpoint);
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Failed to load your synced flashcards.'));
  }
  return (await res.json()) as CardDef[];
}

/** Saves (upserts, keyed by `card.id`) a flashcard's content to the current user's account. Throws on failure, `401` included. */
export async function saveLearnCardToAccount(
  card: CardDef,
  endpoint = '/api/learn-cards',
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(card.id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ card }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Failed to sync this flashcard to your account.'));
  }
}

/** Deletes a synced flashcard from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedLearnCardFromAccount(
  id: string,
  endpoint = '/api/learn-cards',
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Failed to remove this synced flashcard.'));
  }
}
