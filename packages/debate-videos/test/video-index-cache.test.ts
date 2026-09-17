/**
 * @fileoverview Pins the browser-side copy of the video library: what a page
 * load fetches, what it merges, and the three ways a client-side cache of
 * server data goes wrong.
 *
 * The interesting cases are all about *not trusting the cache*. A delta
 * cannot express a deleted video, so the server's row count is the check that
 * catches one. A cache written by an older format cannot be interpreted, so
 * it is thrown away rather than read. And a `localStorage` quota that refuses
 * the write must cost the cache and nothing else — the library still has to
 * render.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildVideoRows } from "debate-data-sync/src/videos/video-rows";
import {
  VIDEO_INDEX_FORMAT_VERSION,
  videoRowToIndexTuple,
  type VideoIndexResponse,
} from "debate-data-sync/src/videos/video-index";

/** Requests `grab` was asked to make, newest last. */
let requests: Array<{ path: string; params: Record<string, string> }> = [];
/** Queue of responses, one per request. */
let responses: unknown[] = [];

vi.mock("grab-url", () => ({
  default: async (path: string, params: Record<string, string> = {}) => {
    requests.push({ path, params });
    return responses.shift() ?? { rows: [], partial: false, total: 0, syncedAt: 0 };
  },
}));

const {
  VIDEO_INDEX_STORAGE_KEY,
  clearVideoIndex,
  getVideoIndexState,
  hydrateVideoIndex,
  isVideoIndexReady,
  queryVideoIndex,
  queryVideoIndexMeta,
  queryVideoIndexStacks,
  refreshVideoIndex,
  resetVideoIndexForTests,
} = await import("../src/state/videoIndexCache");

const LIBRARY = buildVideoRows({
  rounds: [
    {
      data: [
        ["r1", "TOC Finals", "2026-04-14", "LASA", 500, "policy round", 1, "2026 TOC", "Finals", "GBN CR", "MBA HL"],
        ["r2", "TOC Semis", "2026-04-13", "LASA", 300, "policy round", 1, "2026 TOC", "Semifinals", "Westwood AB", "Peninsula CD"],
      ],
    },
  ],
  lectures: { data: [["l1", "Kritik basics", "2025-09-02", "Camp", 90, "lecture", "Theory"]] },
} as any);

const index = (
  rows: typeof LIBRARY,
  overrides: Partial<VideoIndexResponse> = {},
): VideoIndexResponse => ({
  version: VIDEO_INDEX_FORMAT_VERSION,
  rows: rows.map(videoRowToIndexTuple),
  partial: false,
  total: rows.length,
  syncedAt: 1_700_000_000_000,
  backend: "sql",
  ...overrides,
});

/** A minimal localStorage; this package's tests run in the node environment. */
function installLocalStorage(onWrite?: (key: string, value: string) => void): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      onWrite?.(key, value);
      store.set(key, value);
    },
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  });
  return store;
}

beforeEach(() => {
  installLocalStorage();
  vi.stubGlobal("window", undefined);
  requests = [];
  responses = [];
  resetVideoIndexForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("first visit", () => {
  it("fetches the whole library and stores it", async () => {
    responses = [index(LIBRARY)];

    const state = await refreshVideoIndex();

    expect(requests).toEqual([{ path: "videos/index", params: {} }]);
    expect(state).toMatchObject({ ready: true, count: 3, syncedAt: 1_700_000_000_000 });
    expect(localStorage.getItem(VIDEO_INDEX_STORAGE_KEY)).toContain("\"version\":1");
  });

  it("leaves the cache unusable — not half-built — when the fetch fails", async () => {
    responses = [{ error: "boom" }];

    const state = await refreshVideoIndex();

    expect(state.ready).toBe(false);
    expect(state.error).toBeTruthy();
    expect(queryVideoIndex({})).toBeNull();
  });
});

describe("later visits", () => {
  /** Puts a stored library in place, as a previous visit would have left it. */
  async function withStoredLibrary(): Promise<void> {
    responses = [index(LIBRARY)];
    await refreshVideoIndex();
    resetVideoIndexForTests();
    requests = [];
  }

  it("reads the stored library without asking the network", async () => {
    await withStoredLibrary();

    expect(hydrateVideoIndex()).toBe(true);
    expect(isVideoIndexReady()).toBe(true);
    expect(requests).toEqual([]);
  });

  it("asks only for what changed since the stored cursor", async () => {
    await withStoredLibrary();
    responses = [index([], { partial: true, total: 3, syncedAt: 1_700_000_100_000 })];

    await refreshVideoIndex();

    expect(requests[0]).toEqual({
      path: "videos/index",
      params: { since: "1700000000000" },
    });
    expect(getVideoIndexState()).toMatchObject({ count: 3, syncedAt: 1_700_000_100_000 });
  });

  it("merges a new video into the stored library", async () => {
    await withStoredLibrary();
    const added = buildVideoRows({
      rounds: [{ data: [["r3", "NDT Finals", "2026-03-30", "NDT", 800, "policy round", 1]] }],
      lectures: { data: [] },
    } as any);
    responses = [index(added, { partial: true, total: 4, syncedAt: 1_700_000_100_000 })];

    await refreshVideoIndex();

    expect(getVideoIndexState().count).toBe(4);
    expect(queryVideoIndex({ ids: ["r3"] })?.videos).toHaveLength(1);
  });

  it("replaces an edited video rather than duplicating it", async () => {
    await withStoredLibrary();
    const edited = buildVideoRows({
      rounds: [{ data: [["r1", "TOC Finals (re-uploaded)", "2026-04-14", "LASA", 900, "policy round", 1]] }],
      lectures: { data: [] },
    } as any);
    responses = [index(edited, { partial: true, total: 3, syncedAt: 1_700_000_100_000 })];

    await refreshVideoIndex();

    expect(getVideoIndexState().count).toBe(3);
    expect(queryVideoIndex({ ids: ["r1"] })?.videos[0][1]).toBe("TOC Finals (re-uploaded)");
  });

  it("refetches in full when a video has been removed upstream", async () => {
    // The one change a delta cannot describe: the server's own row count is
    // what catches it, and the answer is one more request, not a stale grid.
    await withStoredLibrary();
    const remaining = LIBRARY.filter((row) => row.videoId !== "r2");
    responses = [
      index([], { partial: true, total: 2, syncedAt: 1_700_000_100_000 }),
      index(remaining, { total: 2, syncedAt: 1_700_000_100_000 }),
    ];

    await refreshVideoIndex();

    expect(requests.map((request) => request.params)).toEqual([
      { since: "1700000000000" },
      {},
    ]);
    expect(getVideoIndexState().count).toBe(2);
    expect(queryVideoIndex({ ids: ["r2"] })?.videos).toEqual([]);
  });

  it("throws away a cache written in an older format", async () => {
    localStorage.setItem(
      VIDEO_INDEX_STORAGE_KEY,
      JSON.stringify({ version: 0, syncedAt: 1, rows: [["r1"]] }),
    );

    expect(hydrateVideoIndex()).toBe(false);
    expect(localStorage.getItem(VIDEO_INDEX_STORAGE_KEY)).toBeNull();
  });

  it("survives a cache that is not JSON at all", () => {
    localStorage.setItem(VIDEO_INDEX_STORAGE_KEY, "{not json");

    expect(hydrateVideoIndex()).toBe(false);
    expect(isVideoIndexReady()).toBe(false);
  });
});

describe("when localStorage refuses the write", () => {
  it("still serves the library for this visit", async () => {
    installLocalStorage(() => {
      throw new Error("QuotaExceededError");
    });
    responses = [index(LIBRARY)];

    const state = await refreshVideoIndex();

    expect(state).toMatchObject({ ready: true, count: 3, persisted: false });
    expect(queryVideoIndex({})?.total).toBe(3);
  });
});

describe("serving the grid locally", () => {
  beforeEach(async () => {
    responses = [index(LIBRARY)];
    await refreshVideoIndex();
  });

  it("filters to one source, the way the rounds grid asks for it", () => {
    const page = queryVideoIndex({ source: "round" });

    expect(page?.total).toBe(2);
    expect(page?.videos.map((video) => video[0]).sort()).toEqual(["r1", "r2"]);
  });

  it("searches the same text the API searches", () => {
    expect(queryVideoIndex({ q: "kritik" })?.videos.map((video) => video[0])).toEqual(["l1"]);
  });

  it("pages, and reports whether more remain", () => {
    const first = queryVideoIndex({ limit: 2, offset: 0 });
    const second = queryVideoIndex({ limit: 2, offset: 2 });

    expect(first).toMatchObject({ total: 3, hasMore: true });
    expect(second).toMatchObject({ total: 3, hasMore: false });
  });

  it("computes the dropdown counts when asked", () => {
    const page = queryVideoIndex({ source: "round" }, true);

    expect(page?.facets?.styleCounts?.[1]).toBe(2);
  });

  it("counts the library for the quick-link cards", () => {
    expect(queryVideoIndexMeta()?.counts).toMatchObject({
      total: 3,
      rounds: 2,
      lectures: 1,
      lecturesOnly: 1,
    });
  });

  it("returns nothing for a stack key the library does not have", () => {
    expect(queryVideoIndexStacks(["nope"])).toEqual({});
  });

  it("answers nothing at all once the cache is cleared", () => {
    clearVideoIndex();

    expect(queryVideoIndex({})).toBeNull();
    expect(queryVideoIndexStacks(["r1"])).toBeNull();
  });
});
