/**
 * @fileoverview Covers the parts of `state/videoIndexCache.ts` the main cache
 * test leaves alone: scheduling the one idle-time refresh per page load, the
 * staleness check, stack resolution from cached rows, and subscriber
 * isolation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildVideoRows } from "../src/data/video-rows";
import {
  VIDEO_INDEX_FORMAT_VERSION,
  videoRowToIndexTuple,
} from "../src/data/video-index";

let responses: unknown[] = [];
const requests: string[] = [];

vi.mock("grab-url", () => ({
  default: async (path: string) => {
    requests.push(path);
    return responses.shift() ?? { error: "no response queued" };
  },
}));

const cache = await import("../src/state/videoIndexCache");

function library() {
  const rows = buildVideoRows({
    rounds: [
      {
        data: [
          ["r1", "TOC Finals", "2026-04-14", "LASA", 500, "policy round", 1, "2026 TOC", "Finals"],
          ["r2", "TOC Finals analysis", "2026-04-15", "LASA", 300, "policy round", 1, "2026 TOC", "Finals"],
          ["r3", "Lone", "2026-04-13", "LASA", 100, "policy round", 1, "2026 TOC", "Semis"],
        ],
      },
    ],
    lectures: { data: [] },
  } as any);
  // r2 is the stack's first slot, r1 its second; r3 is a key with one member.
  rows[0].stackKey = "s1";
  rows[0].stackPosition = 1;
  rows[1].stackKey = "s1";
  rows[1].stackPosition = 0;
  rows[2].stackKey = "solo";
  rows[2].stackPosition = 0;
  return rows;
}

function payload(syncedAt = 1_700_000_000_000) {
  const rows = library();
  return {
    version: VIDEO_INDEX_FORMAT_VERSION,
    rows: rows.map(videoRowToIndexTuple),
    partial: false,
    total: rows.length,
    syncedAt,
    backend: "sql",
  };
}

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal("window", undefined);
  responses = [];
  requests.length = 0;
  cache.resetVideoIndexForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("scheduleVideoIndexRefresh", () => {
  it("does nothing without a window (server render)", () => {
    cache.scheduleVideoIndexRefresh();
    expect(requests).toEqual([]);
  });

  it("refreshes at idle once the document has loaded, only once per page", async () => {
    const idle = vi.fn((cb: () => void, _options?: { timeout: number }) => {
      cb();
      return 1;
    });
    vi.stubGlobal("window", { requestIdleCallback: idle, setTimeout, addEventListener: vi.fn() });
    vi.stubGlobal("document", { readyState: "complete" });
    responses = [payload()];

    cache.scheduleVideoIndexRefresh();
    cache.scheduleVideoIndexRefresh();
    await vi.waitFor(() => expect(cache.isVideoIndexReady()).toBe(true));

    expect(idle).toHaveBeenCalledTimes(1);
    expect(idle.mock.calls[0][1]).toEqual({ timeout: 5_000 });
    expect(requests).toEqual(["videos/index"]);
  });

  it("falls back to a timer without requestIdleCallback, and waits for load", async () => {
    vi.useFakeTimers();
    const listeners: Record<string, () => void> = {};
    const fakeWindow = {
      setTimeout: (cb: () => void, ms: number) => setTimeout(cb, ms),
      addEventListener: vi.fn((type: string, cb: () => void, opts: unknown) => {
        listeners[type] = cb;
        expect(opts).toEqual({ once: true });
      }),
    };
    vi.stubGlobal("window", fakeWindow);
    vi.stubGlobal("document", { readyState: "loading" });
    responses = [payload()];

    cache.scheduleVideoIndexRefresh();
    expect(fakeWindow.addEventListener).toHaveBeenCalledWith("load", expect.any(Function), { once: true });
    expect(requests).toEqual([]);

    listeners.load();
    await vi.advanceTimersByTimeAsync(1_199);
    expect(requests).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(requests).toEqual(["videos/index"]);
  });
});

describe("isVideoIndexStale", () => {
  it("is stale before any sync and after a day", async () => {
    expect(cache.isVideoIndexStale()).toBe(true);
    responses = [payload(1_000)];
    await cache.refreshVideoIndex();
    expect(cache.isVideoIndexStale(1_000 + 60_000)).toBe(false);
    expect(cache.isVideoIndexStale(1_000 + cache.VIDEO_INDEX_MAX_AGE_MS + 1)).toBe(true);
  });
});

describe("queryVideoIndexStacks / getVideoIndexRows", () => {
  it("returns null before the cache loads", () => {
    expect(cache.queryVideoIndexStacks(["s1"])).toBeNull();
    expect(cache.getVideoIndexRows()).toBeNull();
  });

  it("orders members by position and drops one-member stacks", async () => {
    responses = [payload()];
    await cache.refreshVideoIndex();

    const stacks = cache.queryVideoIndexStacks(["s1", "solo", "missing"])!;
    expect(Object.keys(stacks)).toEqual(["s1"]);
    expect(stacks.s1.map((v) => v[0])).toEqual(["r2", "r1"]);
    expect(cache.queryVideoIndexStacks(["", ""])).toEqual({});
    expect(cache.getVideoIndexRows()?.map((r) => r.videoId).sort()).toEqual(["r1", "r2", "r3"]);
  });
});

describe("subscribeToVideoIndex", () => {
  it("keeps notifying the others when one listener throws, and unsubscribes", async () => {
    const broken = vi.fn(() => {
      throw new Error("bad listener");
    });
    const good = vi.fn();
    const offBroken = cache.subscribeToVideoIndex(broken);
    const offGood = cache.subscribeToVideoIndex(good);

    responses = [payload()];
    await cache.refreshVideoIndex();
    expect(broken).toHaveBeenCalled();
    expect(good).toHaveBeenCalled();

    offBroken();
    offGood();
    good.mockClear();
    cache.clearVideoIndex();
    expect(good).not.toHaveBeenCalled();
    expect(cache.getVideoIndexState().ready).toBe(false);
  });

  it("shares one in-flight refresh between callers", async () => {
    responses = [payload()];
    const [a, b] = await Promise.all([cache.refreshVideoIndex(), cache.refreshVideoIndex()]);
    expect(a).toBe(b);
    expect(requests).toEqual(["videos/index"]);
  });

  it("reports a malformed payload as the sync error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    responses = [{ rows: "nope" }];
    const state = await cache.refreshVideoIndex();
    expect(state.error).toBe("Malformed video index");
  });
});
