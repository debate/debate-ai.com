/**
 * @fileoverview Audio extraction for caption-less videos: the media API call,
 * the Whisper call and its size guard, and the admin route's access check and
 * caption write-back.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env: Record<string, string | undefined> = {};
const getStaffAccess = vi.fn();
const writeCachedTranscript = vi.fn();

vi.mock("@/lib/env", () => ({ getEnv: (key: string) => env[key] }));
vi.mock("@/lib/auth/admin", () => ({ getStaffAccess }));
vi.mock("@/lib/youtube/transcript-cache", () => ({ writeCachedTranscript }));

const {
  audioServiceUrl,
  fetchVideoAudio,
  getAudioExtractStatus,
  segmentsToSnippets,
  transcribeAudio,
  AudioExtractError,
  MAX_TRANSCRIPTION_BYTES,
} = await import("@/lib/youtube/audio-extract");
const route = await import("@/app/api/admin/videos/library/[id]/audio/route");

const VIDEO = "Afl7_hl-H0c";
const params = (id = VIDEO) => ({ params: Promise.resolve({ id }) });
const nextRequest = (url: string, init?: RequestInit) => new Request(url, init) as never;

const WHISPER = {
  text: "Thank you judge. First contention.",
  segments: [
    { start: 0, end: 2.345, text: " Thank you judge." },
    { start: 2.345, end: 5, text: " First contention." },
    { start: 5, end: 6, text: "  " },
  ],
};

describe("audio-extract", () => {
  beforeEach(() => {
    for (const key of Object.keys(env)) delete env[key];
    vi.spyOn(console, "error").mockImplementation(() => {});
    getStaffAccess.mockResolvedValue({ canEditContent: true });
    writeCachedTranscript.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("builds the media API's audio URL", () => {
    expect(audioServiceUrl("https://media.example", VIDEO, { format: "mp3", bitrate: 32, mono: true, rate: 16000 })).toBe(
      `https://media.example/audio?v=${VIDEO}&format=mp3&bitrate=32&mono=1&rate=16000`,
    );
  });

  it("reports which halves are configured, naming no secret", () => {
    expect(getAudioExtractStatus()).toEqual({ audioService: false, transcription: null });
    env.YOUTUBE_AUDIO_SERVICE_URL = "https://media.example/";
    env.OPENAI_API_KEY = "sk-openai";
    expect(getAudioExtractStatus()).toEqual({
      audioService: true,
      transcription: { provider: "openai", model: "whisper-1" },
    });
    env.GROQ_API_KEY = "gsk-groq";
    expect(getAudioExtractStatus().transcription?.provider).toBe("groq");
  });

  it("refuses to fetch audio until the service is configured", async () => {
    await expect(fetchVideoAudio(VIDEO)).rejects.toMatchObject({ status: 501 });
  });

  it("sends the service key and surfaces the service's error", async () => {
    env.YOUTUBE_AUDIO_SERVICE_URL = "https://media.example/";
    env.YOUTUBE_AUDIO_SERVICE_KEY = "media-key";
    const fetchMock = vi.fn(async () => Response.json({ error: "Video dQw has no audio stream" }, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const error = await fetchVideoAudio(VIDEO).catch((e) => e);
    expect(error).toBeInstanceOf(AudioExtractError);
    expect(error).toMatchObject({ status: 404, message: expect.stringContaining("no audio stream") });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/media\.example\/audio\?/), {
      headers: { Authorization: "Bearer media-key" },
    });
  });

  it("turns Whisper segments into rounded caption snippets, dropping blank ones", () => {
    expect(segmentsToSnippets(WHISPER.segments)).toEqual([
      { text: "Thank you judge.", start: 0, duration: 2.35 },
      { text: "First contention.", start: 2.35, duration: 2.65 },
    ]);
  });

  it("rejects audio over the 25 MB limit before uploading", async () => {
    env.GROQ_API_KEY = "gsk";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const big = new Blob([new Uint8Array(MAX_TRANSCRIPTION_BYTES + 1)]);
    await expect(transcribeAudio(big, "a.mp3")).rejects.toMatchObject({ status: 413 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe("route", () => {
    it("is staff-only", async () => {
      getStaffAccess.mockResolvedValue({ canEditContent: false });
      const res = await route.POST(nextRequest("https://d.ebate.app/x", { method: "POST" }), params());
      expect(res.status).toBe(403);
    });

    it("rejects a malformed id and an unknown format", async () => {
      expect((await route.GET(nextRequest("https://d.ebate.app/x"), params("bad"))).status).toBe(400);
      expect((await route.GET(nextRequest("https://d.ebate.app/x?format=flac"), params())).status).toBe(400);
    });

    it("streams the audio download through with its file name", async () => {
      env.YOUTUBE_AUDIO_SERVICE_URL = "https://media.example";
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          new Response("MP3", {
            headers: { "content-type": "audio/mpeg", "content-disposition": 'attachment; filename="Round.mp3"' },
          }),
        ),
      );
      const res = await route.GET(nextRequest("https://d.ebate.app/x?format=mp3"), params());
      expect(res.status).toBe(200);
      expect(res.headers.get("content-disposition")).toContain("Round.mp3");
      expect(await res.text()).toBe("MP3");
    });

    it("transcribes, answers caption snippets and stores them as the video's captions", async () => {
      env.YOUTUBE_AUDIO_SERVICE_URL = "https://media.example";
      env.GROQ_API_KEY = "gsk";
      const fetchMock = vi.fn(async (url: string) =>
        url.startsWith("https://media.example")
          ? new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/mpeg" } })
          : Response.json(WHISPER),
      );
      vi.stubGlobal("fetch", fetchMock);

      const res = await route.POST(
        nextRequest("https://d.ebate.app/x", { method: "POST", body: JSON.stringify({ language: "EN" }) }),
        params(),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ videoId: VIDEO, provider: "groq", model: "whisper-large-v3-turbo" });
      expect(body.snippets).toHaveLength(2);
      expect(writeCachedTranscript).toHaveBeenCalledWith(VIDEO, "en", body.snippets);
      expect(fetchMock.mock.calls[0][0]).toContain("bitrate=32&mono=1&rate=16000");
      expect(fetchMock.mock.calls[1][0]).toBe("https://api.groq.com/openai/v1/audio/transcriptions");
    });

    it("answers 501 with the missing setting when nothing is configured", async () => {
      const res = await route.POST(nextRequest("https://d.ebate.app/x", { method: "POST" }), params());
      expect(res.status).toBe(501);
      expect((await res.json()).error).toContain("YOUTUBE_AUDIO_SERVICE_URL");
    });
  });
});
