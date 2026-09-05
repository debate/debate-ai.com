import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "debate-api-client";
import { requestCoachFeedback } from "../src/round/coach-feedback-client";
import type { CoachFeedbackAiInput } from "../src/round/coach-feedback-ai";
import { mockFetchError, mockFetchJson } from "./helpers/mock-api-fetch";

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
    const fetchMock = mockFetchJson({ text: "Lead with the solvency deficit — it's the round's biggest lever." });

    const feedback = await requestCoachFeedback(INPUT);

    expect(feedback).toBe("Lead with the solvency deficit — it's the round's biggest lever.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/reason-ai");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages[0].content).toContain("Side being coached: AFF");
    expect(body.messages[0].content).toContain("Solvency deficit");
    expect(body.maxTokens).toBe(2048);
  });

  it("posts through a caller-supplied client override", async () => {
    const fetchMock = mockFetchJson({ text: "Feedback." });
    const client = createClient({ baseUrl: "/custom-endpoint" });

    await requestCoachFeedback(INPUT, client);

    expect(fetchMock.mock.calls[0][0]).toBe("/custom-endpoint/reason-ai");
  });

  it("throws when the request fails", async () => {
    mockFetchError(401, "Unauthorized");

    await expect(requestCoachFeedback(INPUT)).rejects.toThrow("Coach feedback AI request failed.");
  });

  it("throws when the response text is empty or unusable", async () => {
    mockFetchJson({ text: "   " });

    await expect(requestCoachFeedback(INPUT)).rejects.toThrow(
      "AI returned an empty or unusable feedback response.",
    );
  });
});
