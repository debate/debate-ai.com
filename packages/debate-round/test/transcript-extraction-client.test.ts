import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "debate-api-client";
import { requestTranscriptExtraction } from "../src/round/transcript-extraction-client";
import type { TranscriptExtractionAiInput } from "../src/round/transcript-extraction-ai";
import { mockFetchError, mockFetchJson } from "./helpers/mock-api-fetch";

const INPUT: TranscriptExtractionAiInput = {
  speech: "1AC",
  transcriptText: "The plan solves warming because it cuts emissions.",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestTranscriptExtraction", () => {
  it("posts to /api/reason-ai with the rendered prompt and returns the parsed arguments", async () => {
    const fetchMock = mockFetchJson({
      text: JSON.stringify({ arguments: [{ claim: "The plan solves warming." }] }),
    });

    const extracted = await requestTranscriptExtraction(INPUT);

    expect(extracted).toEqual([{ claim: "The plan solves warming." }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/reason-ai");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages[0].content).toContain("Speech: 1AC");
    expect(body.messages[0].content).toContain("cuts emissions");
    expect(body.maxTokens).toBe(2048);
  });

  it("posts through a caller-supplied client override", async () => {
    const fetchMock = mockFetchJson({ text: JSON.stringify({ arguments: [{ claim: "Claim." }] }) });
    const client = createClient({ baseUrl: "/custom-endpoint" });

    await requestTranscriptExtraction(INPUT, client);

    expect(fetchMock.mock.calls[0][0]).toBe("/custom-endpoint/reason-ai");
  });

  it("throws when the request fails", async () => {
    mockFetchError(401, "Unauthorized");

    await expect(requestTranscriptExtraction(INPUT)).rejects.toThrow("Transcript extraction AI request failed.");
  });

  it("throws when the response text has no usable extracted arguments", async () => {
    mockFetchJson({ text: "not json" });

    await expect(requestTranscriptExtraction(INPUT)).rejects.toThrow(
      "AI returned no usable extracted arguments.",
    );
  });
});
