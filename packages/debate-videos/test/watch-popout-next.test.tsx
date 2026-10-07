// @vitest-environment jsdom
/**
 * @fileoverview The popout icon on a watch page's related rows.
 *
 * Off a watch page that icon plays the video in the floating player at once.
 * On one, the page's own embed is playing, and switching the store's active
 * video there is a navigation — so the icon used to whisk the reader off to
 * the clicked video's page. Pinned here: it lines the video up instead, the
 * page's video keeps playing with no navigation, the floating player shows
 * what is waiting, and leaving the page starts it.
 */

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { createElement, act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

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

vi.mock("grab-url", () => ({
  default: async (path: string) => (path === "transcript" ? { videoId: "x", snippets: [] } : {}),
}));

const { VideoWatchPage } = await import("../src/panels/watch/VideoWatchPage")
const { PersistentVideoPlayer } = await import("../src/components/video-player/PersistentVideoPlayer")
const { useVideoPlayerStore } = await import("../src/state/videoPlayerStore")
import type { VideoType } from "../src/types/videos"

const video = [
  "OXdffJy8HIs", "Round 3 — Dartmouth vs Michigan", "2022-03-25", "NDT", 1234, "A debate round.", 1, "2022 NDT",
] as unknown as VideoType

const related = [
  [
    "rel-new", "Finals — Texas vs Georgetown", "2022-04-18", "NDT", 20, "", 1,
    "2022 Harvard", "Finals", "Texas", "Georgetown", true, "3-0", null, null, false, null, 2022,
  ],
] as unknown as VideoType[]

const store = () => useVideoPlayerStore.getState()

let pageContainer: HTMLDivElement
let pageRoot: Root
let playerRoot: Root
let pageMounted = false

beforeEach(() => {
  push.mockClear()
  localStorage.clear()
  useVideoPlayerStore.setState({
    activeVideoId: null,
    activeVideoTitle: null,
    activeVideoMeta: null,
    isPlaying: false,
    queue: [],
    startTime: 0,
    theaterVideoId: null,
    popoutNext: null,
  })
  pageContainer = document.createElement("div")
  document.body.append(pageContainer)
  pageRoot = createRoot(pageContainer)
  const playerContainer = document.createElement("div")
  document.body.append(playerContainer)
  playerRoot = createRoot(playerContainer)
  act(() => {
    playerRoot.render(createElement(PersistentVideoPlayer))
    pageRoot.render(createElement(VideoWatchPage, { video, related }))
  })
  pageMounted = true
})

afterEach(() => {
  act(() => {
    if (pageMounted) pageRoot.unmount()
    playerRoot.unmount()
  })
  document.body.innerHTML = ""
})

function clickRowPopout() {
  const button = pageContainer.querySelector<HTMLButtonElement>(
    'tbody button[aria-label="Play in popout player when you leave this page"]',
  )
  expect(button).not.toBeNull()
  act(() => button!.click())
}

describe("the popout icon on a watch page", () => {
  it("lines the video up without navigating or changing what plays", () => {
    clickRowPopout()

    expect(push).not.toHaveBeenCalled()
    expect(store().activeVideoId).toBe("OXdffJy8HIs")
    expect(store().theaterVideoId).toBe("OXdffJy8HIs")
    expect(store().popoutNext?.videoId).toBe("rel-new")
  })

  it("shows the waiting video in the floating player's corner", () => {
    clickRowPopout()

    const card = document.body.querySelector('[aria-label="Up next in popout player"]')
    expect(card?.textContent).toContain("Finals — Texas vs Georgetown")
    expect(card?.textContent).toContain("Plays when you leave this page")
    // Still no second embed while the page's own player holds playback.
    expect(document.body.querySelectorAll("iframe")).toHaveLength(1)
  })

  it("cancels on a second click", () => {
    clickRowPopout()
    const button = pageContainer.querySelector<HTMLButtonElement>('tbody button[aria-pressed="true"]')
    act(() => button!.click())
    expect(store().popoutNext).toBeNull()
  })

  it("starts the lined-up video in the popout once the page is left", () => {
    clickRowPopout()

    act(() => pageRoot.unmount())
    pageMounted = false

    expect(store().theaterVideoId).toBeNull()
    expect(store().activeVideoId).toBe("rel-new")
    expect(store().isPlaying).toBe(true)
    expect(store().popoutNext).toBeNull()
    const iframe = document.body.querySelector("iframe")
    expect(iframe?.getAttribute("src")).toContain("rel-new")
  })
})
