/**
 * Learn — account sync for flashcard CONTENT only (`id`/`type`/`front`/
 * `back`; no schedule, anchor, AI thread, note, review log, deck, or doc
 * registry). Splits the same way `quick-cards-store.ts` does ("the card
 * DEFINITION is the durable, shareable unit; per-user scheduling/
 * retrieval state isn't part of a quick card"): a restored card starts
 * fresh (no due date pressure) on whichever device adopts it, which is
 * already how `learnStore.upsertCard` treats a card with no schedule, and
 * already how the manage GUI's own JSON export/import round-trips a card
 * with `schedule: null` (§ its module doc). No new sync infrastructure or
 * schema for the other 7 sub-collections — see TODO.md's standing
 * follow-up note for why those remain local-only.
 *
 * `LearnStore` stays host-agnostic (no network/account knowledge) — this
 * class sits beside it, web-only (Electron's Learn store stays local-only
 * for now, same boundary `quick-cards-store.ts` draws for its own
 * Electron backend), and drives sync purely through the store's existing
 * public surface (`listCards`, `upsertCard`, `subscribe`).
 *
 * `init()` — call once after `loadLearnStore()` resolves:
 *   1. Best-effort merge against `/api/learn-cards`: adopts any remote
 *      card missing locally (by id, so an adopted card keeps its identity
 *      rather than duplicating — `upsertCard` fits perfectly here since it
 *      sets-if-absent by id and only mints a schedule when none exists)
 *      and pushes any local-only card up. No-op (stays unsynced) when
 *      signed out or the request fails.
 *   2. Subscribes to the store's generic `subscribe()` (fires on *any*
 *      mutation — grading, notes, decks, ... — not just card edits) and,
 *      on each notification, diffs the current card list's content against
 *      the last-synced snapshot: a new or content-changed card is pushed,
 *      a card no longer present is removed from the account. This catches
 *      every card-mutating path (`upsertCard`, `importCards`, `deleteCard`,
 *      and `forgetDoc`'s bulk prune) without `LearnStore` having to name
 *      them individually — cheap even on an unrelated change, since the
 *      diff is a same-content check that costs nothing when no card's
 *      `{type, front, back}` moved.
 *
 * The class (not just the `learnCardsSync` singleton below) is exported so
 * tests can construct isolated instances against a fresh `LearnStore`,
 * mirroring `quick-cards-store.ts`'s `QuickCardsStore` convention.
 */

import type { CardDef, LearnStore } from './learn-store.js';
import { learnStore, localToday } from './learn-store-host.js';
import { getElectronHost } from './host/index.js';
import {
  deleteSavedLearnCardFromAccount,
  listSavedLearnCards,
  saveLearnCardToAccount,
} from './learn-cards-client.js';

function contentKey(card: CardDef): string {
  return JSON.stringify({ type: card.type, front: card.front, back: card.back });
}

export class LearnCardsSync {
  private remoteAvailable = false;
  /** cardId → serialized `{type, front, back}` as last pushed/adopted. */
  private baseline = new Map<string, string>();
  private initialized = false;

  constructor(
    private readonly store: LearnStore,
    private readonly today: () => string = localToday,
  ) {}

  /** Whether this browser is signed in and syncing flashcard content to the account (web only — always `false` under Electron or before the first successful merge). */
  isSynced(): boolean {
    return this.remoteAvailable;
  }

  /** Web-only best-effort merge + ongoing mirror of flashcard content. Call once, after `loadLearnStore()` resolves. Idempotent; no-op under Electron. */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    if (getElectronHost()) return;

    const remote = await listSavedLearnCards().catch(() => null);
    if (!remote) return;
    this.remoteAvailable = true;

    const today = this.today();
    const localIds = new Set(this.store.listCards().map((c) => c.id));
    for (const card of remote) {
      if (!localIds.has(card.id)) this.store.upsertCard(card, today);
    }

    const remoteIds = new Set(remote.map((c) => c.id));
    for (const card of this.store.listCards()) {
      if (!remoteIds.has(card.id)) {
        void saveLearnCardToAccount(card).catch(() => {
          // Best-effort — see handleStoreChange.
        });
      }
    }

    for (const card of this.store.listCards()) this.baseline.set(card.id, contentKey(card));
    this.store.subscribe(() => this.handleStoreChange());
  }

  private handleStoreChange(): void {
    if (!this.remoteAvailable) return;
    const seen = new Set<string>();
    for (const card of this.store.listCards()) {
      seen.add(card.id);
      const key = contentKey(card);
      if (this.baseline.get(card.id) !== key) {
        this.baseline.set(card.id, key);
        void saveLearnCardToAccount(card).catch(() => {
          // Best-effort — already saved locally; this card resyncs the
          // next time it (or anything else) changes.
        });
      }
    }
    for (const id of [...this.baseline.keys()]) {
      if (!seen.has(id)) {
        this.baseline.delete(id);
        void deleteSavedLearnCardFromAccount(id).catch(() => {
          // Best-effort — see above.
        });
      }
    }
  }
}

export const learnCardsSync = new LearnCardsSync(learnStore);
