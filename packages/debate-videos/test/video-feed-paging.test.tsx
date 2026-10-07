// @vitest-environment jsdom
/**
 * @fileoverview Pins how the video feed pages.
 *
 * The feed loads pages on its own for as long as the library has more; the
 * views stay responsive by keeping only the on-screen cards mounted (see
 * `WindowedChunk`). A feed whose server order shifted underneath it used to
 * append the same rows over and over without ever advancing.
 *
 * Guards, one test each:
 *   - paging continues to the end of the library, with no ceiling;
 *   - ids are appended once, however often the server returns them;
 *   - a page of nothing ends the feed rather than being asked for again.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import type { VideoType } from "../src/types/videos";

/** Requests `grab` has been handed, newest last. */
let requests: Record<string, string>[];
/** Answers the next `grab` call, keyed by request offset. */
let respond: (params: Record<string, string>) => {
  videos: VideoType[];
  total: number;
  hasMore: boolean;
};

vi.mock("grab-url", () => ({
  default: async (_path: string, params: Record<string, string>) => {
    requests.push(params);
    return respond(params);
  },
}));

import type { VideoFeed } from "../src/hooks/useVideoFeed";

const { useVideoFeed, VIDEO_PAGE_SIZE } = await import(
  "../src/hooks/useVideoFeed"
);

/** A video row with `id` in the one position the feed actually reads. */
function row(id: string): VideoType {
  return [id, `Video ${id}`] as unknown as VideoType;
}

/** `count` rows numbered from `start`. */
function rows(start: number, count: number): VideoType[] {
  return Array.from({ length: count }, (_, i) => row(String(start + i)));
}

let container: HTMLDivElement;
let root: Root;
let feed: VideoFeed;

/** Mounts `useVideoFeed` and exposes its latest return value as `feed`. */
async function mountFeed() {
  function Probe() {
    feed = useVideoFeed({ source: "all" });
    return null;
  }
  await act(async () => {
    root.render(createElement(Probe));
  });
}

beforeEach(() => {
  requests = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("useVideoFeed paging", () => {
  it("keeps paging to the end of the library with no ceiling", async () => {
    // Far more than the 600 the feed used to stop at.
    const total = VIDEO_PAGE_SIZE * 15;
    respond = (params) => {
      const offset = Number(params.offset);
      const count = Math.min(VIDEO_PAGE_SIZE, total - offset);
      return { videos: rows(offset, count), total, hasMore: offset + count < total };
    };

    await mountFeed();
    expect(feed.videos).toHaveLength(VIDEO_PAGE_SIZE);

    for (let i = 0; i < 20 && feed.hasMore; i++) {
      await act(async () => feed.loadMore());
    }

    expect(feed.videos).toHaveLength(total);
    expect(feed.hasMore).toBe(false);

    // Once exhausted, another call asks for nothing.
    const settled = requests.length;
    await act(async () => feed.loadMore());
    expect(requests).toHaveLength(settled);
  });

  it("appends a video once however often the server returns it", async () => {
    // The library is ordered by views or recency, both of which shift while
    // it is read a page at a time, so a later page can legitimately repeat
    // rows an earlier one already delivered.
    respond = (params) =>
      Number(params.offset) === 0
        ? { videos: rows(0, 5), total: 8, hasMore: true }
        : { videos: [...rows(3, 2), ...rows(5, 3)], total: 8, hasMore: false };

    await mountFeed();
    await act(async () => feed.loadMore());

    const ids = feed.videos.map((video) => video[0]);
    expect(ids).toEqual(["0", "1", "2", "3", "4", "5", "6", "7"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("continues from the server's offset, not the number of rows kept", async () => {
    // Dropping a duplicate must not rewind the window: asking for the same
    // offset again is how the feed used to loop in place.
    respond = (params) =>
      Number(params.offset) === 0
        ? { videos: rows(0, 5), total: 20, hasMore: true }
        : { videos: [...rows(4, 1), ...rows(5, 4)], total: 20, hasMore: true };

    await mountFeed();
    await act(async () => feed.loadMore());
    await act(async () => feed.loadMore());

    expect(requests.map((request) => request.offset)).toEqual(["0", "5", "10"]);
  });

  it("ends the feed on an empty page even when the server still says hasMore", async () => {
    // Otherwise the sentinel sat in view asking for the same offset forever —
    // a request loop that only stopped when the tab did.
    respond = (params) =>
      Number(params.offset) === 0
        ? { videos: rows(0, 5), total: 99, hasMore: true }
        : { videos: [], total: 99, hasMore: true };

    await mountFeed();
    await act(async () => feed.loadMore());

    expect(feed.hasMore).toBe(false);
    const settled = requests.length;
    await act(async () => feed.loadMore());
    expect(requests).toHaveLength(settled);
  });
});
