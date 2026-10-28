/**
 * @fileoverview Pins that sample data stays out of the account: a record
 * seeded through `sampleRecords.ts` is never pushed by the auto-sync watcher,
 * while the user's own records beside it still are.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSampleRecords,
  hasSampleRecords,
  isSampleToolRecord,
  seedSampleRecords,
} from "../../src/account-sync/sampleRecords";
import {
  flushToolRecordCollection,
  markToolRecordsSynced,
  resetToolRecordAutoSync,
} from "../../src/account-sync/tool-record-auto-sync";
import { setToolRecordSyncEnabled } from "../../src/account-sync/tool-record-mirror";
import { findToolRecordCollection, type ToolRecordCollection } from "../../src/account-sync/toolRecordCollections";

const tracked = findToolRecordCollection("trackedArguments") as ToolRecordCollection;
let bodies: unknown[] = [];

beforeEach(() => {
  bodies = [];
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  });
  vi.stubGlobal("window", undefined);
  vi.stubGlobal("StorageEvent", undefined);
  vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
    if (init?.body) bodies.push(JSON.parse(String(init.body)));
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

describe("sample records", () => {
  it("are never pushed to the account, while the user's own records are", async () => {
    markToolRecordsSynced(tracked.key);
    seedSampleRecords("trackedArguments", "id", [{ id: "sample-arg-1", argBlock: "DA", topic: "T" }]);
    localStorage.setItem(
      "trackedArguments",
      JSON.stringify([...JSON.parse(localStorage.getItem("trackedArguments") ?? "[]"), { id: "mine", argBlock: "K", topic: "T" }]),
    );

    const result = await flushToolRecordCollection(tracked.key);

    expect(result).toMatchObject({ pushed: 1, deleted: 0 });
    expect(bodies).toEqual([{ records: [{ id: "mine", argBlock: "K", topic: "T" }] }]);
  });

  it("skips an id the store already holds and clears only what it seeded", () => {
    localStorage.setItem("trackedArguments", JSON.stringify([{ id: "a", argBlock: "Mine" }]));
    const added = seedSampleRecords("trackedArguments", "id", [{ id: "a", argBlock: "Sample" }, { id: "b", argBlock: "Sample" }]);

    expect(added).toBe(1);
    expect(isSampleToolRecord(tracked, { id: "a" })).toBe(false);
    expect(isSampleToolRecord(tracked, { id: "b" })).toBe(true);
    expect(hasSampleRecords(["trackedArguments"])).toBe(true);

    expect(clearSampleRecords(["trackedArguments"])).toBe(1);
    expect(JSON.parse(localStorage.getItem("trackedArguments") ?? "[]")).toEqual([{ id: "a", argBlock: "Mine" }]);
    expect(hasSampleRecords(["trackedArguments"])).toBe(false);
  });
});
