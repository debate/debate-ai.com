import { afterEach, describe, expect, it, vi } from "vitest";
import { requestTeamBrainstormAiIdeas } from "../src/lib/team-brainstorm-client";
import { buildBrainstormPrompt } from "../src/lib/team-brainstorm-assist";

const REQUEST = buildBrainstormPrompt("solvency", "argument");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestTeamBrainstormAiIdeas", () => {
  it("posts to /api/reason-ai with the rendered prompt and returns the parsed ideas", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: JSON.stringify({ ideas: ["Idea one.", "Idea two."] }) }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const ideas = await requestTeamBrainstormAiIdeas(REQUEST);

    expect(ideas).toEqual(["Idea one.", "Idea two."]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/reason-ai");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages[0].content).toContain("Argument block: solvency");
    expect(body.maxTokens).toBe(512);
  });

  it("posts to a caller-supplied endpoint override", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: JSON.stringify({ ideas: ["Idea."] }) }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await requestTeamBrainstormAiIdeas(REQUEST, "/custom-endpoint");

    expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("/custom-endpoint");
  });

  it("throws the server's error message when the request fails", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "Sign in to use AI features." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestTeamBrainstormAiIdeas(REQUEST)).rejects.toThrow("Sign in to use AI features.");
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

    await expect(requestTeamBrainstormAiIdeas(REQUEST)).rejects.toThrow("Brainstorm AI request failed (502).");
  });

  it("throws when the response text can't be parsed as ideas", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: "not json at all" }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestTeamBrainstormAiIdeas(REQUEST)).rejects.toThrow(
      "AI returned a response that couldn't be parsed as brainstorm ideas.",
    );
  });
});
