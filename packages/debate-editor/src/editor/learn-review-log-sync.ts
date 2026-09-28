/**
 * Learn — account sync for the review LOG (`ReviewLogEntry[]`: `cardId`/
 * `at`/`grade`/`intervalBefore`/`intervalAfter`). Same split
 * `learn-cards-sync.ts` established for card content and
 * `learn-decks-sync.ts` for custom decks: one of Learn's 8 sub-collections
 * gets its own bespoke sync rather than the generic `TOOL_RECORD_COLLECTIONS`
 * mechanism, because all 8 live in one shared `pmd-learn-store` blob and the
 * generic mechanism would overwrite the other 7 on every write. No new sync
 * infrastructure for the remaining 5 sub-collections (schedules, anchors, AI
 * threads, notes, doc registry) — see those modules' own doc comments for
 * why those stay local-only.
 *
 * A review-log entry is immutable once logged (`grade()` only ever appends;
 * nothing edits an existing entry), and syncing it is purely informational
 * — this module never touches `schedules`, which stays local-only and
 * per-device exactly as `learn-cards-sync.ts` and `learn-decks-sync.ts`
 * already leave it. That makes this the simplest of the three: no
 * optimistic-concurrency conflict is possible (an entry's content for a
 * given `reviewLogEntryId` never changes), so the sync is pure add/remove —
 * closer to `learn-decks-sync.ts`'s brand-new-deck push than to either
 * module's edit-conflict handling.
 *
 * `LearnStore` stays host-agnostic (no network/account knowledge) — this
 * class sits beside it, web-only (Electron's Learn store stays local-only
 * for now, same boundary the other two sync classes draw), and drives sync
 * purely through the store's existing public surface (`listLog`,
 * `adoptLogEntry`, `subscribe`).
 *
 * `init()` — call once after `loadLearnStore()` resolves:
 *   1. Best-effort merge against `/api/learn-review-log`: adopts any remote
 *      entry missing locally (by `reviewLogEntryId`, via `adoptLogEntry` —
 *      a plain create-if-absent that never touches the schedule) and
 *      pushes any local-only entry up. No-op (stays unsynced) when signed
 *      out or the request fails.
 *   2. Subscribes to the store's generic `subscribe()` (fires on *any*
 *      mutation, not just grading) and, on each notification, diffs the
 *      current log's id set against the last-synced snapshot: a new entry
 *      is pushed, an entry no longer present (a card's log gets pruned by
 *      `deleteCard` or `forgetDoc`) is removed from the account. This
 *      catches every log-mutating path without `LearnStore` having to name
 *      them individually.
 *
 * The class (not just the `learnReviewLogSync` singleton below) is exported
 * so tests can construct isolated instances against a fresh `LearnStore`,
 * mirroring `LearnCardsSync`'s convention.
 */

import type { LearnStore, ReviewLogEntry } from './learn-store.js';
import { reviewLogEntryId } from './learn-store.js';
import { learnStore } from './learn-store-host.js';
import { getElectronHost } from './host/index.js';
import {
  deleteSavedReviewLogEntryFromAccount,
  listSavedReviewLogEntries,
  saveReviewLogEntryToAccount,
} from './learn-review-log-client.js';

export class LearnReviewLogSync {
  private remoteAvailable = false;
  /** The set of entry ids last pushed/adopted, for diffing the next change. */
  private baseline = new Set<string>();
  private initialized = false;

  constructor(private readonly store: LearnStore) {}

  /** Whether this browser is signed in and syncing review history to the account (web only — always `false` under Electron or before the first successful merge). */
  isSynced(): boolean {
    return this.remoteAvailable;
  }

  /** Web-only best-effort merge + ongoing mirror of the review log. Call once, after `loadLearnStore()` resolves. Idempotent; no-op under Electron. */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    if (getElectronHost()) return;

    const remote = await listSavedReviewLogEntries().catch(() => null);
    if (!remote) return;
    this.remoteAvailable = true;

    const localIds = new Set(this.store.listLog().map((l) => reviewLogEntryId(l)));
    for (const entry of remote) {
      if (!localIds.has(reviewLogEntryId(entry))) this.store.adoptLogEntry(entry);
    }

    const remoteIds = new Set(remote.map((l) => reviewLogEntryId(l)));
    for (const entry of this.store.listLog()) {
      if (!remoteIds.has(reviewLogEntryId(entry))) {
        void saveReviewLogEntryToAccount(entry).catch(() => {
          // Best-effort — see handleStoreChange.
        });
      }
    }

    for (const entry of this.store.listLog()) this.baseline.add(reviewLogEntryId(entry));
    this.store.subscribe(() => this.handleStoreChange());
  }

  private handleStoreChange(): void {
    if (!this.remoteAvailable) return;
    const seen = new Set<string>();
    for (const entry of this.store.listLog()) {
      const id = reviewLogEntryId(entry);
      seen.add(id);
      if (this.baseline.has(id)) continue;
      this.baseline.add(id);
      void saveReviewLogEntryToAccount(entry).catch(() => {
        // Best-effort — already saved locally; this entry resyncs the next
        // time it (or anything else) changes.
      });
    }
    for (const id of [...this.baseline]) {
      if (!seen.has(id)) {
        this.baseline.delete(id);
        void deleteSavedReviewLogEntryFromAccount(id).catch(() => {
          // Best-effort — see above.
        });
      }
    }
  }
}

export const learnReviewLogSync = new LearnReviewLogSync(learnStore);
