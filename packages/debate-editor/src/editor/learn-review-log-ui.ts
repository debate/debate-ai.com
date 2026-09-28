/**
 * Learn manage overlay → "Review history": lists every logged review
 * (`ReviewLogEntry`), newest first, with the card's current front text,
 * the grade, and when it happened.
 *
 * Before this, the review log (`grade()`'s append-only history in
 * `learn-store.ts`) had no user-facing surface at all — not even the
 * "Manage flashcards" overlay reads it — the same gap
 * `user-dictionary-ui.ts` closed for the personal spellcheck dictionary.
 * Pulled into its own module for the same reason: unit-testable without
 * `learn-manage-ui.ts`'s much larger dependency graph, and constructed with
 * an injectable `store`/`sync` pair (defaulting to the app singletons)
 * mirroring `LearnCardsSync`'s own testability convention rather than
 * `user-dictionary-ui.ts`'s plain-localStorage one, since a review-log
 * entry's card lookup and sync status both come from the Learn store.
 *
 * The whole section shows one "Synced to your account" / "Not synced —
 * sign in to sync" line (via `sync.isSynced()`), the same coarse status
 * `learn-manage-ui.ts`'s own card list already shows — not a per-entry
 * badge: `learn-review-log-sync.ts`'s sync is push/adopt only, with no
 * per-record conflict state worth surfacing (an entry's content for a
 * given id never changes).
 */

import type { LearnStore, ReviewLogEntry } from './learn-store.js';
import { learnStore } from './learn-store-host.js';
import { LearnReviewLogSync, learnReviewLogSync } from './learn-review-log-sync.js';
import { pushOverlay, popOverlay, isTopOverlay } from './overlay-stack.js';

const GRADE_LABELS: Record<ReviewLogEntry['grade'], string> = {
  remembered: 'Remembered',
  forgot: 'Forgot',
};

export interface ReviewLogSectionOptions {
  store?: LearnStore;
  sync?: LearnReviewLogSync;
}

export interface ReviewLogSection {
  /** The section's root element — append it wherever it should be shown. */
  element: HTMLElement;
  /** Stops the store subscription and the sync-status refresh. Call on unmount. */
  destroy: () => void;
}

function cardLabel(store: LearnStore, cardId: string): string {
  const front = store.getCard(cardId)?.front.trim();
  if (!front) return '(deleted card)';
  return front.length > 80 ? `${front.slice(0, 80)}…` : front;
}

export function buildReviewLogSection(opts: ReviewLogSectionOptions = {}): ReviewLogSection {
  const store = opts.store ?? learnStore;
  const sync = opts.sync ?? learnReviewLogSync;

  const section = document.createElement('section');
  section.className = 'pmd-review-log-section';

  const title = document.createElement('h3');
  title.className = 'pmd-review-log-title';
  title.textContent = 'Review history';
  section.appendChild(title);

  const syncStatus = document.createElement('div');
  syncStatus.className = 'pmd-review-log-sync-status';
  section.appendChild(syncStatus);

  const list = document.createElement('div');
  list.className = 'pmd-review-log-list';
  section.appendChild(list);

  function render(): void {
    syncStatus.textContent = sync.isSynced() ? 'Synced to your account' : 'Not synced — sign in to sync';

    const entries = [...store.listLog()].sort((a, b) => b.at.localeCompare(a.at));
    list.innerHTML = '';
    if (entries.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'pmd-review-log-empty';
      empty.textContent = 'No reviews logged yet.';
      list.appendChild(empty);
      return;
    }
    for (const entry of entries) {
      const row = document.createElement('div');
      row.className = 'pmd-review-log-row';

      const card = document.createElement('span');
      card.className = 'pmd-review-log-card';
      card.textContent = cardLabel(store, entry.cardId);
      row.appendChild(card);

      const grade = document.createElement('span');
      grade.className = `pmd-review-log-grade pmd-review-log-grade--${entry.grade}`;
      grade.textContent = GRADE_LABELS[entry.grade];
      row.appendChild(grade);

      const date = document.createElement('span');
      date.className = 'pmd-review-log-date';
      date.textContent = new Date(entry.at).toLocaleString();
      row.appendChild(date);

      list.appendChild(row);
    }
  }

  render();
  const unsubscribe = store.subscribe(render);
  // `sync.init()` is idempotent — a no-op if something else already called
  // it (the normal boot path). Re-renders once the merge resolves so the
  // sync-status line and any adopted entries show up without a store
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

let openOverlay: HTMLElement | null = null;

/**
 * Opens "Review history" as its own small overlay above the manage
 * overlay (`learn-manage-ui.ts`'s "History" button), mirroring
 * `openLearnManage`'s own escape-key / click-outside chrome. Single
 * instance — a second call while one is already open is a no-op, same
 * guard `openLearnManage` uses.
 */
export function openReviewLogHistory(): void {
  if (openOverlay) return;

  const overlay = document.createElement('div');
  overlay.className = 'pmd-route-overlay pmd-review-log-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'pmd-route-dialog pmd-review-log-dialog';
  overlay.appendChild(dialog);
  openOverlay = overlay;

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'pmd-review-log-close';
  close.setAttribute('aria-label', 'Close');
  close.textContent = '✕';
  close.addEventListener('click', cleanup);
  dialog.appendChild(close);

  const { element, destroy } = buildReviewLogSection();
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
