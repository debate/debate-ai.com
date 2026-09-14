import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  deleteSavedQuickCardFromAccount,
  listSavedQuickCards,
  saveQuickCardToAccount,
} from '../src/editor/quick-cards-client';
import type { QuickCard } from '../src/editor/quick-cards-store';

const CARD: QuickCard = {
  id: 'card-1',
  name: 'Warming impact',
  tags: ['impacts'],
  contentJson: { type: 'text', text: 'Carbon warms.' },
  nameLower: 'warming impact',
  tagsLower: ['impacts'],
  textLower: 'carbon warms.',
  sourceName: 'aff-case.cmir',
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listSavedQuickCards', () => {
  it('GETs the endpoint and returns the parsed card list', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [CARD],
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    const result = await listSavedQuickCards();

    expect(result).toEqual([CARD]);
    expect(fetchMock).toHaveBeenCalledWith('/api/quick-cards');
  });

  it('returns null on a 401 rather than throwing', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    expect(await listSavedQuickCards()).toBeNull();
  });

  it("throws the server's error message on another failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Something broke.' }),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    await expect(listSavedQuickCards()).rejects.toThrow('Something broke.');
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

    await expect(listSavedQuickCards()).rejects.toThrow('Failed to load your synced quick cards.');
  });
});

describe('saveQuickCardToAccount', () => {
  it("PUTs to the card's id-scoped endpoint", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    await saveQuickCardToAccount(CARD);

    expect(fetchMock).toHaveBeenCalledWith('/api/quick-cards/card-1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ card: CARD }),
    });
  });

  it('URL-encodes the id', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    await saveQuickCardToAccount({ ...CARD, id: 'card 1' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/quick-cards/card%201',
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

    await expect(saveQuickCardToAccount(CARD)).rejects.toThrow('Invalid card.');
  });
});

describe('deleteSavedQuickCardFromAccount', () => {
  it("DELETEs the card's id-scoped endpoint", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    await deleteSavedQuickCardFromAccount('card-1');

    expect(fetchMock).toHaveBeenCalledWith('/api/quick-cards/card-1', { method: 'DELETE' });
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Something broke.' }),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteSavedQuickCardFromAccount('card-1')).rejects.toThrow('Something broke.');
  });
});
