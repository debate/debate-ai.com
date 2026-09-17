/**
 * @fileoverview The two failure modes that made the Worker's video sync
 * unusable, pinned so they cannot come back.
 *
 * 1. **The key was read at import.** This client is shared with the CLI,
 *    where `process.env.YOUTUBE_API_KEY` is set before anything imports
 *    anything. Inside the Worker the key arrives on the request's `env`
 *    binding and `process.env` is empty at module scope, so every request
 *    went out unauthenticated — on a deployment whose admin page had just
 *    checked the key was configured.
 * 2. **A failed request looked like an empty one.** `grab` resolves with an
 *    `error` field rather than rejecting, so reading `data.items` straight
 *    through turned an auth failure into "YouTube returned no videos" — a
 *    resync that marked the whole library missing and logged nothing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Requests the mocked client has seen, newest last. */
const requests: Array<{ path: string; params: Record<string, any> }> = [];

/** What the next request resolves with. */
let nextResponse: any = { items: [] };

vi.mock("grab-url", () => {
  const request = (path: string, params: Record<string, any>) => {
    requests.push({ path, params });
    return Promise.resolve(nextResponse);
  };
  return { default: { instance: () => request } };
});

const { fetchVideoStatuses, fetchViewCounts, setYouTubeApiKey, YouTubeApiError } = await import(
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

describe("the API key", () => {
  it("is sent with every request, from whatever the host handed over", async () => {
    setYouTubeApiKey("worker-binding-key");
    await fetchViewCounts(["dQw4w9WgXcQ"]);

    expect(requests).toHaveLength(1);
    expect(requests[0].params.key).toBe("worker-binding-key");
  });

  it("is read per request, so a key set after import is still used", async () => {
    // The Worker cannot set this before the module loads; it sets it when a
    // request arrives. Baking it in at import is the original bug.
    setYouTubeApiKey(null);
    setYouTubeApiKey("late-key");
    await fetchViewCounts(["dQw4w9WgXcQ"]);

    expect(requests[0].params.key).toBe("late-key");
  });

  it("refuses to make a request at all when there is no key", async () => {
    setYouTubeApiKey(null);
    const previous = process.env.YOUTUBE_API_KEY;
    delete process.env.YOUTUBE_API_KEY;

    await expect(fetchViewCounts(["dQw4w9WgXcQ"])).rejects.toBeInstanceOf(YouTubeApiError);
    expect(requests).toHaveLength(0);

    if (previous !== undefined) process.env.YOUTUBE_API_KEY = previous;
  });
});

describe("a failed request", () => {
  it("throws rather than reading through as an empty result", async () => {
    nextResponse = { error: "The request cannot be completed because you have exceeded your quota." };

    await expect(fetchViewCounts(["dQw4w9WgXcQ"])).rejects.toThrow(/quota/);
  });

  it("surfaces the API's own error message", async () => {
    nextResponse = { error: { message: "API key not valid" } };

    await expect(fetchVideoStatuses(["dQw4w9WgXcQ"])).rejects.toThrow("API key not valid");
  });
});

describe("fetchViewCounts", () => {
  it("reads counts off a JSON body spread onto the response root", async () => {
    nextResponse = {
      items: [
        { id: "dQw4w9WgXcQ", statistics: { viewCount: "4821" } },
        { id: "abcdefghijk", statistics: {} },
      ],
    };

    const counts = await fetchViewCounts(["dQw4w9WgXcQ", "abcdefghijk"]);

    // A video whose statistics the API withheld keeps the count it has,
    // rather than being written back as zero views.
    expect(counts).toEqual({ dQw4w9WgXcQ: 4821 });
  });

  it("batches by fifty", async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `id${String(i).padStart(8, "0")}`);
    await fetchViewCounts(ids);

    expect(requests).toHaveLength(3);
    expect(requests[0].params.id.split(",")).toHaveLength(50);
    expect(requests[2].params.id.split(",")).toHaveLength(20);
  });
});

describe("fetchVideoStatuses", () => {
  it("reports the ids the API did not return as missing", async () => {
    nextResponse = {
      items: [
        {
          id: "dQw4w9WgXcQ",
          statistics: { viewCount: "10" },
          status: { privacyStatus: "public", uploadStatus: "processed", embeddable: true },
        },
      ],
    };

    const { statuses, missing } = await fetchVideoStatuses(["dQw4w9WgXcQ", "takenDownXX"]);

    expect(statuses.dQw4w9WgXcQ).toMatchObject({
      viewCount: 10,
      privacyStatus: "public",
      embeddable: true,
    });
    // The only signal a deleted video gives is not coming back.
    expect(missing).toEqual(["takenDownXX"]);
  });

  it("asks for statistics and status in one request", async () => {
    await fetchVideoStatuses(["dQw4w9WgXcQ"]);
    expect(requests[0].params.part).toBe("statistics,status");
  });
});
