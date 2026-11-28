import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteSavedRound, saveRoundToAccount } from "../src/round/saved-rounds-client";
import type { Round } from "../src/types/flow";

function makeRound(overrides: Partial<Round> = {}): Round {
  return {
    id: 1700000000000,
    tournamentName: "Glenbrooks",
    roundLevel: "Octafinals",
    debaters: { aff: ["a@b.com", ""], neg: ["c@d.com", ""] },
    judges: ["judge@e.com"],
    flowIds: [1, 2],
    timestamp: 1700000000000,
    status: "completed",
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("saveRoundToAccount", () => {
  it("PUTs the round with the given baseUpdatedAt and returns the saved summary", async () => {
    const summary = { clientId: 1700000000000, label: "Glenbrooks - Octafinals", updatedAt: "2024-01-02T00:00:00.000Z" };
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => summary })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const round = makeRound();
    const result = await saveRoundToAccount(round, { baseUpdatedAt: "2024-01-01T00:00:00.000Z" });

    expect(result).toEqual({ conflict: false, summary });
    expect(fetchMock).toHaveBeenCalledWith("/api/rounds/1700000000000", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ round, baseUpdatedAt: "2024-01-01T00:00:00.000Z", force: false }),
    });
  });

  it("defaults baseUpdatedAt to null and force to false when opts is omitted", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ clientId: 1, label: "", updatedAt: "" }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await saveRoundToAccount(makeRound());

    const call = fetchMock.mock.calls[0];
    expect(JSON.parse(call[1]!.body as string)).toEqual({
      round: makeRound(),
      baseUpdatedAt: null,
      force: false,
    });
  });

  it("resolves to a conflict result on a 409 instead of throwing", async () => {
    const current = { clientId: 1700000000000, label: "Glenbrooks - Octafinals", updatedAt: "2024-02-01T00:00:00.000Z" };
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 409,
      json: async () => ({ error: "conflict", current }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const result = await saveRoundToAccount(makeRound(), { baseUpdatedAt: "2024-01-01T00:00:00.000Z" });

    expect(result).toEqual({ conflict: true, current });
  });

  it("throws with the server's error message on a non-409 failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "Something went wrong." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveRoundToAccount(makeRound())).rejects.toThrow("Something went wrong.");
  });

  it("passes force: true through to the request body", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ clientId: 1700000000000, label: "Glenbrooks - Octafinals", updatedAt: "2024-01-01T00:00:00.000Z" }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await saveRoundToAccount(makeRound(), { baseUpdatedAt: "stale", force: true });

    const call = fetchMock.mock.calls[0];
    expect(JSON.parse(call[1]!.body as string)).toMatchObject({ force: true });
  });
});

describe("deleteSavedRound", () => {
  const empty = { removedFlowIds: [], keptFlowIds: [], flowsUnreadable: false };

  it("DELETEs the round alone by default and resolves to an empty result", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true }) }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(deleteSavedRound(7)).resolves.toEqual(empty);
    expect(fetchMock).toHaveBeenCalledWith("/api/rounds/7", { method: "DELETE" });
  });

  it("asks for the flows with withFlows and passes back which went and which stayed", async () => {
    const body = { success: true, removedFlowIds: [1, 2], keptFlowIds: [3], flowsUnreadable: false };
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => body }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(deleteSavedRound(7, "/api/rounds", { withFlows: true })).resolves.toEqual({
      removedFlowIds: [1, 2],
      keptFlowIds: [3],
      flowsUnreadable: false,
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/rounds/7?withFlows=1", { method: "DELETE" });
  });

  it("drops malformed ids and tolerates a body that isn't JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ removedFlowIds: [1, "2", 2.5], flowsUnreadable: "yes" }) })),
    );
    await expect(deleteSavedRound(7, undefined, { withFlows: true })).resolves.toEqual({ ...empty, removedFlowIds: [1] });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("x"); } })),
    );
    await expect(deleteSavedRound(7)).resolves.toEqual(empty);
  });

  it("throws the server's message on failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: "Sign in to manage your saved rounds." }) })));
    await expect(deleteSavedRound(7)).rejects.toThrow("Sign in to manage your saved rounds.");
  });
});
