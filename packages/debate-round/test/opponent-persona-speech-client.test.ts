import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "debate-api-client";
import { opponentPersonas } from "debate-speech-writer/src/opponent/opponent-personas";
import { requestAiVersusSpeechWithPersona } from "../src/round/opponent-persona-speech-client";
import type { AiSpeechRequest } from "../src/round/ai-versus-speech-order";
import { mockFetchError, mockFetchJson } from "./helpers/mock-api-fetch";

const REQUEST: AiSpeechRequest = {
  slot: { index: 0, name: "1AC", secondary: false, time: 360, speaker: "ai" },
  priorSpeeches: [],
  isCrossExamination: false,
};

const PERSONA = opponentPersonas.kritik;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestAiVersusSpeechWithPersona", () => {
  it("posts to /api/reason-ai with a persona-conditioned system prompt and returns the parsed speech text", async () => {
    const fetchMock = mockFetchJson({ text: "  Framework comes first.  " });

    const speech = await requestAiVersusSpeechWithPersona(REQUEST, PERSONA);

    expect(speech).toBe("Framework comes first.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/reason-ai");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.system).toContain("Opponent Persona: Kritik");
    expect(body.messages[0].content).toContain('"1AC"');
    expect(body.maxTokens).toBe(2048);
  });

  it("posts through a caller-supplied client override", async () => {
    const fetchMock = mockFetchJson({ text: "A speech." });
    const client = createClient({ baseUrl: "/custom-endpoint" });

    await requestAiVersusSpeechWithPersona(REQUEST, PERSONA, client);

    expect(fetchMock.mock.calls[0][0]).toBe("/custom-endpoint/reason-ai");
  });

  it("throws when the request fails", async () => {
    mockFetchError(401, "Unauthorized");

    await expect(requestAiVersusSpeechWithPersona(REQUEST, PERSONA)).rejects.toThrow("AI speech request failed.");
  });

  it("throws when the response text parses to an empty speech", async () => {
    mockFetchJson({ text: "   " });

    await expect(requestAiVersusSpeechWithPersona(REQUEST, PERSONA)).rejects.toThrow(
      "AI returned an empty or unusable speech.",
    );
  });
});
