import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteSavedRoundPairingFromAccount,
  listSavedRoundPairings,
  saveRoundPairingToAccount,
} from "../src/round/round-pairings-client";
import type { RoundPairingRecord } from "../src/state/roundPairings";

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
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [RECORD],
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const result = await listSavedRoundPairings();

    expect(result).toEqual([RECORD]);
    expect(fetchMock).toHaveBeenCalledWith("/api/round-pairings");
  });

  it("returns null on a 401 rather than throwing", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    expect(await listSavedRoundPairings()).toBeNull();
  });

  it("throws the server's error message on another failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "Something broke." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(listSavedRoundPairings()).rejects.toThrow("Something broke.");
  });

  it("falls back to a default error message when the failure body isn't JSON", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(listSavedRoundPairings()).rejects.toThrow("Failed to load your synced round pairings.");
  });
});

describe("saveRoundPairingToAccount", () => {
  it("PUTs to the record's roundId-scoped endpoint", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await saveRoundPairingToAccount(RECORD);

    expect(fetchMock).toHaveBeenCalledWith("/api/round-pairings/round-1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ record: RECORD }),
    });
  });

  it("URL-encodes the roundId", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await saveRoundPairingToAccount({ ...RECORD, roundId: "round 1" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/round-pairings/round%201",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: "Invalid pairing." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveRoundPairingToAccount(RECORD)).rejects.toThrow("Invalid pairing.");
  });
});

describe("deleteSavedRoundPairingFromAccount", () => {
  it("DELETEs the record's roundId-scoped endpoint", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await deleteSavedRoundPairingFromAccount("round-1");

    expect(fetchMock).toHaveBeenCalledWith("/api/round-pairings/round-1", { method: "DELETE" });
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "Something broke." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteSavedRoundPairingFromAccount("round-1")).rejects.toThrow("Something broke.");
  });
});
