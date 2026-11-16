/**
 * @fileoverview Deletes on another device stick for collections with
 * `propagateRemoteDeletes` (pinned debates): the account merge remembers
 * which ids the account held last time, per account, and drops a local
 * record that has since gone from the account instead of pushing it back.
 * Records never seen in the account are still pushed, and every other
 * collection keeps the plain union.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetToolRecordWriteBackoff } from "../../src/account-sync/tool-records-client";
import {
  hydrateToolRecords,
  readLocalToolRecords,
  setToolRecordSyncEnabled,
  writeLocalToolRecords,
} from "../../src/account-sync/tool-record-mirror";
import {
  MAX_BASELINE_IDS,
  SYNCED_ID_BASELINE_KEY,
  readSyncedIdBaseline,
  toolRecordsDeletedRemotely,
  writeSyncedIdBaseline,
} from "../../src/account-sync/synced-id-baseline";
import {
  TOOL_RECORD_COLLECTIONS,
  findToolRecordCollection,
  type ToolRecordCollection,
} from "../../src/account-sync/toolRecordCollections";

const pins = findToolRecordCollection("pinnedDebates") as ToolRecordCollection;
const flowAnnotations = findToolRecordCollection("flowAnnotations") as ToolRecordCollection;

let store: Map<string, string>;

function installLocalStorage(): void {
  store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  });
}

/** Queues `fetch` responses in order, and records what was requested. */
function stubFetch(responses: { status?: number; body?: unknown }[]) {
  const calls: { method: string; body: unknown }[] = [];
  let index = 0;
  vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
    const next = responses[index++] ?? { status: 200, body: [] };
    calls.push({
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    });
    return {
      ok: (next.status ?? 200) < 400,
      status: next.status ?? 200,
      json: async () => next.body ?? {},
    } as Response;
  });
  return calls;
}

const pin = (roundId: string) => ({ roundId, pinnedAt: 1 });

beforeEach(() => {
  resetToolRecordWriteBackoff();
  installLocalStorage();
  setToolRecordSyncEnabled(true);
});

afterEach(() => {
  setToolRecordSyncEnabled(false);
  vi.unstubAllGlobals();
});

describe("the stored baseline", () => {
  it("round-trips per account and collection", () => {
    writeSyncedIdBaseline("user-1", "pinnedDebates", ["1", "2", "2"]);
    writeSyncedIdBaseline("user-1", "other", ["x"]);
    expect(readSyncedIdBaseline("user-1", "pinnedDebates")).toEqual(new Set(["1", "2"]));
    expect(readSyncedIdBaseline("user-1", "other")).toEqual(new Set(["x"]));
    expect(readSyncedIdBaseline("user-1", "never-merged")).toBeNull();
  });

  it("never hands one account's baseline to another, and replaces it on write", () => {
    writeSyncedIdBaseline("user-1", "pinnedDebates", ["1"]);
    expect(readSyncedIdBaseline("user-2", "pinnedDebates")).toBeNull();

    writeSyncedIdBaseline("user-2", "other", ["x"]);
    expect(readSyncedIdBaseline("user-2", "pinnedDebates")).toBeNull();
    expect(readSyncedIdBaseline("user-1", "pinnedDebates")).toBeNull();
  });

  it("reads unreadable or malformed storage as no baseline", () => {
    store.set(SYNCED_ID_BASELINE_KEY, "{not json");
    expect(readSyncedIdBaseline("user-1", "pinnedDebates")).toBeNull();
    store.set(SYNCED_ID_BASELINE_KEY, JSON.stringify({ accountId: "user-1", collections: [] }));
    expect(readSyncedIdBaseline("user-1", "pinnedDebates")).toBeNull();
    store.set(SYNCED_ID_BASELINE_KEY, JSON.stringify({ accountId: "user-1", collections: { pinnedDebates: [1, "2"] } }));
    expect(readSyncedIdBaseline("user-1", "pinnedDebates")).toEqual(new Set(["2"]));
    expect(readSyncedIdBaseline("", "pinnedDebates")).toBeNull();
    expect(readSyncedIdBaseline("user-1", "pinnedDebates", null)).toBeNull();
  });

  it("drops a collection's baseline instead of storing more than the cap", () => {
    writeSyncedIdBaseline("user-1", "pinnedDebates", ["1"]);
    const many = Array.from({ length: MAX_BASELINE_IDS + 1 }, (_, i) => String(i));
    writeSyncedIdBaseline("user-1", "pinnedDebates", many);
    expect(readSyncedIdBaseline("user-1", "pinnedDebates")).toBeNull();
  });

  it("survives a storage that refuses writes", () => {
    const refusing = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
    expect(() => writeSyncedIdBaseline("user-1", "pinnedDebates", ["1"], refusing)).not.toThrow();
  });
});

describe("toolRecordsDeletedRemotely", () => {
  it("is what was in the account, is gone from it, and is still here", () => {
    const deleted = toolRecordsDeletedRemotely(
      pins,
      [pin("1"), pin("2"), pin("3")],
      [pin("2")],
      new Set(["1", "2"]),
    );
    expect(deleted).toEqual(new Set(["1"]));
  });

  it("is empty without a baseline", () => {
    expect(toolRecordsDeletedRemotely(pins, [pin("1")], [], null).size).toBe(0);
    expect(toolRecordsDeletedRemotely(pins, [pin("1")], [], new Set()).size).toBe(0);
  });
});

describe("hydrateToolRecords with propagateRemoteDeletes", () => {
  it("is set for pinned debates only", () => {
    expect(TOOL_RECORD_COLLECTIONS.filter((c) => c.propagateRemoteDeletes).map((c) => c.key)).toEqual([
      "pinnedDebates",
    ]);
  });

  it("drops a pin another device removed instead of pushing it back", async () => {
    writeLocalToolRecords(pins, [pin("1"), pin("2")]);
    writeSyncedIdBaseline("user-1", "pinnedDebates", ["1", "2"]);
    const calls = stubFetch([{ status: 200, body: [pin("2")] }]);

    const result = await hydrateToolRecords("pinnedDebates", { accountId: "user-1" });

    expect(result).toMatchObject({ synced: true, adopted: 0, pushed: 0, removed: 1 });
    expect(readLocalToolRecords(pins)).toEqual([pin("2")]);
    expect(calls.map((call) => call.method)).toEqual(["GET"]);
    expect(readSyncedIdBaseline("user-1", "pinnedDebates")).toEqual(new Set(["2"]));
  });

  it("still pushes a pin the account has never held, and remembers it once pushed", async () => {
    writeLocalToolRecords(pins, [pin("1"), pin("9")]);
    writeSyncedIdBaseline("user-1", "pinnedDebates", ["1"]);
    const calls = stubFetch([{ status: 200, body: [pin("1")] }, { status: 200 }]);

    const result = await hydrateToolRecords("pinnedDebates", { accountId: "user-1" });

    expect(result).toMatchObject({ synced: true, pushed: 1 });
    expect(result.removed).toBeUndefined();
    expect(calls[1]!.body).toEqual({ records: [pin("9")] });
    expect(readSyncedIdBaseline("user-1", "pinnedDebates")).toEqual(new Set(["1", "9"]));
  });

  it("leaves a pin whose push failed out of the baseline, so it is pushed again rather than dropped", async () => {
    writeLocalToolRecords(pins, [pin("9")]);
    stubFetch([{ status: 200, body: [pin("1")] }, { status: 500, body: { error: "nope" } }]);

    const result = await hydrateToolRecords("pinnedDebates", { accountId: "user-1" });

    expect(result.error).toBe("nope");
    expect(readSyncedIdBaseline("user-1", "pinnedDebates")).toEqual(new Set(["1"]));

    // Next visit: the account still lacks 9, and 9 is pushed again, not dropped.
    const calls = stubFetch([{ status: 200, body: [pin("1")] }, { status: 200 }]);
    const retry = await hydrateToolRecords("pinnedDebates", { accountId: "user-1" });
    expect(retry).toMatchObject({ pushed: 1 });
    expect(calls[1]!.body).toEqual({ records: [pin("9")] });
    expect(readLocalToolRecords(pins).map((r) => (r as { roundId: string }).roundId).sort()).toEqual(["1", "9"]);
  });

  it("keeps the plain union on a first merge, without an account id, or under another account's baseline", async () => {
    writeLocalToolRecords(pins, [pin("1")]);
    stubFetch([{ status: 200, body: [] }, { status: 200 }]);
    expect(await hydrateToolRecords("pinnedDebates", { accountId: "user-1" })).toMatchObject({ pushed: 1 });

    writeSyncedIdBaseline("user-1", "pinnedDebates", ["1"]);
    stubFetch([{ status: 200, body: [] }, { status: 200 }]);
    expect(await hydrateToolRecords("pinnedDebates")).toMatchObject({ pushed: 1 });
    expect(readLocalToolRecords(pins)).toEqual([pin("1")]);

    writeSyncedIdBaseline("user-1", "pinnedDebates", ["1"]);
    stubFetch([{ status: 200, body: [] }, { status: 200 }]);
    expect(await hydrateToolRecords("pinnedDebates", { accountId: "user-2" })).toMatchObject({ pushed: 1 });
    expect(readLocalToolRecords(pins)).toEqual([pin("1")]);
  });

  it("does not touch a collection that hasn't opted in", async () => {
    writeLocalToolRecords(flowAnnotations, [{ id: "a" }]);
    writeSyncedIdBaseline("user-1", "flowAnnotations", ["a"]);
    const calls = stubFetch([{ status: 200, body: [] }, { status: 200 }]);

    const result = await hydrateToolRecords("flowAnnotations", { accountId: "user-1" });

    expect(result).toMatchObject({ pushed: 1 });
    expect(readLocalToolRecords(flowAnnotations)).toEqual([{ id: "a" }]);
    expect(calls[1]!.body).toEqual({ records: [{ id: "a" }] });
    // Its baseline is neither used nor rewritten.
    expect(readSyncedIdBaseline("user-1", "flowAnnotations")).toEqual(new Set(["a"]));
  });

  it("drops nothing when the account can't be read", async () => {
    writeLocalToolRecords(pins, [pin("1")]);
    writeSyncedIdBaseline("user-1", "pinnedDebates", ["1"]);
    stubFetch([{ status: 500, body: { error: "D1 is down" } }]);

    const result = await hydrateToolRecords("pinnedDebates", { accountId: "user-1" });

    expect(result.synced).toBe(false);
    expect(readLocalToolRecords(pins)).toEqual([pin("1")]);
    expect(readSyncedIdBaseline("user-1", "pinnedDebates")).toEqual(new Set(["1"]));
  });
});
