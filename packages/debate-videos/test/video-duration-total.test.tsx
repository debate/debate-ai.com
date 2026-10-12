// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { useVideoDurationTotal } from "../src/state/videoDurations";
import { flush, renderHook } from "./helpers/mount";

/** Lets the batched request go out and its response land. */
const settle = () => flush(() => new Promise((resolve) => setTimeout(resolve, 10)));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useVideoDurationTotal", () => {
  it("sums the stored lengths and skips videos without one", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ durations: { totalA: 3600, totalB: 300 } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const hook = await renderHook(() => useVideoDurationTotal(["totalA", "totalB", "totalC", "totalA"]));
    expect(hook.result.current).toBe(0);

    await settle();
    expect(hook.result.current).toBe(3900);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain(
      encodeURIComponent("totalA,totalB,totalC"),
    );
    await hook.unmount();
  });

  it("is zero for an empty list without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const hook = await renderHook(() => useVideoDurationTotal([]));
    await settle();

    expect(hook.result.current).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    await hook.unmount();
  });
});
