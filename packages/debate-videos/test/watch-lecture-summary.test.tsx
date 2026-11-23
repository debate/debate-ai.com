// @vitest-environment jsdom
/**
 * @fileoverview A lecture's LLM summary tab: first beside the player, written
 * on the first open when nobody has one, shared back, and read from the
 * shared store when someone already wrote it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { WatchSidePanel } from "../src/components/videos/watch/WatchSidePanel";
import { resetSharedVideoAi } from "../src/state/sharedVideoAi";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const VIDEO = "dQw4w9WgXcQ";
const sentences = [
  { text: "Today we cover line by line refutation.", start: 0, duration: 4 },
  { text: "Answer every argument in order.", start: 4, duration: 4 },
];

function mockFetch(sharedSummary: string | null) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes("/api/video-ai-results")) {
      if ((init?.method ?? "GET") === "GET") {
        return new Response(JSON.stringify({ summaries: sharedSummary ? { lecture: sharedSummary } : {} }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }
    return new Response(JSON.stringify({ text: "- **Line by line**\n  - answer every arg in order" }), { status: 200 });
  });
}

describe("WatchSidePanel lecture LLM summary", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    resetSharedVideoAi();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  async function render() {
    await act(async () => {
      root.render(
        createElement(WatchSidePanel, {
          sentences,
          captionsLoading: false,
          currentTime: 0,
          onSeek: () => {},
          videoId: VIDEO,
          videoTitle: "Refutation lecture",
          speeches: [],
        }),
      );
    });
    // Let the shared lookup and the AI reply settle.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  const tabs = () => Array.from(container.querySelectorAll('[aria-label="Beside this video"] [role="tab"]'));

  it("opens on the LLM summary, writes it on first open and shares it", async () => {
    const fetchMock = mockFetch(null);
    vi.stubGlobal("fetch", fetchMock);
    await render();
    expect(tabs().map((tab) => tab.querySelector("span")?.textContent)).toEqual(["LLM summary", "Captions"]);
    expect(tabs()[0].getAttribute("aria-selected")).toBe("true");
    expect(container.textContent).toContain("Line by line");

    const calls = fetchMock.mock.calls.map(([url, init]) => [String(url), (init as RequestInit | undefined)?.method ?? "GET"]);
    const ai = fetchMock.mock.calls.filter(([url]) => !String(url).includes("/api/video-ai-results"));
    expect(ai).toHaveLength(1);
    expect(String((ai[0][1] as RequestInit).body)).toContain("Answer every argument in order.");
    // Offered back to the shared store, under the lecture key.
    const share = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes("/api/video-ai-results") && (init as RequestInit | undefined)?.method === "POST",
    );
    expect(calls.length).toBeGreaterThan(1);
    expect(JSON.parse(String((share![1] as RequestInit).body))).toMatchObject({ videoId: VIDEO, kind: "summary", key: "lecture" });
  });

  it("shows the shared summary without asking the AI again", async () => {
    const fetchMock = mockFetch("- **Already written**");
    vi.stubGlobal("fetch", fetchMock);
    await render();
    expect(container.textContent).toContain("Already written");
    expect(fetchMock.mock.calls.filter(([url]) => !String(url).includes("/api/video-ai-results"))).toHaveLength(0);
  });
});
