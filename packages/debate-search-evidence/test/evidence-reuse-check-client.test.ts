import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkRemotePageForExistingCards,
  fetchReuseCheckDashboard,
  registerRemoteReuseEntry,
} from "../src/lib/evidence-reuse-check-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("checkRemotePageForExistingCards", () => {
  it("GETs /api/evidence-reuse-check with the url query param and returns the parsed result", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        url: "https://example.com/article",
        alreadyCut: true,
        matches: [{ id: "card-1", sourceUrl: "https://example.com/article", cite: "Smith 24", argBlock: "Warming DA", topic: "Energy" }],
      }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkRemotePageForExistingCards("https://example.com/article");

    expect(result.alreadyCut).toBe(true);
    expect(result.matches).toHaveLength(1);
    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/evidence-reuse-check?url=https%3A%2F%2Fexample.com%2Farticle");
    expect((init as RequestInit).method).toBe("GET");
  });

  it("posts to a caller-supplied endpoint override", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ url: "u", alreadyCut: false, matches: [] }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await checkRemotePageForExistingCards("u", "https://ext.example/api/evidence-reuse-check");

    expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      "https://ext.example/api/evidence-reuse-check?url=u",
    );
  });

  it("throws the server's error message when the request fails", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: "url is required." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkRemotePageForExistingCards("")).rejects.toThrow("url is required.");
  });

  it("falls back to a status-code message when the error body isn't JSON", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkRemotePageForExistingCards("u")).rejects.toThrow("Reuse check request failed (500).");
  });
});

describe("registerRemoteReuseEntry", () => {
  it("POSTs the entry fields to /api/evidence-reuse-check", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await registerRemoteReuseEntry({
      id: "card-1",
      sourceUrl: "https://example.com/article",
      cite: "Smith 24",
      argBlock: "Warming DA",
      topic: "Energy",
      contributorId: "alex",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/evidence-reuse-check");
    expect((init as RequestInit).method).toBe("POST");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      id: "card-1",
      sourceUrl: "https://example.com/article",
      cite: "Smith 24",
      argBlock: "Warming DA",
      topic: "Energy",
      contributorId: "alex",
    });
  });

  it("defaults optional fields to empty strings", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 201, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await registerRemoteReuseEntry({ id: "card-2", sourceUrl: "https://example.com/x" });

    const body = JSON.parse((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
    expect(body).toEqual({
      id: "card-2",
      sourceUrl: "https://example.com/x",
      cite: "",
      argBlock: "",
      topic: "",
      contributorId: "",
    });
  });

  it("throws the server's error message when the request fails", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: "sourceUrl is required." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(registerRemoteReuseEntry({ id: "x", sourceUrl: "" })).rejects.toThrow("sourceUrl is required.");
  });
});

describe("fetchReuseCheckDashboard", () => {
  it("GETs /api/evidence-reuse-check/dashboard and returns the parsed dashboard", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        dashboard: [
          { normalizedUrl: "a.com", url: "https://a.com", timesFlagged: 3, lastFlaggedAt: 100, sources: ["web"] },
        ],
      }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchReuseCheckDashboard();

    expect(result).toHaveLength(1);
    expect(result[0].timesFlagged).toBe(3);
    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/evidence-reuse-check/dashboard");
    expect((init as RequestInit).method).toBe("GET");
  });

  it("returns an empty array when the server omits the dashboard field", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchReuseCheckDashboard()).toEqual([]);
  });

  it("respects a caller-supplied endpoint override", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ dashboard: [] }) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await fetchReuseCheckDashboard("https://ext.example/api/evidence-reuse-check/dashboard");

    expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      "https://ext.example/api/evidence-reuse-check/dashboard",
    );
  });

  it("throws the server's error message when the request fails", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "boom" }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchReuseCheckDashboard()).rejects.toThrow("boom");
  });
});
