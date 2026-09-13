import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  QuickCardsStore,
  buildQuickCard,
  distinctTags,
  findDuplicate,
  isValidQuickCardRecord,
  normalizeTag,
  tagSetKey,
  type QuickCard,
} from '../src/editor/quick-cards-store';

const LEGACY_STORAGE_KEY = 'pmd-quick-cards';

function card(over: Partial<QuickCard> = {}): QuickCard {
  return buildQuickCard({
    id: over.id,
    name: over.name ?? 'Warming impact',
    tags: over.tags ?? ['impacts'],
    contentJson: over.contentJson ?? { type: 'text' },
    plainText: 'Carbon warms the planet.',
    sourceName: over.sourceName ?? 'aff-case.cmir',
    createdAt: over.createdAt,
  });
}

/** Dispatches a fetch mock by method + path so a test only asserts the calls it cares about. */
function stubFetch(opts: {
  get?: QuickCard[] | 'signed-out';
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

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isValidQuickCardRecord', () => {
  it('accepts a well-formed card', () => {
    expect(isValidQuickCardRecord(card())).toBe(true);
  });

  it.each([
    ['id', { id: undefined }],
    ['name', { name: undefined }],
    ['tags', { tags: undefined }],
    ['nameLower', { nameLower: undefined }],
    ['tagsLower', { tagsLower: undefined }],
    ['textLower', { textLower: undefined }],
    ['sourceName', { sourceName: undefined }],
    ['createdAt', { createdAt: undefined }],
    ['updatedAt', { updatedAt: undefined }],
  ])('rejects a card missing %s', (_field, patch) => {
    expect(isValidQuickCardRecord({ ...card(), ...patch })).toBe(false);
  });

  it('rejects non-object values', () => {
    expect(isValidQuickCardRecord(null)).toBe(false);
    expect(isValidQuickCardRecord('card')).toBe(false);
  });
});

describe('pure card helpers', () => {
  it('normalizes tag casing/whitespace for matching', () => {
    expect(normalizeTag('  Impacts ')).toBe('impacts');
  });

  it('finds a duplicate by identical name + tag-set only', () => {
    const existing = card({ id: 'a', name: 'Warming', tags: ['impacts'] });
    expect(findDuplicate([existing], 'Warming', ['impacts'])).toBe(existing);
    expect(findDuplicate([existing], 'Warming', ['solvency'])).toBeUndefined();
    expect(findDuplicate([existing], 'warming', ['Impacts'])).toBe(existing);
  });

  it('excludes the card being edited from its own duplicate check', () => {
    const existing = card({ id: 'a', name: 'Warming', tags: ['impacts'] });
    expect(findDuplicate([existing], 'Warming', ['impacts'], 'a')).toBeUndefined();
  });

  it('lists distinct tags across cards, sorted case-insensitively', () => {
    const a = card({ id: 'a', tags: ['Impacts', 'aff'] });
    const b = card({ id: 'b', tags: ['impacts', 'Neg'] });
    expect(distinctTags([a, b])).toEqual(['aff', 'Impacts', 'Neg']);
  });

  it('keys a tag-set independent of order but not of internal spelling', () => {
    expect(tagSetKey(['a', 'b'])).toBe(tagSetKey(['b', 'a']));
    expect(tagSetKey(['a b'])).not.toBe(tagSetKey(['a', 'b']));
  });
});

describe('QuickCardsStore account sync', () => {
  it('stays local-only when signed out', async () => {
    stubFetch({ get: 'signed-out' });
    const store = new QuickCardsStore();

    await store.init();

    expect(store.isSynced()).toBe(false);
    expect(store.list()).toEqual([]);
  });

  it('adopts a remote-only card and pushes a local-only one during the init merge', async () => {
    const localOnly = card({ id: 'local-1' });
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify([localOnly]));
    const remoteOnly = card({ id: 'remote-1' });
    const pushed: string[] = [];
    stubFetch({ get: [remoteOnly], onPut: (id) => pushed.push(id) });

    const store = new QuickCardsStore();
    await store.init();

    expect(store.isSynced()).toBe(true);
    expect(store.list().map((c) => c.id).sort()).toEqual(['local-1', 'remote-1']);
    expect(pushed).toEqual(['local-1']);
  });

  it('pushes a new card to the account on upsert once signed in', async () => {
    const pushed: unknown[] = [];
    stubFetch({ get: [], onPut: (_id, body) => pushed.push(body) });
    const store = new QuickCardsStore();
    await store.init();

    const created = card({ id: 'new-1' });
    await store.upsert(created);

    expect(pushed).toEqual([{ card: created }]);
  });

  it('does not call the account at all on upsert while signed out', async () => {
    const fetchMock = stubFetch({ get: 'signed-out' });
    const store = new QuickCardsStore();
    await store.init();

    await store.upsert(card({ id: 'new-1' }));

    // Only the one GET from init() — no PUT was attempted.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('deletes from the account on remove once signed in', async () => {
    const deleted: string[] = [];
    stubFetch({ get: [], onDelete: (id) => deleted.push(id) });
    const store = new QuickCardsStore();
    await store.init();
    await store.upsert(card({ id: 'gone' }));

    await store.remove('gone');

    expect(deleted).toEqual(['gone']);
    expect(store.list()).toEqual([]);
  });

  it('deletes every card from the account on clear once signed in', async () => {
    const deleted: string[] = [];
    stubFetch({ get: [], onDelete: (id) => deleted.push(id) });
    const store = new QuickCardsStore();
    await store.init();
    await store.upsert(card({ id: 'a' }));
    await store.upsert(card({ id: 'b' }));

    await store.clear();

    expect(deleted.sort()).toEqual(['a', 'b']);
    expect(store.list()).toEqual([]);
  });

  it('applies the local change even when the account push rejects', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'GET') return { ok: true, status: 200, json: async () => [] };
      return { ok: false, status: 500, json: async () => ({ error: 'down' }) };
    }) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    const store = new QuickCardsStore();
    await store.init();
    const created = card({ id: 'still-local' });

    await expect(store.upsert(created)).resolves.toBeUndefined();

    expect(store.list()).toEqual([created]);
  });
});
