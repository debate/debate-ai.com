/**
 * @fileoverview Pins the bulk read that a sign-in reconciles from, and the one
 * distinction it must never blur.
 *
 * `listAllToolRecords` resolves to `null` on *any* failure and to a map on
 * success, and `hydrateToolRecords` treats those two differently on purpose:
 *
 * - A **successful** response missing a collection means that collection has
 *   no records — adopt nothing, push this browser's copy up.
 * - A **failed** request means we do not know what the account holds. Reading
 *   that as "no records" would have the merge adopt nothing and then push the
 *   entire local store back up as if it were new, on every sign-in, for every
 *   collection at once.
 *
 * Collapsing the two — returning `{}` on a network error, say — is a one-line
 * change that no test of the happy path would catch.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { listAllToolRecords } from "../src/state/tool-records-client";
import {
  beginToolRecordPrefetch,
  endToolRecordPrefetch,
  hydrateToolRecords,
  readLocalToolRecords,
  setToolRecordSyncEnabled,
  writeLocalToolRecords,
} from "../src/state/tool-record-mirror";
import {
  findToolRecordCollection,
  type ToolRecordCollection,
} from "../src/state/toolRecordCollections";

const favorites = findToolRecordCollection("debateVideosFavorites") as ToolRecordCollection;

let requests: string[] = [];

/** Installs a `fetch` that answers the bulk route and refuses the rest. */
function stubFetch(handler: (url: string) => Response | Promise<Response>): void {
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    requests.push(`${init?.method ?? "GET"} ${url}`);
    return handler(url);
  });
}

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
  requests = [];
  installLocalStorage();
  vi.stubGlobal("window", undefined);
  vi.stubGlobal("StorageEvent", undefined);
  endToolRecordPrefetch();
});

afterEach(() => {
  endToolRecordPrefetch();
  setToolRecordSyncEnabled(false);
  vi.unstubAllGlobals();
});

describe("listAllToolRecords", () => {
  it("returns each collection's records, keeping only array values", () => {
    stubFetch(
      () =>
        new Response(
          JSON.stringify({
            debateVideosFavorites: [{ videoId: "abc" }],
            prepNotes: [],
            somethingOdd: "not an array",
          }),
          { status: 200 },
        ),
    );

    return expect(listAllToolRecords()).resolves.toEqual({
      debateVideosFavorites: [{ videoId: "abc" }],
      prepNotes: [],
    });
  });

  it("asks the bulk route once, not once per collection", async () => {
    stubFetch(() => new Response("{}", { status: 200 }));

    await listAllToolRecords();

    expect(requests).toEqual(["GET /api/tool-records"]);
  });

  it("returns null when signed out", async () => {
    stubFetch(() => new Response(JSON.stringify({ error: "Sign in." }), { status: 401 }));

    expect(await listAllToolRecords()).toBeNull();
  });

  it("returns null on a server error, rather than an empty account", async () => {
    stubFetch(() => new Response("{}", { status: 500 }));

    expect(await listAllToolRecords()).toBeNull();
  });

  it("returns null when the request never lands", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });

    // Offline must not throw into the reconcile loop, and must not look empty.
    expect(await listAllToolRecords()).toBeNull();
  });

  it("returns null on a body that is not an object of arrays", async () => {
    stubFetch(() => new Response(JSON.stringify([1, 2, 3]), { status: 200 }));

    expect(await listAllToolRecords()).toBeNull();
  });

  it("returns null on a body that is not JSON", async () => {
    stubFetch(() => new Response("<html>gateway error</html>", { status: 200 }));

    expect(await listAllToolRecords()).toBeNull();
  });
});

describe("hydrating from the prefetch", () => {
  it("merges a collection out of the bulk payload without fetching it", async () => {
    setToolRecordSyncEnabled(true);
    stubFetch((url) => {
      if (url === "/api/tool-records") {
        return new Response(
          JSON.stringify({ debateVideosFavorites: [{ videoId: "remote", savedAt: "r" }] }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 200 });
    });

    beginToolRecordPrefetch();
    const result = await hydrateToolRecords(favorites.key);

    expect(result).toMatchObject({ synced: true, adopted: 1 });
    expect(readLocalToolRecords(favorites)).toEqual([{ videoId: "remote", savedAt: "r" }]);
    // The per-collection GET must not have happened.
    expect(requests).toEqual(["GET /api/tool-records"]);
  });

  it("treats a collection absent from a successful payload as empty", async () => {
    setToolRecordSyncEnabled(true);
    writeLocalToolRecords(favorites, [{ videoId: "local", savedAt: "l" }]);
    stubFetch(() => new Response(JSON.stringify({ prepNotes: [] }), { status: 200 }));

    beginToolRecordPrefetch();
    const result = await hydrateToolRecords(favorites.key);

    // Nothing to adopt, and the local-only record is pushed up — still without
    // a per-collection GET.
    expect(result).toMatchObject({ synced: true, adopted: 0, pushed: 1 });
    expect(requests).toEqual(["GET /api/tool-records", "PUT /api/tool-records/debateVideosFavorites"]);
  });

  it("falls back to the per-collection fetch when the prefetch failed", async () => {
    setToolRecordSyncEnabled(true);
    stubFetch((url) => {
      if (url === "/api/tool-records") return new Response("{}", { status: 500 });
      return new Response(JSON.stringify([{ videoId: "remote", savedAt: "r" }]), { status: 200 });
    });

    beginToolRecordPrefetch();
    const result = await hydrateToolRecords(favorites.key);

    // The failed prefetch must not have been read as an empty account.
    expect(result).toMatchObject({ synced: true, adopted: 1 });
    expect(requests).toEqual([
      "GET /api/tool-records",
      "GET /api/tool-records/debateVideosFavorites",
    ]);
  });

  it("shares one bulk request across repeated begin calls", async () => {
    setToolRecordSyncEnabled(true);
    stubFetch(() => new Response(JSON.stringify({}), { status: 200 }));

    // The shell document and each dock frame both mount the provider.
    beginToolRecordPrefetch();
    beginToolRecordPrefetch();
    await hydrateToolRecords(favorites.key);

    expect(requests.filter((request) => request === "GET /api/tool-records")).toHaveLength(1);
  });

  it("fetches per collection again once the prefetch is discarded", async () => {
    setToolRecordSyncEnabled(true);
    stubFetch(() => new Response(JSON.stringify([]), { status: 200 }));

    // A later `resync()` must not be served the payload as it was at sign-in.
    endToolRecordPrefetch();
    await hydrateToolRecords(favorites.key);

    expect(requests).toEqual(["GET /api/tool-records/debateVideosFavorites"]);
  });
});
