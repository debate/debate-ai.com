/**
 * Learn — account sync for custom DECKS (`deckId`/`name`/`cardIds`/
 * `createdAt`). Same split `learn-cards-sync.ts` established for card
 * content: one of Learn's 8 sub-collections gets its own bespoke sync
 * rather than the generic `TOOL_RECORD_COLLECTIONS` mechanism, because all
 * 8 live in one shared `pmd-learn-store` blob and the generic mechanism
 * would overwrite the other 7 on every write. The review log
 * (`learn-review-log-sync.ts`) gets the same treatment; no new sync
 * infrastructure for the remaining 5 sub-collections (schedules, anchors,
 * AI threads, notes, doc registry) — see those modules' own doc comments
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
 *      mutation — grading, notes, cards, ... — not just deck edits) and, on
 *      each notification, diffs the current deck list against the
 *      last-synced snapshot: a brand-new deck is pushed in full (no
 *      concurrent-edit race for a row that doesn't exist yet), a deck no
 *      longer present is removed from the account, and a deck that changed
 *      sends one op per actual change (`addCardId`/`removeCardId` per
 *      card, `rename` for a name change) via `pushDeckChange` instead of a
 *      whole-deck snapshot — the fix for the "two devices edit the same
 *      deck at once" lost-update race a whole-deck replace is exposed to
 *      (see `learn-decks-cloud-save.mdx`'s Known gaps). This catches every
 *      deck-mutating path (`createDeck`, `renameDeck`, `setDeckMembership`,
 *      `deleteDeck`) without `LearnStore` having to name them individually.
 *
 * The class (not just the `learnDecksSync` singleton below) is exported so
 * tests can construct isolated instances against a fresh `LearnStore`,
 * mirroring `LearnCardsSync`'s convention.
 *
 * `getDeckSyncStatus` gives each deck a per-deck "synced"/"pending"/"unknown"
 * status, mirroring `debate-data-sync`'s `getToolRecordSyncStatus` — a
 * `landed` map tracks each deck's last *confirmed* value (only advanced once
 * a create/op/fallback push has actually resolved), separate from
 * `baseline`, which advances eagerly on every store change purely to compute
 * the next diff. `onStatusChange` lets a caller (the deck-management UI) know
 * when a fire-and-forget push settles, since nothing else re-renders on that.
 */

import type { CustomDeck, LearnStore } from './learn-store.js';
import { learnStore } from './learn-store-host.js';
import { getElectronHost } from './host/index.js';
import type { LearnDeckOp } from './learn-deck-op.js';
import {
  applyLearnDeckOpToAccount,
  deleteSavedLearnDeckFromAccount,
  listSavedLearnDecks,
  saveLearnDeckToAccount,
} from './learn-decks-client.js';

/**
 * Per-deck sync status, mirroring `debate-data-sync`'s `ToolRecordSyncStatus`
 * shape: `"unknown"` before this deck has any confirmed landed value to
 * compare against (signed out, sync disabled, or the deck no longer exists
 * locally); `"pending"` once local content differs from — or has never
 * reached — the last confirmed landed value; `"synced"` once they match.
 */
export type LearnDeckSyncStatus = 'synced' | 'pending' | 'unknown';

export class LearnDecksSync {
  private remoteAvailable = false;
  /** deckId → the deck as last pushed/adopted, for diffing the next change. */
  private baseline = new Map<string, CustomDeck>();
  /** deckId → the deck as last *confirmed* landed on the account (create/op/fallback push actually resolved), for `getDeckSyncStatus`. */
  private landed = new Map<string, CustomDeck>();
  private initialized = false;
  private statusListeners = new Set<() => void>();

  constructor(private readonly store: LearnStore) {}

  /** Whether this browser is signed in and syncing decks to the account (web only — always `false` under Electron or before the first successful merge). */
  isSynced(): boolean {
    return this.remoteAvailable;
  }

  /**
   * Per-deck status — `"unknown"` while `isSynced()` is false, or once this
   * deck no longer exists locally; otherwise `"synced"` iff its current
   * name/cardIds match the last confirmed landed value, `"pending"`
   * otherwise (never landed, or changed locally since it last did).
   */
  getDeckSyncStatus(deckId: string): LearnDeckSyncStatus {
    if (!this.remoteAvailable) return 'unknown';
    const current = this.store.listDecks().find((d) => d.deckId === deckId);
    if (!current) return 'unknown';
    const landed = this.landed.get(deckId);
    if (!landed) return 'pending';
    return landed.name === current.name && sameCardIds(landed.cardIds, current.cardIds)
      ? 'synced'
      : 'pending';
  }

  /** Notified whenever a deck's landed status changes — e.g. to refresh a per-deck sync badge once a fire-and-forget push settles. Returns an unsubscribe function. */
  onStatusChange(listener: () => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private markLanded(deck: CustomDeck): void {
    this.landed.set(deck.deckId, deck);
    for (const listener of this.statusListeners) listener();
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
      if (remoteIds.has(deck.deckId)) {
        // Present on both sides at merge time (either just adopted above, or
        // already there before this device ever synced) — no reconciliation
        // is attempted for this case (see the module doc), so it counts as
        // already landed.
        this.markLanded(cloneDeck(deck));
        continue;
      }
      const snapshot = cloneDeck(deck);
      void saveLearnDeckToAccount(deck)
        .then(() => this.markLanded(snapshot))
        .catch(() => {
          // Best-effort — see handleStoreChange. Stays "pending" until the
          // next change to this deck resyncs it.
        });
    }

    for (const deck of this.store.listDecks()) this.baseline.set(deck.deckId, cloneDeck(deck));
    this.store.subscribe(() => this.handleStoreChange());
  }

  private handleStoreChange(): void {
    if (!this.remoteAvailable) return;
    const seen = new Set<string>();
    for (const deck of this.store.listDecks()) {
      seen.add(deck.deckId);
      const prev = this.baseline.get(deck.deckId);
      if (!prev) {
        // Brand-new deck — push it in full; there is no concurrent-edit
        // race to resolve for a row that doesn't exist yet.
        const snapshot = cloneDeck(deck);
        this.baseline.set(deck.deckId, snapshot);
        void saveLearnDeckToAccount(deck)
          .then(() => this.markLanded(snapshot))
          .catch(() => {
            // Best-effort — already saved locally; this deck resyncs the
            // next time it (or anything else) changes.
          });
        continue;
      }
      if (prev.name === deck.name && sameCardIds(prev.cardIds, deck.cardIds)) continue;

      // `deck` is the store's own live, mutable object (`listDecks()` only
      // shallow-copies the array), so the baseline snapshot must be an
      // independent clone — otherwise a later in-place `cardIds` mutation
      // (`setDeckMembership`'s `push`) would silently corrupt `prev` on the
      // *next* call too, since it would be the very same object. The same
      // clone doubles as the landed snapshot on success, since both would
      // otherwise hold identical content anyway.
      const snapshot = cloneDeck(deck);
      this.baseline.set(deck.deckId, snapshot);
      void this.pushDeckChange(prev, deck)
        .then(() => this.markLanded(snapshot))
        .catch(() => {
          // Best-effort — see above.
        });
    }
    for (const id of [...this.baseline.keys()]) {
      if (!seen.has(id)) {
        this.baseline.delete(id);
        // The deck is already gone from the local store, so `getDeckSyncStatus`
        // reports "unknown" for it regardless of `landed` — drop it here too
        // rather than leaving a stale entry around either way.
        this.landed.delete(id);
        void deleteSavedLearnDeckFromAccount(id).catch(() => {
          // Best-effort — see above.
        });
      }
    }
  }

  /**
   * Resolves a changed deck against the account as one op per actual
   * change (add/remove a card, rename) instead of the whole-deck snapshot
   * `saveLearnDeckToAccount` would send — see this module's doc and
   * `learn-deck-op.ts`. Falls back to a full push if an op 404s: the
   * account doesn't have this deck yet, most likely because this same
   * deck's own initial create push (fired the same way, "best-effort",
   * from a prior `handleStoreChange` tick) hasn't landed.
   */
  private async pushDeckChange(prev: CustomDeck, next: CustomDeck): Promise<void> {
    const prevIds = new Set(prev.cardIds);
    const nextIds = new Set(next.cardIds);
    const ops: LearnDeckOp[] = [
      ...next.cardIds.filter((id) => !prevIds.has(id)).map((cardId) => ({ addCardId: cardId })),
      ...prev.cardIds.filter((id) => !nextIds.has(id)).map((cardId) => ({ removeCardId: cardId })),
      ...(prev.name === next.name ? [] : [{ rename: next.name }]),
    ];

    for (const op of ops) {
      const applied = await applyLearnDeckOpToAccount(next.deckId, op);
      if (!applied) {
        await saveLearnDeckToAccount(next);
        return;
      }
    }
  }
}

function cloneDeck(deck: CustomDeck): CustomDeck {
  return { ...deck, cardIds: [...deck.cardIds] };
}

function sameCardIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const bIds = new Set(b);
  return a.every((id) => bIds.has(id));
}

export const learnDecksSync = new LearnDecksSync(learnStore);
