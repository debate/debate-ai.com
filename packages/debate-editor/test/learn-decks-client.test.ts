import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  deleteSavedLearnDeckFromAccount,
  listSavedLearnDecks,
  saveLearnDeckToAccount,
} from '../src/editor/learn-decks-client';
import type { CustomDeck } from '../src/editor/learn-store';

const DECK: CustomDeck = {
  deckId: 'deck-1',
  name: 'Impacts',
  cardIds: ['card-1'],
  createdAt: '2026-03-14T00:00:00.000Z',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listSavedLearnDecks', () => {
  it('GETs the endpoint and returns the parsed deck list', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [DECK],
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    const result = await listSavedLearnDecks();

    expect(result).toEqual([DECK]);
    expect(fetchMock).toHaveBeenCalledWith('/api/learn-decks');
  });

  it('returns null on a 401 rather than throwing', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    expect(await listSavedLearnDecks()).toBeNull();
  });

  it("throws the server's error message on another failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Something broke.' }),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    await expect(listSavedLearnDecks()).rejects.toThrow('Something broke.');
  });

  it("falls back to a default error message when the failure body isn't JSON", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    await expect(listSavedLearnDecks()).rejects.toThrow('Failed to load your synced decks.');
  });
});

describe('saveLearnDeckToAccount', () => {
  it("PUTs to the deck's id-scoped endpoint", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    await saveLearnDeckToAccount(DECK);

    expect(fetchMock).toHaveBeenCalledWith('/api/learn-decks/deck-1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deck: DECK }),
    });
  });

  it('URL-encodes the id', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    await saveLearnDeckToAccount({ ...DECK, deckId: 'deck 1' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/learn-decks/deck%201',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid deck.' }),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    await expect(saveLearnDeckToAccount(DECK)).rejects.toThrow('Invalid deck.');
  });
});

describe('deleteSavedLearnDeckFromAccount', () => {
  it("DELETEs the deck's id-scoped endpoint", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    await deleteSavedLearnDeckFromAccount('deck-1');

    expect(fetchMock).toHaveBeenCalledWith('/api/learn-decks/deck-1', { method: 'DELETE' });
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Something broke.' }),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteSavedLearnDeckFromAccount('deck-1')).rejects.toThrow('Something broke.');
  });
});
