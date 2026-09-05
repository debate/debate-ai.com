import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "debate-api-client";
import { requestCaseChoiceEvaluation } from "../src/round/case-choice-client";
import type { CaseChoiceAiInput } from "../src/round/case-choice-ai";
import { mockFetchError, mockFetchJson } from "./helpers/mock-api-fetch";

const INPUT: CaseChoiceAiInput = {
  caseRankings: [{ name: "Kritik case", argumentTags: ["kritik"], overlapScore: 1 }],
  judgeAdaptationNotes: ["No strong tendencies detected — adapt based on in-round reads."],
  riskLevel: "low",
  riskFactors: [],
};

const VALID_REPLY_TEXT = JSON.stringify({
  recommendedCase: "Kritik case",
  reasoning: "Lowest overlap and no notable risk factors.",
  caseAssessments: [{ name: "Kritik case", assessment: "Safest available option." }],
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestCaseChoiceEvaluation", () => {
  it("posts to /api/reason-ai and returns the parsed evaluation", async () => {
    const fetchMock = mockFetchJson({ text: VALID_REPLY_TEXT });

    const result = await requestCaseChoiceEvaluation(INPUT);

    expect(result.recommendedCase).toBe("Kritik case");
    expect(result.caseAssessments).toEqual([{ name: "Kritik case", assessment: "Safest available option." }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/reason-ai");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages[0].content).toContain("Kritik case");
    expect(body.maxTokens).toBe(1024);
  });

  it("posts through a caller-supplied client override", async () => {
    const fetchMock = mockFetchJson({ text: VALID_REPLY_TEXT });
    const client = createClient({ baseUrl: "/custom-endpoint" });

    await requestCaseChoiceEvaluation(INPUT, client);

    expect(fetchMock.mock.calls[0][0]).toBe("/custom-endpoint/reason-ai");
  });

  it("throws when the request fails", async () => {
    mockFetchError(401, "Unauthorized");

    await expect(requestCaseChoiceEvaluation(INPUT)).rejects.toThrow("AI case-choice evaluation request failed.");
  });

  it("throws when the response text can't be parsed as an evaluation", async () => {
    mockFetchJson({ text: "not valid json" });

    await expect(requestCaseChoiceEvaluation(INPUT)).rejects.toThrow(
      "AI returned a response that couldn't be parsed as a case-choice evaluation.",
    );
  });
});
