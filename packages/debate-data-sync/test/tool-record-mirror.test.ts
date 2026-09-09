/**
 * @fileoverview Pins the write half of the shared tool-record sync — the
 * fire-and-forget mirror that the sidebar tools' own `save*`/`delete*`
 * functions call, and the account merge that reconciles a collection on
 * sign-in.
 *
 * The properties that make it safe to call from a pure state module, and the
 * reason this file exists: it is **off** until the app enables it (so a
 * signed-out browser, a server render and every other test in this repo make
 * no requests at all), and it **never throws or blocks** (so a failed sync
 * can't break a local save). Both are easy to regress by "just awaiting" a
 * mirror call, and neither is visible from the calling store.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  hydrateToolRecords,
  isToolRecordSyncEnabled,
  mirrorToolRecordDelete,
  mirrorToolRecordSave,
  mirrorToolRecordsClear,
  mirrorToolRecordsSave,
  readLocalToolRecords,
  setToolRecordMirrorErrorHandler,
  setToolRecordSyncEnabled,
  writeLocalToolRecords,
} from "../src/state/tool-record-mirror";
import {
  findToolRecordCollection,
  type ToolRecordCollection,
} from "../src/state/toolRecordCollections";

const flowAnnotations = findToolRecordCollection("flowAnnotations") as ToolRecordCollection;

/** A minimal localStorage, since these tests run in the node environment. */
function installLocalStorage(): void {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  });
}

/** Queues `fetch` responses in order, and records what was requested. */
function stubFetch(responses: { status?: number; body?: unknown }[]) {
  const calls: { url: string; method: string; body: unknown }[] = [];
  let index = 0;
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const next = responses[index++] ?? { status: 200, body: [] };
    calls.push({
      url,
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

/** Lets the fire-and-forget mirror's promise settle before asserting. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  installLocalStorage();
  setToolRecordSyncEnabled(false);
  setToolRecordMirrorErrorHandler(null);
});

afterEach(() => {
  setToolRecordSyncEnabled(false);
  setToolRecordMirrorErrorHandler(null);
  vi.unstubAllGlobals();
});

describe("mirror gating", () => {
  it("is off until the app turns it on", () => {
    expect(isToolRecordSyncEnabled()).toBe(false);
  });

  it("makes no request at all while off", async () => {
    const calls = stubFetch([]);

    mirrorToolRecordSave("flowAnnotations", { id: "a" });
    mirrorToolRecordDelete("flowAnnotations", "a");
    mirrorToolRecordsSave("flowAnnotations", [{ id: "a" }]);
    mirrorToolRecordsClear("flowAnnotations");
    await settle();

    expect(calls).toEqual([]);
  });

  it("upserts by the record's own id once enabled", async () => {
    const calls = stubFetch([{ status: 200 }]);
    setToolRecordSyncEnabled(true);

    mirrorToolRecordSave("flowAnnotations", { id: "a-1", text: "hi" });
    await settle();

    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe("PUT");
    expect(calls[0]!.url).toBe("/api/tool-records/flowAnnotations/a-1");
    expect(calls[0]!.body).toEqual({ record: { id: "a-1", text: "hi" } });
  });

  it("skips a record with no id rather than filing it under undefined", async () => {
    const calls = stubFetch([]);
    setToolRecordSyncEnabled(true);

    mirrorToolRecordSave("flowAnnotations", { text: "no id" });
    await settle();

    expect(calls).toEqual([]);
  });

  it("skips a collection that isn't in the catalog, whichever call it is", async () => {
    const calls = stubFetch([]);
    setToolRecordSyncEnabled(true);

    mirrorToolRecordSave("not-a-tool", { id: "a" });
    mirrorToolRecordDelete("not-a-tool", "a");
    mirrorToolRecordsSave("not-a-tool", [{ id: "a" }]);
    mirrorToolRecordsClear("not-a-tool");
    await settle();

    expect(calls).toEqual([]);
  });

  it("drops the unsyncable rows of a bulk write rather than losing the batch", async () => {
    // The route refuses the whole batch on one bad record, so a CSV import
    // with one odd row would otherwise sync nothing at all.
    const calls = stubFetch([{ status: 200 }]);
    setToolRecordSyncEnabled(true);

    mirrorToolRecordsSave("flowAnnotations", [{ id: "a" }, { noId: true }, { id: "b" }]);
    await settle();

    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toEqual({ records: [{ id: "a" }, { id: "b" }] });
  });

  it("sends nothing when a bulk write has no syncable row at all", async () => {
    const calls = stubFetch([]);
    setToolRecordSyncEnabled(true);

    mirrorToolRecordsSave("flowAnnotations", [{ noId: true }]);
    await settle();

    expect(calls).toEqual([]);
  });

  it("sends a bulk write as one request, not one per record", async () => {
    const calls = stubFetch([{ status: 200 }]);
    setToolRecordSyncEnabled(true);

    mirrorToolRecordsSave("flowAnnotations", [{ id: "a" }, { id: "b" }, { id: "c" }]);
    await settle();

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("/api/tool-records/flowAnnotations");
    expect(calls[0]!.body).toEqual({ records: [{ id: "a" }, { id: "b" }, { id: "c" }] });
  });

  it("does not send an empty bulk write", async () => {
    const calls = stubFetch([]);
    setToolRecordSyncEnabled(true);

    mirrorToolRecordsSave("flowAnnotations", []);
    await settle();

    expect(calls).toEqual([]);
  });
});

describe("mirror failure handling", () => {
  it("swallows a failure instead of rejecting into the calling store", async () => {
    stubFetch([{ status: 500, body: { error: "boom" } }]);
    setToolRecordSyncEnabled(true);
    const errors: unknown[] = [];
    setToolRecordMirrorErrorHandler((_collection, error) => errors.push(error));

    // The store calls this synchronously and moves on; an unhandled rejection
    // here would surface as a test failure.
    expect(() => mirrorToolRecordSave("flowAnnotations", { id: "a" })).not.toThrow();
    await settle();

    expect(errors).toHaveLength(1);
  });

  it("stands down after a 401 rather than retrying every later write", async () => {
    // The route's 401 body is prose, with no "401" in it — which is exactly
    // why the stand-down reads the status off the thrown error rather than
    // pattern-matching the message.
    const calls = stubFetch([
      { status: 401, body: { error: "Sign in to sync this to your account." } },
      { status: 200 },
    ]);
    setToolRecordSyncEnabled(true);

    mirrorToolRecordSave("flowAnnotations", { id: "a" });
    await settle();
    expect(isToolRecordSyncEnabled()).toBe(false);

    mirrorToolRecordSave("flowAnnotations", { id: "b" });
    await settle();
    expect(calls).toHaveLength(1);
  });

  it("keeps syncing after a server error — that one is worth retrying", async () => {
    stubFetch([{ status: 500, body: { error: "D1 is down" } }, { status: 200 }]);
    setToolRecordSyncEnabled(true);

    mirrorToolRecordSave("flowAnnotations", { id: "a" });
    await settle();

    expect(isToolRecordSyncEnabled()).toBe(true);
  });

  it("reports the status alongside the message for a failed write", async () => {
    stubFetch([{ status: 413, body: { error: "This record is too large to sync." } }]);
    setToolRecordSyncEnabled(true);
    const seen: { message: string; status?: number }[] = [];
    setToolRecordMirrorErrorHandler((_collection, error) => {
      seen.push({
        message: error instanceof Error ? error.message : String(error),
        status: (error as { status?: number }).status,
      });
    });

    mirrorToolRecordSave("flowAnnotations", { id: "a" });
    await settle();

    expect(seen).toEqual([{ message: "This record is too large to sync.", status: 413 }]);
  });
});

describe("local store access", () => {
  it("round-trips a collection's records through its own storage key", () => {
    writeLocalToolRecords(flowAnnotations, [{ id: "a" }]);

    expect(localStorage.getItem("flowAnnotations")).toBe('[{"id":"a"}]');
    expect(readLocalToolRecords(flowAnnotations)).toEqual([{ id: "a" }]);
  });

  it("reads an absent or corrupt store as empty rather than throwing", () => {
    expect(readLocalToolRecords(flowAnnotations)).toEqual([]);

    localStorage.setItem("flowAnnotations", "not json");
    expect(readLocalToolRecords(flowAnnotations)).toEqual([]);

    localStorage.setItem("flowAnnotations", '{"not":"an array"}');
    expect(readLocalToolRecords(flowAnnotations)).toEqual([]);
  });
});

describe("hydrateToolRecords", () => {
  it("adopts the account's records and pushes local-only ones up", async () => {
    writeLocalToolRecords(flowAnnotations, [{ id: "local-only" }]);
    const calls = stubFetch([{ status: 200, body: [{ id: "from-account" }] }, { status: 200 }]);
    setToolRecordSyncEnabled(true);

    const result = await hydrateToolRecords("flowAnnotations");

    expect(result.synced).toBe(true);
    expect(result.adopted).toBe(1);
    expect(result.pushed).toBe(1);
    expect(readLocalToolRecords(flowAnnotations)).toEqual([
      { id: "local-only" },
      { id: "from-account" },
    ]);
    expect(calls[1]!.method).toBe("PUT");
    expect(calls[1]!.body).toEqual({ records: [{ id: "local-only" }] });
  });

  it("leaves the local store alone when signed out", async () => {
    writeLocalToolRecords(flowAnnotations, [{ id: "a" }]);
    stubFetch([{ status: 401, body: { error: "Sign in" } }]);

    const result = await hydrateToolRecords("flowAnnotations");

    expect(result.synced).toBe(false);
    expect(result.error).toBeUndefined();
    expect(readLocalToolRecords(flowAnnotations)).toEqual([{ id: "a" }]);
  });

  it("reports a failed load without throwing or clearing local records", async () => {
    writeLocalToolRecords(flowAnnotations, [{ id: "a" }]);
    stubFetch([{ status: 500, body: { error: "D1 is down" } }]);

    const result = await hydrateToolRecords("flowAnnotations");

    expect(result.synced).toBe(false);
    expect(result.error).toBe("D1 is down");
    expect(readLocalToolRecords(flowAnnotations)).toEqual([{ id: "a" }]);
  });

  it("keeps the merged records when the push back up fails", async () => {
    writeLocalToolRecords(flowAnnotations, [{ id: "local-only" }]);
    stubFetch([{ status: 200, body: [{ id: "from-account" }] }, { status: 500, body: { error: "nope" } }]);

    const result = await hydrateToolRecords("flowAnnotations");

    expect(result.pushed).toBe(0);
    expect(result.error).toBe("nope");
    expect(readLocalToolRecords(flowAnnotations)).toEqual([
      { id: "local-only" },
      { id: "from-account" },
    ]);
  });

  it("refuses a collection that isn't in the catalog", async () => {
    const calls = stubFetch([]);

    const result = await hydrateToolRecords("not-a-tool");

    expect(result.synced).toBe(false);
    expect(calls).toEqual([]);
  });
});
