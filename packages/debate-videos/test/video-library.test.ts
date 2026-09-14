/**
 * @fileoverview Pins the video library's per-user stores — favourites, hidden
 * videos and reports — and the two things that were previously wrong about
 * them: the format could not be synced, and a guest was never told their
 * collection was browser-only.
 *
 * The legacy-format cases are the ones that matter most. Favourites shipped
 * for a long time as a JSON array of bare video ids, and a debater can build
 * that list over a whole season. A format change that dropped it — or that
 * re-dated every entry to "now" and so reordered a season's collection — would
 * be a silent data loss on upgrade, visible only to the user it happened to.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  VIDEO_FAVORITES_KEY,
  VIDEO_HIDDEN_KEY,
  VIDEO_REPORTS_KEY,
  clearVideoFavorites,
  hideVideo,
  listHiddenVideos,
  listVideoFavorites,
  listVideoReports,
  saveVideoReport,
  toggleVideoFavorite,
  unhideVideo,
} from "../src/state/videoLibrary";
import {
  resetSignInPrompts,
  setSignedIn,
  subscribeToSignInPrompts,
  type SignInPrompt,
} from "debate-data-sync/src/state/sign-in-prompt";
import { setToolRecordSyncEnabled } from "debate-data-sync/src/state/tool-record-mirror";

const AT = () => new Date("2026-03-01T12:00:00.000Z");

let prompts: SignInPrompt[] = [];
let requests: { url: string; method: string }[] = [];

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
  // The store dispatches a synthetic `storage` event so a mounted panel in the
  // same tab re-reads; node has neither `window` nor `StorageEvent`, and the
  // store is written to tolerate exactly that.
  vi.stubGlobal("window", undefined);
  vi.stubGlobal("StorageEvent", undefined);
  prompts = [];
  requests = [];
  resetSignInPrompts();
  subscribeToSignInPrompts((prompt) => prompts.push(prompt));
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    requests.push({ url, method: init?.method ?? "GET" });
    return new Response("{}", { status: 200 });
  });
});

afterEach(() => {
  setToolRecordSyncEnabled(false);
  resetSignInPrompts();
  vi.unstubAllGlobals();
});

describe("video favorites", () => {
  it("favourites a video as a record the account sync can key", () => {
    expect(toggleVideoFavorite("abc", AT)).toEqual([
      { videoId: "abc", savedAt: "2026-03-01T12:00:00.000Z" },
    ]);
    expect(listVideoFavorites()).toEqual([
      { videoId: "abc", savedAt: "2026-03-01T12:00:00.000Z" },
    ]);
  });

  it("un-favourites by video id", () => {
    toggleVideoFavorite("abc", AT);
    toggleVideoFavorite("def", AT);

    expect(toggleVideoFavorite("abc", AT)).toEqual([
      { videoId: "def", savedAt: "2026-03-01T12:00:00.000Z" },
    ]);
  });

  it("reads a store written in the legacy bare-id format", () => {
    localStorage.setItem(VIDEO_FAVORITES_KEY, JSON.stringify(["abc", "def"]));

    expect(listVideoFavorites().map((favorite) => favorite.videoId)).toEqual(["abc", "def"]);
  });

  it("dates upgraded legacy favourites to the epoch, not to now", () => {
    // Stamping them with the upgrade time would reorder a collection built
    // over a season the first time the new code ran.
    localStorage.setItem(VIDEO_FAVORITES_KEY, JSON.stringify(["abc"]));

    expect(listVideoFavorites()[0]?.savedAt).toBe(new Date(0).toISOString());
  });

  it("keeps a season's legacy favourites when one more is added", () => {
    localStorage.setItem(VIDEO_FAVORITES_KEY, JSON.stringify(["abc", "def"]));

    expect(toggleVideoFavorite("ghi", AT).map((favorite) => favorite.videoId)).toEqual([
      "abc",
      "def",
      "ghi",
    ]);
  });

  it("de-duplicates a video present in both formats at once", () => {
    // What a browser mid-upgrade holds after an account merge: the legacy
    // string this browser wrote, plus the record the account returned.
    localStorage.setItem(
      VIDEO_FAVORITES_KEY,
      JSON.stringify(["abc", { videoId: "abc", savedAt: "2026-01-01T00:00:00.000Z" }]),
    );

    expect(listVideoFavorites()).toEqual([
      { videoId: "abc", savedAt: "2026-01-01T00:00:00.000Z" },
    ]);
  });

  it("ignores junk entries rather than throwing on page load", () => {
    localStorage.setItem(VIDEO_FAVORITES_KEY, JSON.stringify([null, 7, "", { savedAt: "x" }]));

    expect(listVideoFavorites()).toEqual([]);
  });

  it("survives a store that is not JSON at all", () => {
    localStorage.setItem(VIDEO_FAVORITES_KEY, "{not json");

    expect(listVideoFavorites()).toEqual([]);
  });

  it("clears every favourite", () => {
    toggleVideoFavorite("abc", AT);
    clearVideoFavorites();

    expect(listVideoFavorites()).toEqual([]);
  });
});

describe("the guest prompt", () => {
  it("tells a signed-out user their favourites are browser-only", () => {
    toggleVideoFavorite("abc", AT);

    expect(prompts).toHaveLength(1);
    expect(prompts[0]?.feature).toBe("video favorites");
    expect(prompts[0]?.message).toMatch(/this browser only/i);
  });

  it("saves the favourite anyway", () => {
    // The prompt is an offer to keep the work, not a gate in front of it: a
    // guest who dismisses the dialog still has the favourite they just made,
    // and the first sign-in pushes it up.
    toggleVideoFavorite("abc", AT);

    expect(listVideoFavorites()).toEqual([
      { videoId: "abc", savedAt: "2026-03-01T12:00:00.000Z" },
    ]);
  });

  it("says nothing to a signed-in user", () => {
    setSignedIn(true);
    toggleVideoFavorite("abc", AT);

    expect(prompts).toEqual([]);
  });

  it("does not prompt when a favourite is being removed", () => {
    setSignedIn(true);
    toggleVideoFavorite("abc", AT);
    setSignedIn(false);
    prompts = [];

    toggleVideoFavorite("abc", AT);

    expect(prompts).toEqual([]);
  });

  it("does not prompt when a video is un-hidden", () => {
    hideVideo("abc", AT);
    prompts = [];

    unhideVideo("abc");

    expect(prompts).toEqual([]);
  });
});

describe("account mirroring", () => {
  it("mirrors a favourite to the account once signed in", async () => {
    setToolRecordSyncEnabled(true);
    setSignedIn(true);

    toggleVideoFavorite("abc", AT);
    await Promise.resolve();

    expect(requests).toEqual([
      { url: "/api/tool-records/debateVideosFavorites/abc", method: "PUT" },
    ]);
  });

  it("mirrors an un-favourite as a delete", async () => {
    setToolRecordSyncEnabled(true);
    setSignedIn(true);
    toggleVideoFavorite("abc", AT);
    await Promise.resolve();
    requests = [];

    toggleVideoFavorite("abc", AT);
    await Promise.resolve();

    expect(requests).toEqual([
      { url: "/api/tool-records/debateVideosFavorites/abc", method: "DELETE" },
    ]);
  });

  it("makes no requests at all while signed out", async () => {
    toggleVideoFavorite("abc", AT);
    hideVideo("def", AT);
    saveVideoReport({ videoId: "ghi", title: "T", report: "bad audio" }, AT);
    await Promise.resolve();

    expect(requests).toEqual([]);
  });
});

describe("hidden videos", () => {
  it("hides and un-hides by video id", () => {
    expect(hideVideo("abc", AT)).toEqual([
      { videoId: "abc", hiddenAt: "2026-03-01T12:00:00.000Z" },
    ]);
    expect(unhideVideo("abc")).toEqual([]);
  });

  it("is idempotent — hiding twice does not duplicate the record", () => {
    hideVideo("abc", AT);

    expect(hideVideo("abc", AT)).toHaveLength(1);
  });

  it("reads the legacy bare-id format", () => {
    localStorage.setItem(VIDEO_HIDDEN_KEY, JSON.stringify(["abc"]));

    expect(listHiddenVideos().map((entry) => entry.videoId)).toEqual(["abc"]);
  });
});

describe("video reports", () => {
  it("keys a report so it can reach the reporter's account", () => {
    const saved = saveVideoReport(
      { videoId: "abc", title: "Finals", report: "audio desync" },
      AT,
    );

    expect(saved.id).toBe("abc:2026-03-01T12:00:00.000Z");
    expect(listVideoReports()).toEqual([saved]);
  });

  it("derives a stable id for a report written before the sync existed", () => {
    localStorage.setItem(
      VIDEO_REPORTS_KEY,
      JSON.stringify([
        { videoId: "abc", title: "Finals", report: "audio", date: "2026-01-01T00:00:00.000Z" },
      ]),
    );

    // Re-reading must produce the same id every time, or each page load would
    // sync the same report to the account as a new row.
    expect(listVideoReports()[0]?.id).toBe("abc:2026-01-01T00:00:00.000Z");
    expect(listVideoReports()[0]?.id).toBe(listVideoReports()[0]?.id);
  });

  it("keeps earlier reports when a new one is added", () => {
    saveVideoReport({ videoId: "abc", title: "A", report: "one" }, AT);
    saveVideoReport({ videoId: "def", title: "B", report: "two" }, AT);

    expect(listVideoReports().map((report) => report.videoId)).toEqual(["abc", "def"]);
  });
});
