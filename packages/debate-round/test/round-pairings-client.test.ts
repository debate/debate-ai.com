import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteSavedRoundPairingFromAccount,
  listSavedRoundPairings,
  saveRoundPairingToAccount,
} from "../src/round/round-pairings-client";
import type { RoundPairingRecord } from "../src/state/roundPairings";
import { mockFetchError, mockFetchJson } from "./helpers/mock-api-fetch";

const RECORD: RoundPairingRecord = {
  roundId: "round-1",
  tournamentName: "Blake",
  division: "LD",
  roundLabel: "Round 4",
  side: "aff",
  room: "Room 204",
  updatedAt: 1700000000000,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listSavedRoundPairings", () => {
  it("GETs the endpoint and returns the parsed record list", async () => {
    const fetchMock = mockFetchJson([RECORD]);

    const result = await listSavedRoundPairings();

    expect(result).toEqual([RECORD]);
    expect(fetchMock).toHaveBeenCalledWith("/api/round-pairings", expect.anything());
  });

  it("returns null on a 401 rather than throwing", async () => {
    mockFetchError(401, "Unauthorized");

    expect(await listSavedRoundPairings()).toBeNull();
  });

  it("throws on another failure", async () => {
    mockFetchError(500, "Internal Server Error");

    await expect(listSavedRoundPairings()).rejects.toThrow("Failed to load your synced round pairings.");
  });
});

describe("saveRoundPairingToAccount", () => {
  it("PUTs to the record's roundId-scoped endpoint", async () => {
    const fetchMock = mockFetchJson({});

    await saveRoundPairingToAccount(RECORD);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/round-pairings/round-1");
    expect((init as RequestInit).method).toBe("PUT");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ record: RECORD });
  });

  it("URL-encodes the roundId", async () => {
    const fetchMock = mockFetchJson({});

    await saveRoundPairingToAccount({ ...RECORD, roundId: "round 1" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/round-pairings/round%201");
    expect((init as RequestInit).method).toBe("PUT");
  });

  it("throws on failure", async () => {
    mockFetchError(400, "Bad Request");

    await expect(saveRoundPairingToAccount(RECORD)).rejects.toThrow("Failed to sync this pairing to your account.");
  });
});

describe("deleteSavedRoundPairingFromAccount", () => {
  it("DELETEs the record's roundId-scoped endpoint", async () => {
    const fetchMock = mockFetchJson({});

    await deleteSavedRoundPairingFromAccount("round-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/round-pairings/round-1");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("throws on failure", async () => {
    mockFetchError(500, "Internal Server Error");

    await expect(deleteSavedRoundPairingFromAccount("round-1")).rejects.toThrow(
      "Failed to remove this synced pairing.",
    );
  });
});
