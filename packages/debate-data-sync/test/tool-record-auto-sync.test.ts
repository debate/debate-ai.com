/**
 * @fileoverview Pins the watcher that syncs a catalog collection without its
 * package being wired for it.
 *
 * This is the mechanism that makes "every tool stores its data with the user"
 * true by construction — a collection in `TOOL_RECORD_COLLECTIONS` syncs
 * whether or not anybody remembered to add a `mirrorToolRecord*` call — so the
 * failure modes it must not have are the ones that lose data silently:
 *
 * - **Re-uploading a just-merged store.** Without the post-hydrate baseline,
 *   every sign-in would push the entire account back at itself.
 * - **Advancing the snapshot past a failed write.** A record whose push was
 *   refused has to be retried, not quietly forgotten — the one bug a sync like
 *   this cannot be allowed to have.
 * - **Treating a sign-out's leftovers as synced.** The next user's first flush
 *   would push nothing at all.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  flushToolRecordCollection,
  flushToolRecords,
  markToolRecordsSynced,
  resetToolRecordAutoSync,
} from "../src/state/tool-record-auto-sync";
import {
  setToolRecordSyncEnabled,
  writeLocalToolRecords,
} from "../src/state/tool-record-mirror";
import {
  findToolRecordCollection,
  type ToolRecordCollection,
} from "../src/state/toolRecordCollections";

const favorites = findToolRecordCollection("debateVideosFavorites") as ToolRecordCollection;

interface Call {
  url: string;
  method: string;
  body: unknown;
}

let calls: Call[] = [];
/** Statuses to fail the next N requests with, oldest first. */
let failures: number[] = [];

/** A minimal localStorage, since this package's tests run in node. */
function installLocalStorage(): void {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  });
}

beforeEach(() => {
  calls = [];
  failures = [];
  installLocalStorage();
  // `writeLocalToolRecords` dispatches a synthetic StorageEvent; node has
  // neither, and the watcher's own listeners are not what these tests drive.
  vi.stubGlobal("window", undefined);
  vi.stubGlobal("StorageEvent", undefined);
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({
      url,
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const status = failures.shift();
    if (status) return new Response(JSON.stringify({ error: "nope" }), { status });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
  resetToolRecordAutoSync();
  setToolRecordSyncEnabled(true);
});

afterEach(() => {
  setToolRecordSyncEnabled(false);
  resetToolRecordAutoSync();
  vi.unstubAllGlobals();
});

describe("tool-record auto-sync", () => {
  it("pushes a record the store gained since the baseline", async () => {
    markToolRecordsSynced(favorites.key);
    writeLocalToolRecords(favorites, [{ videoId: "abc", savedAt: "2026-01-01T00:00:00.000Z" }]);

    const result = await flushToolRecordCollection(favorites.key);

    expect(result).toMatchObject({ pushed: 1, deleted: 0 });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: "/api/tool-records/debateVideosFavorites",
      method: "PUT",
    });
    expect(calls[0]?.body).toEqual({
      records: [{ videoId: "abc", savedAt: "2026-01-01T00:00:00.000Z" }],
    });
  });

  it("sends nothing when the store has not changed", async () => {
    writeLocalToolRecords(favorites, [{ videoId: "abc", savedAt: "2026-01-01T00:00:00.000Z" }]);
    markToolRecordsSynced(favorites.key);

    // This is the sign-in case: the baseline is taken right after the account
    // merge, so a store full of adopted records is not pushed back up.
    expect(await flushToolRecordCollection(favorites.key)).toMatchObject({
      pushed: 0,
      deleted: 0,
    });
    expect(calls).toEqual([]);
  });

  it("pushes a record whose contents changed under the same id", async () => {
    writeLocalToolRecords(favorites, [{ videoId: "abc", savedAt: "2026-01-01T00:00:00.000Z" }]);
    markToolRecordsSynced(favorites.key);
    writeLocalToolRecords(favorites, [{ videoId: "abc", savedAt: "2026-06-06T00:00:00.000Z" }]);

    expect(await flushToolRecordCollection(favorites.key)).toMatchObject({ pushed: 1 });
    expect(calls[0]?.body).toEqual({
      records: [{ videoId: "abc", savedAt: "2026-06-06T00:00:00.000Z" }],
    });
  });

  it("deletes from the account what the store lost", async () => {
    writeLocalToolRecords(favorites, [
      { videoId: "abc", savedAt: "2026-01-01T00:00:00.000Z" },
      { videoId: "def", savedAt: "2026-01-02T00:00:00.000Z" },
    ]);
    markToolRecordsSynced(favorites.key);
    writeLocalToolRecords(favorites, [{ videoId: "abc", savedAt: "2026-01-01T00:00:00.000Z" }]);

    expect(await flushToolRecordCollection(favorites.key)).toMatchObject({
      pushed: 0,
      deleted: 1,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: "/api/tool-records/debateVideosFavorites/def",
      method: "DELETE",
    });
  });

  it("retries a push that failed, rather than losing the record", async () => {
    markToolRecordsSynced(favorites.key);
    writeLocalToolRecords(favorites, [{ videoId: "abc", savedAt: "2026-01-01T00:00:00.000Z" }]);

    failures = [500];
    const failed = await flushToolRecordCollection(favorites.key);
    expect(failed.pushed).toBe(0);
    expect(failed.error).toBeDefined();

    // The snapshot must not have advanced past the record that never landed.
    calls = [];
    const retried = await flushToolRecordCollection(favorites.key);
    expect(retried).toMatchObject({ pushed: 1 });
    expect(calls[0]?.body).toEqual({
      records: [{ videoId: "abc", savedAt: "2026-01-01T00:00:00.000Z" }],
    });
  });

  it("stands down when the session has expired, instead of retrying every store", async () => {
    markToolRecordsSynced(favorites.key);
    writeLocalToolRecords(favorites, [{ videoId: "abc", savedAt: "2026-01-01T00:00:00.000Z" }]);

    failures = [401];
    await flushToolRecordCollection(favorites.key);

    // A 401 is not a transient failure — every subsequent write would be
    // refused the same way, so the whole catalog flush stops trying.
    calls = [];
    expect(await flushToolRecords()).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("treats a reset as 'nothing is synced', so the next flush pushes everything", async () => {
    writeLocalToolRecords(favorites, [{ videoId: "abc", savedAt: "2026-01-01T00:00:00.000Z" }]);
    markToolRecordsSynced(favorites.key);

    // What a sign-out does: the snapshot described the previous account.
    resetToolRecordAutoSync();

    expect(await flushToolRecordCollection(favorites.key)).toMatchObject({ pushed: 1 });
  });

  it("leaves a record the sync cannot key alone", async () => {
    markToolRecordsSynced(favorites.key);
    writeLocalToolRecords(favorites, [{ savedAt: "2026-01-01T00:00:00.000Z" }, { videoId: "" }]);

    expect(await flushToolRecordCollection(favorites.key)).toMatchObject({
      pushed: 0,
      deleted: 0,
    });
    expect(calls).toEqual([]);
  });

  it("sends nothing at all while syncing is off", async () => {
    setToolRecordSyncEnabled(false);
    markToolRecordsSynced(favorites.key);
    writeLocalToolRecords(favorites, [{ videoId: "abc", savedAt: "2026-01-01T00:00:00.000Z" }]);

    expect(await flushToolRecordCollection(favorites.key)).toMatchObject({ pushed: 0 });
    expect(await flushToolRecords()).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("refuses a collection nothing syncs under", async () => {
    const result = await flushToolRecordCollection("notATool");
    expect(result.error).toBeDefined();
    expect(calls).toEqual([]);
  });
});

describe("records the account cannot accept", () => {
  it("holds back an oversized record without costing its collection the flush", async () => {
    markToolRecordsSynced(favorites.key);
    writeLocalToolRecords(favorites, [
      { videoId: "huge", savedAt: "x".repeat(300_000) },
      { videoId: "abc", savedAt: "2026-01-01T00:00:00.000Z" },
    ]);

    const result = await flushToolRecordCollection(favorites.key);

    // The route rejects a whole PUT over one oversized record, so the small
    // one has to travel without it.
    expect(result.pushed).toBe(1);
    expect(result.error).toMatch(/too large/i);
    expect(calls[0]?.body).toEqual({
      records: [{ videoId: "abc", savedAt: "2026-01-01T00:00:00.000Z" }],
    });
  });

  it("does not retry an oversized record on every tick", async () => {
    markToolRecordsSynced(favorites.key);
    writeLocalToolRecords(favorites, [{ videoId: "huge", savedAt: "x".repeat(300_000) }]);

    await flushToolRecordCollection(favorites.key);
    calls = [];

    expect(await flushToolRecordCollection(favorites.key)).toMatchObject({ pushed: 0 });
    expect(calls).toEqual([]);
  });

  it("picks the record up once it is edited back under the cap", async () => {
    markToolRecordsSynced(favorites.key);
    writeLocalToolRecords(favorites, [{ videoId: "huge", savedAt: "x".repeat(300_000) }]);
    await flushToolRecordCollection(favorites.key);
    calls = [];

    writeLocalToolRecords(favorites, [{ videoId: "huge", savedAt: "2026-01-01T00:00:00.000Z" }]);

    expect(await flushToolRecordCollection(favorites.key)).toMatchObject({ pushed: 1 });
    expect(calls).toHaveLength(1);
  });
});

describe("the unchanged-store pre-check", () => {
  it("skips the diff entirely when the store is byte-identical", async () => {
    writeLocalToolRecords(favorites, [{ videoId: "abc", savedAt: "2026-01-01T00:00:00.000Z" }]);
    markToolRecordsSynced(favorites.key);

    // A tick walks all ~50 collections and almost none of them have changed, so
    // the common case must not parse every store. Observed through the reads:
    // the pre-check costs one getItem, the full diff costs a second.
    let reads = 0;
    const raw = localStorage.getItem(favorites.storageKey);
    vi.stubGlobal("localStorage", {
      getItem: () => {
        reads += 1;
        return raw;
      },
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    });

    expect(await flushToolRecordCollection(favorites.key)).toMatchObject({ pushed: 0 });
    expect(reads).toBe(1);
    expect(calls).toEqual([]);
  });

  it("still diffs a collection it has never baselined", async () => {
    // Without the `snapshots.has` guard, a store whose raw value happened to
    // match an absent cache entry would be treated as synced and never pushed.
    writeLocalToolRecords(favorites, [{ videoId: "abc", savedAt: "2026-01-01T00:00:00.000Z" }]);

    expect(await flushToolRecordCollection(favorites.key)).toMatchObject({ pushed: 1 });
  });

  it("re-diffs after a failed push instead of being skipped by the pre-check", async () => {
    markToolRecordsSynced(favorites.key);
    writeLocalToolRecords(favorites, [{ videoId: "abc", savedAt: "2026-01-01T00:00:00.000Z" }]);

    failures = [500];
    await flushToolRecordCollection(favorites.key);

    // The store has not changed since that failure, so a raw-equality check
    // alone would skip it forever and the record would be lost.
    calls = [];
    expect(await flushToolRecordCollection(favorites.key)).toMatchObject({ pushed: 1 });
    expect(calls).toHaveLength(1);
  });
});
