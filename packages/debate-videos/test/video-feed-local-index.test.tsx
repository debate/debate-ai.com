// @vitest-environment jsdom
/**
 * @fileoverview Pins the payoff of caching the library in the browser: the
 * grid pages, filters and searches without asking the network anything.
 *
 * This is the property the whole cache exists for, and the one most easily
 * lost — a refactor that reorders the feed's effects, or drops the hydrate
 * before the first fetch, leaves everything *working* while quietly going
 * back to a request per interaction. So the assertions here are about the
 * requests that are **not** made, as much as the rows that come back.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { buildVideoRows } from "debate-data-sync/src/videos/video-rows";
import {
  VIDEO_INDEX_FORMAT_VERSION,
  videoRowToIndexTuple,
} from "debate-data-sync/src/videos/video-index";

/** Paths `grab` has been handed, newest last. */
let requests: string[] = [];

vi.mock("grab-url", () => ({
  default: async (path: string) => {
    requests.push(path);
    return { videos: [], total: 0, hasMore: false, backend: "sql" };
  },
}));

import type { VideoFeed } from "../src/hooks/useVideoFeed";

const { useVideoFeed } = await import("../src/hooks/useVideoFeed");
const { VIDEO_INDEX_STORAGE_KEY, resetVideoIndexForTests } = await import(
  "../src/state/videoIndexCache"
);

const LIBRARY = buildVideoRows({
  rounds: [
    {
      data: [
        ["r1", "TOC Finals", "2026-04-14", "LASA", 500, "policy round", 1, "2026 TOC", "Finals"],
        ["r2", "TOC Semis", "2026-04-13", "LASA", 300, "policy round", 1, "2026 TOC", "Semis"],
      ],
    },
  ],
  lectures: { data: [["l1", "Kritik basics", "2025-09-02", "Camp", 90, "lecture", "Theory"]] },
} as any);

/** Leaves a synced library in `localStorage`, as a previous visit would. */
function storeLibrary(): void {
  localStorage.setItem(
    VIDEO_INDEX_STORAGE_KEY,
    JSON.stringify({
      version: VIDEO_INDEX_FORMAT_VERSION,
      syncedAt: Date.now(),
      rows: LIBRARY.map(videoRowToIndexTuple),
    }),
  );
}

let container: HTMLDivElement;
let root: Root;
let feed: VideoFeed;

/** Mounts `useVideoFeed` with the given filters and exposes it as `feed`. */
async function mountFeed(filters: Parameters<typeof useVideoFeed>[0]) {
  function Probe() {
    feed = useVideoFeed(filters);
    return null;
  }
  await act(async () => {
    root.render(createElement(Probe));
  });
}

beforeEach(() => {
  requests = [];
  localStorage.clear();
  resetVideoIndexForTests();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  resetVideoIndexForTests();
});

describe("a feed with the library cached", () => {
  it("renders the first page without a request", async () => {
    storeLibrary();

    await mountFeed({ source: "all" });

    expect(requests).toEqual([]);
    expect(feed.videos.map((video) => video[0]).sort()).toEqual(["l1", "r1", "r2"]);
    expect(feed.total).toBe(3);
    expect(feed.isLoading).toBe(false);
  });

  it("applies a source filter locally", async () => {
    storeLibrary();

    await mountFeed({ source: "round" });

    expect(requests).toEqual([]);
    expect(feed.videos.map((video) => video[0]).sort()).toEqual(["r1", "r2"]);
  });

  it("searches locally", async () => {
    storeLibrary();

    await mountFeed({ source: "all", q: "kritik" });

    expect(requests).toEqual([]);
    expect(feed.videos.map((video) => video[0])).toEqual(["l1"]);
  });

  it("answers the season and style dropdowns locally", async () => {
    storeLibrary();

    await mountFeed({ source: "round", withFacets: true });

    expect(requests).toEqual([]);
    expect(feed.facets?.styleCounts?.[1]).toBe(2);
  });
});

describe("a feed with nothing cached", () => {
  it("falls back to the paginated API", async () => {
    await mountFeed({ source: "all" });

    expect(requests).toContain("videos");
  });

  it("ignores a cache written in a format it cannot read", async () => {
    localStorage.setItem(
      VIDEO_INDEX_STORAGE_KEY,
      JSON.stringify({ version: 0, syncedAt: Date.now(), rows: [["r1"]] }),
    );

    await mountFeed({ source: "all" });

    expect(requests).toContain("videos");
  });
});
