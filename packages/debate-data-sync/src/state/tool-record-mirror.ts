/**
 * @fileoverview The write half of the shared tool-record sync: fire-and-forget
 * mirroring of a tool's local `localStorage` writes up to the signed-in user's
 * account, plus the local read/write/hydrate helpers the account merge uses.
 *
 * Why a mirror rather than a hook per tool: the stores in
 * `state/toolRecordCollections.ts` are written from all over their packages —
 * panels, hooks, CSV importers, undo stacks, one tool's store writing
 * another's (a judge round record rebuilds its judge profile). Threading an
 * "and also sync it" callback through every one of those call sites would
 * have been a large, mechanical change to a dozen packages, and every future
 * call site would have to remember to do it. Instead each store's own
 * `save*`/`delete*` functions — the one place every write already funnels
 * through — call `mirrorToolRecord*`, and the network side stays here.
 *
 * A store that has *not* been wired that way still syncs:
 * `state/tool-record-auto-sync.ts` watches every collection in the catalog and
 * flushes what changed. These calls are the fast path on top of that — the
 * difference between reaching the account on the click and reaching it at the
 * watcher's next tick — not the thing that makes a collection sync at all.
 *
 * Two properties make that safe to call from a pure state module:
 *
 * - **Off by default.** Nothing syncs until `setToolRecordSyncEnabled(true)`,
 *   which the app's `ToolRecordSyncProvider` calls only once `useSession`
 *   reports a signed-in user. A signed-out browser, a server render and a unit
 *   test therefore make no requests at all — the stores stay exactly as
 *   local-only as they were.
 * - **Never throws, never blocks.** A mirror call returns immediately and its
 *   failure is swallowed, keeping this repo's "local apply is never blocked by
 *   a sync failure" convention. A `401` (a session that expired mid-visit)
 *   additionally switches syncing back off rather than retrying every write
 *   against an endpoint that will keep refusing.
 *
 * @module state/tool-record-mirror
 */

import {
  findToolRecordCollection,
  mergeToolRecords,
  toolRecordId,
  toolRecordsMissingRemotely,
  type ToolRecordCollection,
} from "./toolRecordCollections";
import {
  ToolRecordSyncError,
  clearToolRecordsInAccount,
  deleteToolRecordFromAccount,
  listAllToolRecords,
  listToolRecords,
  saveToolRecordToAccount,
  saveToolRecordsToAccount,
} from "./tool-records-client";

/** Whether writes mirror to the account. Off until the app says otherwise. */
let syncEnabled = false;

/**
 * The in-flight (or settled) bulk read of every collection, while a reconcile
 * is running. `null` when none is.
 *
 * Reconciling the catalog one collection at a time is one GET per collection,
 * and there are now dozens of them — a request storm on every sign-in, for
 * rows that all live in one table. {@link beginToolRecordPrefetch} fetches
 * them together and each `hydrateToolRecords` call reads its slice out of the
 * shared promise instead of making its own request.
 */
let prefetch: Promise<Record<string, unknown[]> | null> | null = null;

/** Reports a mirror failure, when the host has asked to hear about them. */
let onMirrorError: ((collection: string, error: unknown) => void) | null = null;

/**
 * Turns account mirroring on or off for every collection at once.
 *
 * Called by the app with `true` once a signed-in session is known, and with
 * `false` on sign-out — after which the tools go back to being purely local,
 * with this browser's copy of each store left in place.
 *
 * @param enabled - Whether subsequent local writes mirror to the account.
 */
export function setToolRecordSyncEnabled(enabled: boolean): void {
  syncEnabled = enabled;
}

/** Whether local writes are currently mirroring to an account. */
export function isToolRecordSyncEnabled(): boolean {
  return syncEnabled;
}

/**
 * Registers a callback for mirror failures, so a host can surface "this
 * didn't reach your account" without any store having to know how. Pass
 * `null` to clear it.
 *
 * @param handler - Called with the collection key and the thrown error.
 */
export function setToolRecordMirrorErrorHandler(
  handler: ((collection: string, error: unknown) => void) | null,
): void {
  onMirrorError = handler;
}

/**
 * Starts one bulk read of every synced collection, for the reconcile about to
 * run. Subsequent {@link hydrateToolRecords} calls read from it rather than
 * fetching their own collection.
 *
 * Safe to call when one is already in flight: the existing prefetch is reused,
 * so the shell document and each dock frame share a single request.
 */
export function beginToolRecordPrefetch(): void {
  if (prefetch !== null) return;
  prefetch = listAllToolRecords();
}

/**
 * Discards the prefetch, so the next reconcile fetches fresh. Called when one
 * finishes — holding the payload past that would serve a later `resync()` the
 * records as they were at sign-in.
 */
export function endToolRecordPrefetch(): void {
  prefetch = null;
}

/**
 * This collection's records from the bulk prefetch, or `undefined` when there
 * is no usable prefetch and the caller should fetch the collection itself.
 *
 * A prefetch that failed resolves to `null`, which deliberately reads as "no
 * prefetch" rather than "no records": a request that never landed must not be
 * allowed to look like an empty account, since the merge would then adopt
 * nothing and the push would re-upload everything.
 */
async function prefetchedRecords(collectionKey: string): Promise<unknown[] | undefined> {
  if (prefetch === null) return undefined;
  const all = await prefetch;
  if (all === null) return undefined;
  // A collection absent from a *successful* response genuinely has no records.
  return all[collectionKey] ?? [];
}

/** Runs a mirror request, swallowing failure and standing down on a 401. */
function mirror(collection: string, run: () => Promise<void>): void {
  if (!syncEnabled || typeof fetch === "undefined") return;
  void run().catch((error: unknown) => {
    // A session that expired mid-visit would otherwise have every subsequent
    // write retry against an endpoint that will keep refusing it. Checked on
    // the status rather than the message: the route's 401 body is prose
    // ("Sign in to …"), which no pattern-match on the text would catch.
    if (error instanceof ToolRecordSyncError && error.status === 401) syncEnabled = false;
    onMirrorError?.(collection, error);
  });
}

/**
 * Mirrors one record's local save up to the account. A no-op when syncing is
 * off, or when the record carries no id to key it by.
 *
 * @param collectionKey - A key from `TOOL_RECORD_COLLECTIONS`.
 * @param record - The record just written locally.
 */
export function mirrorToolRecordSave(collectionKey: string, record: unknown): void {
  if (!syncEnabled) return;
  const collection = findToolRecordCollection(collectionKey);
  if (!collection) return;
  const id = toolRecordId(collection, record);
  if (id === null) return;
  mirror(collectionKey, () => saveToolRecordToAccount(collectionKey, id, record));
}

/**
 * Mirrors a local delete up to the account.
 *
 * @param collectionKey - A key from `TOOL_RECORD_COLLECTIONS`.
 * @param recordId - The id just removed locally.
 */
export function mirrorToolRecordDelete(collectionKey: string, recordId: string): void {
  if (!syncEnabled || !findToolRecordCollection(collectionKey)) return;
  mirror(collectionKey, () => deleteToolRecordFromAccount(collectionKey, recordId));
}

/**
 * Mirrors a bulk local write — a CSV import, or a store rewritten wholesale —
 * as one request rather than one per record.
 *
 * @param collectionKey - A key from `TOOL_RECORD_COLLECTIONS`.
 * @param records - The records just written locally.
 */
export function mirrorToolRecordsSave(collectionKey: string, records: readonly unknown[]): void {
  if (!syncEnabled) return;
  const collection = findToolRecordCollection(collectionKey);
  if (!collection) return;
  // The route refuses the whole batch if any record lacks its id field.
  // Dropping the unsyncable ones here means one odd row can't cost a CSV
  // import its entire sync — those rows stay local, which is where they were.
  const syncable = records.filter((record) => toolRecordId(collection, record) !== null);
  if (syncable.length === 0) return;
  mirror(collectionKey, () => saveToolRecordsToAccount(collectionKey, syncable));
}

/**
 * Mirrors a local "clear everything" up to the account.
 *
 * @param collectionKey - A key from `TOOL_RECORD_COLLECTIONS`.
 */
export function mirrorToolRecordsClear(collectionKey: string): void {
  if (!syncEnabled || !findToolRecordCollection(collectionKey)) return;
  mirror(collectionKey, () => clearToolRecordsInAccount(collectionKey));
}

/**
 * Reads a collection's records straight out of this browser's store.
 *
 * Deliberately by storage key rather than through the owning package's
 * `list*` helper: `debate-data-sync` is a leaf package that the tool packages
 * depend on, and hydration must work whether or not the tool's own module has
 * been imported yet.
 *
 * @param collection - The collection to read.
 * @returns Its records, or `[]` when there is no store (or no localStorage).
 */
export function readLocalToolRecords(collection: ToolRecordCollection): unknown[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(collection.storageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Writes a collection's records back to this browser's store and tells any
 * mounted panel to re-read.
 *
 * The panels already refresh on the `storage` event (see each package's
 * `live-update.ts`), but the browser fires that only in *other* tabs — never
 * in the one that wrote. Dispatching the same event by hand is what makes an
 * account merge show up in the open tool without every panel needing to know
 * this sync exists.
 *
 * @param collection - The collection to write.
 * @param records - The records to store.
 */
export function writeLocalToolRecords(
  collection: ToolRecordCollection,
  records: readonly unknown[],
): void {
  if (typeof localStorage === "undefined") return;
  const newValue = JSON.stringify(records);
  localStorage.setItem(collection.storageKey, newValue);

  if (typeof window === "undefined" || typeof StorageEvent === "undefined") return;
  try {
    window.dispatchEvent(
      new StorageEvent("storage", { key: collection.storageKey, newValue, storageArea: localStorage }),
    );
  } catch {
    // A host without a constructible StorageEvent just doesn't live-update;
    // the merged records are already in localStorage either way.
  }
}

/** What one collection's account merge did, for the sync-status UI. */
export interface ToolRecordHydrationResult {
  collection: string;
  /** Records adopted from the account into this browser. */
  adopted: number;
  /** Local-only records pushed up to the account. */
  pushed: number;
  /** False when the account had nothing to say — signed out, or a failure. */
  synced: boolean;
  /** Why it didn't sync, when `synced` is false and it wasn't a sign-out. */
  error?: string;
}

/**
 * Reconciles one collection between this browser and the account: adopt what
 * the account has, push up what only this browser has (see
 * `mergeToolRecords`), and leave local storage holding the union.
 *
 * Never throws — a browser that can't reach the account keeps working against
 * its local store, which is what it did before any of this existed.
 *
 * @param collectionKey - A key from `TOOL_RECORD_COLLECTIONS`.
 * @returns What the merge did.
 */
export async function hydrateToolRecords(
  collectionKey: string,
): Promise<ToolRecordHydrationResult> {
  const collection = findToolRecordCollection(collectionKey);
  if (!collection) {
    return { collection: collectionKey, adopted: 0, pushed: 0, synced: false, error: "Unknown collection." };
  }

  let remote: unknown[] | null;
  try {
    remote = (await prefetchedRecords(collectionKey)) ?? (await listToolRecords(collectionKey));
  } catch (error: unknown) {
    return {
      collection: collectionKey,
      adopted: 0,
      pushed: 0,
      synced: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // Signed out: nothing to merge, and nothing to push to.
  if (remote === null) {
    return { collection: collectionKey, adopted: 0, pushed: 0, synced: false };
  }

  const local = readLocalToolRecords(collection);
  const merged = mergeToolRecords(collection, local, remote);
  const missing = toolRecordsMissingRemotely(collection, local, remote);

  if (merged.length !== local.length || remote.length > 0) {
    writeLocalToolRecords(collection, merged);
  }

  let pushed = 0;
  if (missing.length > 0) {
    try {
      await saveToolRecordsToAccount(collectionKey, missing);
      pushed = missing.length;
    } catch (error: unknown) {
      return {
        collection: collectionKey,
        adopted: merged.length - local.length,
        pushed: 0,
        synced: true,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    collection: collectionKey,
    adopted: merged.length - local.length,
    pushed,
    synced: true,
  };
}
