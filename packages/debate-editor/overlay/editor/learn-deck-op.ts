/**
 * @fileoverview Per-deck operations for Learn's account-synced custom decks
 * — the fix for the "two devices editing the same deck's name or membership
 * at once has last-write-win" lost-update race
 * `learn-decks-cloud-save.mdx`'s Known gaps section describes. Mirrors
 * `debate-round`'s `state/favoriteTools.ts#applyFavoriteToolOp` convention:
 * the caller sends just the single card being added/removed, or the new
 * name, and `/api/learn-decks/[deckId]`'s `PATCH` handler resolves it
 * against the row's *current* stored deck (read-then-write) instead of
 * trusting a client-computed whole-deck replace that may already be stale
 * by the time it lands — see `learn-decks-sync.ts`'s `pushDeckChange`.
 *
 * @module editor/learn-deck-op
 */

import type { CustomDeck } from './learn-store.js';

/** Mirrors `debate-search-evidence`'s `MAX_COLLECTION_NAME_LENGTH`-style caps for a user-typed name field. */
const MAX_DECK_NAME_LENGTH = 200;

export type LearnDeckOp = {
  addCardId?: string;
  removeCardId?: string;
  rename?: string;
};

export type LearnDeckOpPatchResult = {
  valid: LearnDeckOp;
  errors: string[];
};

/**
 * Validates an untrusted `{ addCardId }` / `{ removeCardId }` / `{ rename }`
 * patch — exactly one op per request, mirroring
 * `normalizeFavoriteToolOpPatch`'s "one op per call" rule.
 */
export function normalizeLearnDeckOpPatch(input: unknown): LearnDeckOpPatchResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { valid: {}, errors: ['Request body must be a JSON object.'] };
  }

  const record = input as Record<string, unknown>;
  const hasAdd = 'addCardId' in record;
  const hasRemove = 'removeCardId' in record;
  const hasRename = 'rename' in record;

  if ([hasAdd, hasRemove, hasRename].filter(Boolean).length > 1) {
    return {
      valid: {},
      errors: ['Provide only one of "addCardId", "removeCardId" or "rename" per request.'],
    };
  }
  if (hasAdd) {
    return typeof record.addCardId === 'string' && record.addCardId.length > 0
      ? { valid: { addCardId: record.addCardId }, errors: [] }
      : { valid: {}, errors: ['"addCardId" must be a non-empty string.'] };
  }
  if (hasRemove) {
    return typeof record.removeCardId === 'string' && record.removeCardId.length > 0
      ? { valid: { removeCardId: record.removeCardId }, errors: [] }
      : { valid: {}, errors: ['"removeCardId" must be a non-empty string.'] };
  }
  if (hasRename) {
    const name = typeof record.rename === 'string' ? record.rename.trim() : '';
    return name.length > 0 && name.length <= MAX_DECK_NAME_LENGTH
      ? { valid: { rename: name }, errors: [] }
      : { valid: {}, errors: [`"rename" must be 1-${MAX_DECK_NAME_LENGTH} characters.`] };
  }
  return { valid: {}, errors: [] };
}

/**
 * Applies one validated op to a currently stored deck. Pure and idempotent:
 * adding an already-present card id, removing an absent one, or renaming to
 * the same name returns the same object reference unchanged.
 */
export function applyLearnDeckOp(current: CustomDeck, op: LearnDeckOp): CustomDeck {
  if (op.addCardId !== undefined) {
    if (current.cardIds.includes(op.addCardId)) return current;
    return { ...current, cardIds: [...current.cardIds, op.addCardId] };
  }
  if (op.removeCardId !== undefined) {
    if (!current.cardIds.includes(op.removeCardId)) return current;
    return { ...current, cardIds: current.cardIds.filter((id) => id !== op.removeCardId) };
  }
  if (op.rename !== undefined) {
    if (current.name === op.rename) return current;
    return { ...current, name: op.rename };
  }
  return current;
}
