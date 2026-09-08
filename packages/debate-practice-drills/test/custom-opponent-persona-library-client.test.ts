import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteCustomOpponentPersonaFromAccount,
  listMyCustomOpponentPersonas,
  listSharedCustomOpponentPersonas,
  saveCustomOpponentPersonaToAccount,
} from "../src/round/custom-opponent-persona-library-client";
import type { SavedCustomOpponentPersona } from "debate-speech-writer/src/opponent/opponent-persona-library";

const ENTRY: SavedCustomOpponentPersona = {
  id: "kritik-bot",
  name: "Kritik Bot",
  notes: "Opens on framework.",
  shared: false,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listMyCustomOpponentPersonas", () => {
  it("GETs the endpoint and returns the parsed entry list", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [ENTRY],
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const result = await listMyCustomOpponentPersonas();

    expect(result).toEqual([ENTRY]);
    expect(fetchMock).toHaveBeenCalledWith("/api/custom-opponent-personas");
  });

  it("returns null on a 401 rather than throwing", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    expect(await listMyCustomOpponentPersonas()).toBeNull();
  });

  it("throws the server's error message on another failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "Something broke." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(listMyCustomOpponentPersonas()).rejects.toThrow("Something broke.");
  });
});

describe("saveCustomOpponentPersonaToAccount", () => {
  it("PUTs to the entry's id-keyed endpoint", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await saveCustomOpponentPersonaToAccount(ENTRY);

    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/custom-opponent-personas/kritik-bot");
    expect((init as RequestInit).method).toBe("PUT");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ entry: ENTRY });
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: "Invalid entry." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveCustomOpponentPersonaToAccount(ENTRY)).rejects.toThrow("Invalid entry.");
  });
});

describe("deleteCustomOpponentPersonaFromAccount", () => {
  it("DELETEs the id-keyed endpoint, URI-encoded", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await deleteCustomOpponentPersonaFromAccount("id with spaces");

    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/custom-opponent-personas/id%20with%20spaces");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "Delete failed." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteCustomOpponentPersonaFromAccount("kritik-bot")).rejects.toThrow("Delete failed.");
  });
});

describe("listSharedCustomOpponentPersonas", () => {
  it("GETs the shared endpoint and returns the parsed entry list", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [ENTRY],
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const result = await listSharedCustomOpponentPersonas();

    expect(result).toEqual([ENTRY]);
    expect(fetchMock).toHaveBeenCalledWith("/api/custom-opponent-personas/shared");
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "Something broke." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(listSharedCustomOpponentPersonas()).rejects.toThrow("Something broke.");
  });
});
