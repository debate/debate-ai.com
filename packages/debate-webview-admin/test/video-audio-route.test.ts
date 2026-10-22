// @vitest-environment node
/**
 * @fileoverview `/api/admin/videos/library/[id]/audio`: downloading a video's
 * audio and transcribing it. The extractor and the transcript cache are stood
 * in for; the route's own job is access, validation, the download headers and
 * mapping the extractor's errors to statuses.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN, access } from "./helpers/access";
import { params, request } from "./helpers/db";

vi.mock("@/lib/auth/session", async () => (await import("./helpers/access")).sessionMock);

const audio = vi.hoisted(() => ({
  fetchVideoAudio: vi.fn(),
  transcribeVideoAudio: vi.fn(),
  getAudioExtractStatus: vi.fn(),
  writeCachedTranscript: vi.fn(),
}));
vi.mock("@/lib/youtube/audio-extract", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchVideoAudio: audio.fetchVideoAudio,
  transcribeVideoAudio: audio.transcribeVideoAudio,
  getAudioExtractStatus: audio.getAudioExtractStatus,
}));
vi.mock("@/lib/youtube/transcript-cache", () => ({ writeCachedTranscript: audio.writeCachedTranscript }));

const { AudioExtractError } = await import("@/lib/youtube/audio-extract");
const route = await import("../src/api/admin/videos/library/[id]/audio");

const ID = "roundAAAAAA";
const ctx = params({ id: ID });

beforeEach(() => {
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  access.email = ADMIN;
  for (const stub of Object.values(audio)) stub.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET (download)", () => {
  it("reports the extractor's status", async () => {
    audio.getAudioExtractStatus.mockReturnValue({ configured: true });
    expect(await (await route.GET(request(`/x?status`), ctx)).json()).toEqual({ configured: true });
  });

  it("streams the audio with download headers", async () => {
    audio.fetchVideoAudio.mockResolvedValue(
      new Response("audio-bytes", { headers: { "content-type": "audio/mp4", "content-length": "11" } }),
    );
    const res = await route.GET(request(`/x?format=m4a`), ctx);
    expect(audio.fetchVideoAudio).toHaveBeenCalledWith(ID, { format: "m4a" });
    expect(res.headers.get("content-type")).toBe("audio/mp4");
    expect(res.headers.get("content-length")).toBe("11");
    expect(res.headers.get("content-disposition")).toBe(`attachment; filename="${ID}.m4a"`);
    expect(await res.text()).toBe("audio-bytes");
  });

  it("validates the id and format", async () => {
    expect((await route.GET(request(`/x`), params({ id: "bad" }))).status).toBe(400);
    expect((await route.GET(request(`/x?format=flac`), ctx)).status).toBe(400);
  });

  it("maps extractor errors to their status, and anything else to 500", async () => {
    audio.fetchVideoAudio.mockRejectedValue(new AudioExtractError("Extractor not configured", 503));
    const res = await route.GET(request(`/x`), ctx);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Extractor not configured" });

    audio.fetchVideoAudio.mockRejectedValue(new Error("socket hang up"));
    const crash = await route.GET(request(`/x`), ctx);
    expect(crash.status).toBe(500);
    expect((await crash.json()).details).toBe("socket hang up");
  });
});

describe("POST (transcribe)", () => {
  it("transcribes and caches the result in the requested language", async () => {
    const snippets = [{ text: "Thank you judge", start: 0, duration: 2 }];
    audio.transcribeVideoAudio.mockResolvedValue({ snippets, model: "whisper" });
    const res = await route.POST(request(`/x`, { method: "POST", body: { language: "ES" } }), ctx);
    expect(await res.json()).toEqual({ videoId: ID, snippets, model: "whisper" });
    expect(audio.transcribeVideoAudio).toHaveBeenCalledWith(ID, { language: "es" });
    expect(audio.writeCachedTranscript).toHaveBeenCalledWith(ID, "es", snippets);
  });

  it("defaults to English for a missing or odd language", async () => {
    audio.transcribeVideoAudio.mockResolvedValue({ snippets: [{ text: "x" }] });
    await route.POST(request(`/x`, { method: "POST", body: "nope" }), ctx);
    await route.POST(request(`/x`, { method: "POST", body: { language: "english!" } }), ctx);
    expect(audio.transcribeVideoAudio.mock.calls.map((call) => call[1])).toEqual([{ language: "en" }, { language: "en" }]);
  });

  it("refuses an empty transcription without caching it", async () => {
    audio.transcribeVideoAudio.mockResolvedValue({ snippets: [] });
    expect((await route.POST(request(`/x`, { method: "POST", body: {} }), ctx)).status).toBe(422);
    expect(audio.writeCachedTranscript).not.toHaveBeenCalled();
  });

  it("validates the id and maps failures", async () => {
    expect((await route.POST(request(`/x`, { method: "POST" }), params({ id: "bad" }))).status).toBe(400);
    audio.transcribeVideoAudio.mockRejectedValue(new AudioExtractError("Too long", 413));
    expect((await route.POST(request(`/x`, { method: "POST", body: {} }), ctx)).status).toBe(413);
  });
});

it("is staff-only", async () => {
  access.email = null;
  expect((await route.GET(request(`/x`), ctx)).status).toBe(403);
  expect((await route.POST(request(`/x`, { method: "POST" }), ctx)).status).toBe(403);
});
