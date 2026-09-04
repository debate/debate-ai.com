import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteAllSavedWordCountRoundsFromAccount,
  deleteSavedWordCountRoundFromAccount,
  listSavedWordCountRounds,
  saveWordCountRoundToAccount,
} from "../src/round/word-count-rounds-client";
import type { WordCountRoundRecord } from "debate-round/src/state/wordCountRounds";

const RECORD: WordCountRoundRecord = {
  roundId: "round-1",
  styleKey: "practicePublicForum",
  submittedSpeeches: [{ name: "AC", speaker: "A1", text: "Contention one is..." }],
  createdAt: 1700000000000,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listSavedWordCountRounds", () => {
  it("GETs the endpoint and returns the parsed record list", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [RECORD],
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const result = await listSavedWordCountRounds();

    expect(result).toEqual([RECORD]);
    expect(fetchMock).toHaveBeenCalledWith("/api/word-count-rounds");
  });

  it("returns null on a 401 rather than throwing", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    expect(await listSavedWordCountRounds()).toBeNull();
  });

  it("throws the server's error message on another failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "Something broke." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(listSavedWordCountRounds()).rejects.toThrow("Something broke.");
  });
});

describe("saveWordCountRoundToAccount", () => {
  it("PUTs to the record's roundId-keyed endpoint", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await saveWordCountRoundToAccount(RECORD);

    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/word-count-rounds/round-1");
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

    await expect(saveWordCountRoundToAccount(RECORD)).rejects.toThrow("Invalid record.");
  });
});

describe("deleteSavedWordCountRoundFromAccount", () => {
  it("DELETEs the roundId-keyed endpoint, URI-encoded", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await deleteSavedWordCountRoundFromAccount("round with spaces");

    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/word-count-rounds/round%20with%20spaces");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "Delete failed." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteSavedWordCountRoundFromAccount("round-1")).rejects.toThrow("Delete failed.");
  });
});

describe("deleteAllSavedWordCountRoundsFromAccount", () => {
  it("DELETEs the base endpoint", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await deleteAllSavedWordCountRoundsFromAccount();

    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/word-count-rounds");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "Clear failed." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteAllSavedWordCountRoundsFromAccount()).rejects.toThrow("Clear failed.");
  });
});
