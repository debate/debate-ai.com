/** @vitest-environment jsdom */
/**
 * @fileoverview The pop-out mini player: transport controls, the speech strip's
 * previous/next jumps, progress recorded from the embed's messages, the
 * desktop-only always-on-top pin, and handing back to the full watch page.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { click, flush, mount, type Mounted } from "./helpers/mount";

const player = vi.hoisted(() => ({ sendYouTubeCommand: vi.fn(), iframeRef: { current: null as unknown } }));
const embed = vi.hoisted(() => ({ startListening: vi.fn() }));
const history = vi.hoisted(() => ({ recordWatchProgress: vi.fn() }));
const win = vi.hoisted(() => ({
  isDesktopApp: vi.fn(() => false),
  readMiniPlayerOnTop: vi.fn(() => true),
  setMiniPlayerOnTop: vi.fn(async () => true),
  returnToFullPage: vi.fn(async () => {}),
}));
const ai = vi.hoisted(() => ({ shared: { segmentation: null as unknown, starts: {} as Record<string, number> } }));
const oneTab = vi.hoisted(() => ({ onOther: null as null | (() => void) }));
const speechState = vi.hoisted(() => ({
  starts: {} as Record<string, number>,
  segmentation: null as unknown,
}));

vi.mock("../src/state/videoPlayerStore", () => ({
  sendYouTubeCommand: player.sendYouTubeCommand,
  videoPlayerIframeRef: player.iframeRef,
}));
vi.mock("../src/components/videos/player/youtubeEmbed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/components/videos/player/youtubeEmbed")>()),
  startListening: embed.startListening,
}));
vi.mock("../src/state/videoWatchHistory", () => ({ recordWatchProgress: history.recordWatchProgress }));
vi.mock("../src/lib/mini-player-window", () => win);
vi.mock("../src/state/sharedVideoAi", () => ({ useSharedVideoAi: () => ai.shared }));
vi.mock("../src/state/oneTabPlayback", () => ({
  useOneTabPlayback: (_playing: boolean, onOther: () => void) => {
    oneTab.onOther = onOther;
  },
}));
vi.mock("../src/state/speechStartMarks", () => ({ readSpeechStarts: () => speechState.starts }));
vi.mock("../src/state/speechAiCache", () => ({ readSpeechSegmentation: () => speechState.segmentation }));
vi.mock("../src/ui/primitives/tooltip", () => ({
  TooltipProvider: ({ children }: { children: unknown }) => <>{children as never}</>,
  Tooltip: ({ children }: { children: unknown }) => <>{children as never}</>,
  TooltipTrigger: ({ children }: { children: unknown }) => <>{children as never}</>,
  TooltipContent: () => null,
}));

import { VideoMiniPlayer, adjacentTimedSpeech } from "../src/panels/watch/VideoMiniPlayer";
import type { RoundSpeech } from "../src/lib/round-speeches";
import type { VideoType } from "../src/types/videos";

const video = ["vid1", "Mini Round", "2026-01-01", "Channel", 1, "", "VLD"] as unknown as VideoType
const roundVideo = ["vid1", "Mini Round", "2026-01-01", "Channel", 1, "", 3] as unknown as VideoType;

function speech(label: string, startSeconds: number | null): RoundSpeech {
  return { label, startSeconds } as unknown as RoundSpeech;
}

let mounted: Mounted | undefined;

async function render(props: Partial<React.ComponentProps<typeof VideoMiniPlayer>> = {}) {
  mounted = await mount(<VideoMiniPlayer video={video} {...props} />);
  return mounted.container;
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const found = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!found) throw new Error(`No button "${label}"`);
  return found;
}

function postFromYouTube(payload: unknown, origin = "https://www.youtube.com") {
  return flush(() => {
    window.dispatchEvent(
      new MessageEvent("message", { origin, data: typeof payload === "string" ? payload : JSON.stringify(payload) }),
    );
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  win.isDesktopApp.mockReturnValue(false);
  win.readMiniPlayerOnTop.mockReturnValue(true);
  ai.shared = { segmentation: null, starts: {} };
  speechState.starts = {};
  speechState.segmentation = null;
});

afterEach(async () => {
  await mounted?.unmount();
  mounted = undefined;
});

describe("adjacentTimedSpeech", () => {
  const speeches = [speech("1AC", 0), speech("1NC", 100), speech("2AC", 200), speech("untimed", null)];

  it("has no neighbour when no speech is timed", () => {
    expect(adjacentTimedSpeech([speech("1AC", null)], 10, 1)).toBeNull();
  });

  it("jumps to the next timed speech, skipping untimed ones, and stops at the end", () => {
    expect(adjacentTimedSpeech(speeches, 10, 1)?.label).toBe("1NC");
    expect(adjacentTimedSpeech(speeches, 150, 1)?.label).toBe("2AC");
    expect(adjacentTimedSpeech(speeches, 250, 1)).toBeNull();
  });

  it("restarts the playing speech when a few seconds in, otherwise goes back one", () => {
    expect(adjacentTimedSpeech(speeches, 150, -1)?.label).toBe("1NC");
    expect(adjacentTimedSpeech(speeches, 101, -1)?.label).toBe("1AC");
  });

  it("has nothing before the first speech", () => {
    expect(adjacentTimedSpeech(speeches, 50, -1)).toBeNull();
  });
});

describe("VideoMiniPlayer", () => {
  it("embeds the video at the starting position and registers its iframe", async () => {
    const container = await render({ startSeconds: 42 });
    const iframe = container.querySelector("iframe")!;
    expect(iframe.getAttribute("src")).toContain("vid1");
    expect(iframe.getAttribute("src")).toContain("start=42");
    expect(iframe.getAttribute("src")).toContain("autoplay=1");
    expect(iframe.title).toBe("Mini Round");
    expect(player.iframeRef.current).toBe(iframe);
    expect(container.textContent).toContain("Mini Round");
  });

  it("starts the embed handshake on mount, on load, and retries it a few times", async () => {
    vi.useFakeTimers();
    try {
      const container = await render();
      expect(embed.startListening).toHaveBeenCalledTimes(1);
      await flush(() => {
        container.querySelector("iframe")!.dispatchEvent(new Event("load"));
      });
      expect(embed.startListening).toHaveBeenCalledTimes(2);
      await flush(() => {
        vi.advanceTimersByTime(400 * 20);
      });
      // 1 on mount + 1 on load + 12 retries, after which it stops.
      expect(embed.startListening).toHaveBeenCalledTimes(14);
    } finally {
      vi.useRealTimers();
    }
  });

  it("toggles play and pause through the embed", async () => {
    const container = await render();
    await click(button(container, "Pause video"));
    expect(player.sendYouTubeCommand).toHaveBeenLastCalledWith("pauseVideo");
    await click(button(container, "Play video"));
    expect(player.sendYouTubeCommand).toHaveBeenLastCalledWith("playVideo");
  });

  it("pauses when another tab starts playing", async () => {
    const container = await render();
    await flush(() => oneTab.onOther?.());
    expect(player.sendYouTubeCommand).toHaveBeenCalledWith("pauseVideo");
    expect(button(container, "Play video")).toBeTruthy();
  });

  it("follows the embed's play state and records progress when it pauses or ends", async () => {
    const container = await render();
    await postFromYouTube({ event: "infoDelivery", info: { duration: 600, currentTime: 123 } });
    expect(history.recordWatchProgress).toHaveBeenLastCalledWith({
      videoId: "vid1",
      positionSeconds: 123,
      durationSeconds: 600,
      title: expect.any(String),
    });

    await postFromYouTube({ event: "onStateChange", info: 2 });
    expect(button(container, "Play video")).toBeTruthy();
    expect(history.recordWatchProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({ positionSeconds: 123, durationSeconds: 600, completed: false, flush: true }),
    );

    await postFromYouTube({ event: "onStateChange", info: 1 });
    expect(button(container, "Pause video")).toBeTruthy();

    await postFromYouTube({ event: "onStateChange", info: 0 });
    expect(history.recordWatchProgress).toHaveBeenLastCalledWith(expect.objectContaining({ completed: true }));
  });

  it("ignores messages from other origins, bad durations and non-JSON data", async () => {
    await render()
    await postFromYouTube({ event: "infoDelivery", info: { currentTime: 5 } }, "https://evil.example");
    await postFromYouTube("not json");
    await postFromYouTube({ event: "infoDelivery", info: { duration: -4 } });
    expect(history.recordWatchProgress).not.toHaveBeenCalled();
  });

  it("flushes the position when the window closes or unmounts", async () => {
    await render({ startSeconds: 30 });
    history.recordWatchProgress.mockClear();
    await flush(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(history.recordWatchProgress).toHaveBeenCalledWith(
      expect.objectContaining({ videoId: "vid1", positionSeconds: 30, flush: true }),
    );
    history.recordWatchProgress.mockClear();
    await mounted!.unmount();
    mounted = undefined;
    expect(history.recordWatchProgress).toHaveBeenCalledWith(expect.objectContaining({ flush: true }));
  });

  it("opens the full watch page after saving the position", async () => {
    const container = await render();
    await postFromYouTube({ event: "infoDelivery", info: { currentTime: 77 } });
    history.recordWatchProgress.mockClear();
    await click(button(container, "Open the full watch page"));
    expect(history.recordWatchProgress).toHaveBeenCalledWith(
      expect.objectContaining({ positionSeconds: 77, flush: true }),
    );
    expect(win.returnToFullPage).toHaveBeenCalledWith("/videos/25-26/vld/mini-round");
  });

  it("only offers the always-on-top pin in the desktop app, and toggles it", async () => {
    let container = await render();
    expect(container.querySelector('button[aria-label*="on top"]')).toBeNull();
    await mounted!.unmount();

    win.isDesktopApp.mockReturnValue(true);
    win.readMiniPlayerOnTop.mockReturnValue(false);
    container = await render();
    const pin = button(container, "Keep on top of other windows");
    expect(pin.getAttribute("aria-pressed")).toBe("false");
    await click(pin);
    expect(win.setMiniPlayerOnTop).toHaveBeenCalledWith(true);
    expect(button(container, "Stop keeping on top").getAttribute("aria-pressed")).toBe("true");
  });

  it("shows no speech strip when the round has no speeches", async () => {
    const container = await render();
    expect(container.querySelector('button[aria-label^="Next speech"]')).toBeNull();
    expect(container.querySelector('button[aria-label="No later speech"]')).toBeNull();
  });

  it("jumps between the speeches the reader has timed", async () => {
    speechState.starts = { "1AC#1": 10, "1NC#1": 100, "1AR#1": 300 };
    const container = await render({ video: roundVideo, startSeconds: 50 });
    expect(button(container, "No earlier speech").disabled).toBe(true);

    await click(button(container, "Next speech: 1NC"));
    expect(player.sendYouTubeCommand).toHaveBeenCalledWith("seekTo", [100, true]);
    expect(player.sendYouTubeCommand).toHaveBeenLastCalledWith("playVideo");

    await postFromYouTube({ event: "infoDelivery", info: { duration: 600, currentTime: 150 } });
    expect(button(container, "Next speech: 1AR").disabled).toBe(false);
    await click(button(container, "Previous speech: 1NC"));
    expect(player.sendYouTubeCommand).toHaveBeenCalledWith("seekTo", [100, true]);

    await postFromYouTube({ event: "infoDelivery", info: { duration: 600, currentTime: 400 } });
    expect(button(container, "No later speech").disabled).toBe(true);
  });

  it("times speeches from the published speech starts over the local marks", async () => {
    speechState.starts = { "1AC#1": 10, "1NC#1": 100 };
    ai.shared = { segmentation: null, starts: { "1NC#1": 200 } };
    const container = await render({ video: roundVideo, startSeconds: 50 });
    await click(button(container, "Next speech: 1NC"));
    expect(player.sendYouTubeCommand).toHaveBeenCalledWith("seekTo", [200, true]);
  });
});
