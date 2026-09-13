/**
 * @fileoverview The generic half of the tool-record sync: a watcher that
 * flushes any catalog collection's `localStorage` changes to the account
 * without that collection's package knowing the sync exists.
 *
 * `state/tool-record-mirror.ts` syncs a store by having its own `save*`/
 * `delete*` functions call `mirrorToolRecord*`. That is precise and immediate,
 * and it is the right thing for a store whose writes all funnel through one
 * pair of functions. It does not scale to the rest of the sidebar: the tools
 * keep something like ninety `localStorage`-backed stores between them, written
 * from panels, hooks, CSV importers, undo stacks and each other, and wiring
 * every one of those call sites by hand is both a very large mechanical change
 * across a dozen packages and a standing invitation for the next call site to
 * forget.
 *
 * So this module syncs by *observation* instead of by instrumentation. It keeps
 * a snapshot of each collection's serialized records and, whenever something
 * might have changed, diffs the store against that snapshot and pushes what
 * moved: upserts for records that are new or whose JSON differs, deletes for
 * ids that are gone. Adding a tool to the sync becomes one entry in
 * `TOOL_RECORD_COLLECTIONS` — no edit to the owning package at all.
 *
 * The two mechanisms compose rather than compete. An instrumented store's
 * `mirrorToolRecordSave` still goes out the moment the user clicks; the
 * watcher then sees that record already matching its snapshot and sends
 * nothing. The watcher is the floor, not the path.
 *
 * What it costs: a change is visible to the account at the next tick rather
 * than instantly, and a record edited to an identical value is not re-sent.
 * Both are fine for stores whose records are create/replace/delete — which, per
 * `mergeToolRecords`, is all of them.
 *
 * It never throws and never blocks a local write, the same contract the mirror
 * keeps: a browser that cannot reach the account goes on working against its
 * local store.
 *
 * @module state/tool-record-auto-sync
 */

import {
  TOOL_RECORD_COLLECTIONS,
  findToolRecordCollection,
  toolRecordId,
  MAX_TOOL_RECORD_BYTES,
  MAX_TOOL_RECORDS_PER_PUSH,
  type ToolRecordCollection,
} from "./toolRecordCollections";
import {
  isToolRecordSyncEnabled,
  readLocalToolRecords,
  setToolRecordSyncEnabled,
} from "./tool-record-mirror";
import {
  ToolRecordSyncError,
  deleteToolRecordFromAccount,
  saveToolRecordsToAccount,
} from "./tool-records-client";

/**
 * How often the watcher re-reads the stores, in ms.
 *
 * Reading ~90 `localStorage` keys and comparing strings is cheap and
 * synchronous, but it is not free, so this is slow enough to be invisible
 * between user actions and fast enough that a tab closed shortly after a save
 * has still flushed it. The event triggers below carry the urgent cases.
 */
export const TOOL_RECORD_AUTO_SYNC_INTERVAL_MS = 15_000;

/** The serialized records last known to match the account, per collection. */
const snapshots = new Map<string, Map<string, string>>();

/**
 * The raw `localStorage` string each collection held when its snapshot was
 * taken — a cheap pre-check so an unchanged store costs one `getItem` and a
 * string compare instead of a parse.
 *
 * This matters at the catalog's size: a tick walks every collection, and
 * almost all of them are unchanged almost every time. Parsing all of them to
 * discover that would put avoidable work on the main thread every 15 seconds.
 * It is only ever an early-out — a miss falls through to the real diff, so a
 * store whose JSON was re-serialized with the same content is caught there
 * and sends nothing anyway.
 */
const rawSnapshots = new Map<string, string>();

/** Teardown for everything {@link startToolRecordAutoSync} attached. */
let stop: (() => void) | null = null;

/** Guards against a slow flush overlapping the next tick. */
let flushing = false;

/**
 * Serializes a collection's local store by record id, dropping records the
 * sync cannot key (which stay local, exactly as `mirrorToolRecordsSave` leaves
 * them) and collapsing duplicate ids the way the route's own batch does.
 */
function rawOf(collection: ToolRecordCollection): string {
  if (typeof localStorage === "undefined") return "";
  try {
    return localStorage.getItem(collection.storageKey) ?? "";
  } catch {
    return "";
  }
}

function snapshotOf(collection: ToolRecordCollection): Map<string, string> {
  const byId = new Map<string, string>();
  for (const record of readLocalToolRecords(collection)) {
    const id = toolRecordId(collection, record);
    if (id === null || byId.has(id)) continue;
    try {
      byId.set(id, JSON.stringify(record));
    } catch {
      // A record carrying a cycle or a BigInt cannot be sent to the account at
      // all; leaving it out of the snapshot keeps it local rather than
      // retrying a serialization that will keep failing.
    }
  }
  return byId;
}

/**
 * Records a collection's current local store as already matching the account,
 * so the next flush sends only what changes after this point.
 *
 * Called after `hydrateToolRecords` has merged a collection: everything in the
 * store at that moment either came from the account or was just pushed to it,
 * and re-sending all of it on the first tick would turn every sign-in into a
 * full re-upload of every tool.
 *
 * @param collectionKey - A key from `TOOL_RECORD_COLLECTIONS`.
 */
export function markToolRecordsSynced(collectionKey: string): void {
  const collection = findToolRecordCollection(collectionKey);
  if (!collection) return;
  snapshots.set(collectionKey, snapshotOf(collection));
  rawSnapshots.set(collectionKey, rawOf(collection));
}

/**
 * Forgets every snapshot, so the next flush treats each store as entirely
 * unsynced. What a sign-out (and a sign-in as somebody else) leaves behind.
 */
export function resetToolRecordAutoSync(): void {
  snapshots.clear();
  rawSnapshots.clear();
}

/** What one collection's flush sent. */
export interface ToolRecordFlushResult {
  collection: string;
  /** Records created or changed since the last flush, and pushed. */
  pushed: number;
  /** Record ids gone from the store, and deleted from the account. */
  deleted: number;
  /** Why the flush stopped early, if it did. */
  error?: string;
}

/**
 * Pushes one collection's local changes to the account.
 *
 * A failure leaves that collection's snapshot un-advanced for whatever did not
 * land, so the next tick retries it rather than silently dropping the change —
 * the one behaviour a sync like this must not get wrong.
 *
 * @param collectionKey - A key from `TOOL_RECORD_COLLECTIONS`.
 * @returns What it sent.
 */
export async function flushToolRecordCollection(
  collectionKey: string,
): Promise<ToolRecordFlushResult> {
  const collection = findToolRecordCollection(collectionKey);
  if (!collection) {
    return { collection: collectionKey, pushed: 0, deleted: 0, error: "Unknown collection." };
  }
  if (!isToolRecordSyncEnabled() || typeof fetch === "undefined") {
    return { collection: collectionKey, pushed: 0, deleted: 0 };
  }

  // Cheap path: the store is byte-identical to when its snapshot was taken, so
  // there is nothing to diff. Only valid once a snapshot exists — an unseen
  // collection has to be walked even if its raw value happens to match.
  const raw = rawOf(collection);
  if (snapshots.has(collectionKey) && rawSnapshots.get(collectionKey) === raw) {
    return { collection: collectionKey, pushed: 0, deleted: 0 };
  }

  const previous = snapshots.get(collectionKey) ?? new Map<string, string>();
  const current = snapshotOf(collection);

  const changed: unknown[] = [];
  // Records the account will not accept at any size, held back from the batch
  // but still baselined below. The route rejects an entire PUT if one record
  // in it is over the cap, so sending an oversized record would cost every
  // *other* changed record in that collection its sync — and, because the
  // snapshot would not advance, it would do so again on every tick, forever.
  const oversized: string[] = [];
  for (const [id, data] of current) {
    if (previous.get(id) === data) continue;
    if (data.length > MAX_TOOL_RECORD_BYTES) {
      oversized.push(id);
      continue;
    }
    try {
      changed.push(JSON.parse(data));
    } catch {
      // Unreachable in practice — `data` is this module's own JSON.stringify.
    }
  }
  const removed = [...previous.keys()].filter((id) => !current.has(id));

  if (changed.length === 0 && removed.length === 0) {
    rawSnapshots.set(collectionKey, raw);
    if (oversized.length > 0) {
      // Baseline them anyway: they stay local, and if one is later edited down
      // under the cap its JSON changes and the next flush picks it up.
      const baselined = new Map(previous);
      for (const id of oversized) baselined.set(id, current.get(id) ?? "");
      snapshots.set(collectionKey, baselined);
      return {
        collection: collectionKey,
        pushed: 0,
        deleted: 0,
        error: `${oversized.length} record(s) too large to sync; kept in this browser.`,
      };
    }
    return { collection: collectionKey, pushed: 0, deleted: 0 };
  }

  // Advance the snapshot only for what the account actually accepted, so a
  // half-failed flush retries the remainder on the next tick.
  const landed = new Map(previous);
  for (const id of oversized) landed.set(id, current.get(id) ?? "");
  let pushed = 0;
  let deleted = 0;
  // A failed write, which must re-diff next tick. Distinct from the oversized
  // note below: that one is reported but is not a reason to retry, since
  // re-sending the same too-large record would fail identically.
  let writeError: string | undefined;

  try {
    for (let from = 0; from < changed.length; from += MAX_TOOL_RECORDS_PER_PUSH) {
      const batch = changed.slice(from, from + MAX_TOOL_RECORDS_PER_PUSH);
      await saveToolRecordsToAccount(collectionKey, batch);
      for (const record of batch) {
        const id = toolRecordId(collection, record);
        if (id !== null) landed.set(id, current.get(id) ?? "");
      }
      pushed += batch.length;
    }
    for (const id of removed) {
      await deleteToolRecordFromAccount(collectionKey, id);
      landed.delete(id);
      deleted += 1;
    }
  } catch (caught: unknown) {
    writeError = caught instanceof Error ? caught.message : String(caught);
    // A session that expired mid-visit. Detaching the watcher's listeners is
    // not enough on its own — a flush already scheduled, or one the app calls
    // directly, would go on pushing every remaining collection at an endpoint
    // that will keep refusing it. So switch mirroring off as well, exactly as
    // `tool-record-mirror` does on its own 401, and let the app's next session
    // change turn both back on.
    if (caught instanceof ToolRecordSyncError && caught.status === 401) {
      setToolRecordSyncEnabled(false);
      stopToolRecordAutoSync();
    }
  }

  snapshots.set(collectionKey, landed);
  // Only when every write landed: a partial flush must re-diff next tick rather
  // than be skipped by the raw pre-check.
  if (writeError === undefined) rawSnapshots.set(collectionKey, raw);

  const error =
    writeError ??
    (oversized.length > 0
      ? `${oversized.length} record(s) too large to sync; kept in this browser.`
      : undefined);
  return { collection: collectionKey, pushed, deleted, ...(error ? { error } : {}) };
}

/**
 * Flushes every collection in the catalog, in order.
 *
 * Sequential rather than `Promise.all` for the same reason `useToolRecordSync`
 * hydrates sequentially: a tab that has been open a while should not answer a
 * visibility change with ninety simultaneous writes.
 *
 * @returns One result per collection that had something to send.
 */
export async function flushToolRecords(): Promise<ToolRecordFlushResult[]> {
  if (flushing || !isToolRecordSyncEnabled()) return [];
  flushing = true;
  try {
    const results: ToolRecordFlushResult[] = [];
    for (const collection of TOOL_RECORD_COLLECTIONS) {
      if (!isToolRecordSyncEnabled()) break;
      const result = await flushToolRecordCollection(collection.key);
      if (result.pushed > 0 || result.deleted > 0 || result.error) results.push(result);
    }
    return results;
  } finally {
    flushing = false;
  }
}

/**
 * Starts watching every catalog collection for local changes.
 *
 * Flushes on an interval, on a cross-tab `storage` event, and when the tab is
 * hidden or unloaded — the last of those being what saves the change a user
 * made immediately before closing the laptop.
 *
 * Idempotent: calling it again while running restarts the timers rather than
 * stacking a second watcher, which matters because `ToolRecordSyncProvider`
 * mounts in both the shell document and each dock frame.
 *
 * @param onFlush - Called with a tick's results, when it had any worth
 * reporting (something pushed, deleted, or held back — see
 * {@link flushToolRecords}). This is the only way a caller learns about a
 * background-tick failure, e.g. a record that grew past
 * `MAX_TOOL_RECORD_BYTES` after the tab's initial reconcile: nothing else
 * surfaces it, since the tick that finds it runs on its own, unobserved
 * timer rather than in response to a call the caller is awaiting.
 * @returns A function that stops the watcher.
 */
export function startToolRecordAutoSync(
  onFlush?: (results: ToolRecordFlushResult[]) => void,
): () => void {
  stopToolRecordAutoSync();
  if (typeof window === "undefined") return () => {};

  const tick = () => {
    void flushToolRecords().then((results) => {
      if (onFlush && results.length > 0) onFlush(results);
    });
  };

  const interval = setInterval(tick, TOOL_RECORD_AUTO_SYNC_INTERVAL_MS);
  const onStorage = (event: StorageEvent) => {
    // `null` is `localStorage.clear()` per the StorageEvent spec, which can
    // have emptied any store; anything else only matters if it is a store the
    // catalog names.
    if (event.key !== null && !TOOL_RECORD_COLLECTIONS.some((c) => c.storageKey === event.key)) {
      return;
    }
    tick();
  };
  const onHide = () => {
    if (document.visibilityState === "hidden") tick();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener("pagehide", tick);
  document.addEventListener("visibilitychange", onHide);

  stop = () => {
    clearInterval(interval);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("pagehide", tick);
    document.removeEventListener("visibilitychange", onHide);
    stop = null;
  };
  return stop;
}

/** Stops the watcher, if one is running. Safe to call when none is. */
export function stopToolRecordAutoSync(): void {
  stop?.();
}

/** Whether a watcher is currently attached. */
export function isToolRecordAutoSyncRunning(): boolean {
  return stop !== null;
}
