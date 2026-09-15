/**
 * @fileoverview `LearnDecksSync` — the account-sync layer for Learn custom
 * decks (deckId/name/cardIds/createdAt). Each test builds an isolated
 * `LearnStore` + `LearnDecksSync` pair (mirroring
 * `learn-cards-sync.test.ts`'s per-test instances) rather than importing
 * the module singletons, so tests never share sync state with each other.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { LearnStore, type CustomDeck } from '../src/editor/learn-store';
import { LearnDecksSync } from '../src/editor/learn-decks-sync';

const NOW = '2026-03-14T00:00:00.000Z';

const deck = (deckId: string, over: Partial<CustomDeck> = {}): CustomDeck => ({
  deckId,
  name: 'Impacts',
  cardIds: [],
  createdAt: NOW,
  ...over,
});

/** Dispatches a fetch mock by method + path so a test only asserts the calls it cares about. */
function stubFetch(opts: {
  get?: CustomDeck[] | 'signed-out';
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

describe('LearnDecksSync init merge', () => {
  it('stays unsynced when signed out', async () => {
    stubFetch({ get: 'signed-out' });
    const store = new LearnStore();
    const sync = new LearnDecksSync(store);

    await sync.init();

    expect(sync.isSynced()).toBe(false);
    expect(store.listDecks()).toEqual([]);
  });

  it('adopts a remote-only deck by its own id (no duplicate id minted)', async () => {
    const remoteOnly = deck('remote-1');
    stubFetch({ get: [remoteOnly] });
    const store = new LearnStore();
    const sync = new LearnDecksSync(store);

    await sync.init();

    expect(sync.isSynced()).toBe(true);
    expect(store.listDecks()).toEqual([remoteOnly]);
  });

  it('pushes a local-only deck during the merge', async () => {
    const pushed: string[] = [];
    stubFetch({ get: [], onPut: (id) => pushed.push(id) });
    const store = new LearnStore();
    store.createDeck('Impacts', 'local-1', NOW);
    const sync = new LearnDecksSync(store);

    await sync.init();

    expect(pushed).toEqual(['local-1']);
  });

  it('does not touch an id present on both sides', async () => {
    const pushed: string[] = [];
    stubFetch({ get: [deck('shared-1', { name: 'Remote name' })], onPut: (id) => pushed.push(id) });
    const store = new LearnStore();
    store.createDeck('Local name', 'shared-1', NOW);
    const sync = new LearnDecksSync(store);

    await sync.init();

    // Present on both sides — merge does not overwrite either way.
    expect(pushed).toEqual([]);
    expect(store.listDecks().find((d) => d.deckId === 'shared-1')?.name).toBe('Local name');
  });

  it('is idempotent — a second init() does not re-fetch', async () => {
    const fetchMock = stubFetch({ get: [] });
    const store = new LearnStore();
    const sync = new LearnDecksSync(store);

    await sync.init();
    await sync.init();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('LearnDecksSync ongoing mirror', () => {
  it('pushes a newly created deck once signed in', async () => {
    const pushed: unknown[] = [];
    stubFetch({ get: [], onPut: (_id, body) => pushed.push(body) });
    const store = new LearnStore();
    const sync = new LearnDecksSync(store);
    await sync.init();

    store.createDeck('New deck', 'new-1', NOW);

    expect(pushed).toEqual([{ deck: deck('new-1', { name: 'New deck' }) }]);
  });

  it('pushes a renamed deck exactly once, keyed by content', async () => {
    const pushed: unknown[] = [];
    stubFetch({ get: [], onPut: (_id, body) => pushed.push(body) });
    const store = new LearnStore();
    store.createDeck('v1', 'rename-1', NOW);
    const sync = new LearnDecksSync(store);
    await sync.init();
    pushed.length = 0; // isolate the rename itself from the merge's initial push

    store.renameDeck('rename-1', 'v2');

    expect(pushed).toEqual([{ deck: deck('rename-1', { name: 'v2' }) }]);
  });

  it('pushes a deck once its card membership changes', async () => {
    const pushed: unknown[] = [];
    stubFetch({ get: [], onPut: (_id, body) => pushed.push(body) });
    const store = new LearnStore();
    store.createDeck('Impacts', 'membership-1', NOW);
    const sync = new LearnDecksSync(store);
    await sync.init();
    pushed.length = 0;

    store.setDeckMembership('membership-1', 'card-1', true);

    expect(pushed).toEqual([{ deck: deck('membership-1', { cardIds: ['card-1'] }) }]);
  });

  it('does not re-push on an unrelated store change (e.g. grading a card)', async () => {
    const pushed: unknown[] = [];
    stubFetch({ get: [], onPut: (_id, body) => pushed.push(body) });
    const store = new LearnStore();
    store.createDeck('Impacts', 'd1', NOW);
    store.upsertCard({ id: 'c1', type: 'qa', front: 'Q', back: 'A' }, NOW.slice(0, 10));
    const sync = new LearnDecksSync(store);
    await sync.init(); // pushes 'd1' once, as the local-only merge push

    pushed.length = 0; // isolate what grading itself triggers

    store.grade('c1', 'remembered', NOW.slice(0, 10), NOW);

    expect(pushed).toEqual([]);
  });

  it('deletes from the account when a deck is removed', async () => {
    const deleted: string[] = [];
    stubFetch({ get: [], onDelete: (id) => deleted.push(id) });
    const store = new LearnStore();
    const sync = new LearnDecksSync(store);
    await sync.init();
    store.createDeck('Impacts', 'gone', NOW);

    store.deleteDeck('gone');

    expect(deleted).toEqual(['gone']);
  });

  it('does not mirror any change while signed out', async () => {
    const fetchMock = stubFetch({ get: 'signed-out' });
    const store = new LearnStore();
    const sync = new LearnDecksSync(store);
    await sync.init();

    store.createDeck('Impacts', 'new-1', NOW);

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
    const sync = new LearnDecksSync(store);
    await sync.init();

    store.createDeck('Still local', 'still-local', NOW);

    expect(store.listDecks().find((d) => d.deckId === 'still-local')).toBeDefined();
  });
});
