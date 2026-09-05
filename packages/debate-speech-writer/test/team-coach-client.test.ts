import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "debate-api-client";
import { requestTeamCoachAnswer } from "../src/coach/team-coach-client";
import type { CoachMaterialMatch } from "../src/coach/team-coach-materials";
import { mockFetchError, mockFetchJson } from "./helpers/mock-api-fetch";

const MATCHES: CoachMaterialMatch[] = [
  {
    material: {
      id: "m1",
      kind: "lecture_transcript",
      title: "Topicality Basics",
      tags: ["theory"],
      text: "A topicality violation needs an interpretation, violation, standards, and voters.",
    },
    relevance: 1,
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestTeamCoachAnswer", () => {
  it("posts to /api/reason-ai with the grounded prompt and returns the parsed answer", async () => {
    const fetchMock = mockFetchJson({ text: "Answer a T violation by reading your interpretation and standards." });

    const answer = await requestTeamCoachAnswer("How do I answer a topicality violation?", MATCHES);

    expect(answer).toBe("Answer a T violation by reading your interpretation and standards.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/reason-ai");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages[0].content).toContain("How do I answer a topicality violation?");
    expect(body.messages[0].content).toContain("Topicality Basics");
    expect(body.maxTokens).toBe(2048);
  });

  it("sends prior conversation turns as alternating user/assistant messages before the grounded prompt", async () => {
    const fetchMock = mockFetchJson({ text: "A follow-up answer." });

    await requestTeamCoachAnswer("What about a counter-interp?", MATCHES, {
      history: [{ id: "t1", question: "What is topicality?", answer: "A voting issue.", askedAt: 0 }],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.messages).toEqual([
      { role: "user", content: "What is topicality?" },
      { role: "assistant", content: "A voting issue." },
      { role: "user", content: expect.stringContaining("What about a counter-interp?") },
    ]);
  });

  it("posts through a caller-supplied client override", async () => {
    const fetchMock = mockFetchJson({ text: "An answer." });
    const client = createClient({ baseUrl: "/custom-endpoint" });

    await requestTeamCoachAnswer("A question?", MATCHES, {}, client);

    expect(fetchMock.mock.calls[0][0]).toBe("/custom-endpoint/reason-ai");
  });

  it("throws when the request fails", async () => {
    mockFetchError(401, "Unauthorized");

    await expect(requestTeamCoachAnswer("A question?", MATCHES)).rejects.toThrow("Team coach AI request failed.");
  });

  it("throws when the response text is empty or unusable", async () => {
    mockFetchJson({ text: "   " });

    await expect(requestTeamCoachAnswer("A question?", MATCHES)).rejects.toThrow(
      "AI returned an empty or unusable answer.",
    );
  });
});
