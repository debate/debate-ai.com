import { afterEach, describe, expect, it, vi } from "vitest";
import { requestJudgeDecision } from "../src/round/judge-decision-client";
import type { JudgeDecisionAiInput } from "debate-round/src/round/judge-decision-ai";
import { judgeParadigms } from "debate-speech-writer/src/judge/judge-paradigms";

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
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: VALID_REPLY_TEXT }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestJudgeDecision(INPUT);

    expect(result.winner).toBe("primary");
    expect(result.keyVotingIssues).toEqual(["Net benefits"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/reason-ai");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages[0].content).toContain("Policymaker");
    expect(body.maxTokens).toBe(1024);
  });

  it("posts to a caller-supplied endpoint override", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: VALID_REPLY_TEXT }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await requestJudgeDecision(INPUT, "/custom-endpoint");

    expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("/custom-endpoint");
  });

  it("throws the server's error message when the request fails", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "Sign in to use AI features." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestJudgeDecision(INPUT)).rejects.toThrow("Sign in to use AI features.");
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

    await expect(requestJudgeDecision(INPUT)).rejects.toThrow("AI judge decision request failed (502).");
  });

  it("throws when the response text can't be parsed as a decision", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: "not valid json" }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestJudgeDecision(INPUT)).rejects.toThrow(
      "AI returned a response that couldn't be parsed as a judge decision.",
    );
  });
});
