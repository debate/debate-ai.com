import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteSavedDrillSetFromAccount,
  listSavedDrillSets,
  saveDrillSetToAccount,
} from "../src/round/drill-sets-client";
import type { DrillSetRecord } from "../src/state/drillSets";

const RECORD: DrillSetRecord = {
  roundId: "round-1",
  sideKey: "aff",
  drills: [{ kind: "overview", rowIndex: null, prompt: "Weigh the round.", difficulty: "medium" }],
  updatedAt: 1700000000000,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listSavedDrillSets", () => {
  it("GETs the endpoint and returns the parsed record list", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [RECORD],
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const result = await listSavedDrillSets();

    expect(result).toEqual([RECORD]);
    expect(fetchMock).toHaveBeenCalledWith("/api/drill-sets");
  });

  it("returns null on a 401 rather than throwing", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    expect(await listSavedDrillSets()).toBeNull();
  });

  it("throws the server's error message on another failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "Something broke." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(listSavedDrillSets()).rejects.toThrow("Something broke.");
  });
});

describe("saveDrillSetToAccount", () => {
  it("PUTs to the record's roundId-keyed endpoint", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await saveDrillSetToAccount(RECORD);

    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/drill-sets/round-1");
    expect((init as RequestInit).method).toBe("PUT");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ record: RECORD });
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: "Invalid record." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveDrillSetToAccount(RECORD)).rejects.toThrow("Invalid record.");
  });
});

describe("deleteSavedDrillSetFromAccount", () => {
  it("DELETEs the roundId-keyed endpoint, URI-encoded", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await deleteSavedDrillSetFromAccount("round with spaces");

    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/drill-sets/round%20with%20spaces");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "Delete failed." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteSavedDrillSetFromAccount("round-1")).rejects.toThrow("Delete failed.");
  });
});
