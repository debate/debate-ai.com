import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  deleteSavedReviewLogEntryFromAccount,
  listSavedReviewLogEntries,
  saveReviewLogEntryToAccount,
} from '../src/editor/learn-review-log-client';
import type { ReviewLogEntry } from '../src/editor/learn-store';

const ENTRY: ReviewLogEntry = {
  cardId: 'card-1',
  at: '2026-03-14T12:00:00.000Z',
  grade: 'remembered',
  intervalBefore: 0,
  intervalAfter: 1,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listSavedReviewLogEntries', () => {
  it('GETs the endpoint and returns the parsed entry list', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [ENTRY],
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    const result = await listSavedReviewLogEntries();

    expect(result).toEqual([ENTRY]);
    expect(fetchMock).toHaveBeenCalledWith('/api/learn-review-log');
  });

  it('returns null on a 401 rather than throwing', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    expect(await listSavedReviewLogEntries()).toBeNull();
  });

  it("throws the server's error message on another failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Something broke.' }),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    await expect(listSavedReviewLogEntries()).rejects.toThrow('Something broke.');
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

    await expect(listSavedReviewLogEntries()).rejects.toThrow('Failed to load your synced review history.');
  });
});

describe('saveReviewLogEntryToAccount', () => {
  it("PUTs to the entry's id-scoped endpoint", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    await saveReviewLogEntryToAccount(ENTRY);

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/learn-review-log/${encodeURIComponent('card-1:2026-03-14T12:00:00.000Z')}`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entry: ENTRY }),
      },
    );
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid entry.' }),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    await expect(saveReviewLogEntryToAccount(ENTRY)).rejects.toThrow('Invalid entry.');
  });
});

describe('deleteSavedReviewLogEntryFromAccount', () => {
  it("DELETEs the entry's id-scoped endpoint", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    await deleteSavedReviewLogEntryFromAccount('card-1:2026-03-14T12:00:00.000Z');

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/learn-review-log/${encodeURIComponent('card-1:2026-03-14T12:00:00.000Z')}`,
      { method: 'DELETE' },
    );
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Something broke.' }),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteSavedReviewLogEntryFromAccount('card-1:2026-03-14T12:00:00.000Z')).rejects.toThrow(
      'Something broke.',
    );
  });
});
