import { describe, expect, it, vi } from "vitest";
import { speechChunks, streamKokoroSpeech } from "../src/editor/kokoro-browser-tts";

describe("speechChunks", () => {
  it("keeps short text whole and packs sentences up to the limit", () => {
    expect(speechChunks("  Warming   causes extinction. ")).toEqual(["Warming causes extinction."]);
    expect(speechChunks("One two. Three four. Five six.", 20)).toEqual(["One two. Three four.", "Five six."]);
  });

  it("cuts unpunctuated highlighted text at words, never over the limit", () => {
    const text = Array.from({ length: 200 }, (_, i) => `word${i}`).join(" ");
    const chunks = speechChunks(text, 100);
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks.every((c) => c.length <= 100)).toBe(true);
    expect(chunks.join(" ")).toBe(text);
  });

  it("prefers commas inside a long sentence", () => {
    expect(speechChunks("alpha beta gamma, delta epsilon zeta, eta theta", 20)).toEqual([
      "alpha beta gamma,",
      "delta epsilon zeta,",
      "eta theta",
    ]);
  });

  it("gives nothing for empty text", () => {
    expect(speechChunks("   ")).toEqual([]);
  });
});

describe("streamKokoroSpeech", () => {
  it("generates one clip per chunk in the chosen voice and stops on abort", async () => {
    const generate = vi.fn(async (text: string) => ({ toBlob: () => new Blob([text]) }));
    const load = vi.fn(async () => ({ generate }));
    const abort = new AbortController();
    const seen: string[] = [];
    const text = Array.from({ length: 120 }, (_, i) => `w${i}`).join(" ");
    for await (const blob of streamKokoroSpeech(text, "af_bella", abort.signal, load)) {
      seen.push(await blob.text());
      abort.abort();
    }
    expect(seen).toHaveLength(1);
    expect(generate).toHaveBeenCalledWith(expect.any(String), { voice: "af_bella" });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not load the model for empty text", async () => {
    const load = vi.fn();
    for await (const _ of streamKokoroSpeech("", "af_heart", undefined, load)) void _;
    expect(load).not.toHaveBeenCalled();
  });
});
