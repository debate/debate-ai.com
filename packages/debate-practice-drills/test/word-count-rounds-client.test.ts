import { afterEach, describe, expect, it, vi } from "vitest";
import type { WordCountRoundRecord } from "@debate-ai/round/src/state/wordCountRounds";
import {
  deleteSavedWordCountRoundFromAccount,
  listSavedWordCountRounds,
  saveWordCountRoundToAccount,
} from "../src/round/word-count-rounds-client";

const RECORD: WordCountRoundRecord = {
  roundId: "Round 1/Finals",
  styleKey: "practicePublicForum",
  submittedSpeeches: [{ name: "AC", speaker: "A1", text: "Contention one." }],
  updatedAt: 1700000000000,
};

function stubFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  const fetchMock = vi.fn(async () => response as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listSavedWordCountRounds", () => {
  it("GETs the endpoint and returns the records", async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, json: async () => [RECORD] });
    expect(await listSavedWordCountRounds()).toEqual([RECORD]);
    expect(fetchMock).toHaveBeenCalledWith("/api/word-count-rounds");
  });

  it("returns null when signed out", async () => {
    stubFetch({ ok: false, status: 401 });
    expect(await listSavedWordCountRounds()).toBeNull();
  });

  it("throws the server's message on another failure, or a fallback", async () => {
    stubFetch({ ok: false, status: 500, json: async () => ({ error: "Database down" }) });
    await expect(listSavedWordCountRounds()).rejects.toThrow("Database down");

    stubFetch({ ok: false, status: 500, json: async () => Promise.reject(new Error("not json")) });
    await expect(listSavedWordCountRounds()).rejects.toThrow("Failed to load your saved word-count rounds.");
  });
});

describe("saveWordCountRoundToAccount", () => {
  it("PUTs the record under its encoded round id", async () => {
    const fetchMock = stubFetch({ ok: true, status: 200 });
    await saveWordCountRoundToAccount(RECORD);
    expect(fetchMock).toHaveBeenCalledWith("/api/word-count-rounds/Round%201%2FFinals", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ record: RECORD }),
    });
  });

  it("throws on failure, 401 included", async () => {
    stubFetch({ ok: false, status: 401, json: async () => ({ error: "Sign in first." }) });
    await expect(saveWordCountRoundToAccount(RECORD)).rejects.toThrow("Sign in first.");
  });
});

describe("deleteSavedWordCountRoundFromAccount", () => {
  it("DELETEs the encoded round id", async () => {
    const fetchMock = stubFetch({ ok: true, status: 200 });
    await deleteSavedWordCountRoundFromAccount("a b");
    expect(fetchMock).toHaveBeenCalledWith("/api/word-count-rounds/a%20b", { method: "DELETE" });
  });

  it("throws a fallback message when the body has no error", async () => {
    stubFetch({ ok: false, status: 500, json: async () => ({}) });
    await expect(deleteSavedWordCountRoundFromAccount("a")).rejects.toThrow(
      "Failed to remove this round from your account.",
    );
  });
});
