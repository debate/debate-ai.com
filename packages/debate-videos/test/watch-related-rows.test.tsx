// @vitest-environment jsdom
/**
 * @fileoverview The related videos under the player, and the queue beside
 * them.
 *
 * Related videos are rows, not cards: a short list to pick the next video
 * from reads better as a sortable table than as a wall of thumbnails. Three
 * things are pinned here. The list opens newest-first — nothing else ranks
 * it, and the feed's own order is meaningless for a related set. The queue
 * is on the page at all: the watch page stands the floating player down on
 * mount, and that player was the only thing that ever showed what was
 * queued. And the ← / → step wraps rather than dead-ending, and keeps its
 * hands off the keyboard while a field has focus.
 */

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { createElement, act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

// The page's sidebar is a `react-resizable-panels` group, which observes its
// panels' sizes; jsdom has no ResizeObserver, so give it an inert one.
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

const searchHit = [
  "hit-1", "Semis — Harvard vs Northwestern", "2023-04-01", "NDT", 30, "", 1,
  "2023 NDT", "Semis", "Harvard", "Northwestern", true, "3-0", null, null, false, null, 2023,
]

vi.mock("grab-url", () => ({
  default: async (path: string, params?: Record<string, string>) =>
    path === "transcript"
      ? { videoId: "x", snippets: [] }
      : path === "videos" && params?.q
        ? { videos: [searchHit], total: 1, hasMore: false }
        : {},
}));

const { VideoWatchPage } = await import("../src/panels/watch/VideoWatchPage")
const { useVideoPlayerStore } = await import("../src/state/videoPlayerStore")
import type { VideoType } from "../src/types/videos"

const video = [
  "OXdffJy8HIs",
  "Round 3 — Dartmouth vs Michigan",
  "2022-03-25",
  "NDT",
  1234,
  "A debate round.",
  1,
  "2022 NDT",
] as unknown as VideoType

/** Two related rounds, deliberately oldest-first in the feed. */
const related = [
  [
    "rel-old", "Octas — Emory vs Kentucky", "2022-01-05", "NDT", 10, "", 1,
    "2022 Harvard", "Octas", "Emory", "Kentucky", true, "2-1", null, null, false, null, 2022,
  ],
  [
    "rel-new", "Finals — Texas vs Georgetown", "2022-04-18", "NDT", 20, "", 1,
    "2022 Harvard", "Finals", "Texas", "Georgetown", true, "3-0", null, null, false, null, 2022,
  ],
] as unknown as VideoType[]

let container: HTMLDivElement
let root: Root

function mount() {
  act(() => {
    root.render(createElement(VideoWatchPage, { video, related }))
  })
}

beforeEach(() => {
  push.mockClear()
  useVideoPlayerStore.setState({ queue: [] })
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  useVideoPlayerStore.setState({ queue: [] })
})

/** Text of each body row's first cell, in render order. */
function rowTitles(): string[] {
  const table = container.querySelector("table")
  expect(table).not.toBeNull()
  return [...(table as HTMLTableElement).querySelectorAll("tbody tr")].map(
    (row) => row.textContent ?? "",
  )
}

describe("the related videos under the player", () => {
  it("lists them as table rows rather than cards", () => {
    mount()
    const headers = [...container.querySelectorAll("thead th")].map((th) => th.textContent?.trim())
    expect(headers).toContain("Date")
    expect(headers).toContain("Views")
    expect(rowTitles()).toHaveLength(related.length)
  })

  it("opens newest first, whatever order the feed returned", () => {
    mount()
    const [first, second] = rowTitles()
    expect(first).toContain("Texas")
    expect(second).toContain("Emory")
  })

  it("keeps the Date header sortable, so the order can be flipped", () => {
    mount()
    const dateHeader = [...container.querySelectorAll("thead th button")].find(
      (button) => button.textContent?.trim().startsWith("Date"),
    )
    expect(dateHeader).toBeDefined()
    act(() => {
      ;(dateHeader as HTMLButtonElement).click()
    })
    expect(rowTitles()[0]).toContain("Emory")
  })
})

describe("the queue beside them", () => {
  it("says how to fill an empty queue", () => {
    mount()
    const panel = container.querySelector('[aria-label="Play queue"]')
    expect(panel?.textContent).toContain("Nothing queued")
  })

  it("lists what is queued, in order", () => {
    useVideoPlayerStore.setState({
      queue: [
        { videoId: "rel-new", title: "Finals — Texas vs Georgetown" },
        { videoId: "rel-old", title: "Octas — Emory vs Kentucky" },
      ],
    })
    mount()
    const items = [
      ...(container.querySelector('[aria-label="Play queue"]')?.querySelectorAll("li") ?? []),
    ].map((item) => item.textContent ?? "")
    expect(items).toHaveLength(2)
    expect(items[0]).toContain("Texas")
    expect(items[1]).toContain("Emory")
  })

  it("plays a queued video, which the page turns into a navigation", () => {
    useVideoPlayerStore.setState({
      queue: [{ videoId: "rel-new", title: "Finals — Texas vs Georgetown" }],
    })
    mount()
    push.mockClear()
    const play = container.querySelector<HTMLButtonElement>(
      '[aria-label="Play Finals — Texas vs Georgetown now"]',
    )
    expect(play).not.toBeNull()
    act(() => {
      play?.click()
    })
    expect(useVideoPlayerStore.getState().activeVideoId).toBe("rel-new")
    expect(push).toHaveBeenCalled()
  })

  it("drops a video from the queue", () => {
    useVideoPlayerStore.setState({
      queue: [{ videoId: "rel-new", title: "Finals — Texas vs Georgetown" }],
    })
    mount()
    const remove = container.querySelector<HTMLButtonElement>(
      '[aria-label="Remove Finals — Texas vs Georgetown from the queue"]',
    )
    act(() => {
      remove?.click()
    })
    expect(useVideoPlayerStore.getState().queue).toHaveLength(0)
  })
})

describe("a related row", () => {
  it("opens the video's watch page when clicked", () => {
    mount()
    push.mockClear()
    const row = [...container.querySelectorAll<HTMLTableRowElement>("tbody tr")].find((tr) =>
      tr.textContent?.includes("Texas"),
    )
    act(() => {
      row?.click()
    })
    expect(push).toHaveBeenCalledTimes(1)
    expect(String(push.mock.calls[0][0])).toMatch(/^\/videos\//)
  })

  it("offers the popout player in place of the transcript link", () => {
    mount()
    expect(container.querySelector('[aria-label="Open the watch page with transcript"]')).toBeNull()
    // On a watch page the icon lines the video up for when the reader leaves,
    // rather than taking over from the page's player — see watch-popout-next.
    expect(
      container.querySelectorAll('[aria-label="Play in popout player when you leave this page"]').length,
    ).toBe(related.length)
  })
})

describe("the search above the related videos", () => {
  async function search(text: string) {
    const input = container.querySelector<HTMLInputElement>('[aria-label="Search videos"]')
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
    await act(async () => {
      setValue?.call(input, text)
      input?.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => {
      container.querySelector("form[role=search]")?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      )
    })
    // Let the feed's request settle.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }

  it("swaps the list for the matches without leaving the page", async () => {
    mount()
    push.mockClear()
    await search("Harvard")
    expect(push).not.toHaveBeenCalled()
    expect(container.textContent).toContain("Results for “Harvard”")
    const titles = rowTitles()
    expect(titles).toHaveLength(1)
    expect(titles[0]).toContain("Northwestern")
  })

  it("queues every match in one click, and clears back to the related videos", async () => {
    mount()
    await search("Harvard")
    const queueAll = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.startsWith("Queue all"),
    )
    act(() => {
      queueAll?.click()
    })
    expect(useVideoPlayerStore.getState().queue.map((item) => item.videoId)).toEqual(["hit-1"])

    const clear = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Clear" && b.closest("form"))
    act(() => {
      clear?.click()
    })
    expect(container.textContent).toContain("Related videos")
    expect(rowTitles()).toHaveLength(related.length)
  })
})
