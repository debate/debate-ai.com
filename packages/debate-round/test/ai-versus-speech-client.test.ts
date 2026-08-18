import { afterEach, describe, expect, it, vi } from "vitest";
import { requestAiVersusSpeech } from "../src/round/ai-versus-speech-client";
import type { AiSpeechRequest } from "../src/round/ai-versus-speech-order";

const REQUEST: AiSpeechRequest = {
  slot: { index: 0, name: "1AC", secondary: false, time: 360, speaker: "ai" },
  priorSpeeches: [],
  isCrossExamination: false,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestAiVersusSpeech", () => {
  it("posts to /api/reason-ai and returns the parsed speech text", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: "  Contention one: warming is real.  " }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const speech = await requestAiVersusSpeech(REQUEST);

    expect(speech).toBe("Contention one: warming is real.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/reason-ai");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages[0].content).toContain('"1AC"');
    expect(body.maxTokens).toBe(2048);
  });

  it("posts to a caller-supplied endpoint override", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: "A speech." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await requestAiVersusSpeech(REQUEST, { endpoint: "/custom-endpoint" });

    expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("/custom-endpoint");
  });

  it("folds a caller-supplied persona prompt section into the request", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: "A speech." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await requestAiVersusSpeech(REQUEST, { personaPromptSection: "Opponent Persona: Kritik" });

    const [, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages[0].content).toContain("Opponent Persona: Kritik");
  });

  it("omits any persona prompt section when none is supplied", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: "A speech." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await requestAiVersusSpeech(REQUEST);

    const [, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages[0].content).not.toContain("Opponent Persona");
  });

  it("throws the server's error message when the request fails", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "Sign in to use AI features." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestAiVersusSpeech(REQUEST)).rejects.toThrow("Sign in to use AI features.");
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

    await expect(requestAiVersusSpeech(REQUEST)).rejects.toThrow("AI speech request failed (502).");
  });

  it("throws when the response text parses to an empty speech", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: "   " }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestAiVersusSpeech(REQUEST)).rejects.toThrow(
      "AI returned an empty or unusable speech.",
    );
  });
});
