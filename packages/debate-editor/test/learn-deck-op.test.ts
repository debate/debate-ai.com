/**
 * @fileoverview `normalizeLearnDeckOpPatch`/`applyLearnDeckOp` — the
 * per-deck add-card/remove-card/rename ops `/api/learn-decks/[deckId]`'s
 * `PATCH` handler resolves against a deck's current stored state, closing
 * the "two devices edit the same deck at once" lost-update race a
 * whole-deck `PUT` replace is exposed to.
 */

import { describe, expect, it } from 'vitest';
import { applyLearnDeckOp, normalizeLearnDeckOpPatch } from '../src/editor/learn-deck-op';
import type { CustomDeck } from '../src/editor/learn-store';

const DECK: CustomDeck = {
  deckId: 'deck-1',
  name: 'Impacts',
  cardIds: ['card-1', 'card-2'],
  createdAt: '2026-03-14T00:00:00.000Z',
};

describe('normalizeLearnDeckOpPatch', () => {
  it('accepts a valid addCardId', () => {
    expect(normalizeLearnDeckOpPatch({ addCardId: 'card-3' })).toEqual({
      valid: { addCardId: 'card-3' },
      errors: [],
    });
  });

  it('accepts a valid removeCardId', () => {
    expect(normalizeLearnDeckOpPatch({ removeCardId: 'card-1' })).toEqual({
      valid: { removeCardId: 'card-1' },
      errors: [],
    });
  });

  it('accepts a valid rename, trimmed', () => {
    expect(normalizeLearnDeckOpPatch({ rename: '  New name  ' })).toEqual({
      valid: { rename: 'New name' },
      errors: [],
    });
  });

  it('rejects a non-object body', () => {
    expect(normalizeLearnDeckOpPatch(null).errors).not.toEqual([]);
    expect(normalizeLearnDeckOpPatch('nope').errors).not.toEqual([]);
    expect(normalizeLearnDeckOpPatch([]).errors).not.toEqual([]);
  });

  it('rejects more than one op in the same request', () => {
    const result = normalizeLearnDeckOpPatch({ addCardId: 'card-3', rename: 'New name' });
    expect(result.valid).toEqual({});
    expect(result.errors).toEqual(['Provide only one of "addCardId", "removeCardId" or "rename" per request.']);
  });

  it('rejects a non-string/empty addCardId', () => {
    expect(normalizeLearnDeckOpPatch({ addCardId: '' }).errors).not.toEqual([]);
    expect(normalizeLearnDeckOpPatch({ addCardId: 42 }).errors).not.toEqual([]);
  });

  it('rejects a non-string/empty removeCardId', () => {
    expect(normalizeLearnDeckOpPatch({ removeCardId: '' }).errors).not.toEqual([]);
    expect(normalizeLearnDeckOpPatch({ removeCardId: null }).errors).not.toEqual([]);
  });

  it('rejects an empty or over-length rename', () => {
    expect(normalizeLearnDeckOpPatch({ rename: '   ' }).errors).not.toEqual([]);
    expect(normalizeLearnDeckOpPatch({ rename: 'x'.repeat(201) }).errors).not.toEqual([]);
    expect(normalizeLearnDeckOpPatch({ rename: 'x'.repeat(200) }).errors).toEqual([]);
  });

  it('returns no valid op and no errors for a body with none of the three fields', () => {
    expect(normalizeLearnDeckOpPatch({})).toEqual({ valid: {}, errors: [] });
  });
});

describe('applyLearnDeckOp', () => {
  it('adds a new card id', () => {
    expect(applyLearnDeckOp(DECK, { addCardId: 'card-3' }).cardIds).toEqual(['card-1', 'card-2', 'card-3']);
  });

  it('adding an already-present card id is a no-op (same reference)', () => {
    expect(applyLearnDeckOp(DECK, { addCardId: 'card-1' })).toBe(DECK);
  });

  it('removes an existing card id', () => {
    expect(applyLearnDeckOp(DECK, { removeCardId: 'card-1' }).cardIds).toEqual(['card-2']);
  });

  it('removing an absent card id is a no-op (same reference)', () => {
    expect(applyLearnDeckOp(DECK, { removeCardId: 'card-9' })).toBe(DECK);
  });

  it('renames the deck', () => {
    expect(applyLearnDeckOp(DECK, { rename: 'New name' }).name).toBe('New name');
  });

  it('renaming to the same name is a no-op (same reference)', () => {
    expect(applyLearnDeckOp(DECK, { rename: 'Impacts' })).toBe(DECK);
  });

  it('does not mutate the input deck', () => {
    const next = applyLearnDeckOp(DECK, { addCardId: 'card-3' });
    expect(DECK.cardIds).toEqual(['card-1', 'card-2']);
    expect(next).not.toBe(DECK);
  });

  it('an empty op returns the deck unchanged', () => {
    expect(applyLearnDeckOp(DECK, {})).toBe(DECK);
  });
});
