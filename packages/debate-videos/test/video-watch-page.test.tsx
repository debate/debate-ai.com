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
const { resetRevealedDecisions } = await import("../src/hooks/useDecisionReveal")
const { resetRoundDecisions } = await import("../src/hooks/useRoundDecision")
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

  it("pops out at the video's saved second, not 0, when toggled before any playback report arrives", () => {
    // Moving the iframe into the PiP window forces it to reload, so the embed
    // is rebuilt from `resumeSeconds` — seeded from `currentTimeRef` at the
    // moment of the toggle. Only `infoDelivery` broadcasts ever advance that
    // ref past its initial value, so toggling PiP in the gap before the first
    // one arrives must not lose the second the video actually opened at.
    Object.defineProperty(window, "documentPictureInPicture", {
      configurable: true,
      value: { window: null, requestWindow: () => new Promise<Window>(() => {}) },
    })
    saveVideoTimestamp(VIDEO_ID, 128)
    mount()

    // No `reportPlaybackTime` here — the embed's first `infoDelivery`
    // broadcast never arrives before PiP is toggled.
    const pipButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Pop out picture-in-picture"]',
    )
    expect(pipButton).not.toBeNull()
    act(() => {
      pipButton!.click()
    })

    const src = container.querySelector("iframe")?.getAttribute("src") ?? ""
    expect(new URL(src).searchParams.get("start")).toBe("128")

    unmount()
    Reflect.deleteProperty(window, "documentPictureInPicture")
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

    expect(push).toHaveBeenCalledWith(videoWatchHref("Round 4"))

    unmount()
  })
})

describe("VideoWatchPage fullscreen", () => {
  it("fullscreens the video wrapper alone, not the surrounding title/description stage", () => {
    // jsdom has no real Fullscreen API — record which element each call was
    // made on so the test can tell "the video" from "the whole left column".
    const requestedOn: HTMLElement[] = []
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: function requestFullscreen(this: HTMLElement) {
        requestedOn.push(this)
        return Promise.resolve()
      },
    })

    mount()

    const videoWrapper = container.querySelector("iframe")!.parentElement as HTMLElement
    const stage = videoWrapper.parentElement as HTMLElement

    const fullscreenButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Fullscreen"]',
    )
    expect(fullscreenButton).not.toBeNull()
    act(() => {
      fullscreenButton!.click()
    })

    expect(requestedOn).toEqual([videoWrapper])
    expect(requestedOn).not.toContain(stage)

    unmount()
    Reflect.deleteProperty(HTMLElement.prototype, "requestFullscreen")
  })
})

describe("VideoWatchPage round badge", () => {
  const roundVideo = (level: string) =>
    [VIDEO_ID, "Round", "2022-03-25", "NDT", 1234, "A debate round.", 1, "Harvard", level] as unknown as VideoType

  it("stacks the bracket size over the round name, directly under the tournament", () => {
    mount(createElement(VideoWatchPage, { video: roundVideo("Quarters") }))
    const top = [...container.querySelectorAll("span")].find((el) => el.textContent === "Top 8")
    expect(top).toBeTruthy()
    expect(top!.nextElementSibling?.textContent).toBe("Quarters")
    const column = top!.closest("div.flex-col")!
    expect(column.className).toContain("gap-0")
    expect(column.firstElementChild?.tagName).toBe("BUTTON")
    expect(column.children).toHaveLength(2)
    unmount()
  })

  it("keeps a final on a single row", () => {
    mount(createElement(VideoWatchPage, { video: roundVideo("Finals") }))
    const spans = [...container.querySelectorAll("span")]
    expect(spans.some((el) => el.textContent === "Final")).toBe(true)
    expect(spans.some((el) => /^Top \d+$/.test(el.textContent ?? ""))).toBe(false)
    unmount()
  })
});

describe("VideoWatchPage reveal decision", () => {
  const SPOILER_TEAM = "Kentucky AB";
  const round = (affWin: boolean | null, decision: string | null) =>
    [VIDEO_ID, "Round", "2022-03-25", "NDT", 1234, "A debate round.", 1, "Harvard", "Finals", "Harker LL", SPOILER_TEAM, affWin, decision] as unknown as VideoType;
  const lecture = [VIDEO_ID, "Lecture", "2022-03-25", "NDT", 1234, "A lecture.", "Kritiks"] as unknown as VideoType;

  let decisionRequests: string[];
  function stubDecision(body: unknown) {
    decisionRequests = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.startsWith("/api/videos/decision")) {
          decisionRequests.push(url);
          return new Response(JSON.stringify(body), { status: 200 });
        }
        throw new Error("offline");
      }),
    );
  }
  const scales = () => container.querySelector<HTMLButtonElement>('[aria-label="Reveal decision"]');
  const click = async (el: HTMLElement) => {
    await act(async () => {
      el.click();
    });
  };

  beforeEach(() => {
    resetRevealedDecisions();
    resetRoundDecisions();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("offers the scales button on a round with no stored decision, and asks nothing until it is clicked", async () => {
    stubDecision({ status: "unknown", source: null, affWin: null, decision: null, judges: [], url: null });
    mount(createElement(VideoWatchPage, { video: round(null, null) }));
    expect(scales()).not.toBeNull();
    expect(container.querySelector('[data-testid="watch-decision"]')).toBeNull();
    expect(decisionRequests).toEqual([]);
    unmount();
  });

  it("shows ? when no result can be found", async () => {
    stubDecision({ status: "unknown", source: null, affWin: null, decision: null, judges: [], url: null });
    mount(createElement(VideoWatchPage, { video: round(null, null) }));
    await click(scales()!);
    expect(decisionRequests).toEqual([`/api/videos/decision?id=${VIDEO_ID}`]);
    expect(container.querySelector('[data-testid="decision-unknown"]')?.textContent).toContain("?");
    expect(container.querySelector('[data-testid="decision-summary"]')).toBeNull();
    unmount();
  });

  it("shows a looked-up decision with each judge's vote, and rings the winner", async () => {
    stubDecision({
      status: "known",
      source: "tabroom",
      affWin: false,
      decision: "2-1",
      judges: [
        { name: "Ann Lee", side: "neg", squirreled: false },
        { name: "Bo Kim", side: "neg", squirreled: false },
        { name: "Cy Diaz", side: "aff", squirreled: true },
      ],
      url: "https://www.tabroom.com/index/tourn/results/round_results.mhtml?tourn_id=1&round_id=2",
    });
    mount(createElement(VideoWatchPage, { video: round(null, null) }));
    await click(scales()!);
    const text = container.querySelector('[data-testid="watch-decision"]')?.textContent ?? "";
    expect(text).toContain(`${SPOILER_TEAM} (Neg)`);
    expect(text).toContain("2-1");
    const names = (side: string) =>
      [...container.querySelectorAll(`[data-testid="decision-judges-${side}"] li`)].map((li) => li.textContent);
    expect(names("neg")).toEqual(["Ann Lee", "Bo Kim"]);
    expect(names("aff")).toEqual(["Cy Diaz*"]);
    expect(container.querySelector('a[href*="tabroom.com"]')?.textContent).toContain("Tabroom");
    const negBadge = container.querySelector<HTMLButtonElement>(`button[title="Negative: ${SPOILER_TEAM}"]`);
    expect(negBadge?.className).toContain("border-amber-400");
    unmount();
  });

  it("uses the stored decision right away and the server only for the judges", async () => {
    stubDecision({
      status: "known",
      source: "stored",
      affWin: true,
      decision: "3-0 Aff",
      judges: [{ name: "Ann Lee", side: "aff", squirreled: false }],
      url: null,
    });
    mount(createElement(VideoWatchPage, { video: round(true, "3-0 Aff") }));
    expect(container.textContent).not.toContain("3-0");
    await click(scales()!);
    expect(container.querySelector('[data-testid="decision-summary"]')?.textContent).toBe("Harker LL (Aff)  3-0");
    expect(container.querySelector('[data-testid="decision-judges"]')?.textContent).toContain("Ann Lee");
    expect(container.querySelector('[data-testid="decision-judges-aff"]')?.textContent).toContain("Ann Lee");
    unmount();
  });

  it("is not offered on a lecture", () => {
    stubDecision({});
    mount(createElement(VideoWatchPage, { video: lecture }));
    expect(scales()).toBeNull();
    unmount();
  });
});
