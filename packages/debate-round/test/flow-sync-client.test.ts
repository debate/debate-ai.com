import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "debate-api-client";
import { pullRemoteFlowEdits, pushFlowEditToServer } from "../src/flow/flow-sync-client";
import type { FlowEdit } from "../src/flow/shared-flow-sync";
import { mockFetchError, mockFetchJson } from "./helpers/mock-api-fetch";

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
    const fetchMock = mockFetchJson({ edits: [EDIT] });

    const edits = await pullRemoteFlowEdits(7, 500);

    expect(edits).toEqual([EDIT]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/flow-sync?flowId=7&sinceMs=500");
  });

  it("pulls through a caller-supplied client override", async () => {
    const fetchMock = mockFetchJson({ edits: [] });
    const client = createClient({ baseUrl: "/custom-endpoint" });

    await pullRemoteFlowEdits(7, 0, client);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/custom-endpoint/flow-sync?flowId=7&sinceMs=0");
  });

  it("returns an empty array when the response has no edits field", async () => {
    mockFetchJson({});

    const edits = await pullRemoteFlowEdits(7, 0);

    expect(edits).toEqual([]);
  });

  it("throws when the request fails", async () => {
    mockFetchError(400, "Bad Request");

    await expect(pullRemoteFlowEdits(7, 0)).rejects.toThrow("Flow sync pull failed.");
  });
});

describe("pushFlowEditToServer", () => {
  it("POSTs the edit as JSON to /api/flow-sync", async () => {
    const fetchMock = mockFetchJson(EDIT, 201, "Created");

    await pushFlowEditToServer(EDIT);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/flow-sync");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(EDIT);
  });

  it("pushes through a caller-supplied client override", async () => {
    const fetchMock = mockFetchJson(EDIT, 201, "Created");
    const client = createClient({ baseUrl: "/custom-endpoint" });

    await pushFlowEditToServer(EDIT, client);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/custom-endpoint/flow-sync");
  });

  it("throws when the request fails", async () => {
    mockFetchError(400, "Bad Request");

    await expect(pushFlowEditToServer(EDIT)).rejects.toThrow("Flow sync push failed.");
  });
});
