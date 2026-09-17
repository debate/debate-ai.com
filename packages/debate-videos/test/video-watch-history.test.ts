/**
 * @fileoverview Pins the watch history: what gets recorded while a video
 * plays, what the grid reads back from it, and the three ways a naive version
 * of this feature would be wrong.
 *
 * The cases that matter most are the ones about *forgetting*. A history that
 * followed the current position would erase itself the moment a debater
 * rewound to re-hear a 2NR; one that wrote on every position report would
 * rewrite `localStorage` — and push a record to the account — several times a
 * second; and one that trusted the position alone would call an hour-long
 * round unfinished because the viewer skipped the closing credits.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MIN_TRACKED_SECONDS,
  VIDEO_WATCH_HISTORY_KEY,
  WATCH_PROGRESS_WRITE_INTERVAL_MS,
  clearWatchHistory,
  describeWatchProgress,
  forgetWatchedVideo,
  formatWatchClock,
  getWatchHistoryEntry,
  listWatchHistory,
  recordWatchProgress,
  resetWatchHistoryCache,
  watchPercent,
  watchStatus,
} from "../src/state/videoWatchHistory";
import { setToolRecordSyncEnabled } from "debate-data-sync/src/state/tool-record-mirror";

/** A clock the tests advance by hand, so the write throttle is deterministic. */
let clockMs = new Date("2026-03-01T12:00:00.000Z").getTime();
const AT = () => new Date(clockMs);
const advance = (ms: number) => {
  clockMs += ms;
};

/** A minimal localStorage, since this package's tests run in the node environment. */
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
  installLocalStorage();
  vi.stubGlobal("window", undefined);
  vi.stubGlobal("StorageEvent", undefined);
  clockMs = new Date("2026-03-01T12:00:00.000Z").getTime();
  resetWatchHistoryCache();
});

afterEach(() => {
  setToolRecordSyncEnabled(false);
  vi.unstubAllGlobals();
});

describe("recording playback", () => {
  it("records a position as a record the account sync can key", () => {
    recordWatchProgress(
      { videoId: "abc", positionSeconds: 300, durationSeconds: 1200, title: "NDT Finals" },
      AT,
    );

    expect(listWatchHistory()).toEqual([
      {
        videoId: "abc",
        positionSeconds: 300,
        durationSeconds: 1200,
        title: "NDT Finals",
        watchedAt: "2026-03-01T12:00:00.000Z",
        completed: false,
      },
    ]);
  });

  it("ignores a video that barely started playing", () => {
    // Clicking a card and clicking away is not watch history; without this
    // every mis-click would put a badge on a card.
    expect(
      recordWatchProgress(
        { videoId: "abc", positionSeconds: MIN_TRACKED_SECONDS - 1, durationSeconds: 1200 },
        AT,
      ),
    ).toBeNull();
    expect(listWatchHistory()).toEqual([]);
  });

  it("throttles repeat reports for the same video", () => {
    recordWatchProgress({ videoId: "abc", positionSeconds: 100, durationSeconds: 1000 }, AT);
    advance(1_000);
    expect(
      recordWatchProgress({ videoId: "abc", positionSeconds: 101, durationSeconds: 1000 }, AT),
    ).toBeNull();

    expect(getWatchHistoryEntry("abc")?.positionSeconds).toBe(100);
  });

  it("writes again once the throttle interval has passed", () => {
    recordWatchProgress({ videoId: "abc", positionSeconds: 100, durationSeconds: 1000 }, AT);
    advance(WATCH_PROGRESS_WRITE_INTERVAL_MS);
    recordWatchProgress({ videoId: "abc", positionSeconds: 130, durationSeconds: 1000 }, AT);

    expect(getWatchHistoryEntry("abc")?.positionSeconds).toBe(130);
  });

  it("writes immediately when the caller flushes", () => {
    // A pause, an ended video or a page leave may be the last report there
    // ever is for this video, so it cannot wait for the interval.
    recordWatchProgress({ videoId: "abc", positionSeconds: 100, durationSeconds: 1000 }, AT);
    advance(1_000);
    recordWatchProgress(
      { videoId: "abc", positionSeconds: 140, durationSeconds: 1000, flush: true },
      AT,
    );

    expect(getWatchHistoryEntry("abc")?.positionSeconds).toBe(140);
  });

  it("keeps the furthest point reached when the user rewinds", () => {
    recordWatchProgress({ videoId: "abc", positionSeconds: 900, durationSeconds: 1000 }, AT);
    advance(WATCH_PROGRESS_WRITE_INTERVAL_MS);
    recordWatchProgress(
      { videoId: "abc", positionSeconds: 120, durationSeconds: 1000, flush: true },
      AT,
    );

    expect(getWatchHistoryEntry("abc")?.positionSeconds).toBe(900);
  });

  it("marks a video completed when playback reaches the end", () => {
    recordWatchProgress(
      { videoId: "abc", positionSeconds: 1000, durationSeconds: 1000, completed: true },
      AT,
    );

    expect(getWatchHistoryEntry("abc")?.completed).toBe(true);
    expect(watchStatus(getWatchHistoryEntry("abc"))).toBe("watched");
  });

  it("never un-completes a video watched through once", () => {
    recordWatchProgress(
      { videoId: "abc", positionSeconds: 1000, durationSeconds: 1000, completed: true },
      AT,
    );
    advance(WATCH_PROGRESS_WRITE_INTERVAL_MS);
    recordWatchProgress({ videoId: "abc", positionSeconds: 30, durationSeconds: 1000 }, AT);

    expect(getWatchHistoryEntry("abc")?.completed).toBe(true);
  });

  it("keeps a duration learnt earlier when a later report omits it", () => {
    // The embed announces the duration once per load; a position report that
    // arrives without one must not blank out the percentage.
    recordWatchProgress({ videoId: "abc", positionSeconds: 100, durationSeconds: 1000 }, AT);
    advance(WATCH_PROGRESS_WRITE_INTERVAL_MS);
    recordWatchProgress({ videoId: "abc", positionSeconds: 200 }, AT);

    expect(getWatchHistoryEntry("abc")?.durationSeconds).toBe(1000);
  });

  it("tracks each video separately", () => {
    recordWatchProgress({ videoId: "abc", positionSeconds: 100, durationSeconds: 1000 }, AT);
    recordWatchProgress({ videoId: "def", positionSeconds: 200, durationSeconds: 1000 }, AT);

    expect(listWatchHistory().map((entry) => entry.videoId).sort()).toEqual(["abc", "def"]);
  });

  it("forgets one video, and clears the lot", () => {
    recordWatchProgress({ videoId: "abc", positionSeconds: 100, durationSeconds: 1000 }, AT);
    recordWatchProgress({ videoId: "def", positionSeconds: 200, durationSeconds: 1000 }, AT);

    expect(forgetWatchedVideo("abc").map((entry) => entry.videoId)).toEqual(["def"]);
    clearWatchHistory();
    expect(listWatchHistory()).toEqual([]);
  });
});

describe("reading the history back", () => {
  it("survives a store that is not JSON at all", () => {
    localStorage.setItem(VIDEO_WATCH_HISTORY_KEY, "{not json");

    expect(listWatchHistory()).toEqual([]);
  });

  it("ignores junk entries rather than throwing on page load", () => {
    localStorage.setItem(
      VIDEO_WATCH_HISTORY_KEY,
      JSON.stringify([null, 7, "", { positionSeconds: 10 }]),
    );

    expect(listWatchHistory()).toEqual([]);
  });

  it("normalizes a record whose numbers arrived as strings", () => {
    localStorage.setItem(
      VIDEO_WATCH_HISTORY_KEY,
      JSON.stringify([{ videoId: "abc", positionSeconds: "300.4", durationSeconds: "1200" }]),
    );

    expect(getWatchHistoryEntry("abc")).toMatchObject({
      positionSeconds: 300,
      durationSeconds: 1200,
    });
  });
});

describe("what the grid shows", () => {
  const entry = (positionSeconds: number, durationSeconds = 1000) => ({
    videoId: "abc",
    positionSeconds,
    durationSeconds,
    title: "",
    watchedAt: "2026-03-01T12:00:00.000Z",
    completed: false,
  });

  it("has no status for a video that was never played", () => {
    expect(watchStatus(null)).toBe("unwatched");
    expect(watchPercent(null)).toBe(0);
  });

  it("bands progress into the four watched states", () => {
    expect(watchStatus(entry(100))).toBe("started");
    expect(watchStatus(entry(300))).toBe("partly");
    expect(watchStatus(entry(600))).toBe("mostly");
    expect(watchStatus(entry(950))).toBe("watched");
  });

  it("reads a completed video as fully watched whatever its position", () => {
    // A viewer who skips the credits of an hour-long round has finished it.
    expect(watchPercent({ ...entry(820), completed: true })).toBe(100);
    expect(watchStatus({ ...entry(820), completed: true })).toBe("watched");
  });

  it("still counts a video of unknown length as started", () => {
    // No percentage can be computed, but the user did watch it, and a badge
    // with no number beats no badge at all.
    expect(watchStatus(entry(300, 0))).toBe("started");
    expect(watchPercent(entry(300, 0))).toBe(0);
  });

  it("formats clocks as a viewer reads them", () => {
    expect(formatWatchClock(90)).toBe("1:30");
    expect(formatWatchClock(3704)).toBe("1:01:44");
  });

  it("describes progress with both the percentage and the clock", () => {
    expect(describeWatchProgress(entry(600))).toBe("Mostly watched — 60% (10:00 of 16:40)");
  });

  it("describes a video of unknown length without inventing a percentage", () => {
    expect(describeWatchProgress(entry(600, 0))).toBe("Just started — 10:00 watched");
  });
});
