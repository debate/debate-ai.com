/**
 * Learn — account sync for custom DECKS (`deckId`/`name`/`cardIds`/
 * `createdAt`). Same split `learn-cards-sync.ts` established for card
 * content: one of Learn's 8 sub-collections gets its own bespoke sync
 * rather than the generic `TOOL_RECORD_COLLECTIONS` mechanism, because all
 * 8 live in one shared `pmd-learn-store` blob and the generic mechanism
 * would overwrite the other 7 on every write. No new sync infrastructure
 * for the remaining 6 sub-collections (schedules, anchors, AI threads,
 * notes, review log, doc registry) — see TODO.md's standing follow-up note
 * for why those stay local-only.
 *
 * A deck's `cardIds` reference cards synced separately by
 * `learn-cards-sync.ts`; a deck can legitimately reference a card that
 * hasn't reached this device yet (e.g. a third device's card not yet
 * merged here), the same soft-reference gap `learn-cards-sync.ts` already
 * accepts for card content — no attempt to reconcile that here.
 *
 * `LearnStore` stays host-agnostic (no network/account knowledge) — this
 * class sits beside it, web-only (Electron's Learn store stays local-only
 * for now, same boundary `learn-cards-sync.ts` draws), and drives sync
 * purely through the store's existing public surface (`listDecks`,
 * `upsertDeck`, `subscribe`).
 *
 * `init()` — call once after `loadLearnStore()` resolves:
 *   1. Best-effort merge against `/api/learn-decks`: adopts any remote
 *      deck missing locally (by `deckId`, via `upsertDeck` — a plain
 *      create-if-absent here since the merge only calls it for a deck this
 *      device doesn't have) and pushes any local-only deck up. No-op
 *      (stays unsynced) when signed out or the request fails.
 *   2. Subscribes to the store's generic `subscribe()` (fires on *any*
 *      mutation — grading, notes, cards, ... — not just deck edits) and,
 *      on each notification, diffs the current deck list's `{name,
 *      cardIds}` against the last-synced snapshot: a new or changed deck is
 *      pushed, a deck no longer present is removed from the account. This
 *      catches every deck-mutating path (`createDeck`, `renameDeck`,
 *      `setDeckMembership`, `deleteDeck`) without `LearnStore` having to
 *      name them individually.
 *
 * The class (not just the `learnDecksSync` singleton below) is exported so
 * tests can construct isolated instances against a fresh `LearnStore`,
 * mirroring `LearnCardsSync`'s convention.
 */

import type { CustomDeck, LearnStore } from './learn-store.js';
import { learnStore } from './learn-store-host.js';
import { getElectronHost } from './host/index.js';
import {
  deleteSavedLearnDeckFromAccount,
  listSavedLearnDecks,
  saveLearnDeckToAccount,
} from './learn-decks-client.js';

function contentKey(deck: CustomDeck): string {
  return JSON.stringify({ name: deck.name, cardIds: deck.cardIds });
}

export class LearnDecksSync {
  private remoteAvailable = false;
  /** deckId → serialized `{name, cardIds}` as last pushed/adopted. */
  private baseline = new Map<string, string>();
  private initialized = false;

  constructor(private readonly store: LearnStore) {}

  /** Whether this browser is signed in and syncing decks to the account (web only — always `false` under Electron or before the first successful merge). */
  isSynced(): boolean {
    return this.remoteAvailable;
  }

  /** Web-only best-effort merge + ongoing mirror of custom decks. Call once, after `loadLearnStore()` resolves. Idempotent; no-op under Electron. */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    if (getElectronHost()) return;

    const remote = await listSavedLearnDecks().catch(() => null);
    if (!remote) return;
    this.remoteAvailable = true;

    const localIds = new Set(this.store.listDecks().map((d) => d.deckId));
    for (const deck of remote) {
      if (!localIds.has(deck.deckId)) this.store.upsertDeck(deck);
    }

    const remoteIds = new Set(remote.map((d) => d.deckId));
    for (const deck of this.store.listDecks()) {
      if (!remoteIds.has(deck.deckId)) {
        void saveLearnDeckToAccount(deck).catch(() => {
          // Best-effort — see handleStoreChange.
        });
      }
    }

    for (const deck of this.store.listDecks()) this.baseline.set(deck.deckId, contentKey(deck));
    this.store.subscribe(() => this.handleStoreChange());
  }

  private handleStoreChange(): void {
    if (!this.remoteAvailable) return;
    const seen = new Set<string>();
    for (const deck of this.store.listDecks()) {
      seen.add(deck.deckId);
      const key = contentKey(deck);
      if (this.baseline.get(deck.deckId) !== key) {
        this.baseline.set(deck.deckId, key);
        void saveLearnDeckToAccount(deck).catch(() => {
          // Best-effort — already saved locally; this deck resyncs the
          // next time it (or anything else) changes.
        });
      }
    }
    for (const id of [...this.baseline.keys()]) {
      if (!seen.has(id)) {
        this.baseline.delete(id);
        void deleteSavedLearnDeckFromAccount(id).catch(() => {
          // Best-effort — see above.
        });
      }
    }
  }
}

export const learnDecksSync = new LearnDecksSync(learnStore);
