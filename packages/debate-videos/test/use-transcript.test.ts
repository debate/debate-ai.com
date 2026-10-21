// @vitest-environment jsdom
/**
 * @fileoverview The captions request behind the watch page's transcript and
 * "Detect speeches": it must reach the `/api/transcript` route.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { useTranscript } from "../src/components/videos/transcript/useTranscript";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => vi.unstubAllGlobals());

describe("useTranscript", () => {
  it("fetches /api/transcript and returns its snippets", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ videoId: "abcdefghijk", snippets: [{ text: "Hi.", start: 1, duration: 2 }] }), {
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    let result: ReturnType<typeof useTranscript> | null = null;
    function Probe() {
      result = useTranscript("abcdefghijk", true);
      return null;
    }
    const root = createRoot(document.createElement("div"));
    await act(async () => {
      root.render(createElement(Probe));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toMatch(/^\/api\/transcript\?/);
    expect(url).toContain("videoId=abcdefghijk");
    expect(result!.snippets).toEqual([{ text: "Hi.", start: 1, duration: 2 }]);
    act(() => root.unmount());
  });
});
