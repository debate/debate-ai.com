import { afterEach, describe, expect, it, vi } from "vitest";
import { requestCaseChoiceEvaluation } from "../src/round/case-choice-client";
import type { CaseChoiceAiInput } from "../src/round/case-choice-ai";

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
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: VALID_REPLY_TEXT }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestCaseChoiceEvaluation(INPUT);

    expect(result.recommendedCase).toBe("Kritik case");
    expect(result.caseAssessments).toEqual([{ name: "Kritik case", assessment: "Safest available option." }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/reason-ai");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages[0].content).toContain("Kritik case");
    expect(body.maxTokens).toBe(1024);
  });

  it("posts to a caller-supplied endpoint override", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: VALID_REPLY_TEXT }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await requestCaseChoiceEvaluation(INPUT, "/custom-endpoint");

    expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("/custom-endpoint");
  });

  it("throws the server's error message when the request fails", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "Sign in to use AI features." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestCaseChoiceEvaluation(INPUT)).rejects.toThrow("Sign in to use AI features.");
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

    await expect(requestCaseChoiceEvaluation(INPUT)).rejects.toThrow(
      "AI case-choice evaluation request failed (502).",
    );
  });

  it("throws when the response text can't be parsed as an evaluation", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: "not valid json" }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestCaseChoiceEvaluation(INPUT)).rejects.toThrow(
      "AI returned a response that couldn't be parsed as a case-choice evaluation.",
    );
  });
});
