import { afterEach, describe, expect, it, vi } from "vitest";
import { requestTeamCoachAnswer } from "../src/coach/team-coach-client";
import type { CoachMaterialMatch } from "../src/coach/team-coach-materials";

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
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: "Answer a T violation by reading your interpretation and standards." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const answer = await requestTeamCoachAnswer("How do I answer a topicality violation?", MATCHES);

    expect(answer).toBe("Answer a T violation by reading your interpretation and standards.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/reason-ai");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages[0].content).toContain("How do I answer a topicality violation?");
    expect(body.messages[0].content).toContain("Topicality Basics");
    expect(body.maxTokens).toBe(2048);
  });

  it("sends prior conversation turns as alternating user/assistant messages before the grounded prompt", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: "A follow-up answer." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await requestTeamCoachAnswer("What about a counter-interp?", MATCHES, {
      history: [{ id: "t1", question: "What is topicality?", answer: "A voting issue.", askedAt: 0 }],
    });

    const body = JSON.parse((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
    expect(body.messages).toEqual([
      { role: "user", content: "What is topicality?" },
      { role: "assistant", content: "A voting issue." },
      { role: "user", content: expect.stringContaining("What about a counter-interp?") },
    ]);
  });

  it("posts to a caller-supplied endpoint override", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: "An answer." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await requestTeamCoachAnswer("A question?", MATCHES, {}, "/custom-endpoint");

    expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("/custom-endpoint");
  });

  it("throws the server's error message when the request fails", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "Sign in to use AI features." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestTeamCoachAnswer("A question?", MATCHES)).rejects.toThrow(
      "Sign in to use AI features.",
    );
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

    await expect(requestTeamCoachAnswer("A question?", MATCHES)).rejects.toThrow(
      "Team coach AI request failed (502).",
    );
  });

  it("throws when the response text is empty or unusable", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: "   " }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestTeamCoachAnswer("A question?", MATCHES)).rejects.toThrow(
      "AI returned an empty or unusable answer.",
    );
  });
});
