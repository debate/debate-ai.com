import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mergeRemotePageReuseMatches,
  pullRemotePageReuseMatches,
  pushPageReuseEntry,
  type RemotePageReuseMatch,
} from "../src/lib/page-reuse-check-client";
import type { EvidenceLibraryEntry, PageReuseCheckResult } from "../src/lib/shared-evidence-library";

const ENTRY: EvidenceLibraryEntry = {
  id: "entry-1",
  kind: "card",
  text: "Warming is accelerating.",
  cite: "Smith 2024",
  sourceUrl: "https://www.example.com/article?utm_source=x",
  argBlock: "Warming DA",
  topic: "Climate",
  caseArea: "DA",
  tags: ["warming"],
  wordCount: 3,
};

const REMOTE_MATCH: RemotePageReuseMatch = {
  id: "entry-2",
  sourceUrl: "https://example.com/article",
  cite: "Jones 2023",
  argBlock: "Warming DA",
  contributorId: "bob",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pullRemotePageReuseMatches", () => {
  it("GETs /api/page-reuse-check with the encoded url and returns the parsed matches", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ url: "https://example.com/a b", alreadyCut: true, matches: [REMOTE_MATCH] }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const matches = await pullRemotePageReuseMatches("https://example.com/a b");

    expect(matches).toEqual([REMOTE_MATCH]);
    const [url] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/page-reuse-check?url=https%3A%2F%2Fexample.com%2Fa%20b");
  });

  it("pulls from a caller-supplied endpoint override", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ matches: [] }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await pullRemotePageReuseMatches("https://example.com", "/custom-endpoint");

    const [url] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/custom-endpoint?url=https%3A%2F%2Fexample.com");
  });

  it("returns an empty array when the response has no matches field", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    expect(await pullRemotePageReuseMatches("https://example.com")).toEqual([]);
  });

  it("throws the server's error message when the request fails", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: "url is required." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(pullRemotePageReuseMatches("")).rejects.toThrow("url is required.");
  });

  it("falls back to a status-code message when the error body isn't JSON", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("not json");
      },
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(pullRemotePageReuseMatches("https://example.com")).rejects.toThrow(
      "Page reuse check failed (502).",
    );
  });
});

describe("pushPageReuseEntry", () => {
  it("POSTs the entry's id, sourceUrl, cite, and argBlock as JSON", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await pushPageReuseEntry(ENTRY);

    const [url, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/page-reuse-check");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      id: "entry-1",
      sourceUrl: "https://www.example.com/article?utm_source=x",
      cite: "Smith 2024",
      argBlock: "Warming DA",
    });
  });

  it("pushes to a caller-supplied endpoint override", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await pushPageReuseEntry(ENTRY, "/custom-endpoint");

    const [url] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/custom-endpoint");
  });

  it("is a no-op for an entry with no sourceUrl", async () => {
    const fetchMock = vi.fn() as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await pushPageReuseEntry({ ...ENTRY, sourceUrl: undefined });
    await pushPageReuseEntry({ ...ENTRY, sourceUrl: "   " });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws the server's error message when the request fails", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: "sourceUrl is required." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(pushPageReuseEntry(ENTRY)).rejects.toThrow("sourceUrl is required.");
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

    await expect(pushPageReuseEntry(ENTRY)).rejects.toThrow("Page reuse push failed (500).");
  });
});

describe("mergeRemotePageReuseMatches", () => {
  const localHit: PageReuseCheckResult = {
    url: "https://example.com/article",
    alreadyCut: true,
    matches: [ENTRY],
  };
  const localMiss: PageReuseCheckResult = {
    url: "https://example.com/article",
    alreadyCut: false,
    matches: [],
  };

  it("appends remote-only matches after the local ones", () => {
    const merged = mergeRemotePageReuseMatches(localHit, [REMOTE_MATCH]);

    expect(merged.alreadyCut).toBe(true);
    expect(merged.matches.map((entry) => entry.id)).toEqual(["entry-1", "entry-2"]);
    expect(merged.matches[1]).toMatchObject({
      id: "entry-2",
      kind: "card",
      cite: "Jones 2023",
      sourceUrl: "https://example.com/article",
      argBlock: "Warming DA",
    });
  });

  it("flags a page as already cut when only the server index knows about it", () => {
    const merged = mergeRemotePageReuseMatches(localMiss, [REMOTE_MATCH]);

    expect(merged.alreadyCut).toBe(true);
    expect(merged.matches).toHaveLength(1);
    expect(merged.url).toBe("https://example.com/article");
  });

  it("keeps the local entry when the same id came back from the server", () => {
    const merged = mergeRemotePageReuseMatches(localHit, [{ ...REMOTE_MATCH, id: "entry-1" }]);

    expect(merged.matches).toHaveLength(1);
    expect(merged.matches[0]).toBe(ENTRY);
  });

  it("stays not-already-cut when neither side found anything", () => {
    const merged = mergeRemotePageReuseMatches(localMiss, []);

    expect(merged.alreadyCut).toBe(false);
    expect(merged.matches).toEqual([]);
  });
});
