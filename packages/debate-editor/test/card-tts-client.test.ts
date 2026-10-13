import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_QWKSEARCH_VOICE_URL,
  fetchModelSpeech,
  readVoiceChoice,
} from "../src/editor/card-tts-client";

const audio = () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "audio/wav" } });
const json = (status: number) =>
  new Response(JSON.stringify({ error: "x" }), { status, headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("readVoiceChoice", () => {
  it("defaults to Kokoro and keeps known choices", () => {
    expect(readVoiceChoice(null)).toEqual({ provider: "kokoro", voice: "af_heart" });
    expect(readVoiceChoice("nope")).toEqual({ provider: "kokoro", voice: "af_heart" });
    expect(readVoiceChoice("deepgram:aura-orion-en")).toEqual({ provider: "deepgram", voice: "aura-orion-en" });
    expect(readVoiceChoice("browser")).toBe("browser");
  });
});

describe("fetchModelSpeech", () => {
  const voice = { provider: "kokoro" as const, voice: "af_heart" };

  it("returns the site's audio and sends provider and voice", async () => {
    const fetchMock = vi.fn(async () => audio());
    vi.stubGlobal("fetch", fetchMock);
    const blob = await fetchModelSpeech("Smith 24", voice);
    expect(blob?.size).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/tts");
    expect(JSON.parse(init.body as string)).toEqual({ text: "Smith 24", provider: "kokoro", voice: "af_heart" });
  });

  it("goes to QwkSearch from the browser when the site is rate limited", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(429)).mockResolvedValueOnce(audio());
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchModelSpeech("hi", voice)).not.toBeNull();
    expect(fetchMock.mock.calls[1]?.[0]).toBe(DEFAULT_QWKSEARCH_VOICE_URL);
  });

  it("returns null when every route fails, so the browser voice reads", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(429)).mockResolvedValueOnce(json(429)));
    expect(await fetchModelSpeech("hi", voice)).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(503)));
    expect(await fetchModelSpeech("hi", voice)).toBeNull();
  });
});
