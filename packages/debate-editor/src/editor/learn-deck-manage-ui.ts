/**
 * Learn manage overlay → "Decks": create, rename, and delete custom decks
 * (`CustomDeck` in `learn-store.ts`), and choose which cards belong to each
 * one.
 *
 * Before this, `LearnStore#createDeck`/`renameDeck`/`deleteDeck`/
 * `setDeckMembership` had no UI caller anywhere in this package — only
 * tests and `learn-decks-sync.ts`'s own merge (`upsertDeck`, for adopting a
 * deck created on another device) called them. `home-screen.ts`'s old
 * per-scope "due today" rows could *display* an existing deck, but never
 * create one — and that screen has been a permanent no-op since 2026-08-26
 * (see its own `show()` doc comment) regardless, so it was never a real
 * path either. A deck could only come to exist via account sync adopting
 * one from a device that itself had no way to make one — decks were
 * unreachable end to end.
 *
 * Pulled into its own module for the same testability reason
 * `learn-review-log-ui.ts` was: unit-testable without `learn-manage-ui.ts`'s
 * much larger dependency graph, constructed with an injectable
 * `store`/`sync` pair mirroring that module's convention.
 *
 * Shows the same coarse "Synced to your account" / "Not synced — sign in
 * to sync" line `learn-manage-ui.ts`'s card list and `learn-review-log-ui.ts`
 * already do, via `sync.isSynced()` — `LearnDecksSync` tracks no per-deck
 * status (see its own module doc: pushes/deletes are fire-and-forget), so a
 * per-deck sync badge isn't possible without adding that state to the sync
 * class itself, which is out of scope here.
 */

import { learnStore } from './learn-store-host.js';
import { LearnDecksSync, learnDecksSync } from './learn-decks-sync.js';
import type { CustomDeck, LearnStore } from './learn-store.js';
import { promptForText } from './text-prompt.js';
import { pushOverlay, popOverlay, isTopOverlay } from './overlay-stack.js';

export interface DeckManageSectionOptions {
  store?: LearnStore;
  sync?: LearnDecksSync;
}

export interface DeckManageSection {
  /** The section's root element — append it wherever it should be shown. */
  element: HTMLElement;
  /** Stops the store subscription and the sync-status refresh. Call on unmount. */
  destroy: () => void;
}

function cardLabel(store: LearnStore, cardId: string): string {
  const front = store.getCard(cardId)?.front.trim();
  if (!front) return '(deleted card)';
  return front.length > 60 ? `${front.slice(0, 60)}…` : front;
}

export function buildDeckManageSection(opts: DeckManageSectionOptions = {}): DeckManageSection {
  const store = opts.store ?? learnStore;
  const sync = opts.sync ?? learnDecksSync;

  const section = document.createElement('section');
  section.className = 'pmd-deck-manage-section';

  const bar = document.createElement('div');
  bar.className = 'pmd-deck-manage-bar';
  const title = document.createElement('h3');
  title.className = 'pmd-deck-manage-title';
  title.textContent = 'Decks';
  const syncStatus = document.createElement('span');
  syncStatus.className = 'pmd-deck-manage-sync-status';
  const newBtn = document.createElement('button');
  newBtn.type = 'button';
  newBtn.className = 'pmd-deck-manage-new';
  newBtn.textContent = 'New deck';
  newBtn.addEventListener('click', () => {
    void (async () => {
      const name = await promptForText({
        message: 'Name this deck',
        placeholder: 'e.g. Topicality',
      });
      const trimmed = name?.trim();
      if (!trimmed) return;
      store.createDeck(trimmed, crypto.randomUUID(), new Date().toISOString());
    })();
  });
  bar.append(title, syncStatus, newBtn);
  section.appendChild(bar);

  const list = document.createElement('div');
  list.className = 'pmd-deck-manage-list';
  section.appendChild(list);

  /** deckId currently showing its card picker, or null if none is expanded. */
  let expanded: string | null = null;

  function render(): void {
    syncStatus.textContent = sync.isSynced() ? 'Synced to your account' : 'Not synced — sign in to sync';

    const decks = [...store.listDecks()].sort((a, b) => a.name.localeCompare(b.name));
    list.replaceChildren();
    if (decks.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'pmd-deck-manage-empty';
      empty.textContent = 'No decks yet. Create one to group cards for a focused review.';
      list.appendChild(empty);
      return;
    }
    if (expanded !== null && !decks.some((d) => d.deckId === expanded)) expanded = null;
    for (const deck of decks) list.appendChild(deckRow(deck));
  }

  function deckRow(deck: CustomDeck): HTMLElement {
    const row = document.createElement('div');
    row.className = 'pmd-deck-manage-row';

    const head = document.createElement('div');
    head.className = 'pmd-deck-manage-head';

    const name = document.createElement('span');
    name.className = 'pmd-deck-manage-name';
    name.textContent = deck.name;
    name.title = deck.name;
    head.appendChild(name);

    const count = document.createElement('span');
    count.className = 'pmd-deck-manage-count';
    count.textContent = deck.cardIds.length === 1 ? '1 card' : `${deck.cardIds.length} cards`;
    head.appendChild(count);

    const toggleCards = mkAction(expanded === deck.deckId ? 'Hide cards' : 'Cards', () => {
      expanded = expanded === deck.deckId ? null : deck.deckId;
      render();
    });
    head.appendChild(toggleCards);

    const rename = mkAction('Rename', () => {
      void (async () => {
        const name = await promptForText({ message: 'Rename deck', initial: deck.name });
        const trimmed = name?.trim();
        if (!trimmed || trimmed === deck.name) return;
        store.renameDeck(deck.deckId, trimmed);
      })();
    });
    head.appendChild(rename);

    // Two-click delete (avoids native confirm, which Electron disables) —
    // the same arm/disarm pattern `learn-manage-ui.ts`'s card delete uses.
    const del = mkAction('Delete', () => {});
    del.classList.add('pmd-deck-manage-delete');
    let armed = false;
    let armTimer: number | null = null;
    del.addEventListener('click', () => {
      if (!armed) {
        armed = true;
        del.textContent = 'Delete?';
        del.classList.add('is-armed');
        armTimer = window.setTimeout(() => {
          armed = false;
          del.textContent = 'Delete';
          del.classList.remove('is-armed');
        }, 3000);
        return;
      }
      if (armTimer !== null) window.clearTimeout(armTimer);
      store.deleteDeck(deck.deckId);
    });
    head.appendChild(del);

    row.appendChild(head);
    if (expanded === deck.deckId) row.appendChild(cardPicker(deck));
    return row;
  }

  function cardPicker(deck: CustomDeck): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'pmd-deck-manage-cards';

    if (deck.cardIds.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'pmd-deck-manage-cards-empty';
      empty.textContent = 'No cards in this deck yet.';
      wrap.appendChild(empty);
    } else {
      for (const cardId of deck.cardIds) {
        const cardRow = document.createElement('div');
        cardRow.className = 'pmd-deck-manage-card-row';
        const label = document.createElement('span');
        label.className = 'pmd-deck-manage-card-label';
        label.textContent = cardLabel(store, cardId);
        cardRow.appendChild(label);
        const remove = mkAction('Remove', () => store.setDeckMembership(deck.deckId, cardId, false));
        cardRow.appendChild(remove);
        wrap.appendChild(cardRow);
      }
    }

    const addable = store.listCards().filter((c) => !deck.cardIds.includes(c.id));
    if (addable.length > 0) {
      const select = document.createElement('select');
      select.className = 'pmd-deck-manage-add-select';
      select.setAttribute('aria-label', `Add a card to ${deck.name}`);
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Add a card…';
      select.appendChild(placeholder);
      for (const c of addable) {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = cardLabel(store, c.id);
        select.appendChild(option);
      }
      select.addEventListener('change', () => {
        const cardId = select.value;
        if (cardId) store.setDeckMembership(deck.deckId, cardId, true);
        select.value = '';
      });
      wrap.appendChild(select);
    }

    return wrap;
  }

  render();
  const unsubscribe = store.subscribe(render);
  // `sync.init()` is idempotent — a no-op if something else already called
  // it (the normal boot path). Re-renders once the merge resolves so the
  // sync-status line and any adopted decks show up without a store
  // mutation of this device's own having to happen first.
  let destroyed = false;
  void sync.init().then(() => {
    if (!destroyed) render();
  });

  return {
    element: section,
    destroy: () => {
      destroyed = true;
      unsubscribe();
    },
  };
}

function mkAction(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pmd-deck-manage-action';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

let openOverlay: HTMLElement | null = null;

/**
 * Opens "Decks" as its own small overlay above the manage overlay
 * (`learn-manage-ui.ts`'s "Decks" button), mirroring
 * `openReviewLogHistory`'s escape-key / click-outside chrome exactly.
 * Single instance — a second call while one is already open is a no-op.
 */
export function openDeckManage(): void {
  if (openOverlay) return;

  const overlay = document.createElement('div');
  overlay.className = 'pmd-route-overlay pmd-deck-manage-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'pmd-route-dialog pmd-deck-manage-dialog';
  overlay.appendChild(dialog);
  openOverlay = overlay;

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'pmd-deck-manage-close';
  close.setAttribute('aria-label', 'Close');
  close.textContent = '✕';
  close.addEventListener('click', cleanup);
  dialog.appendChild(close);

  const { element, destroy } = buildDeckManageSection();
  dialog.appendChild(element);

  const overlayToken = pushOverlay();
  document.addEventListener('keydown', onKey, true);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cleanup();
  });
  document.body.appendChild(overlay);

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (!isTopOverlay(overlayToken)) return;
      e.preventDefault();
      e.stopPropagation();
      cleanup();
    }
  }

  function cleanup(): void {
    destroy();
    document.removeEventListener('keydown', onKey, true);
    popOverlay(overlayToken);
    overlay.remove();
    openOverlay = null;
  }
}
