/**
 * @fileoverview `/api/transcript` never answers with a 5xx, and files a video
 * with no captions for the admin Reports panel — but not one YouTube is only
 * bot-checking.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchYouTubeTranscript = vi.fn();
const readCachedTranscript = vi.fn();
const writeCachedTranscript = vi.fn();
const flagMissingTranscript = vi.fn();

vi.mock("@/lib/youtube/transcript", async () => {
  class TranscriptUnavailableError extends Error {
    constructor(videoId: string, reason: string) {
      super(`No transcript available for ${videoId}: ${reason}`);
      this.name = "TranscriptUnavailableError";
    }
  }
  return { fetchYouTubeTranscript, TranscriptUnavailableError };
});
vi.mock("@/lib/youtube/transcript-cache", () => ({ readCachedTranscript, writeCachedTranscript }));
vi.mock("@/lib/youtube/transcript-needed", () => ({ flagMissingTranscript }));

const { GET } = await import("@/app/api/transcript/route");
const { TranscriptUnavailableError } = await import("@/lib/youtube/transcript");

const VIDEO = "Afl7_hl-H0c";
const request = (videoId = VIDEO) => new Request(`https://d.ebate.app/api/transcript?videoId=${videoId}`);

describe("GET /api/transcript", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    readCachedTranscript.mockResolvedValue(null);
    writeCachedTranscript.mockResolvedValue(undefined);
    flagMissingTranscript.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("serves a fetched transcript", async () => {
    fetchYouTubeTranscript.mockResolvedValue([{ text: "Hi", start: 0, duration: 1 }]);
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect((await res.json()).snippets).toHaveLength(1);
    expect(flagMissingTranscript).not.toHaveBeenCalled();
  });

  it("answers 200 and flags a video with no captions", async () => {
    fetchYouTubeTranscript.mockRejectedValue(new TranscriptUnavailableError(VIDEO, "no caption tracks"));
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ snippets: [], unavailable: "No transcript available for this video" });
    expect(flagMissingTranscript).toHaveBeenCalledWith(VIDEO, "YouTube has no captions for this video.");
  });

  it("does not flag a bot check, which comes and goes", async () => {
    fetchYouTubeTranscript.mockRejectedValue(new TranscriptUnavailableError(VIDEO, "Sign in to confirm you're not a bot"));
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect((await res.json()).unavailable).toMatch(/temporarily blocking/);
    expect(flagMissingTranscript).not.toHaveBeenCalled();
  });

  it("flags a fetch that failed for another reason", async () => {
    fetchYouTubeTranscript.mockRejectedValue(new Error("socket hang up"));
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(flagMissingTranscript).toHaveBeenCalledWith(VIDEO, expect.stringContaining("socket hang up"));
  });

  it("answers 200 even when something the layers below should have caught throws", async () => {
    readCachedTranscript.mockRejectedValue(new Error("D1 is down"));
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect((await res.json()).snippets).toEqual([]);
  });

  it("re-wraps an edge-cache hit so its headers can be written", async () => {
    // The Cache API hands back immutable headers; returning that Response
    // as-is is what 500'd once Next.js tried to set a header on it.
    const cached = new Response(JSON.stringify({ videoId: VIDEO, snippets: [{ text: "x", start: 0, duration: 1 }] }), {
      headers: { "content-type": "application/json" },
    });
    vi.stubGlobal("caches", { default: { match: vi.fn(async () => cached), put: vi.fn(async () => {}) } });
    const res = await GET(request());
    expect(res).not.toBe(cached);
    expect(() => res.headers.set("x-test", "1")).not.toThrow();
    expect((await res.json()).snippets).toHaveLength(1);
    expect(fetchYouTubeTranscript).not.toHaveBeenCalled();
  });

  it("still rejects a malformed id", async () => {
    const res = await GET(request("nope"));
    expect(res.status).toBe(400);
  });
});
