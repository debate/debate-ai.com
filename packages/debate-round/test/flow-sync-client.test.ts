import { afterEach, describe, expect, it, vi } from "vitest";
import { pullRemoteFlowEdits, pushFlowEditToServer } from "../src/flow/flow-sync-client";
import type { FlowEdit } from "../src/flow/shared-flow-sync";

const EDIT: FlowEdit = {
  id: "edit-1",
  flowId: 7,
  boxPath: [0, 1],
  authorId: "alice",
  content: "New content",
  timestampMs: 1000,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pullRemoteFlowEdits", () => {
  it("GETs /api/flow-sync with flowId and sinceMs and returns the parsed edits", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ edits: [EDIT] }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const edits = await pullRemoteFlowEdits(7, 500);

    expect(edits).toEqual([EDIT]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/flow-sync?flowId=7&sinceMs=500");
  });

  it("pulls from a caller-supplied endpoint override", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ edits: [] }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await pullRemoteFlowEdits(7, 0, "/custom-endpoint");

    const [url] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/custom-endpoint?flowId=7&sinceMs=0");
  });

  it("returns an empty array when the response has no edits field", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const edits = await pullRemoteFlowEdits(7, 0);

    expect(edits).toEqual([]);
  });

  it("throws the server's error message when the request fails", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: "flowId must be a whole number." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(pullRemoteFlowEdits(7, 0)).rejects.toThrow("flowId must be a whole number.");
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

    await expect(pullRemoteFlowEdits(7, 0)).rejects.toThrow("Flow sync pull failed (502).");
  });
});

describe("pushFlowEditToServer", () => {
  it("POSTs the edit as JSON to /api/flow-sync", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => EDIT,
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await pushFlowEditToServer(EDIT);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/flow-sync");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(EDIT);
  });

  it("pushes to a caller-supplied endpoint override", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => EDIT,
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await pushFlowEditToServer(EDIT, "/custom-endpoint");

    const [url] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/custom-endpoint");
  });

  it("throws the server's error message when the request fails", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: "boxPath must be a non-empty array of numbers." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(pushFlowEditToServer(EDIT)).rejects.toThrow(
      "boxPath must be a non-empty array of numbers.",
    );
  });

  it("falls back to a status-code message when the error body isn't JSON", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(pushFlowEditToServer(EDIT)).rejects.toThrow("Flow sync push failed (500).");
  });
});
