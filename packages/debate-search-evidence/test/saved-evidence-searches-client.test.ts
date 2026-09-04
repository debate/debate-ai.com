import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSavedEvidenceSearches, saveSavedEvidenceSearches } from "../src/lib/saved-evidence-searches-client";
import type { SavedEvidenceSearch } from "../src/lib/saved-evidence-searches";

afterEach(() => {
  vi.unstubAllGlobals();
});

const SEARCH: SavedEvidenceSearch = {
  id: "search-1",
  name: "New topicality cards",
  filters: { text: "topicality", kind: "card", topic: "", caseArea: "", tags: "" },
  createdAt: 1_700_000_000_000,
  seenEntryIds: [],
};

describe("fetchSavedEvidenceSearches", () => {
  it("GETs /api/settings and returns the savedEvidenceSearches field", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ savedEvidenceSearches: [SEARCH] }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSavedEvidenceSearches();

    expect(result).toEqual([SEARCH]);
    expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("/api/settings");
  });

  it("defaults to an empty list when the field is absent from the response", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchSavedEvidenceSearches()).toEqual([]);
  });

  it("returns null on a 401 rather than throwing", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchSavedEvidenceSearches()).toBeNull();
  });

  it("throws the server's error message on another failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "boom" }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchSavedEvidenceSearches()).rejects.toThrow("boom");
  });

  it("uses a caller-supplied endpoint override", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ savedEvidenceSearches: [] }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await fetchSavedEvidenceSearches("https://ext.example/api/settings");

    expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("https://ext.example/api/settings");
  });
});

describe("saveSavedEvidenceSearches", () => {
  it("PUTs the full list as savedEvidenceSearches", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await saveSavedEvidenceSearches([SEARCH]);

    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/settings");
    expect((init as RequestInit).method).toBe("PUT");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ savedEvidenceSearches: [SEARCH] });
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: "invalid" }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveSavedEvidenceSearches([SEARCH])).rejects.toThrow("invalid");
  });
});
