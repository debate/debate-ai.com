import { afterEach, describe, expect, it, vi } from "vitest";
import { requestCoachFeedback } from "../src/round/coach-feedback-client";
import type { CoachFeedbackAiInput } from "../src/round/coach-feedback-ai";

const INPUT: CoachFeedbackAiInput = {
  sideKey: "AFF",
  prompts: [
    {
      kind: "refutation",
      rowIndex: 0,
      prompt: 'Answer "Solvency deficit" before it\'s extended against you.',
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestCoachFeedback", () => {
  it("posts to /api/reason-ai with the rendered prompts and returns the parsed feedback", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: "Lead with the solvency deficit — it's the round's biggest lever." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const feedback = await requestCoachFeedback(INPUT);

    expect(feedback).toBe("Lead with the solvency deficit — it's the round's biggest lever.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/reason-ai");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages[0].content).toContain("Side being coached: AFF");
    expect(body.messages[0].content).toContain("Solvency deficit");
    expect(body.maxTokens).toBe(2048);
  });

  it("posts to a caller-supplied endpoint override", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: "Feedback." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await requestCoachFeedback(INPUT, "/custom-endpoint");

    expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("/custom-endpoint");
  });

  it("throws the server's error message when the request fails", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "Sign in to use AI features." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestCoachFeedback(INPUT)).rejects.toThrow("Sign in to use AI features.");
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

    await expect(requestCoachFeedback(INPUT)).rejects.toThrow("Coach feedback AI request failed (502).");
  });

  it("throws when the response text is empty or unusable", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: "   " }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestCoachFeedback(INPUT)).rejects.toThrow(
      "AI returned an empty or unusable feedback response.",
    );
  });
});
