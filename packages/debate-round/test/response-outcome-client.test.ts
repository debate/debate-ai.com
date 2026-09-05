import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "debate-api-client";
import { requestCounselPanelAssessment } from "../src/flow/response-outcome-client";
import type { CounselPanelAiInput } from "../src/flow/response-outcome-ai";
import { mockFetchError, mockFetchJson } from "./helpers/mock-api-fetch";

const INPUT: CounselPanelAiInput = {
  arguments: [
    {
      rowIndex: 0,
      argument: "The plan solves warming.",
      originSpeech: "1AC",
      isUnanswered: true,
      vulnerabilityScore: 80,
    },
  ],
};

const VALID_REPLY_TEXT = JSON.stringify({
  argumentAssessments: [
    {
      rowIndex: 0,
      counselRole: "Policy Counsel",
      likelyResponsePath: "Negative reads a solvency deficit.",
      clashEstimate: "Clash on mechanism feasibility.",
    },
  ],
  overallClashSummary: "Clash concentrates on solvency.",
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestCounselPanelAssessment", () => {
  it("posts to /api/reason-ai and returns the parsed assessment", async () => {
    const fetchMock = mockFetchJson({ text: VALID_REPLY_TEXT });

    const result = await requestCounselPanelAssessment(INPUT);

    expect(result.overallClashSummary).toBe("Clash concentrates on solvency.");
    expect(result.argumentAssessments[0]?.counselRole).toBe("Policy Counsel");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/reason-ai");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages[0].content).toContain("rowIndex 0");
    expect(body.maxTokens).toBe(1536);
  });

  it("posts through a caller-supplied client override", async () => {
    const fetchMock = mockFetchJson({ text: VALID_REPLY_TEXT });
    const client = createClient({ baseUrl: "/custom-endpoint" });

    await requestCounselPanelAssessment(INPUT, client);

    expect(fetchMock.mock.calls[0][0]).toBe("/custom-endpoint/reason-ai");
  });

  it("throws when the request fails", async () => {
    mockFetchError(401, "Unauthorized");

    await expect(requestCounselPanelAssessment(INPUT)).rejects.toThrow("AI counsel-panel request failed.");
  });

  it("throws when the response text can't be parsed as an assessment", async () => {
    mockFetchJson({ text: "not valid json" });

    await expect(requestCounselPanelAssessment(INPUT)).rejects.toThrow(
      "AI returned a response that couldn't be parsed as a counsel-panel assessment.",
    );
  });
});
