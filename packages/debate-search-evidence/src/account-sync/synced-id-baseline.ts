/**
 * @fileoverview Remembers which record ids the account held at this browser's
 * last merge, so the next merge can tell "deleted on another device" apart
 * from "saved here and never pushed".
 *
 * `mergeToolRecords` is a union: a record this browser holds and the account
 * doesn't is kept and pushed back up. That is right for a record saved
 * offline, but wrong for one another device deleted while this one was away:
 * the union brings it back. Comparing against what the account held last time
 * splits the two cases. An id that was in the account then, is gone now, and
 * is still here was deleted elsewhere; an id this browser never saw in the
 * account is new and still gets pushed.
 *
 * Only collections that opt in with `propagateRemoteDeletes` use this (see
 * `ToolRecordCollection`). The baseline is stored per account: a different
 * account signing in on the same browser starts with no baseline, so it can
 * never drop records because of what someone else's account lacked.
 *
 * Like the rest of the sync this never throws: unreadable or missing storage
 * reads as "no baseline", which falls back to the plain union.
 *
 * @module account-sync/synced-id-baseline
 */

import { toolRecordId, type ToolRecordCollection } from "./toolRecordCollections";

/** Where the baseline is kept. Sync bookkeeping, so it is not itself synced. */
export const SYNCED_ID_BASELINE_KEY = "toolRecordSyncedIds";

/** Most ids remembered per collection; past this the baseline is not saved (the merge falls back to the union). */
export const MAX_BASELINE_IDS = 5_000;

interface StoredBaseline {
  accountId: string;
  collections: Record<string, string[]>;
}

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): WritableStorage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

function readStored(storage: ReadableStorage): StoredBaseline | null {
  try {
    const raw = storage.getItem(SYNCED_ID_BASELINE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const { accountId, collections } = parsed as Partial<StoredBaseline>;
    if (typeof accountId !== "string" || !accountId) return null;
    if (!collections || typeof collections !== "object" || Array.isArray(collections)) return null;
    return { accountId, collections };
  } catch {
    return null;
  }
}

/**
 * The ids the account held for `collectionKey` at this browser's last merge
 * under `accountId`.
 *
 * @returns The ids, or `null` when there is no usable baseline (never merged,
 *   another account's baseline, or unreadable storage).
 */
export function readSyncedIdBaseline(
  accountId: string,
  collectionKey: string,
  storage: ReadableStorage | null = defaultStorage(),
): Set<string> | null {
  if (!storage || !accountId) return null;
  const stored = readStored(storage);
  if (!stored || stored.accountId !== accountId) return null;
  const ids = stored.collections[collectionKey];
  if (!Array.isArray(ids)) return null;
  return new Set(ids.filter((id): id is string => typeof id === "string"));
}

/**
 * Saves the ids the account holds for `collectionKey` after a merge. A
 * baseline saved under another account is replaced, not added to.
 *
 * Over {@link MAX_BASELINE_IDS} ids, the collection's baseline is removed
 * instead, so the next merge falls back to the union rather than growing
 * storage without bound.
 */
export function writeSyncedIdBaseline(
  accountId: string,
  collectionKey: string,
  ids: Iterable<string>,
  storage: WritableStorage | null = defaultStorage(),
): void {
  if (!storage || !accountId) return;
  const stored = readStored(storage);
  const collections = stored && stored.accountId === accountId ? { ...stored.collections } : {};
  const list = [...new Set(ids)];
  if (list.length > MAX_BASELINE_IDS) delete collections[collectionKey];
  else collections[collectionKey] = list;
  try {
    storage.setItem(SYNCED_ID_BASELINE_KEY, JSON.stringify({ accountId, collections }));
  } catch {
    // Quota or a locked-down browser: the next merge simply has no baseline.
  }
}

/**
 * Ids of local records that another device deleted: they were in the account
 * at the last merge (`baseline`), are not in it now (`remote`), and this
 * browser still holds them (`local`).
 *
 * @returns The ids to drop locally instead of pushing back up. Empty without a baseline.
 */
export function toolRecordsDeletedRemotely(
  collection: ToolRecordCollection,
  local: readonly unknown[],
  remote: readonly unknown[],
  baseline: ReadonlySet<string> | null,
): Set<string> {
  const deleted = new Set<string>();
  if (!baseline || baseline.size === 0) return deleted;
  const remoteIds = new Set<string>();
  for (const record of remote) {
    const id = toolRecordId(collection, record);
    if (id !== null) remoteIds.add(id);
  }
  for (const record of local) {
    const id = toolRecordId(collection, record);
    if (id !== null && baseline.has(id) && !remoteIds.has(id)) deleted.add(id);
  }
  return deleted;
}
