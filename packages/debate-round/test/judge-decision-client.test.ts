import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "debate-api-client";
import { requestJudgeDecision } from "../src/round/judge-decision-client";
import type { JudgeDecisionAiInput } from "../src/round/judge-decision-ai";
import { judgeParadigms } from "debate-speech-writer/src/judge/judge-paradigms";
import { mockFetchError, mockFetchJson } from "./helpers/mock-api-fetch";

const INPUT: JudgeDecisionAiInput = {
  paradigm: judgeParadigms.policymaker,
  flowSummaryText: "1AC: Plan solves warming.",
  sideNames: { primary: "Affirmative", secondary: "Negative" },
};

const VALID_REPLY_TEXT = JSON.stringify({
  winner: "primary",
  keyVotingIssues: ["Net benefits"],
  rationale: "The aff wins net benefits over the status quo.",
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestJudgeDecision", () => {
  it("posts to /api/reason-ai and returns the parsed decision", async () => {
    const fetchMock = mockFetchJson({ text: VALID_REPLY_TEXT });

    const result = await requestJudgeDecision(INPUT);

    expect(result.winner).toBe("primary");
    expect(result.keyVotingIssues).toEqual(["Net benefits"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/reason-ai");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages[0].content).toContain("Policymaker");
    expect(body.maxTokens).toBe(1024);
  });

  it("posts through a caller-supplied client override", async () => {
    const fetchMock = mockFetchJson({ text: VALID_REPLY_TEXT });
    const client = createClient({ baseUrl: "/custom-endpoint" });

    await requestJudgeDecision(INPUT, client);

    expect(fetchMock.mock.calls[0][0]).toBe("/custom-endpoint/reason-ai");
  });

  it("throws when the request fails", async () => {
    mockFetchError(401, "Unauthorized");

    await expect(requestJudgeDecision(INPUT)).rejects.toThrow("AI judge decision request failed.");
  });

  it("throws when the response text can't be parsed as a decision", async () => {
    mockFetchJson({ text: "not valid json" });

    await expect(requestJudgeDecision(INPUT)).rejects.toThrow(
      "AI returned a response that couldn't be parsed as a judge decision.",
    );
  });
});
