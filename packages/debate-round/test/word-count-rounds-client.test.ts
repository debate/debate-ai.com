import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteAllSavedWordCountRoundsFromAccount,
  deleteSavedWordCountRoundFromAccount,
  listSavedWordCountRounds,
  saveWordCountRoundToAccount,
} from "../src/round/word-count-rounds-client";
import type { WordCountRoundRecord } from "../src/state/wordCountRounds";
import { mockFetchError, mockFetchJson } from "./helpers/mock-api-fetch";

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
    const fetchMock = mockFetchJson([RECORD]);

    const result = await listSavedWordCountRounds();

    expect(result).toEqual([RECORD]);
    expect(fetchMock).toHaveBeenCalledWith("/api/word-count-rounds", expect.anything());
  });

  it("returns null on a 401 rather than throwing", async () => {
    mockFetchError(401, "Unauthorized");

    expect(await listSavedWordCountRounds()).toBeNull();
  });

  it("throws on another failure", async () => {
    mockFetchError(500, "Internal Server Error");

    await expect(listSavedWordCountRounds()).rejects.toThrow("Failed to load your synced word-count rounds.");
  });
});

describe("saveWordCountRoundToAccount", () => {
  it("PUTs to the record's roundId-keyed endpoint", async () => {
    const fetchMock = mockFetchJson({});

    await saveWordCountRoundToAccount(RECORD);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/word-count-rounds/round-1");
    expect((init as RequestInit).method).toBe("PUT");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ record: RECORD });
  });

  it("throws on failure", async () => {
    mockFetchError(400, "Bad Request");

    await expect(saveWordCountRoundToAccount(RECORD)).rejects.toThrow("Failed to sync this round to your account.");
  });
});

describe("deleteSavedWordCountRoundFromAccount", () => {
  it("DELETEs the roundId-keyed endpoint, URI-encoded", async () => {
    const fetchMock = mockFetchJson({});

    await deleteSavedWordCountRoundFromAccount("round with spaces");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/word-count-rounds/round%20with%20spaces");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("throws on failure", async () => {
    mockFetchError(500, "Internal Server Error");

    await expect(deleteSavedWordCountRoundFromAccount("round-1")).rejects.toThrow(
      "Failed to remove this synced round.",
    );
  });
});

describe("deleteAllSavedWordCountRoundsFromAccount", () => {
  it("DELETEs the base endpoint", async () => {
    const fetchMock = mockFetchJson({});

    await deleteAllSavedWordCountRoundsFromAccount();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/word-count-rounds");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("throws on failure", async () => {
    mockFetchError(500, "Internal Server Error");

    await expect(deleteAllSavedWordCountRoundsFromAccount()).rejects.toThrow(
      "Failed to clear your synced round history.",
    );
  });
});
