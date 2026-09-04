import { afterEach, describe, expect, it, vi } from "vitest";
import { requestDrillScript } from "../src/round/drill-script-client";
import type { DrillScriptAiInput } from "../src/round/drill-script-ai";

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
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: "Let's start with the solvency deficit — here's my response..." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const script = await requestDrillScript(INPUT);

    expect(script).toBe("Let's start with the solvency deficit — here's my response...");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/reason-ai");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages[0].content).toContain("Side: AFF");
    expect(body.messages[0].content).toContain("Solvency deficit");
    expect(body.maxTokens).toBe(1024);
  });

  it("posts to a caller-supplied endpoint override", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: "Script." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await requestDrillScript(INPUT, "/custom-endpoint");

    expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("/custom-endpoint");
  });

  it("throws the server's error message when the request fails", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "Sign in to use AI features." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestDrillScript(INPUT)).rejects.toThrow("Sign in to use AI features.");
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

    await expect(requestDrillScript(INPUT)).rejects.toThrow("Drill script AI request failed (502).");
  });

  it("throws when the response text is empty or unusable", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: "   " }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestDrillScript(INPUT)).rejects.toThrow(
      "AI returned an empty or unusable drill script response.",
    );
  });
});
