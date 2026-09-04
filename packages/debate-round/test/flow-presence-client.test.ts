import { afterEach, describe, expect, it, vi } from "vitest";
import { pullFlowPresence, pushFlowPresenceHeartbeat } from "../src/flow/flow-presence-client";
import type { FlowPresenceHeartbeat } from "../src/flow/flow-presence";

const HEARTBEAT: FlowPresenceHeartbeat = { flowId: 7, authorId: "alice", lastSeenAt: 1000 };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pullFlowPresence", () => {
  it("GETs /api/flow-presence with flowId and returns the parsed heartbeats", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ heartbeats: [HEARTBEAT] }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const heartbeats = await pullFlowPresence(7);

    expect(heartbeats).toEqual([HEARTBEAT]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/flow-presence?flowId=7");
  });

  it("pulls from a caller-supplied endpoint override", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ heartbeats: [] }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await pullFlowPresence(7, "/custom-endpoint");

    const [url] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/custom-endpoint?flowId=7");
  });

  it("returns an empty array when the response has no heartbeats field", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const heartbeats = await pullFlowPresence(7);

    expect(heartbeats).toEqual([]);
  });

  it("throws the server's error message when the request fails", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: "flowId must be a whole number." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(pullFlowPresence(7)).rejects.toThrow("flowId must be a whole number.");
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

    await expect(pullFlowPresence(7)).rejects.toThrow("Flow presence pull failed (502).");
  });
});

describe("pushFlowPresenceHeartbeat", () => {
  it("POSTs the heartbeat as JSON to /api/flow-presence", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => HEARTBEAT,
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await pushFlowPresenceHeartbeat(HEARTBEAT);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/flow-presence");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(HEARTBEAT);
  });

  it("pushes to a caller-supplied endpoint override", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => HEARTBEAT,
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await pushFlowPresenceHeartbeat(HEARTBEAT, "/custom-endpoint");

    const [url] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/custom-endpoint");
  });

  it("throws the server's error message when the request fails", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: "authorId is required." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(pushFlowPresenceHeartbeat(HEARTBEAT)).rejects.toThrow("authorId is required.");
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

    await expect(pushFlowPresenceHeartbeat(HEARTBEAT)).rejects.toThrow("Flow presence push failed (500).");
  });
});
