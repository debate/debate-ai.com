// @vitest-environment jsdom
/**
 * @fileoverview The watch page's half of the one-player rule.
 *
 * The library allows exactly one YouTube embed at a time — two fight over
 * playback and over picture-in-picture — so this page does not add one beside
 * the floating popout player, it takes over from it. That handoff is the
 * riskiest thing in the page and the part with no visible symptom when it
 * breaks: get it wrong in one direction and two embeds play at once, wrong in
 * the other and a debater loses their place mid-round.
 *
 * Four things are pinned here:
 *   - mounting claims playback, and the iframe handle the toolbar posts to;
 *   - the embed opens at the video's saved second, not at zero;
 *   - unmounting hands the tracked position back and releases the claim;
 *   - closing the video hands nothing back — it was closed on purpose.
 */

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { createElement, act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

const push: Mock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useParams: () => ({}),
  usePathname: () => "/videos/watch/round-3-OXdffJy8HIs",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) =>
    createElement("a", { href, className }, children),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: unknown; alt?: string }) =>
    createElement("img", { src: typeof src === "string" ? src : (src as { src: string }).src, alt }),
}));

// Neither the transcript nor the page metadata is under test here, and both
// are fetched on mount — answer them with nothing so the page renders the
// no-captions shape without reaching the network.
vi.mock("grab-url", () => ({
  default: async (path: string) =>
    path === "transcript" ? { videoId: "x", snippets: [] } : {},
}));

const { VideoWatchPage } = await import("../src/panels/watch/VideoWatchPage")
const { useVideoPlayerStore, videoPlayerIframeRef } = await import("../src/state/videoPlayerStore")
const { saveVideoTimestamp } = await import("../src/state/videoPlayerPersistence")
const { videoWatchHref } = await import("../src/lib/video-slug")
import type { VideoType } from "../src/types/videos"

const VIDEO_ID = "OXdffJy8HIs"
const video = [
  VIDEO_ID,
  "Round 3 — Dartmouth vs Michigan",
  "2022-03-25",
  "NDT",
  1234,
  "A debate round.",
  1,
  "2022 NDT",
] as unknown as VideoType

const store = () => useVideoPlayerStore.getState()

let container: HTMLDivElement
let root: Root

/** Feed the page a playback position the way the real embed does. */
function reportPlaybackTime(seconds: number) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://www.youtube.com",
        data: JSON.stringify({ event: "infoDelivery", info: { currentTime: seconds } }),
      }),
    )
  })
}

function mount(node = createElement(VideoWatchPage, { video })) {
  act(() => {
    root.render(node)
  })
}

function unmount() {
  act(() => {
    root.unmount()
  })
}

beforeEach(() => {
  localStorage.clear()
  push.mockClear()
  videoPlayerIframeRef.current = null
  useVideoPlayerStore.setState({
    activeVideoId: null,
    activeVideoTitle: null,
    activeVideoMeta: null,
    isMinimized: false,
    isPlaying: false,
    playbackRate: 1,
    queue: [],
    startTime: 0,
    theaterVideoId: null,
    getCurrentTimeRef: null,
  })
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  container.remove()
})

describe("VideoWatchPage playback handoff", () => {
  it("claims playback and the shared iframe handle on mount", () => {
    mount()

    // The floating player reads `theaterVideoId` to stand down; without this
    // there would be two embeds playing the same video at once.
    expect(store().theaterVideoId).toBe(VIDEO_ID)
    expect(store().activeVideoId).toBe(VIDEO_ID)
    expect(store().activeVideoTitle).toBe("Round 3 — Dartmouth vs Michigan")
    // `sendYouTubeCommand` posts to this handle — the toolbar and the
    // slow-the-spread toggle drive whichever embed owns it.
    expect(videoPlayerIframeRef.current).not.toBeNull()
    expect(container.querySelector("iframe")?.getAttribute("src")).toContain(
      `/embed/${VIDEO_ID}`,
    )

    unmount()
  })

  it("opens the embed at the video's saved second", () => {
    saveVideoTimestamp(VIDEO_ID, 128)
    mount()

    const src = container.querySelector("iframe")?.getAttribute("src") ?? ""
    expect(new URL(src).searchParams.get("start")).toBe("128")

    unmount()
  })

  it("hands the tracked position back to the popout player on the way out", () => {
    mount()
    reportPlaybackTime(96.5)
    unmount()

    // Released, so the floating player renders again...
    expect(store().theaterVideoId).toBeNull()
    // ...and resumes where this page left off rather than restarting.
    expect(store().activeVideoId).toBe(VIDEO_ID)
    expect(store().startTime).toBe(96.5)
  })

  it("hands nothing back when the video was closed rather than left", () => {
    mount()
    reportPlaybackTime(96.5)

    const closeButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Close video"]',
    )
    expect(closeButton).not.toBeNull()
    act(() => {
      closeButton!.click()
    })

    expect(store().activeVideoId).toBeNull()
    expect(push).toHaveBeenCalledWith("/videos")

    unmount()
    // The claim is always released, even on the close path.
    expect(store().theaterVideoId).toBeNull()
    expect(store().startTime).toBe(0)
  })

  it("navigates when something else makes a different video active", async () => {
    mount()

    // A related card, or the queue advancing, goes through the same store
    // action — the page follows it into that video's URL instead of swapping
    // the embed behind an address that no longer describes it.
    await act(async () => {
      store().setActiveVideo("dQw4w9WgXcQ", "Round 4")
    })

    expect(push).toHaveBeenCalledWith(videoWatchHref("Round 4", "dQw4w9WgXcQ"))

    unmount()
  })
})
