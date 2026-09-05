import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "debate-api-client";
import { requestDrillScript } from "../src/round/drill-script-client";
import type { DrillScriptAiInput } from "../src/round/drill-script-ai";
import { mockFetchError, mockFetchJson } from "./helpers/mock-api-fetch";

const INPUT: DrillScriptAiInput = {
  sideKey: "AFF",
  drill: {
    kind: "frontline",
    rowIndex: 2,
    prompt: 'Write a frontline response to "Solvency deficit" before it\'s extended again.',
    difficulty: "medium",
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestDrillScript", () => {
  it("posts to /api/reason-ai with the rendered prompt and returns the parsed script", async () => {
    const fetchMock = mockFetchJson({ text: "Let's start with the solvency deficit — here's my response..." });

    const script = await requestDrillScript(INPUT);

    expect(script).toBe("Let's start with the solvency deficit — here's my response...");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/reason-ai");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages[0].content).toContain("Side: AFF");
    expect(body.messages[0].content).toContain("Solvency deficit");
    expect(body.maxTokens).toBe(1024);
  });

  it("posts through a caller-supplied client override", async () => {
    const fetchMock = mockFetchJson({ text: "Script." });
    const client = createClient({ baseUrl: "/custom-endpoint" });

    await requestDrillScript(INPUT, client);

    expect(fetchMock.mock.calls[0][0]).toBe("/custom-endpoint/reason-ai");
  });

  it("throws when the request fails", async () => {
    mockFetchError(401, "Unauthorized");

    await expect(requestDrillScript(INPUT)).rejects.toThrow("Drill script AI request failed.");
  });

  it("throws when the response text is empty or unusable", async () => {
    mockFetchJson({ text: "   " });

    await expect(requestDrillScript(INPUT)).rejects.toThrow(
      "AI returned an empty or unusable drill script response.",
    );
  });
});
