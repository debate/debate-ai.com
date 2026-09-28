import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchSavedArgumentCollections,
  saveSavedArgumentCollections,
  sendSavedArgumentCollectionOp,
} from "../src/lib/argument-library-collections-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchSavedArgumentCollections", () => {
  it("returns the saved collections list from a successful response", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ savedArgumentCollections: [{ name: "Topicality", tags: ["t"] }] }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSavedArgumentCollections();

    expect(result).toEqual([{ name: "Topicality", tags: ["t"] }]);
  });

  it("returns an empty list when the field is absent from the response", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchSavedArgumentCollections()).toEqual([]);
  });

  it("returns null when signed out (401)", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchSavedArgumentCollections()).toBeNull();
  });

  it("throws the server's error message on another failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "boom" }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchSavedArgumentCollections()).rejects.toThrow("boom");
  });
});

describe("saveSavedArgumentCollections", () => {
  it("PUTs the whole list to the endpoint", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await saveSavedArgumentCollections([{ name: "Warming", tags: ["climate"] }]);

    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/settings");
    expect((init as RequestInit).method).toBe("PUT");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      savedArgumentCollections: [{ name: "Warming", tags: ["climate"] }],
    });
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: "nope" }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveSavedArgumentCollections([])).rejects.toThrow("nope");
  });
});

describe("sendSavedArgumentCollectionOp", () => {
  it("PUTs just the op, not a whole-list replace", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await sendSavedArgumentCollectionOp({ addSavedArgumentCollection: { name: "Warming", tags: ["climate"] } });

    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/settings");
    expect((init as RequestInit).method).toBe("PUT");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      addSavedArgumentCollection: { name: "Warming", tags: ["climate"] },
    });
  });

  it("sends a removeSavedArgumentCollection op", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await sendSavedArgumentCollectionOp({ removeSavedArgumentCollection: "Warming" });

    const [, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ removeSavedArgumentCollection: "Warming" });
  });

  it("throws the server's error message on a business-rule refusal", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: 'A collection named "Warming" already exists.' }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendSavedArgumentCollectionOp({ addSavedArgumentCollection: { name: "Warming", tags: ["a"] } }),
    ).rejects.toThrow('A collection named "Warming" already exists.');
  });
});
