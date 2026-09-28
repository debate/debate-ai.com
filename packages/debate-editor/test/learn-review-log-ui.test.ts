/**
 * DOM behavior of the review-history section: lists logged reviews newest
 * first with the card's current front text and grade, shows the coarse
 * account-sync status line, and re-renders live as the store changes —
 * mirroring `user-dictionary-ui.test.ts`'s shape, but against an injected
 * `LearnStore`/`LearnReviewLogSync` pair (like `learn-cards-sync.test.ts`)
 * rather than the app singletons, since this section reads both.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildReviewLogSection } from '../src/editor/learn-review-log-ui';
import { LearnStore } from '../src/editor/learn-store';
import { LearnReviewLogSync } from '../src/editor/learn-review-log-sync';

const TODAY = '2026-03-14';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubSignedOut() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch,
  );
}

function stubSignedIn(get: unknown[] = []) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'GET') return { ok: true, status: 200, json: async () => get };
      return { ok: true, status: 200, json: async () => ({}) };
    }) as unknown as typeof fetch,
  );
}

function cards(section: HTMLElement): string[] {
  return [...section.querySelectorAll('.pmd-review-log-card')].map((el) => el.textContent!);
}

describe('buildReviewLogSection', () => {
  it('shows an empty state when nothing has been reviewed yet', async () => {
    stubSignedOut();
    const store = new LearnStore();
    const sync = new LearnReviewLogSync(store);
    const { element, destroy } = buildReviewLogSection({ store, sync });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(cards(element)).toEqual([]);
    expect(element.querySelector('.pmd-review-log-empty')?.textContent).toBe('No reviews logged yet.');
    destroy();
  });

  it('lists a logged review with the card front and grade', async () => {
    stubSignedOut();
    const store = new LearnStore();
    store.upsertCard({ id: 'c1', type: 'qa', front: 'What warms?', back: 'Carbon' }, TODAY);
    store.grade('c1', 'remembered', TODAY, `${TODAY}T12:00:00.000Z`);
    const sync = new LearnReviewLogSync(store);

    const { element, destroy } = buildReviewLogSection({ store, sync });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(cards(element)).toEqual(['What warms?']);
    expect(element.querySelector('.pmd-review-log-grade')?.textContent).toBe('Remembered');
    expect(element.querySelector('.pmd-review-log-empty')).toBeNull();
    destroy();
  });

  it("shows a placeholder for an entry whose card no longer exists", async () => {
    stubSignedOut();
    const store = new LearnStore();
    // An entry can outlive its card's own deletion when it's adopted from
    // another device that hasn't seen the delete yet — the same
    // soft-reference gap `learn-decks-sync.ts` already accepts for a deck's
    // `cardIds`. `adoptLogEntry` never requires the card to exist locally.
    store.adoptLogEntry({ cardId: 'gone', at: `${TODAY}T13:00:00.000Z`, grade: 'forgot', intervalBefore: 1, intervalAfter: 1 });
    const sync = new LearnReviewLogSync(store);

    const { element, destroy } = buildReviewLogSection({ store, sync });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(cards(element)).toEqual(['(deleted card)']);
    destroy();
  });

  it('sorts newest first', async () => {
    stubSignedOut();
    const store = new LearnStore();
    store.upsertCard({ id: 'c1', type: 'qa', front: 'First', back: 'B' }, TODAY);
    store.upsertCard({ id: 'c2', type: 'qa', front: 'Second', back: 'B' }, TODAY);
    store.grade('c1', 'remembered', TODAY, `${TODAY}T10:00:00.000Z`);
    store.grade('c2', 'remembered', TODAY, `${TODAY}T14:00:00.000Z`);
    const sync = new LearnReviewLogSync(store);

    const { element, destroy } = buildReviewLogSection({ store, sync });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(cards(element)).toEqual(['Second', 'First']);
    destroy();
  });

  it('re-renders live when the store logs a new review', async () => {
    stubSignedOut();
    const store = new LearnStore();
    store.upsertCard({ id: 'c1', type: 'qa', front: 'What warms?', back: 'Carbon' }, TODAY);
    const sync = new LearnReviewLogSync(store);
    const { element, destroy } = buildReviewLogSection({ store, sync });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(cards(element)).toEqual([]);

    store.grade('c1', 'remembered', TODAY, `${TODAY}T12:00:00.000Z`);

    expect(cards(element)).toEqual(['What warms?']);
    destroy();
  });

  it('stops re-rendering once destroyed', async () => {
    stubSignedOut();
    const store = new LearnStore();
    store.upsertCard({ id: 'c1', type: 'qa', front: 'What warms?', back: 'Carbon' }, TODAY);
    const sync = new LearnReviewLogSync(store);
    const { element, destroy } = buildReviewLogSection({ store, sync });
    await new Promise((resolve) => setTimeout(resolve, 0));
    destroy();

    store.grade('c1', 'remembered', TODAY, `${TODAY}T12:00:00.000Z`);

    expect(cards(element)).toEqual([]);
  });
});

describe('buildReviewLogSection sync status', () => {
  it('shows "Not synced" while signed out', async () => {
    stubSignedOut();
    const store = new LearnStore();
    const sync = new LearnReviewLogSync(store);
    const { element, destroy } = buildReviewLogSection({ store, sync });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(element.querySelector('.pmd-review-log-sync-status')?.textContent).toBe(
      'Not synced — sign in to sync',
    );
    destroy();
  });

  it('shows "Synced to your account" once the merge resolves', async () => {
    stubSignedIn([]);
    const store = new LearnStore();
    const sync = new LearnReviewLogSync(store);
    const { element, destroy } = buildReviewLogSection({ store, sync });

    // Before the async merge resolves, still the signed-out-looking default.
    expect(element.querySelector('.pmd-review-log-sync-status')?.textContent).toBe(
      'Not synced — sign in to sync',
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(element.querySelector('.pmd-review-log-sync-status')?.textContent).toBe('Synced to your account');
    destroy();
  });

  it("reuses an already-in-flight sync.init() instead of re-fetching", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => [] })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);
    const store = new LearnStore();
    const sync = new LearnReviewLogSync(store);
    await sync.init(); // already synced elsewhere, e.g. the app boot path

    const { element, destroy } = buildReviewLogSection({ store, sync });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(element.querySelector('.pmd-review-log-sync-status')?.textContent).toBe('Synced to your account');
    destroy();
  });
});
