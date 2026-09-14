import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  deleteSavedLearnCardFromAccount,
  listSavedLearnCards,
  saveLearnCardToAccount,
} from '../src/editor/learn-cards-client';
import type { CardDef } from '../src/editor/learn-store';

const CARD: CardDef = {
  id: 'card-1',
  type: 'qa',
  front: 'What warms?',
  back: 'Carbon',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listSavedLearnCards', () => {
  it('GETs the endpoint and returns the parsed card list', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [CARD],
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    const result = await listSavedLearnCards();

    expect(result).toEqual([CARD]);
    expect(fetchMock).toHaveBeenCalledWith('/api/learn-cards');
  });

  it('returns null on a 401 rather than throwing', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    expect(await listSavedLearnCards()).toBeNull();
  });

  it("throws the server's error message on another failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Something broke.' }),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    await expect(listSavedLearnCards()).rejects.toThrow('Something broke.');
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

    await expect(listSavedLearnCards()).rejects.toThrow('Failed to load your synced flashcards.');
  });
});

describe('saveLearnCardToAccount', () => {
  it("PUTs to the card's id-scoped endpoint", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    await saveLearnCardToAccount(CARD);

    expect(fetchMock).toHaveBeenCalledWith('/api/learn-cards/card-1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ card: CARD }),
    });
  });

  it('URL-encodes the id', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    await saveLearnCardToAccount({ ...CARD, id: 'card 1' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/learn-cards/card%201',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid card.' }),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    await expect(saveLearnCardToAccount(CARD)).rejects.toThrow('Invalid card.');
  });
});

describe('deleteSavedLearnCardFromAccount', () => {
  it("DELETEs the card's id-scoped endpoint", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    await deleteSavedLearnCardFromAccount('card-1');

    expect(fetchMock).toHaveBeenCalledWith('/api/learn-cards/card-1', { method: 'DELETE' });
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Something broke.' }),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteSavedLearnCardFromAccount('card-1')).rejects.toThrow('Something broke.');
  });
});
