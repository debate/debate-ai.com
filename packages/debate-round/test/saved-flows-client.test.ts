import { afterEach, describe, expect, it, vi } from "vitest";
import { saveFlowToAccount } from "../src/round/saved-flows-client";
import type { Flow } from "../src/types/flow";

function makeFlow(overrides: Partial<Flow> = {}): Flow {
  return {
    content: "1AC",
    level: 0,
    columns: ["1AC", "1NC"],
    invert: false,
    focus: false,
    index: 0,
    lastFocus: [0],
    children: [],
    id: 1700000000000,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("saveFlowToAccount", () => {
  it("PUTs the flow with the given baseUpdatedAt and returns the saved summary", async () => {
    const summary = { clientId: 1700000000000, label: "1AC", updatedAt: "2024-01-02T00:00:00.000Z" };
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => summary })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const flow = makeFlow();
    const result = await saveFlowToAccount(flow, { baseUpdatedAt: "2024-01-01T00:00:00.000Z" });

    expect(result).toEqual({ conflict: false, summary });
    expect(fetchMock).toHaveBeenCalledWith("/api/flows/1700000000000", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ flow, baseUpdatedAt: "2024-01-01T00:00:00.000Z", force: false }),
    });
  });

  it("defaults baseUpdatedAt to null and force to false when opts is omitted", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ clientId: 1, label: "", updatedAt: "" }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await saveFlowToAccount(makeFlow());

    const call = fetchMock.mock.calls[0];
    expect(JSON.parse(call[1]!.body as string)).toEqual({
      flow: makeFlow(),
      baseUpdatedAt: null,
      force: false,
    });
  });

  it("resolves to a conflict result on a 409 instead of throwing", async () => {
    const current = { clientId: 1700000000000, label: "1AC", updatedAt: "2024-02-01T00:00:00.000Z" };
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 409,
      json: async () => ({ error: "conflict", current }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const result = await saveFlowToAccount(makeFlow(), { baseUpdatedAt: "2024-01-01T00:00:00.000Z" });

    expect(result).toEqual({ conflict: true, current });
  });

  it("throws with the server's error message on a non-409 failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "Something went wrong." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveFlowToAccount(makeFlow())).rejects.toThrow("Something went wrong.");
  });

  it("passes force: true through to the request body", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ clientId: 1700000000000, label: "1AC", updatedAt: "2024-01-01T00:00:00.000Z" }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await saveFlowToAccount(makeFlow(), { baseUpdatedAt: "stale", force: true });

    const call = fetchMock.mock.calls[0];
    expect(JSON.parse(call[1]!.body as string)).toMatchObject({ force: true });
  });
});
