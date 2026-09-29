/**
 * @fileoverview Network calls for the Quick Cards account sync (see
 * `quick-cards-store.ts`'s "Account sync" module-doc section and
 * `apps/debate-ai.com`'s `lib/database/schema.ts#savedQuickCards` /
 * `/api/quick-cards`). Kept separate from `quick-cards-store.ts` so the
 * fetch calls stay easy to mock, mirroring `speech-send-log-client.ts`'s
 * split.
 *
 * `listSavedQuickCards` resolves to `null` (rather than throwing) on a
 * `401`, letting the store fall back to local-only persistence. The write
 * calls throw on failure since the card is already saved locally either
 * way — a failed cloud sync is reported but never blocks or rolls back the
 * local change. `saveQuickCardToAccount` resolves `{ conflict: true }`
 * instead of throwing on a `409` — the account already has a newer edit of
 * this card from another device (see `quick-cards-store.ts#hasQuickCardSaveConflict`)
 * — so the store can adopt that newer version instead of treating it as a
 * plain failure.
 *
 * @module editor/quick-cards-client
 */

import type { QuickCard } from './quick-cards-store.js';

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Lists every quick card synced to the current user's account. Returns `null` when signed out (a `401` response). */
export async function listSavedQuickCards(
  endpoint = '/api/quick-cards',
): Promise<QuickCard[] | null> {
  const res = await fetch(endpoint);
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Failed to load your synced quick cards.'));
  }
  return (await res.json()) as QuickCard[];
}

/** Result of a `saveQuickCardToAccount` call: either it saved, or the account already had a newer edit of this card (see `hasQuickCardSaveConflict`). */
export type SaveQuickCardResult = { conflict: false } | { conflict: true; current: QuickCard };

/**
 * Saves (upserts, keyed by `card.id`) a quick card to the current user's
 * account. Resolves `{ conflict: true, current }` instead of overwriting
 * when the account already has a newer edit of this card (a `409`); throws
 * on any other failure, `401` included.
 */
export async function saveQuickCardToAccount(
  card: QuickCard,
  endpoint = '/api/quick-cards',
): Promise<SaveQuickCardResult> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(card.id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ card }),
  });
  if (res.status === 409) {
    const payload = (await res.json()) as { current: QuickCard };
    return { conflict: true, current: payload.current };
  }
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Failed to sync this quick card to your account.'));
  }
  return { conflict: false };
}

/** Deletes a synced quick card from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedQuickCardFromAccount(
  id: string,
  endpoint = '/api/quick-cards',
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Failed to remove this synced quick card.'));
  }
}

/** Deletes every synced quick card from the current user's account in one call. Throws on failure, `401` included. */
export async function clearSavedQuickCardsFromAccount(endpoint = '/api/quick-cards'): Promise<void> {
  const res = await fetch(endpoint, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Failed to clear your synced quick cards.'));
  }
}
