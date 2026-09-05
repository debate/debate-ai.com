import { afterEach, describe, expect, it } from "vitest";
import { createClient } from "debate-api-client";
import { requestAiVersusSpeech } from "../src/round/ai-versus-speech-client";
import type { AiSpeechRequest } from "../src/round/ai-versus-speech-order";
import { mockFetchError, mockFetchJson } from "./helpers/mock-api-fetch";
import { vi } from "vitest";

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
    const fetchMock = mockFetchJson({ text: "  Contention one: warming is real.  " });

    const speech = await requestAiVersusSpeech(REQUEST);

    expect(speech).toBe("Contention one: warming is real.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/reason-ai");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages[0].content).toContain('"1AC"');
    expect(body.maxTokens).toBe(2048);
  });

  it("posts through a caller-supplied client override", async () => {
    const fetchMock = mockFetchJson({ text: "A speech." });
    const client = createClient({ baseUrl: "/custom-endpoint" });

    await requestAiVersusSpeech(REQUEST, client);

    expect(fetchMock.mock.calls[0][0]).toBe("/custom-endpoint/reason-ai");
  });

  it("throws when the request fails", async () => {
    mockFetchError(401, "Unauthorized");

    await expect(requestAiVersusSpeech(REQUEST)).rejects.toThrow("AI speech request failed.");
  });

  it("throws when the response text parses to an empty speech", async () => {
    mockFetchJson({ text: "   " });

    await expect(requestAiVersusSpeech(REQUEST)).rejects.toThrow(
      "AI returned an empty or unusable speech.",
    );
  });
});
