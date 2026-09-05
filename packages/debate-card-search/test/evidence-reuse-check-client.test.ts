import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "debate-api-client";
import { checkRemotePageForExistingCards, registerRemoteReuseEntry } from "../src/lib/evidence-reuse-check-client";
import { mockFetchError, mockFetchJson } from "./helpers/mock-api-fetch";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("checkRemotePageForExistingCards", () => {
  it("GETs /api/evidence-reuse-check with the url query param and returns the parsed result", async () => {
    const fetchMock = mockFetchJson({
      url: "https://example.com/article",
      alreadyCut: true,
      matches: [{ id: "card-1", sourceUrl: "https://example.com/article", cite: "Smith 24", argBlock: "Warming DA", topic: "Energy" }],
    });

    const result = await checkRemotePageForExistingCards("https://example.com/article");

    expect(result.alreadyCut).toBe(true);
    expect(result.matches).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/evidence-reuse-check?url=https%3A%2F%2Fexample.com%2Farticle");
    expect((init as RequestInit).method).toBe("GET");
  });

  it("checks through a caller-supplied client override", async () => {
    const fetchMock = mockFetchJson({ url: "u", alreadyCut: false, matches: [] });
    const client = createClient({ baseUrl: "https://ext.example/api" });

    await checkRemotePageForExistingCards("u", client);

    expect(fetchMock.mock.calls[0][0]).toBe("https://ext.example/api/evidence-reuse-check?url=u");
  });

  it("throws when the request fails", async () => {
    mockFetchError(400, "Bad Request");

    await expect(checkRemotePageForExistingCards("")).rejects.toThrow("Reuse check request failed.");
  });
});

describe("registerRemoteReuseEntry", () => {
  it("POSTs the entry fields to /api/evidence-reuse-check", async () => {
    const fetchMock = mockFetchJson({}, 201, "Created");

    await registerRemoteReuseEntry({
      id: "card-1",
      sourceUrl: "https://example.com/article",
      cite: "Smith 24",
      argBlock: "Warming DA",
      topic: "Energy",
      contributorId: "alex",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/evidence-reuse-check");
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
    const fetchMock = mockFetchJson({}, 201, "Created");

    await registerRemoteReuseEntry({ id: "card-2", sourceUrl: "https://example.com/x" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({
      id: "card-2",
      sourceUrl: "https://example.com/x",
      cite: "",
      argBlock: "",
      topic: "",
      contributorId: "",
    });
  });

  it("throws when the request fails", async () => {
    mockFetchError(400, "Bad Request");

    await expect(registerRemoteReuseEntry({ id: "x", sourceUrl: "" })).rejects.toThrow(
      "Reuse registration request failed.",
    );
  });
});
