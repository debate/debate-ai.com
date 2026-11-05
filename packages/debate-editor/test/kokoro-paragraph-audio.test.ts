import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cachedAudioProblem,
  concatWavs,
  encodePcm16Wav,
  isKokoroAudioKey,
  kokoroAudioCacheKey,
  parseWav,
} from "../src/editor/kokoro-audio-key";
import {
  kokoroParagraphAudio,
  siteKokoroAudioCache,
  speechParagraphs,
  streamKokoroParagraphs,
  type KokoroAudioCache,
  type ParagraphProgress,
} from "../src/editor/kokoro-paragraph-audio";

/** A 32-bit float mono WAV like Kokoro's `toBlob()`. */
function floatWav(samples: number[], rate = 24000): Blob {
  const bytes = new Uint8Array(44 + samples.length * 4);
  const view = new DataView(bytes.buffer);
  const write = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  write(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 4, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 3, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 32, true);
  write(36, "data");
  view.setUint32(40, samples.length * 4, true);
  samples.forEach((s, i) => view.setFloat32(44 + i * 4, s, true));
  return new Blob([bytes], { type: "audio/wav" });
}

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

function fakeModel() {
  const generate = vi.fn(async (text: string) => ({ toBlob: () => floatWav(Array(text.length).fill(0.5)) }));
  return { generate, load: async () => ({ generate }) };
}

function memoryCache(seed: Record<string, Blob> = {}) {
  const store = new Map(Object.entries(seed));
  const cache: KokoroAudioCache & { puts: string[] } = {
    puts: [],
    get: vi.fn(async (text: string, voice: string) => store.get(`${voice}|${text}`) ?? null),
    put: vi.fn(async (text: string, voice: string, audio: Blob) => {
      cache.puts.push(text);
      store.set(`${voice}|${text}`, audio);
    }),
  };
  return cache;
}

afterEach(() => vi.unstubAllGlobals());

describe("kokoroAudioCacheKey", () => {
  it("hashes voice and text (whitespace-insensitive) to 64 hex characters", async () => {
    const a = await kokoroAudioCacheKey("Warming  is\nreal.", "af_heart");
    expect(a && isKokoroAudioKey(a)).toBe(true);
    expect(await kokoroAudioCacheKey(" Warming is real. ", "af_heart")).toBe(a);
    expect(await kokoroAudioCacheKey("Warming is real.", "am_puck")).not.toBe(a);
  });
});

describe("concatWavs", () => {
  it("joins Kokoro's float clips into one mono 16-bit WAV", async () => {
    const joined = await concatWavs([floatWav([0, 1]), floatWav([-1, 0.5, 2])]);
    const wav = parseWav(await bytesOf(joined!))!;
    expect(wav).toMatchObject({ format: 1, channels: 1, sampleRate: 24000, bitsPerSample: 16 });
    const view = new DataView(wav.data.buffer, wav.data.byteOffset, wav.data.byteLength);
    expect(Array.from({ length: 5 }, (_, i) => view.getInt16(i * 2, true))).toEqual([0, 32767, -32768, 16384, 32767]);
  });

  it("gives null for clips it can't join", async () => {
    expect(await concatWavs([new Blob(["nope"])])).toBeNull();
    expect(await concatWavs([floatWav([0], 24000), floatWav([0], 22050)])).toBeNull();
    expect(await concatWavs([])).toBeNull();
  });
});

describe("cachedAudioProblem", () => {
  it("accepts a plausible mono 16-bit WAV and refuses anything else", () => {
    const ok = encodePcm16Wav(new Int16Array(24000), 24000);
    expect(cachedAudioProblem(ok, "A sentence that takes about a second.")).toBeNull();
    expect(cachedAudioProblem(new Uint8Array([1, 2, 3]), "x")).toMatch(/WAV/);
    const long = encodePcm16Wav(new Int16Array(24000 * 60), 24000);
    expect(cachedAudioProblem(long, "Hi.")).toMatch(/longer/);
  });
});

describe("speechParagraphs", () => {
  it("splits at lines and cuts long lines at sentences", () => {
    expect(speechParagraphs("One.\n\nTwo.")).toEqual(["One.", "Two."]);
    expect(speechParagraphs("Aaa. Bbb. Ccc.", 9)).toEqual(["Aaa. Bbb.", "Ccc."]);
  });
});

describe("kokoroParagraphAudio", () => {
  it("serves a cached paragraph without loading the model", async () => {
    const hit = new Blob(["cached"], { type: "audio/wav" });
    const cache = memoryCache({ "af_heart|Smith 24.": hit });
    const load = vi.fn();
    const progress: Array<[number, boolean]> = [];
    const out = await kokoroParagraphAudio("Smith 24.", "af_heart", {
      cache,
      load,
      onProgress: (f, c) => progress.push([f, c]),
    });
    expect(out).toBe(hit);
    expect(load).not.toHaveBeenCalled();
    expect(progress.at(-1)).toEqual([1, true]);
  });

  it("makes a missed paragraph piece by piece with a rising percentage, then uploads one WAV", async () => {
    const cache = memoryCache();
    const { generate, load } = fakeModel();
    const text = `${"word ".repeat(70)}end. ${"more ".repeat(70)}done.`;
    const fractions: number[] = [];
    const out = await kokoroParagraphAudio(text, "af_heart", { cache, load, onProgress: (f) => fractions.push(f) });
    expect(generate.mock.calls.length).toBeGreaterThan(1);
    expect(fractions[0]).toBe(0);
    expect(fractions.at(-1)).toBe(1);
    expect([...fractions].sort((a, b) => a - b)).toEqual(fractions);
    expect(parseWav(await bytesOf(out!))?.bitsPerSample).toBe(16);
    await Promise.resolve();
    expect(cache.puts).toEqual([text.replace(/\s+/g, " ").trim()]);
  });
});

describe("streamKokoroParagraphs", () => {
  it("yields one clip per paragraph with progress per paragraph, mixing cache hits and fresh ones", async () => {
    const hit = new Blob(["cached"], { type: "audio/wav" });
    const cache = memoryCache({ "af_heart|Second.": hit });
    const { generate, load } = fakeModel();
    const progress: ParagraphProgress[] = [];
    const out: Blob[] = [];
    for await (const clip of streamKokoroParagraphs("First.\nSecond.\nThird.", "af_heart", {
      cache,
      load,
      onProgress: (p) => progress.push(p),
    })) {
      out.push(clip);
    }
    expect(out).toHaveLength(3);
    expect(out[1]).toBe(hit);
    expect(generate.mock.calls.map((c) => c[0])).toEqual(["First.", "Third."]);
    expect(progress.filter((p) => p.fraction === 1).map((p) => [p.index, p.count, p.cached])).toEqual([
      [0, 3, false],
      [1, 3, true],
      [2, 3, false],
    ]);
    await Promise.resolve();
    expect(cache.puts).toEqual(["First.", "Third."]);
  });

  it("stops quietly once aborted", async () => {
    const abort = new AbortController();
    const { load } = fakeModel();
    const out: Blob[] = [];
    for await (const clip of streamKokoroParagraphs("One.\nTwo.\nThree.", "af_heart", {
      cache: null,
      load,
      signal: abort.signal,
    })) {
      out.push(clip);
      abort.abort();
    }
    expect(out).toHaveLength(1);
  });
});

describe("siteKokoroAudioCache", () => {
  it("reads by key for anyone and stops uploading after a signed-out 401", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") return new Response("{}", { status: 401 });
      return url.includes("key=")
        ? new Response("wav", { headers: { "content-type": "audio/wav" } })
        : new Response("", { status: 400 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const cache = siteKokoroAudioCache("/api/tts/cache");
    const got = await cache.get("Hello.", "af_heart");
    expect(got).not.toBeNull();
    const key = await kokoroAudioCacheKey("Hello.", "af_heart");
    expect(fetchMock.mock.calls[0]![0]).toBe(`/api/tts/cache?key=${key}`);
    await cache.put("Hello.", "af_heart", new Blob(["a"]));
    await cache.put("Again.", "af_heart", new Blob(["b"]));
    expect(fetchMock.mock.calls.filter((c) => c[1]?.method === "POST")).toHaveLength(1);
  });

  it("treats a 404 as a miss", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    expect(await siteKokoroAudioCache().get("Hello.", "af_heart")).toBeNull();
  });
});
