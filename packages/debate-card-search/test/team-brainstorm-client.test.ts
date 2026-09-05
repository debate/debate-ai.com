import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "debate-api-client";
import { requestTeamBrainstormAiIdeas } from "../src/lib/team-brainstorm-client";
import { buildBrainstormPrompt } from "../src/lib/team-brainstorm-assist";
import { mockFetchError, mockFetchJson } from "./helpers/mock-api-fetch";

const REQUEST = buildBrainstormPrompt("solvency", "argument");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestTeamBrainstormAiIdeas", () => {
  it("posts to /api/reason-ai with the rendered prompt and returns the parsed ideas", async () => {
    const fetchMock = mockFetchJson({ text: JSON.stringify({ ideas: ["Idea one.", "Idea two."] }) });

    const ideas = await requestTeamBrainstormAiIdeas(REQUEST);

    expect(ideas).toEqual(["Idea one.", "Idea two."]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/reason-ai");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages[0].content).toContain("Argument block: solvency");
    expect(body.maxTokens).toBe(512);
  });

  it("posts through a caller-supplied client override", async () => {
    const fetchMock = mockFetchJson({ text: JSON.stringify({ ideas: ["Idea."] }) });
    const client = createClient({ baseUrl: "/custom-endpoint" });

    await requestTeamBrainstormAiIdeas(REQUEST, client);

    expect(fetchMock.mock.calls[0][0]).toBe("/custom-endpoint/reason-ai");
  });

  it("throws when the request fails", async () => {
    mockFetchError(401, "Unauthorized");

    await expect(requestTeamBrainstormAiIdeas(REQUEST)).rejects.toThrow("Brainstorm AI request failed.");
  });

  it("throws when the response text can't be parsed as ideas", async () => {
    mockFetchJson({ text: "not json at all" });

    await expect(requestTeamBrainstormAiIdeas(REQUEST)).rejects.toThrow(
      "AI returned a response that couldn't be parsed as brainstorm ideas.",
    );
  });
});
