import { describe, expect, it, vi } from "vitest";
import { createSharedFetch } from "../src/lib/shared-fetch";

describe("createSharedFetch", () => {
  it("shares one request between calls inside the fresh window", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => "page");
    const fetchShared = createSharedFetch(fetcher, 1_000);
    await Promise.all([fetchShared(), fetchShared()]);
    vi.advanceTimersByTime(500);
    await fetchShared();
    expect(fetcher).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(600);
    await fetchShared();
    expect(fetcher).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("starts a new request when forced or after reset", async () => {
    const fetcher = vi.fn(async () => "page");
    const fetchShared = createSharedFetch(fetcher, 60_000);
    await fetchShared();
    await fetchShared(true);
    fetchShared.reset();
    await fetchShared();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
