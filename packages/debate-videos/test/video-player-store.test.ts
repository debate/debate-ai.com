// @vitest-environment jsdom
/**
 * @fileoverview The persistent player's store: which video is up, the queue
 * behind it, and the timestamp handoff when one video replaces another.
 *
 * That handoff is the part worth pinning. Switching videos has to bank the
 * outgoing one's position before the incoming one overwrites the state, or a
 * debater who clicks away mid-round loses their place silently.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  sendYouTubeCommand,
  useVideoPlayerStore,
  videoPlayerIframeRef,
} from "../src/state/videoPlayerStore";
import { loadVideoTimestamp, saveVideoTimestamp } from "../src/state/videoPlayerPersistence";

const store = () => useVideoPlayerStore.getState();

beforeEach(() => {
  localStorage.clear();
  videoPlayerIframeRef.current = null;
  useVideoPlayerStore.setState({
    activeVideoId: null,
    activeVideoTitle: null,
    activeVideoMeta: null,
    isMinimized: false,
    isPlaying: false,
    isSlowMode: false,
    queue: [],
    startTime: 0,
    searchHandler: null,
    getCurrentTimeRef: null,
  });
});

describe("setActiveVideo", () => {
  it("puts the video up and starts it playing", () => {
    store().setActiveVideo("vid1", "Round 3");
    expect(store().activeVideoId).toBe("vid1");
    expect(store().activeVideoTitle).toBe("Round 3");
    expect(store().isPlaying).toBe(true);
  });

  it("un-minimizes the player, so a new pick is visible", () => {
    useVideoPlayerStore.setState({ isMinimized: true });
    store().setActiveVideo("vid1", "Round 3");
    expect(store().isMinimized).toBe(false);
  });

  it("carries the video's metadata", () => {
    store().setActiveVideo("vid1", "Round 3", { year: 2024, tournament: "Berkeley" });
    expect(store().activeVideoMeta).toEqual({ year: 2024, tournament: "Berkeley" });
  });

  it("holds no metadata when none was given", () => {
    store().setActiveVideo("vid1", "Round 3");
    expect(store().activeVideoMeta).toBeNull();
  });

  it("starts from the beginning for a video never watched", () => {
    store().setActiveVideo("vid1", "Round 3");
    expect(store().startTime).toBe(0);
  });

  it("resumes a video at its saved position", () => {
    saveVideoTimestamp("vid1", 125);
    store().setActiveVideo("vid1", "Round 3");
    expect(store().startTime).toBe(125);
  });

  it("lets an explicit start time win over the saved position", () => {
    saveVideoTimestamp("vid1", 125);
    store().setActiveVideo("vid1", "Round 3", undefined, 42);
    expect(store().startTime).toBe(42);
  });

  it("jumps to an explicit start time on a video that is not loaded yet", () => {
    store().setActiveVideo("vid1", "Round 3", undefined, 300);
    expect(store().startTime).toBe(300);
  });

  it("banks the outgoing video's position before the new one takes over", () => {
    store().setGetCurrentTimeRef(() => 90);
    store().setActiveVideo("vid1", "Round 3");
    store().setActiveVideo("vid2", "Round 4");
    expect(loadVideoTimestamp("vid1")).toBe(90);
  });

  it("does not bank a position of zero, which is not a place to resume from", () => {
    store().setGetCurrentTimeRef(() => 0);
    store().setActiveVideo("vid1", "Round 3");
    store().setActiveVideo("vid2", "Round 4");
    expect(loadVideoTimestamp("vid1")).toBeNull();
  });

  it("banks nothing when the player never reported a position", () => {
    store().setActiveVideo("vid1", "Round 3");
    store().setActiveVideo("vid2", "Round 4");
    expect(loadVideoTimestamp("vid1")).toBeNull();
  });

  it("does not bank when the same video is set again", () => {
    store().setGetCurrentTimeRef(() => 90);
    store().setActiveVideo("vid1", "Round 3");
    store().setActiveVideo("vid1", "Round 3");
    expect(loadVideoTimestamp("vid1")).toBeNull();
  });
});

describe("clearActiveVideo", () => {
  it("takes the video down and stops playback", () => {
    store().setActiveVideo("vid1", "Round 3", { year: 2024 });
    store().clearActiveVideo();
    expect(store().activeVideoId).toBeNull();
    expect(store().activeVideoTitle).toBeNull();
    expect(store().activeVideoMeta).toBeNull();
    expect(store().isPlaying).toBe(false);
    expect(store().startTime).toBe(0);
  });

  it("leaves the queue standing, so closing one video keeps what is lined up", () => {
    store().addToQueue("vid2", "Next");
    store().clearActiveVideo();
    expect(store().queue).toHaveLength(1);
  });
});

describe("the queue", () => {
  it("appends a video", () => {
    store().addToQueue("vid1", "Round 3", { year: 2024 });
    expect(store().queue).toEqual([
      { videoId: "vid1", title: "Round 3", meta: { year: 2024 } },
    ]);
  });

  it("keeps the order videos were added in", () => {
    store().addToQueue("vid1", "One");
    store().addToQueue("vid2", "Two");
    expect(store().queue.map((q) => q.videoId)).toEqual(["vid1", "vid2"]);
  });

  it("does not queue the same video twice", () => {
    store().addToQueue("vid1", "One");
    store().addToQueue("vid1", "One again");
    expect(store().queue).toHaveLength(1);
    expect(store().queue[0].title).toBe("One");
  });

  it("removes a video by id", () => {
    store().addToQueue("vid1", "One");
    store().addToQueue("vid2", "Two");
    store().removeFromQueue("vid1");
    expect(store().queue.map((q) => q.videoId)).toEqual(["vid2"]);
  });

  it("ignores a removal of a video not in the queue", () => {
    store().addToQueue("vid1", "One");
    store().removeFromQueue("gone");
    expect(store().queue).toHaveLength(1);
  });

  it("empties the whole queue", () => {
    store().addToQueue("vid1", "One");
    store().addToQueue("vid2", "Two");
    store().clearQueue();
    expect(store().queue).toEqual([]);
  });
});

describe("playNextInQueue", () => {
  it("puts the head of the queue up and takes it off", () => {
    store().addToQueue("vid1", "One", { year: 2024 });
    store().addToQueue("vid2", "Two");
    store().playNextInQueue();
    expect(store().activeVideoId).toBe("vid1");
    expect(store().activeVideoTitle).toBe("One");
    expect(store().activeVideoMeta).toEqual({ year: 2024 });
    expect(store().queue.map((q) => q.videoId)).toEqual(["vid2"]);
    expect(store().isPlaying).toBe(true);
  });

  it("starts the next video from the beginning", () => {
    saveVideoTimestamp("vid1", 125);
    store().addToQueue("vid1", "One");
    store().playNextInQueue();
    expect(store().startTime).toBe(0);
  });

  it("un-minimizes the player for the next video", () => {
    store().addToQueue("vid1", "One");
    useVideoPlayerStore.setState({ isMinimized: true });
    store().playNextInQueue();
    expect(store().isMinimized).toBe(false);
  });

  it("clears the player when the queue has run out", () => {
    store().setActiveVideo("vid1", "One");
    store().playNextInQueue();
    expect(store().activeVideoId).toBeNull();
    expect(store().isPlaying).toBe(false);
  });
});

describe("the player's own toggles", () => {
  it("minimizes and restores", () => {
    store().setMinimized(true);
    expect(store().isMinimized).toBe(true);
    store().setMinimized(false);
    expect(store().isMinimized).toBe(false);
  });

  it("tracks play and pause", () => {
    store().setIsPlaying(true);
    expect(store().isPlaying).toBe(true);
    store().setIsPlaying(false);
    expect(store().isPlaying).toBe(false);
  });

  it("tracks slow mode, which outlives one video", () => {
    store().setSlowMode(true);
    store().setActiveVideo("vid1", "One");
    expect(store().isSlowMode).toBe(true);
  });

  it("holds the search handler a host page registers, and lets it go", () => {
    const handler = vi.fn();
    store().setSearchHandler(handler);
    store().searchHandler!("warming");
    expect(handler).toHaveBeenCalledWith("warming");
    store().setSearchHandler(null);
    expect(store().searchHandler).toBeNull();
  });

  it("holds the playback-time getter, and lets it go", () => {
    store().setGetCurrentTimeRef(() => 12);
    expect(store().getCurrentTimeRef!()).toBe(12);
    store().setGetCurrentTimeRef(null);
    expect(store().getCurrentTimeRef).toBeNull();
  });
});

describe("restoreVideo", () => {
  it("puts back every part of a persisted snapshot", () => {
    store().restoreVideo("vid1", "Round 3", { year: 2024 }, {
      isMinimized: true,
      isSlowMode: true,
      queue: [{ videoId: "vid2", title: "Next" }],
      savedTime: 125,
    });
    expect(store()).toMatchObject({
      activeVideoId: "vid1",
      activeVideoTitle: "Round 3",
      activeVideoMeta: { year: 2024 },
      isMinimized: true,
      isSlowMode: true,
      startTime: 125,
      isPlaying: true,
    });
    expect(store().queue).toEqual([{ videoId: "vid2", title: "Next" }]);
  });

  it("restores a video that carried no metadata", () => {
    store().restoreVideo("vid1", "Round 3", null, {
      isMinimized: false,
      isSlowMode: false,
      queue: [],
      savedTime: 0,
    });
    expect(store().activeVideoMeta).toBeNull();
  });
});

describe("sendYouTubeCommand", () => {
  it("posts the command to the iframe, addressed to youtube alone", () => {
    const postMessage = vi.fn();
    videoPlayerIframeRef.current = { contentWindow: { postMessage } } as never;

    sendYouTubeCommand("pauseVideo");

    expect(postMessage).toHaveBeenCalledWith(
      JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
      "https://www.youtube.com",
    );
  });

  it("carries the command's arguments", () => {
    const postMessage = vi.fn();
    videoPlayerIframeRef.current = { contentWindow: { postMessage } } as never;

    sendYouTubeCommand("seekTo", [90, true]);

    expect(JSON.parse(postMessage.mock.calls[0][0])).toEqual({
      event: "command",
      func: "seekTo",
      args: [90, true],
    });
  });

  it("does nothing when no player is mounted", () => {
    expect(() => sendYouTubeCommand("playVideo")).not.toThrow();
  });

  it("does nothing when the iframe has no window yet", () => {
    videoPlayerIframeRef.current = { contentWindow: null } as never;
    expect(() => sendYouTubeCommand("playVideo")).not.toThrow();
  });
});
