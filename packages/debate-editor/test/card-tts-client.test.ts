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
    const blob = (await fetchModelSpeech("Smith 24", voice, { browserKokoro: null })) as Blob | null;
    expect(blob?.size).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/tts");
    expect(JSON.parse(init.body as string)).toEqual({ text: "Smith 24", provider: "kokoro", voice: "af_heart" });
  });

  it("goes to QwkSearch from the browser when the site is rate limited", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(429)).mockResolvedValueOnce(audio());
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchModelSpeech("hi", voice, { browserKokoro: null })).not.toBeNull();
    expect(fetchMock.mock.calls[1]?.[0]).toBe(DEFAULT_QWKSEARCH_VOICE_URL);
  });

  it("returns null when every route fails, so the browser voice reads", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(429)).mockResolvedValueOnce(json(429)));
    expect(await fetchModelSpeech("hi", voice, { browserKokoro: null })).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(503)));
    expect(await fetchModelSpeech("hi", voice, { browserKokoro: null })).toBeNull();
  });
});

describe("fetchModelSpeech with Kokoro in the browser", () => {
  const voice = { provider: "kokoro" as const, voice: "af_heart" };
  const clip = (n: number) => new Blob([new Uint8Array(n)], { type: "audio/wav" });

  async function collect(audio: unknown): Promise<number[]> {
    const sizes: number[] = [];
    for await (const b of audio as AsyncIterable<Blob>) sizes.push(b.size);
    return sizes;
  }

  it("streams the browser model's clips and never calls a server", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const browserKokoro = vi.fn(async function* () {
      yield clip(1);
      yield clip(2);
    });
    const audio = await fetchModelSpeech("Smith 24. Warming.", voice, { browserKokoro });
    expect(browserKokoro).toHaveBeenCalledWith("Smith 24. Warming.", "af_heart", undefined);
    expect(await collect(audio)).toEqual([1, 2]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to the site when the browser model fails to load", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn(async () => audio());
    vi.stubGlobal("fetch", fetchMock);
    // eslint-disable-next-line require-yield
    const browserKokoro = async function* (): AsyncGenerator<Blob> {
      throw new Error("download failed");
    };
    const result = await fetchModelSpeech("hi", voice, { browserKokoro });
    expect((result as Blob).size).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("leaves Deepgram voices to the servers", async () => {
    const fetchMock = vi.fn(async () => audio());
    vi.stubGlobal("fetch", fetchMock);
    const browserKokoro = vi.fn();
    await fetchModelSpeech("hi", { provider: "deepgram", voice: "aura-orion-en" }, { browserKokoro });
    expect(browserKokoro).not.toHaveBeenCalled();
  });
});
