// @vitest-environment jsdom
/**
 * @fileoverview Pins that the video grid never downloads the whole library.
 *
 * The grid used to fetch `/api/videos/index` (about 900 kB) into
 * `localStorage` and filter it in the browser. It now pages `/api/videos`
 * instead, so the assertions here are about the request that is **not**
 * made, and about the stored copy an earlier visit left behind being freed
 * rather than parsed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { buildVideoRows } from "@debate/data-sync/src/videos/video-rows";
import {
  VIDEO_INDEX_FORMAT_VERSION,
  videoRowToIndexTuple,
} from "@debate/data-sync/src/videos/video-index";

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
  lectures: { data: [["l1", "Critique basics", "2025-09-02", "Camp", 90, "lecture", "Theory"]] },
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

describe("a feed never loads the whole library", () => {
  it("pages the API instead of fetching the index", async () => {
    await mountFeed({ source: "all" });
    await act(async () => {
      window.dispatchEvent(new Event("load"));
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    });

    expect(requests).toContain("videos");
    expect(requests).not.toContain("videos/index");
  });

  it("frees a library an earlier visit stored instead of reading it", async () => {
    storeLibrary();

    await mountFeed({ source: "round", withFacets: true });

    expect(localStorage.getItem(VIDEO_INDEX_STORAGE_KEY)).toBeNull();
    expect(requests).toEqual(["videos"]);
    expect(requests).not.toContain("videos/index");
  });
});
