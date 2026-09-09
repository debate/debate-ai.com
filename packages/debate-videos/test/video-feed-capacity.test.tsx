// @vitest-environment jsdom
/**
 * @fileoverview Pins the limits that stop the video feed from growing until
 * the page stops responding.
 *
 * The grid is not virtualised: every loaded video is a mounted card carrying a
 * thumbnail, a tooltip provider and a glow subscriber, and infinite scroll
 * appended a page each time the sentinel came into view. On a category with a
 * few thousand videos that meant a few thousand live cards — which is what
 * made the page freeze a while after it looked finished loading — and a feed
 * whose server order shifted underneath it could append the same rows over
 * and over without ever advancing.
 *
 * Three guards, one test each:
 *   - a hard ceiling past which scrolling no longer pages;
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

const { useVideoFeed, MAX_LOADED_VIDEOS, VIDEO_PAGE_SIZE } = await import(
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

describe("useVideoFeed capacity ceiling", () => {
  it("stops automatic paging at the ceiling and only a forced call gets past", async () => {
    // A library far larger than the ceiling: every page reports more to come.
    respond = (params) => ({
      videos: rows(Number(params.offset), VIDEO_PAGE_SIZE),
      total: 10_000,
      hasMore: true,
    });

    await mountFeed();
    expect(feed.videos).toHaveLength(VIDEO_PAGE_SIZE);
    expect(feed.atCapacity).toBe(false);

    // Page in as far as the automatic path is willing to go. The extra
    // iterations are the point: past the ceiling they must do nothing.
    for (let i = 0; i < MAX_LOADED_VIDEOS / VIDEO_PAGE_SIZE + 5; i++) {
      await act(async () => feed.loadMore());
    }

    expect(feed.videos.length).toBeLessThanOrEqual(MAX_LOADED_VIDEOS);
    expect(feed.atCapacity).toBe(true);

    // The sentinel firing again — the state the runaway used to live in —
    // buys nothing at all.
    const settled = requests.length;
    await act(async () => feed.loadMore());
    expect(requests).toHaveLength(settled);

    // A deliberate press still works, and by exactly one page.
    await act(async () => feed.loadMore({ force: true }));
    expect(requests).toHaveLength(settled + 1);
    expect(feed.videos).toHaveLength(MAX_LOADED_VIDEOS + VIDEO_PAGE_SIZE);
    expect(feed.atCapacity).toBe(true);
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
