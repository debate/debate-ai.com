import { afterEach, describe, expect, it, vi } from "vitest";
import { requestJudgeDecision } from "../src/round/judge-decision-client";
import type { JudgeDecisionAiInput } from "../src/round/judge-decision-ai";
import { judgeParadigms } from "debate-speech-writer/src/judge/judge-paradigms";

const INPUT: JudgeDecisionAiInput = {
  paradigm: judgeParadigms.flow,
  flowSummaryText: "1AC: Warming is real (unanswered since 1AC)",
  sideLabels: ["Affirmative", "Negative"],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestJudgeDecision", () => {
  it("posts to /api/reason-ai and returns the parsed verdict", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        text: JSON.stringify({
          winner: "Affirmative",
          reasoning: ["Dropped disad outweighs."],
          ballotText: "Aff wins on the flow.",
        }),
      }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const verdict = await requestJudgeDecision(INPUT);

    expect(verdict.winner).toBe("Affirmative");
    expect(verdict.ballotText).toBe("Aff wins on the flow.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/reason-ai");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages[0].content).toContain('"Affirmative"');
    expect(body.maxTokens).toBe(768);
  });

  it("posts to a caller-supplied endpoint override", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        text: JSON.stringify({
          winner: "Negative",
          reasoning: ["Reason."],
          ballotText: "Ballot.",
        }),
      }),
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

    await expect(requestJudgeDecision(INPUT)).rejects.toThrow(
      "AI judge decision request failed (502).",
    );
  });

  it("throws when the response text doesn't parse into a valid verdict", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: "not json at all" }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestJudgeDecision(INPUT)).rejects.toThrow(
      "AI returned a response that couldn't be parsed as a judge decision.",
    );
  });
});
