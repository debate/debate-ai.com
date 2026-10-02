/**
 * @fileoverview `parseIsoDuration` and `fetchVideoDurations`: YouTube reports
 * lengths as ISO 8601 durations, and an id it does not return must come back
 * as missing rather than as a zero-length video.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requests: Array<{ path: string; params: Record<string, any> }> = [];
let nextResponse: any = { items: [] };

vi.mock("grab-url", () => {
  const request = (path: string, params: Record<string, any>) => {
    requests.push({ path, params });
    return Promise.resolve(nextResponse);
  };
  return { default: { instance: () => request } };
});

const { fetchVideoDurations, parseIsoDuration, setYouTubeApiKey } = await import(
  "../src/youtube/youtube-api"
);

beforeEach(() => {
  requests.length = 0;
  nextResponse = { items: [] };
  setYouTubeApiKey("test-key");
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  setYouTubeApiKey(null);
  vi.restoreAllMocks();
});

describe("parseIsoDuration", () => {
  it.each([
    ["PT1H2M3S", 3723],
    ["PT45M", 2700],
    ["PT59S", 59],
    ["P1DT2H", 93600],
    ["P1W", 604800],
    ["P0D", 0],
    ["PT1.6S", 2],
  ])("reads %s as %d seconds", (iso, seconds) => {
    expect(parseIsoDuration(iso)).toBe(seconds);
  });

  it.each([[""], [null], [undefined], ["1:02:03"], ["PTXS"]])("returns null for %s", (iso) => {
    expect(parseIsoDuration(iso as any)).toBeNull();
  });
});

describe("fetchVideoDurations", () => {
  it("asks only for contentDetails and reports ids YouTube skipped", async () => {
    nextResponse = {
      items: [
        { id: "a", contentDetails: { duration: "PT1H" } },
        { id: "b", contentDetails: { duration: "PT90S" } },
      ],
    };

    const { durations, missing } = await fetchVideoDurations(["a", "b", "gone"]);

    expect(requests[0].params.part).toBe("contentDetails");
    expect(durations).toEqual({ a: 3600, b: 90 });
    expect(missing).toEqual(["gone"]);
  });

  it("batches ids by 50", async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `v${i}`);
    await fetchVideoDurations(ids);
    expect(requests).toHaveLength(3);
    expect(requests[2].params.id.split(",")).toHaveLength(20);
  });

  it("throws when YouTube declines the request", async () => {
    nextResponse = { error: { message: "quotaExceeded" } };
    await expect(fetchVideoDurations(["a"])).rejects.toThrow("quotaExceeded");
  });
});
