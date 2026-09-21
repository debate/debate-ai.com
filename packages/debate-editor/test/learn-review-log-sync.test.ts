/**
 * @fileoverview `LearnReviewLogSync` — the account-sync layer for the Learn
 * review log. Each test builds an isolated `LearnStore` +
 * `LearnReviewLogSync` pair (mirroring `learn-cards-sync.test.ts`'s
 * per-test instances) rather than importing the module singletons, so
 * tests never share sync state with each other.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { LearnStore, type ReviewLogEntry } from '../src/editor/learn-store';
import { LearnReviewLogSync } from '../src/editor/learn-review-log-sync';
import { vi } from 'vitest';

const TODAY = '2026-03-14';

const entry = (cardId: string, over: Partial<ReviewLogEntry> = {}): ReviewLogEntry => ({
  cardId,
  at: `${TODAY}T12:00:00.000Z`,
  grade: 'remembered',
  intervalBefore: 0,
  intervalAfter: 1,
  ...over,
});

/** Dispatches a fetch mock by method + path so a test only asserts the calls it cares about. */
function stubFetch(opts: {
  get?: ReviewLogEntry[] | 'signed-out';
  onPut?: (id: string, body: unknown) => void;
  onDelete?: (id: string) => void;
}) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (method === 'GET') {
      if (opts.get === 'signed-out' || opts.get === undefined) {
        return { ok: false, status: 401 };
      }
      return { ok: true, status: 200, json: async () => opts.get };
    }
    if (method === 'PUT') {
      const id = decodeURIComponent(url.split('/').pop()!);
      opts.onPut?.(id, JSON.parse(String(init!.body)));
      return { ok: true, status: 200 };
    }
    if (method === 'DELETE') {
      const id = decodeURIComponent(url.split('/').pop()!);
      opts.onDelete?.(id);
      return { ok: true, status: 200 };
    }
    throw new Error(`unexpected method ${method}`);
  }) as unknown as typeof fetch;
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LearnReviewLogSync init merge', () => {
  it('stays unsynced when signed out', async () => {
    stubFetch({ get: 'signed-out' });
    const store = new LearnStore();
    const sync = new LearnReviewLogSync(store);

    await sync.init();

    expect(sync.isSynced()).toBe(false);
    expect(store.listLog()).toEqual([]);
  });

  it('adopts a remote-only entry without touching the schedule', async () => {
    const remoteOnly = entry('remote-1');
    stubFetch({ get: [remoteOnly] });
    const store = new LearnStore();
    const sync = new LearnReviewLogSync(store);

    await sync.init();

    expect(sync.isSynced()).toBe(true);
    expect(store.listLog()).toEqual([remoteOnly]);
    expect(store.getSchedule('remote-1')).toBeUndefined();
  });

  it('pushes a local-only entry during the merge', async () => {
    const pushed: string[] = [];
    stubFetch({ get: [], onPut: (id) => pushed.push(id) });
    const store = new LearnStore();
    store.upsertCard({ id: 'c1', type: 'qa', front: 'F', back: 'B' }, TODAY);
    store.grade('c1', 'remembered', TODAY, `${TODAY}T12:00:00.000Z`);
    const sync = new LearnReviewLogSync(store);

    await sync.init();

    expect(pushed).toEqual([`c1:${TODAY}T12:00:00.000Z`]);
  });

  it('does not touch an id present on both sides', async () => {
    const shared = entry('c1');
    const pushed: string[] = [];
    stubFetch({ get: [shared], onPut: (id) => pushed.push(id) });
    const store = new LearnStore();
    store.adoptLogEntry(shared);
    const sync = new LearnReviewLogSync(store);

    await sync.init();

    expect(pushed).toEqual([]);
    expect(store.listLog()).toEqual([shared]);
  });

  it('is idempotent — a second init() does not re-fetch', async () => {
    const fetchMock = stubFetch({ get: [] });
    const store = new LearnStore();
    const sync = new LearnReviewLogSync(store);

    await sync.init();
    await sync.init();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('LearnReviewLogSync ongoing mirror', () => {
  it('pushes a newly graded entry once signed in', async () => {
    const pushed: unknown[] = [];
    stubFetch({ get: [], onPut: (_id, body) => pushed.push(body) });
    const store = new LearnStore();
    store.upsertCard({ id: 'c1', type: 'qa', front: 'F', back: 'B' }, TODAY);
    const sync = new LearnReviewLogSync(store);
    await sync.init();

    store.grade('c1', 'remembered', TODAY, `${TODAY}T12:00:00.000Z`);

    expect(pushed).toEqual([{ entry: entry('c1') }]);
  });

  it('does not re-push on an unrelated store change (e.g. a card edit)', async () => {
    const pushed: unknown[] = [];
    stubFetch({ get: [], onPut: (_id, body) => pushed.push(body) });
    const store = new LearnStore();
    store.upsertCard({ id: 'c1', type: 'qa', front: 'F', back: 'B' }, TODAY);
    store.grade('c1', 'remembered', TODAY, `${TODAY}T12:00:00.000Z`);
    const sync = new LearnReviewLogSync(store);
    await sync.init(); // pushes the one entry, as the local-only merge push

    pushed.length = 0; // isolate what the card edit itself triggers

    store.upsertCard({ id: 'c1', type: 'qa', front: 'F2', back: 'B' }, TODAY);

    expect(pushed).toEqual([]);
  });

  it('deletes from the account when a card (and its log entries) is removed', async () => {
    const deleted: string[] = [];
    stubFetch({ get: [], onDelete: (id) => deleted.push(id) });
    const store = new LearnStore();
    store.upsertCard({ id: 'c1', type: 'qa', front: 'F', back: 'B' }, TODAY);
    const sync = new LearnReviewLogSync(store);
    await sync.init();
    store.grade('c1', 'remembered', TODAY, `${TODAY}T12:00:00.000Z`);

    store.deleteCard('c1');

    expect(deleted).toEqual([`c1:${TODAY}T12:00:00.000Z`]);
  });

  it('does not mirror any change while signed out', async () => {
    const fetchMock = stubFetch({ get: 'signed-out' });
    const store = new LearnStore();
    store.upsertCard({ id: 'c1', type: 'qa', front: 'F', back: 'B' }, TODAY);
    const sync = new LearnReviewLogSync(store);
    await sync.init();

    store.grade('c1', 'remembered', TODAY, `${TODAY}T12:00:00.000Z`);

    // Only the one GET from init() — no PUT was attempted.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('applies the local change even when the account push rejects', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'GET') return { ok: true, status: 200, json: async () => [] };
      return { ok: false, status: 500, json: async () => ({ error: 'down' }) };
    }) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);
    const store = new LearnStore();
    store.upsertCard({ id: 'c1', type: 'qa', front: 'F', back: 'B' }, TODAY);
    const sync = new LearnReviewLogSync(store);
    await sync.init();

    store.grade('c1', 'remembered', TODAY, `${TODAY}T12:00:00.000Z`);

    expect(store.listLog()).toHaveLength(1);
  });
});
