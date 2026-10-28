// @vitest-environment jsdom
/**
 * @fileoverview Covers the branches of `useVideoFeed`, `useVideoMeta` and
 * `useVideoStacks` the capacity and local-index tests don't: a page served
 * out of the in-memory library, request failures on the first and on later
 * pages, a disabled feed, metadata failures, and stack resolution from the
 * cache, from the API, and when the API fails.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildVideoRows } from "../src/data/video-rows";
import {
  VIDEO_INDEX_FORMAT_VERSION,
  videoRowToIndexTuple,
} from "../src/data/video-index";
import { flush, mount, renderHook } from "./helpers/mount";

type Handler = (path: string, params: Record<string, string>) => unknown;
let handler: Handler;
const calls: Array<{ path: string; params: Record<string, string> }> = [];

vi.mock("grab-url", () => ({
  default: async (path: string, params: Record<string, string> = {}) => {
    calls.push({ path, params });
    return handler(path, params);
  },
}));

const { useVideoFeed, useVideoMeta, buildVideoParams, toVideoQueryParams } = await import(
  "../src/hooks/useVideoFeed"
);
const { useVideoStacks } = await import("../src/hooks/useVideoStacks");
const cache = await import("../src/state/videoIndexCache");

/** A video tuple with an optional stack key in slot 18. */
function video(id: string, stackKey: string | null = null): any {
  const tuple: unknown[] = [id, `Title ${id}`];
  tuple[18] = stackKey;
  return tuple;
}

/** Loads a small library into the in-memory cache. */
async function seedCache() {
  const rows = buildVideoRows({
    rounds: [
      {
        data: [
          ["r1", "TOC Finals", "2026-04-14", "LASA", 500, "policy round", 1, "2026 TOC", "Finals"],
          ["r2", "TOC Finals analysis", "2026-04-15", "LASA", 300, "policy round", 1, "2026 TOC", "Finals"],
        ],
      },
    ],
    lectures: { data: [["l1", "Critique basics", "2025-09-02", "Camp", 90, "lecture", "Theory"]] },
  } as any);
  rows[0].stackKey = "s1";
  rows[0].stackPosition = 0;
  rows[1].stackKey = "s1";
  rows[1].stackPosition = 1;
  const previous = handler;
  handler = () => ({
    version: VIDEO_INDEX_FORMAT_VERSION,
    rows: rows.map(videoRowToIndexTuple),
    partial: false,
    total: rows.length,
    syncedAt: Date.now(),
    backend: "sql",
  });
  await flush(async () => {
    await cache.refreshVideoIndex();
  });
  handler = previous;
  calls.length = 0;
}

beforeEach(() => {
  calls.length = 0;
  handler = () => ({ videos: [], total: 0, hasMore: false });
  localStorage.clear();
  cache.resetVideoIndexForTests();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  document.body.innerHTML = "";
  cache.resetVideoIndexForTests();
  vi.restoreAllMocks();
});

describe("buildVideoParams / toVideoQueryParams", () => {
  it("passes a concrete category but not 'all'", () => {
    expect(buildVideoParams({ categoryKey: "theory" }, 0, 10).category).toBe("theory");
    expect(buildVideoParams({ categoryKey: "all" }, 0, 10).category).toBeUndefined();
    expect(toVideoQueryParams({ categoryKey: "theory", style: 2 as any }, 5, 10)).toMatchObject({
      categoryKey: "theory",
      style: 2,
      offset: 5,
      limit: 10,
    });
  });
});

describe("useVideoFeed", () => {
  it("serves pages from the in-memory library without a request", async () => {
    await seedCache();
    const hook = await renderHook(() => useVideoFeed({ source: "round" }));
    await flush();

    expect(calls.filter((c) => c.path === "videos")).toEqual([]);
    expect(hook.result.current.videos.map((v) => v[0]).sort()).toEqual(["r1", "r2"]);
    expect(hook.result.current.total).toBe(2);
    expect(hook.result.current.isLoading).toBe(false);
    expect(hook.result.current.hasMore).toBe(false);
  });

  it("does not fetch while disabled", async () => {
    const hook = await renderHook(() => useVideoFeed({ enabled: false }));
    await flush();
    expect(calls.filter((c) => c.path === "videos")).toEqual([]);
    expect(hook.result.current.isLoading).toBe(false);
    hook.result.current.loadMore();
    expect(calls.filter((c) => c.path === "videos")).toEqual([]);
  });

  it("clears the feed and reports an error when the first page fails", async () => {
    handler = () => ({ error: "500" });
    const hook = await renderHook(() => useVideoFeed({}));
    await flush();
    expect(hook.result.current).toMatchObject({
      videos: [],
      total: 0,
      hasMore: false,
      isLoading: false,
      errorMessage: "Failed to load videos",
    });
    expect(console.error).toHaveBeenCalledWith("Failed to load videos", expect.any(Error));
  });

  it("treats a response without a videos array as malformed", async () => {
    handler = () => ({ videos: "nope" });
    const hook = await renderHook(() => useVideoFeed({}));
    await flush();
    expect(hook.result.current.errorMessage).toBe("Failed to load videos");
    const [, err] = (console.error as any).mock.calls[0];
    expect((err as Error).message).toBe("Malformed videos response");
  });

  it("keeps loaded rows when a later page fails, and reload starts over", async () => {
    handler = (_path, params) =>
      params.offset === "0"
        ? { videos: [video("a"), video("b")], total: 4, hasMore: true }
        : { error: "timeout" };
    const hook = await renderHook(() => useVideoFeed({ pageSize: 2 }));
    await flush();
    expect(hook.result.current.videos).toHaveLength(2);

    await flush(() => hook.result.current.loadMore());
    expect(calls.at(-1)?.params.offset).toBe("2");
    expect(hook.result.current.videos.map((v) => v[0])).toEqual(["a", "b"]);
    expect(hook.result.current.errorMessage).toBe("Failed to load videos");
    expect(hook.result.current.isLoadingMore).toBe(false);

    handler = () => ({ videos: [video("z")], total: 1, hasMore: false });
    await flush(() => hook.result.current.reload());
    expect(hook.result.current.videos.map((v) => v[0])).toEqual(["z"]);
    expect(hook.result.current.errorMessage).toBe("");
  });

  it("ignores a superseded failure after the filters change", async () => {
    let rejectFirst!: (e: unknown) => void;
    handler = (_path, params) =>
      params.q === "old"
        ? new Promise((_res, rej) => (rejectFirst = rej))
        : { videos: [video("new")], total: 1, hasMore: false };
    const seen: any[] = [];
    function Probe({ q }: { q: string }) {
      seen.push(useVideoFeed({ q }));
      return null;
    }
    const view = await mount(<Probe q="old" />);
    await view.rerender(<Probe q="fresh" />);
    await flush(() => rejectFirst(new Error("cancelled")));
    expect(seen.at(-1).videos.map((v: any) => v[0])).toEqual(["new"]);
    expect(seen.at(-1).errorMessage).toBe("");
  });
});

describe("useVideoMeta", () => {
  it("answers counts and categories from the cache, keeping topics from the API", async () => {
    await seedCache();
    handler = () => ({
      counts: { total: 999 },
      topics: { t: 1 },
      champions: { c: 1 },
      history: { h: 1 },
      lectureCategories: [],
    });
    const hook = await renderHook(() => useVideoMeta({ categoryKey: "all", lecturesOnly: true }));
    await flush();

    const state = hook.result.current;
    expect(state.counts.total).toBe(3);
    expect(state.counts.rounds).toBe(2);
    expect((state.meta as any).topics).toEqual({ t: 1 });
    expect((state.meta as any).backend).toBe("index");
    expect(state.isLoading).toBe(false);
  });

  it("serialises the suggestion filters into the meta request", async () => {
    handler = () => ({ counts: { total: 1 }, lectureCategories: [{ key: "k" }], suggestions: { keywords: ["x"], tournaments: [] } });
    const hook = await renderHook(() =>
      useVideoMeta({ lecturesOnly: true, topPicksOnly: true, categoryKey: "theory", style: 1 as any, year: "2026" }),
    );
    await flush();
    expect(calls[0].path).toBe("videos/meta?lecturesOnly=1&topPicks=1&category=theory&style=1&year=2026");
    expect(hook.result.current.lectureCategories).toEqual([{ key: "k" }]);
    expect(hook.result.current.suggestions.keywords).toEqual(["x"]);
  });

  it("logs an error response and a thrown failure, then stops loading", async () => {
    handler = () => ({ error: "nope" });
    const a = await renderHook(() => useVideoMeta());
    await flush();
    expect(console.error).toHaveBeenCalledWith("Failed to load video metadata", "nope");
    expect(a.result.current.meta).toBeNull();
    expect(a.result.current.isLoading).toBe(false);

    handler = () => {
      throw new Error("offline");
    };
    const b = await renderHook(() => useVideoMeta({ year: "2025" }));
    await flush();
    expect(console.error).toHaveBeenCalledWith("Failed to load video metadata", expect.any(Error));
    expect(b.result.current.isLoading).toBe(false);
  });
});

describe("useVideoStacks", () => {
  it("returns nothing and requests nothing when disabled or unstacked", async () => {
    const off = await renderHook(() => useVideoStacks([video("a", "s1")], false));
    const plain = await renderHook(() => useVideoStacks([video("a")]));
    await flush();
    expect(off.result.current).toEqual({});
    expect(plain.result.current).toEqual({});
    expect(calls).toEqual([]);
  });

  it("resolves stacks from the cached library without a request", async () => {
    await seedCache();
    const hook = await renderHook(() => useVideoStacks([video("r1", "s1")]));
    await flush();
    expect(calls).toEqual([]);
    expect(hook.result.current.s1.map((v) => v[0])).toEqual(["r1", "r2"]);
  });

  it("fetches each new key once from the API", async () => {
    handler = (_path, params) => ({
      stacks: Object.fromEntries(params.keys.split(",").map((k) => [k, [video(`${k}-a`), video(`${k}-b`)]])),
    });
    const list = [video("a", "s1"), video("b", "s2"), video("c", "s1")];
    function Probe({ videos }: { videos: any[] }) {
      seen.push(useVideoStacks(videos));
      return null;
    }
    const seen: any[] = [];
    const view = await mount(<Probe videos={list} />);
    await flush();
    expect(calls).toEqual([{ path: "videos/stacks", params: { keys: "s1,s2", baseURL: "/api/" } }]);
    expect(Object.keys(seen.at(-1))).toEqual(["s1", "s2"]);

    await view.rerender(<Probe videos={[...list, video("d", "s3")]} />);
    await flush();
    expect(calls.at(-1)).toEqual({ path: "videos/stacks", params: { keys: "s3", baseURL: "/api/" } });
    expect(Object.keys(seen.at(-1)).sort()).toEqual(["s1", "s2", "s3"]);
  });

  it("logs a failed request and renders unstacked; ignores empty responses", async () => {
    handler = () => {
      throw new Error("down");
    };
    const failed = await renderHook(() => useVideoStacks([video("a", "x1")]));
    await flush();
    expect(console.error).toHaveBeenCalledWith("Failed to load video stacks", expect.any(Error));
    expect(failed.result.current).toEqual({});

    handler = () => ({});
    const empty = await renderHook(() => useVideoStacks([video("a", "x2")]));
    await flush();
    expect(empty.result.current).toEqual({});
  });

  it("drops a response that lands after unmount", async () => {
    let resolve!: (v: unknown) => void;
    handler = () => new Promise((res) => (resolve = res));
    const hook = await renderHook(() => useVideoStacks([video("a", "late")]));
    await hook.unmount();
    await flush(() => resolve({ stacks: { late: [video("a"), video("b")] } }));
    expect(hook.result.current).toEqual({});
  });
});
