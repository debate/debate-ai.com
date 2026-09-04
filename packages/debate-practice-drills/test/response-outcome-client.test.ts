import { afterEach, describe, expect, it, vi } from "vitest";
import { requestCounselPanelAssessment } from "../src/flow/response-outcome-client";
import type { CounselPanelAiInput } from "../src/flow/response-outcome-ai";

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
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: VALID_REPLY_TEXT }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestCounselPanelAssessment(INPUT);

    expect(result.overallClashSummary).toBe("Clash concentrates on solvency.");
    expect(result.argumentAssessments[0]?.counselRole).toBe("Policy Counsel");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/reason-ai");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages[0].content).toContain("rowIndex 0");
    expect(body.maxTokens).toBe(1536);
  });

  it("posts to a caller-supplied endpoint override", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: VALID_REPLY_TEXT }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await requestCounselPanelAssessment(INPUT, "/custom-endpoint");

    expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("/custom-endpoint");
  });

  it("throws the server's error message when the request fails", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "Sign in to use AI features." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestCounselPanelAssessment(INPUT)).rejects.toThrow("Sign in to use AI features.");
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

    await expect(requestCounselPanelAssessment(INPUT)).rejects.toThrow(
      "AI counsel-panel request failed (502).",
    );
  });

  it("throws when the response text can't be parsed as an assessment", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: "not valid json" }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestCounselPanelAssessment(INPUT)).rejects.toThrow(
      "AI returned a response that couldn't be parsed as a counsel-panel assessment.",
    );
  });
});
