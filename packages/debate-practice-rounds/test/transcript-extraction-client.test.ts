import { afterEach, describe, expect, it, vi } from "vitest";
import { requestTranscriptExtraction } from "../src/round/transcript-extraction-client";
import type { TranscriptExtractionAiInput } from "../src/round/transcript-extraction-ai";

const INPUT: TranscriptExtractionAiInput = {
  speech: "1AC",
  transcriptText: "The plan solves warming because it cuts emissions.",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestTranscriptExtraction", () => {
  it("posts to /api/reason-ai with the rendered prompt and returns the parsed arguments", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        text: JSON.stringify({ arguments: [{ claim: "The plan solves warming." }] }),
      }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const extracted = await requestTranscriptExtraction(INPUT);

    expect(extracted).toEqual([{ claim: "The plan solves warming." }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/reason-ai");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages[0].content).toContain("Speech: 1AC");
    expect(body.messages[0].content).toContain("cuts emissions");
    expect(body.maxTokens).toBe(2048);
  });

  it("posts to a caller-supplied endpoint override", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: JSON.stringify({ arguments: [{ claim: "Claim." }] }) }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await requestTranscriptExtraction(INPUT, "/custom-endpoint");

    expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("/custom-endpoint");
  });

  it("throws the server's error message when the request fails", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "Sign in to use AI features." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestTranscriptExtraction(INPUT)).rejects.toThrow("Sign in to use AI features.");
  });

  it("falls back to a status-code message when the error body isn't JSON", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("not json");
      },
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestTranscriptExtraction(INPUT)).rejects.toThrow(
      "Transcript extraction AI request failed (502).",
    );
  });

  it("throws when the response text has no usable extracted arguments", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: "not json" }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestTranscriptExtraction(INPUT)).rejects.toThrow(
      "AI returned no usable extracted arguments.",
    );
  });
});
