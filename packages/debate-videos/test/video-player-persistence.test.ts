// @vitest-environment jsdom
/**
 * @fileoverview Pins the two things a debater notices about the persistent
 * player: that closing the tab and coming back resumes the video where they
 * were, and that a stale snapshot from yesterday does not.
 *
 * Every function here is wrapped in a try/catch that swallows storage
 * failures, so a broken read looks exactly like "nothing saved" at the call
 * site. That fallback is checked directly rather than assumed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSavedPlayerState,
  loadPlayerState,
  loadVideoTimestamp,
  savePlayerState,
  saveVideoTimestamp,
  type PersistedPlayerState,
} from "../src/state/videoPlayerPersistence";

const DAY_MS = 24 * 60 * 60 * 1000;

const snapshot = (
  over: Partial<Omit<PersistedPlayerState, "savedAt">> = {},
): Omit<PersistedPlayerState, "savedAt"> => ({
  videoId: "abc123",
  title: "Round 3 - Westside vs Eastside",
  meta: { year: 2024, tournament: "Berkeley" },
  isMinimized: false,
  playbackRate: 1,
  queue: [],
  savedTime: 125,
  ...over,
});

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("savePlayerState and loadPlayerState", () => {
  it("round-trips the snapshot", () => {
    savePlayerState(snapshot());
    const loaded = loadPlayerState();
    expect(loaded).toMatchObject(snapshot());
  });

  it("stamps the snapshot with the time it was saved", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-03-14T12:00:00Z"));
    savePlayerState(snapshot());
    expect(loadPlayerState()?.savedAt).toBe(Date.parse("2026-03-14T12:00:00Z"));
  });

  it("is null when nothing has been saved", () => {
    expect(loadPlayerState()).toBeNull();
  });

  it("carries the queue and the player's own toggles", () => {
    savePlayerState(
      snapshot({
        isMinimized: true,
        playbackRate: 0.65,
        queue: [{ videoId: "next1", title: "Next up" }],
      }),
    );
    const loaded = loadPlayerState()!;
    expect(loaded.isMinimized).toBe(true);
    expect(loaded.playbackRate).toBe(0.65);
    expect(loaded.queue).toEqual([{ videoId: "next1", title: "Next up" }]);
  });

  it("falls back to normal speed for a snapshot written before playbackRate existed", () => {
    const { playbackRate: _dropped, ...legacy } = snapshot();
    localStorage.setItem(
      "persistent-video-player",
      JSON.stringify({ ...legacy, isSlowMode: true, savedAt: Date.now() }),
    );
    expect(loadPlayerState()!.playbackRate).toBe(1);
  });

  it("drops a snapshot older than a day rather than resuming it", () => {
    vi.useFakeTimers().setSystemTime(0);
    savePlayerState(snapshot());
    vi.setSystemTime(DAY_MS + 1);
    expect(loadPlayerState()).toBeNull();
  });

  it("removes the stale snapshot it refused, so it is not read again", () => {
    vi.useFakeTimers().setSystemTime(0);
    savePlayerState(snapshot());
    vi.setSystemTime(DAY_MS + 1);
    loadPlayerState();
    expect(localStorage.getItem("persistent-video-player")).toBeNull();
  });

  it("keeps a snapshot from just inside the window", () => {
    vi.useFakeTimers().setSystemTime(0);
    savePlayerState(snapshot());
    vi.setSystemTime(DAY_MS - 1);
    expect(loadPlayerState()).not.toBeNull();
  });

  it("drops a snapshot naming no video", () => {
    localStorage.setItem(
      "persistent-video-player",
      JSON.stringify({ ...snapshot({ videoId: "" }), savedAt: Date.now() }),
    );
    expect(loadPlayerState()).toBeNull();
  });

  it("reads corrupt storage as nothing saved", () => {
    localStorage.setItem("persistent-video-player", "{not json");
    expect(loadPlayerState()).toBeNull();
  });

  it("also records the video's own timestamp, so the next play resumes it", () => {
    savePlayerState(snapshot({ videoId: "vid9", savedTime: 42 }));
    expect(loadVideoTimestamp("vid9")).toBe(42);
  });
});

describe("clearSavedPlayerState", () => {
  it("removes the snapshot", () => {
    savePlayerState(snapshot());
    clearSavedPlayerState();
    expect(loadPlayerState()).toBeNull();
  });

  it("leaves the per-video timestamps alone, which outlive one session", () => {
    savePlayerState(snapshot({ videoId: "vid9", savedTime: 42 }));
    clearSavedPlayerState();
    expect(loadVideoTimestamp("vid9")).toBe(42);
  });

  it("is a no-op when there is nothing saved", () => {
    expect(() => clearSavedPlayerState()).not.toThrow();
  });
});

describe("saveVideoTimestamp and loadVideoTimestamp", () => {
  it("round-trips one video's position", () => {
    saveVideoTimestamp("vid1", 90);
    expect(loadVideoTimestamp("vid1")).toBe(90);
  });

  it("keeps each video's position apart", () => {
    saveVideoTimestamp("vid1", 90);
    saveVideoTimestamp("vid2", 30);
    expect(loadVideoTimestamp("vid1")).toBe(90);
    expect(loadVideoTimestamp("vid2")).toBe(30);
  });

  it("overwrites a video's earlier position", () => {
    saveVideoTimestamp("vid1", 90);
    saveVideoTimestamp("vid1", 120);
    expect(loadVideoTimestamp("vid1")).toBe(120);
  });

  it("is null for a video never watched", () => {
    expect(loadVideoTimestamp("never")).toBeNull();
  });

  it("is null when nothing has been stored at all", () => {
    expect(loadVideoTimestamp("vid1")).toBeNull();
  });

  it("keeps a position of zero, which is a real position", () => {
    saveVideoTimestamp("vid1", 0);
    expect(loadVideoTimestamp("vid1")).toBe(0);
  });

  it("forgets a position older than a day", () => {
    vi.useFakeTimers().setSystemTime(0);
    saveVideoTimestamp("vid1", 90);
    vi.setSystemTime(DAY_MS + 1);
    expect(loadVideoTimestamp("vid1")).toBeNull();
  });

  it("prunes the stale entry it refused", () => {
    vi.useFakeTimers().setSystemTime(0);
    saveVideoTimestamp("vid1", 90);
    saveVideoTimestamp("vid2", 30);
    vi.setSystemTime(DAY_MS + 1);
    loadVideoTimestamp("vid1");
    const stored = JSON.parse(localStorage.getItem("video-timestamps")!);
    expect(stored.vid1).toBeUndefined();
    expect(stored.vid2).toBeDefined();
  });

  it("keeps only the fifty most recently watched videos", () => {
    vi.useFakeTimers().setSystemTime(0);
    for (let i = 0; i < 60; i++) {
      vi.setSystemTime(i * 1000);
      saveVideoTimestamp(`vid${i}`, i);
    }
    const stored = JSON.parse(localStorage.getItem("video-timestamps")!);
    expect(Object.keys(stored)).toHaveLength(50);
    // The oldest went; the newest stayed.
    expect(stored.vid0).toBeUndefined();
    expect(stored.vid59).toBeDefined();
  });

  it("reads corrupt storage as no position saved", () => {
    localStorage.setItem("video-timestamps", "{not json");
    expect(loadVideoTimestamp("vid1")).toBeNull();
  });

  it("survives a write into corrupt storage rather than throwing at the caller", () => {
    localStorage.setItem("video-timestamps", "{not json");
    expect(() => saveVideoTimestamp("vid1", 5)).not.toThrow();
  });
});
