/**
 * @fileoverview `LearnCardsSync` — the account-sync layer for Learn
 * flashcard CONTENT (id/type/front/back only). Each test builds an
 * isolated `LearnStore` + `LearnCardsSync` pair (mirroring
 * `quick-cards-store.test.ts`'s per-test `QuickCardsStore` instances)
 * rather than importing the module singletons, so tests never share sync
 * state with each other.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { LearnStore, type CardDef } from '../src/editor/learn-store';
import { LearnCardsSync } from '../src/editor/learn-cards-sync';

const TODAY = '2026-03-14';

/** A fixed default `updatedAt` (rather than the store's own `Date.now()`
 *  stamp) so pushed-body assertions stay deterministic — `upsertCard` only
 *  stamps `Date.now()` when a caller omits `updatedAt`, so passing it here
 *  is preserved as-is. */
const CARD_UPDATED_AT = new Date('2026-03-14T00:00:00.000Z').getTime();

const card = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id,
  type: 'qa',
  front: 'What warms?',
  back: 'Carbon',
  updatedAt: CARD_UPDATED_AT,
  ...over,
});

/** Dispatches a fetch mock by method + path so a test only asserts the calls it cares about. */
function stubFetch(opts: {
  get?: CardDef[] | 'signed-out';
  onPut?: (id: string, body: unknown) => void;
  /** When set, a PUT for this card id responds 409 with this card as `current` instead of succeeding. */
  putConflicts?: Map<string, CardDef>;
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
      const conflict = opts.putConflicts?.get(id);
      if (conflict) {
        return { ok: false, status: 409, json: async () => ({ current: conflict }) };
      }
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

describe('LearnCardsSync init merge', () => {
  it('stays unsynced when signed out', async () => {
    stubFetch({ get: 'signed-out' });
    const store = new LearnStore();
    const sync = new LearnCardsSync(store, () => TODAY);

    await sync.init();

    expect(sync.isSynced()).toBe(false);
    expect(store.listCards()).toEqual([]);
  });

  it('adopts a remote-only card by its own id (no duplicate id minted)', async () => {
    const remoteOnly = card('remote-1');
    stubFetch({ get: [remoteOnly] });
    const store = new LearnStore();
    const sync = new LearnCardsSync(store, () => TODAY);

    await sync.init();

    expect(sync.isSynced()).toBe(true);
    expect(store.listCards()).toEqual([remoteOnly]);
    expect(store.getSchedule('remote-1')).toBeDefined();
  });

  it('pushes a local-only card during the merge', async () => {
    const localOnly = card('local-1');
    const pushed: string[] = [];
    stubFetch({ get: [], onPut: (id) => pushed.push(id) });
    const store = new LearnStore();
    store.upsertCard(localOnly, TODAY);
    const sync = new LearnCardsSync(store, () => TODAY);

    await sync.init();

    expect(pushed).toEqual(['local-1']);
  });

  it('does not touch an id present on both sides', async () => {
    const shared = card('shared-1', { front: 'Local front' });
    const pushed: string[] = [];
    stubFetch({ get: [card('shared-1', { front: 'Remote front' })], onPut: (id) => pushed.push(id) });
    const store = new LearnStore();
    store.upsertCard(shared, TODAY);
    const sync = new LearnCardsSync(store, () => TODAY);

    await sync.init();

    // Present on both sides — merge does not overwrite either way.
    expect(pushed).toEqual([]);
    expect(store.getCard('shared-1')?.front).toBe('Local front');
  });

  it('is idempotent — a second init() does not re-fetch', async () => {
    const fetchMock = stubFetch({ get: [] });
    const store = new LearnStore();
    const sync = new LearnCardsSync(store, () => TODAY);

    await sync.init();
    await sync.init();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('LearnCardsSync ongoing mirror', () => {
  it('pushes a newly created card once signed in', async () => {
    const pushed: unknown[] = [];
    stubFetch({ get: [], onPut: (_id, body) => pushed.push(body) });
    const store = new LearnStore();
    const sync = new LearnCardsSync(store, () => TODAY);
    await sync.init();

    const created = card('new-1');
    store.upsertCard(created, TODAY);

    expect(pushed).toEqual([{ card: created }]);
  });

  it('pushes an edited card exactly once, keyed by content', async () => {
    const pushed: unknown[] = [];
    stubFetch({ get: [], onPut: (_id, body) => pushed.push(body) });
    const store = new LearnStore();
    const sync = new LearnCardsSync(store, () => TODAY);
    await sync.init();

    store.upsertCard(card('edit-1', { front: 'v1' }), TODAY);
    store.upsertCard(card('edit-1', { front: 'v2' }), TODAY);

    expect(pushed).toEqual([
      { card: card('edit-1', { front: 'v1' }) },
      { card: card('edit-1', { front: 'v2' }) },
    ]);
  });

  it('does not re-push on an unrelated store change (e.g. grading)', async () => {
    const pushed: unknown[] = [];
    stubFetch({ get: [], onPut: (_id, body) => pushed.push(body) });
    const store = new LearnStore();
    store.upsertCard(card('c1'), TODAY);
    const sync = new LearnCardsSync(store, () => TODAY);
    await sync.init(); // pushes 'c1' once, as the local-only merge push

    pushed.length = 0; // isolate what grading itself triggers

    store.grade('c1', 'remembered', TODAY, `${TODAY}T12:00:00.000Z`);

    expect(pushed).toEqual([]);
  });

  it('deletes from the account when a card is removed', async () => {
    const deleted: string[] = [];
    stubFetch({ get: [], onDelete: (id) => deleted.push(id) });
    const store = new LearnStore();
    const sync = new LearnCardsSync(store, () => TODAY);
    await sync.init();
    store.upsertCard(card('gone'), TODAY);

    store.deleteCard('gone');

    expect(deleted).toEqual(['gone']);
  });

  it("deletes from the account when forgetDoc prunes a card (not just deleteCard)", async () => {
    const deleted: string[] = [];
    stubFetch({ get: [], onDelete: (id) => deleted.push(id) });
    const store = new LearnStore();
    const sync = new LearnCardsSync(store, () => TODAY);
    await sync.init();
    store.upsertCard(card('anchored-only'), TODAY);
    store.setAnchor('anchored-only', 'doc-1', null);

    store.forgetDoc('doc-1', 'delete');

    expect(store.getCard('anchored-only')).toBeUndefined();
    expect(deleted).toEqual(['anchored-only']);
  });

  it('does not mirror any change while signed out', async () => {
    const fetchMock = stubFetch({ get: 'signed-out' });
    const store = new LearnStore();
    const sync = new LearnCardsSync(store, () => TODAY);
    await sync.init();

    store.upsertCard(card('new-1'), TODAY);

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
    const sync = new LearnCardsSync(store, () => TODAY);
    await sync.init();

    store.upsertCard(card('still-local'), TODAY);

    expect(store.getCard('still-local')).toBeDefined();
  });

  it('adopts a newer account version instead of overwriting it on an edit conflict', async () => {
    const newerRemote = card('raced', { front: 'Newer edit from another device', updatedAt: CARD_UPDATED_AT + 1000 });
    stubFetch({ get: [], putConflicts: new Map([['raced', newerRemote]]) });
    const store = new LearnStore();
    const sync = new LearnCardsSync(store, () => TODAY);
    await sync.init();

    store.upsertCard(card('raced', { front: 'My local edit' }), TODAY);
    // The local write applies immediately; the conflict resolves shortly after the fire-and-forget push.
    expect(store.getCard('raced')!.front).toBe('My local edit');

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(store.getCard('raced')).toEqual(newerRemote);
  });

  it('adopts a newer account version pushed during the init merge, without duplicating the card', async () => {
    const stale = card('raced');
    const newerRemote = card('raced', { front: 'Server-side edit', updatedAt: CARD_UPDATED_AT + 1000 });
    stubFetch({ get: [], putConflicts: new Map([['raced', newerRemote]]) });
    const store = new LearnStore();
    store.upsertCard(stale, TODAY);
    const sync = new LearnCardsSync(store, () => TODAY);

    await sync.init();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(store.listCards()).toEqual([newerRemote]);
  });
});
