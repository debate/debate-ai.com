/**
 * DOM behavior of the deck-management section: lists custom decks with
 * their card counts, shows the coarse account-sync status line, expands to
 * add/remove cards, two-click deletes, and re-renders live as the store
 * changes — mirroring `learn-review-log-ui.test.ts`'s shape, against an
 * injected `LearnStore`/`LearnDecksSync` pair rather than the app
 * singletons.
 *
 * "New deck" and "Rename" open a real `promptForText` modal (untestable
 * here without mocking a shared utility no other test in this package
 * mocks — see `learn-manage-ui.ts`'s own untested "New card"/"Edit"
 * buttons for the same reason); those two flows are exercised indirectly
 * by calling the store mutations they'd eventually make
 * (`createDeck`/`renameDeck`) directly and asserting the section renders
 * the result.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildDeckManageSection } from '../src/editor/learn-deck-manage-ui';
import { LearnStore } from '../src/editor/learn-store';
import { LearnDecksSync } from '../src/editor/learn-decks-sync';

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

function deckNames(section: HTMLElement): string[] {
  return [...section.querySelectorAll('.pmd-deck-manage-name')].map((el) => el.textContent!);
}

function deckRow(section: HTMLElement, name: string): HTMLElement {
  const row = [...section.querySelectorAll('.pmd-deck-manage-row')].find(
    (r) => r.querySelector('.pmd-deck-manage-name')?.textContent === name,
  );
  if (!row) throw new Error(`no deck row for "${name}"`);
  return row as HTMLElement;
}

function actionButton(root: ParentNode, label: string): HTMLButtonElement {
  const btn = [...root.querySelectorAll('.pmd-deck-manage-action')].find((b) => b.textContent === label);
  if (!btn) throw new Error(`no "${label}" button`);
  return btn as HTMLButtonElement;
}

describe('buildDeckManageSection', () => {
  it('shows an empty state when there are no decks yet', async () => {
    stubSignedOut();
    const store = new LearnStore();
    const sync = new LearnDecksSync(store);
    const { element, destroy } = buildDeckManageSection({ store, sync });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(deckNames(element)).toEqual([]);
    expect(element.querySelector('.pmd-deck-manage-empty')?.textContent).toBe(
      'No decks yet. Create one to group cards for a focused review.',
    );
    destroy();
  });

  it('lists a deck with its card count, sorted by name', async () => {
    stubSignedOut();
    const store = new LearnStore();
    store.createDeck('Topicality', 'd1', TODAY);
    store.createDeck('Counterplans', 'd2', TODAY);
    const sync = new LearnDecksSync(store);

    const { element, destroy } = buildDeckManageSection({ store, sync });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(deckNames(element)).toEqual(['Counterplans', 'Topicality']);
    expect(deckRow(element, 'Topicality').querySelector('.pmd-deck-manage-count')?.textContent).toBe('0 cards');
    destroy();
  });

  it('re-renders live when a deck is created, renamed, or deleted', async () => {
    stubSignedOut();
    const store = new LearnStore();
    const sync = new LearnDecksSync(store);
    const { element, destroy } = buildDeckManageSection({ store, sync });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(deckNames(element)).toEqual([]);

    store.createDeck('Impacts', 'd1', TODAY);
    expect(deckNames(element)).toEqual(['Impacts']);

    store.renameDeck('d1', 'Impact framing');
    expect(deckNames(element)).toEqual(['Impact framing']);

    store.deleteDeck('d1');
    expect(deckNames(element)).toEqual([]);
    destroy();
  });

  it('stops re-rendering once destroyed', async () => {
    stubSignedOut();
    const store = new LearnStore();
    const sync = new LearnDecksSync(store);
    const { element, destroy } = buildDeckManageSection({ store, sync });
    await new Promise((resolve) => setTimeout(resolve, 0));
    destroy();

    store.createDeck('Impacts', 'd1', TODAY);

    expect(deckNames(element)).toEqual([]);
  });

  it('deletes a deck only after the delete button is clicked twice', async () => {
    stubSignedOut();
    const store = new LearnStore();
    store.createDeck('Impacts', 'd1', TODAY);
    const sync = new LearnDecksSync(store);
    const { element, destroy } = buildDeckManageSection({ store, sync });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const del = actionButton(deckRow(element, 'Impacts'), 'Delete');
    del.click();
    expect(deckNames(element)).toEqual(['Impacts']);
    expect(del.textContent).toBe('Delete?');

    // Re-query: the row was replaced by the first click's own render.
    actionButton(deckRow(element, 'Impacts'), 'Delete?').click();
    expect(deckNames(element)).toEqual([]);
    destroy();
  });

  it('expands "Cards" to show and remove a deck\'s cards', async () => {
    stubSignedOut();
    const store = new LearnStore();
    store.upsertCard({ id: 'c1', type: 'qa', front: 'What warms?', back: 'Carbon' }, TODAY);
    store.createDeck('Impacts', 'd1', TODAY);
    store.setDeckMembership('d1', 'c1', true);
    const sync = new LearnDecksSync(store);
    const { element, destroy } = buildDeckManageSection({ store, sync });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(element.querySelector('.pmd-deck-manage-card-row')).toBeNull();

    actionButton(deckRow(element, 'Impacts'), 'Cards').click();
    expect(element.querySelector('.pmd-deck-manage-card-label')?.textContent).toBe('What warms?');

    actionButton(deckRow(element, 'Impacts'), 'Remove').click();
    expect(store.listDecks()[0]!.cardIds).toEqual([]);
    expect(element.querySelector('.pmd-deck-manage-cards-empty')?.textContent).toBe('No cards in this deck yet.');
    destroy();
  });

  it("shows a placeholder for a deck card whose card no longer exists", async () => {
    stubSignedOut();
    const store = new LearnStore();
    store.createDeck('Impacts', 'd1', TODAY);
    // A deck can legitimately reference a card synced from another device
    // that hasn't reached this one yet — the same soft-reference gap
    // `learn-review-log-ui.ts` accepts for its own log entries.
    store.upsertDeck({ deckId: 'd1', name: 'Impacts', cardIds: ['gone'], createdAt: TODAY });
    const sync = new LearnDecksSync(store);
    const { element, destroy } = buildDeckManageSection({ store, sync });
    await new Promise((resolve) => setTimeout(resolve, 0));

    actionButton(deckRow(element, 'Impacts'), 'Cards').click();
    expect(element.querySelector('.pmd-deck-manage-card-label')?.textContent).toBe('(deleted card)');
    destroy();
  });

  it('adds a card to a deck by selecting it from the "Add a card" picker', async () => {
    stubSignedOut();
    const store = new LearnStore();
    store.upsertCard({ id: 'c1', type: 'qa', front: 'What warms?', back: 'Carbon' }, TODAY);
    store.createDeck('Impacts', 'd1', TODAY);
    const sync = new LearnDecksSync(store);
    const { element, destroy } = buildDeckManageSection({ store, sync });
    await new Promise((resolve) => setTimeout(resolve, 0));

    actionButton(deckRow(element, 'Impacts'), 'Cards').click();
    const select = element.querySelector<HTMLSelectElement>('.pmd-deck-manage-add-select');
    expect(select).not.toBeNull();
    select!.value = 'c1';
    select!.dispatchEvent(new Event('change'));

    expect(store.listDecks()[0]!.cardIds).toEqual(['c1']);
    destroy();
  });

  it('omits the "Add a card" picker once every card already belongs to the deck', async () => {
    stubSignedOut();
    const store = new LearnStore();
    store.upsertCard({ id: 'c1', type: 'qa', front: 'What warms?', back: 'Carbon' }, TODAY);
    store.createDeck('Impacts', 'd1', TODAY);
    store.setDeckMembership('d1', 'c1', true);
    const sync = new LearnDecksSync(store);
    const { element, destroy } = buildDeckManageSection({ store, sync });
    await new Promise((resolve) => setTimeout(resolve, 0));

    actionButton(deckRow(element, 'Impacts'), 'Cards').click();
    expect(element.querySelector('.pmd-deck-manage-add-select')).toBeNull();
    destroy();
  });
});

describe('buildDeckManageSection sync status', () => {
  it('shows "Not synced" while signed out', async () => {
    stubSignedOut();
    const store = new LearnStore();
    const sync = new LearnDecksSync(store);
    const { element, destroy } = buildDeckManageSection({ store, sync });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(element.querySelector('.pmd-deck-manage-sync-status')?.textContent).toBe(
      'Not synced — sign in to sync',
    );
    destroy();
  });

  it('shows "Synced to your account" once the merge resolves', async () => {
    stubSignedIn([]);
    const store = new LearnStore();
    const sync = new LearnDecksSync(store);
    const { element, destroy } = buildDeckManageSection({ store, sync });

    expect(element.querySelector('.pmd-deck-manage-sync-status')?.textContent).toBe(
      'Not synced — sign in to sync',
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(element.querySelector('.pmd-deck-manage-sync-status')?.textContent).toBe('Synced to your account');
    destroy();
  });

  it("reuses an already-in-flight sync.init() instead of re-fetching", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => [] })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);
    const store = new LearnStore();
    const sync = new LearnDecksSync(store);
    await sync.init(); // already synced elsewhere, e.g. the app boot path

    const { element, destroy } = buildDeckManageSection({ store, sync });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(element.querySelector('.pmd-deck-manage-sync-status')?.textContent).toBe('Synced to your account');
    destroy();
  });
});
