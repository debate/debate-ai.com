import { afterEach, describe, expect, it, vi } from "vitest";
import {
  collectDocumentDescendantIds,
  createDocument,
  deleteDocumentTree,
  duplicateDocument,
  duplicateDocumentTitle,
  fetchDocument,
  listDocuments,
  updateDocument,
  type DocumentRecord,
} from "../src/round/documents-client";

const DOC: DocumentRecord = {
  id: 1,
  title: "1AC",
  content: "<p>plan</p>",
  parentId: null,
  isFolder: false,
  updatedAt: "2026-09-01T00:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("duplicateDocumentTitle", () => {
  it("appends (copy) and numbers later copies", () => {
    expect(duplicateDocumentTitle("1AC", ["1AC"])).toBe("1AC (copy)");
    expect(duplicateDocumentTitle("1AC", ["1AC", "1AC (copy)"])).toBe("1AC (copy 2)");
    expect(duplicateDocumentTitle("1AC", ["1AC", "1AC (copy)", "1AC (copy 2)"])).toBe("1AC (copy 3)");
  });

  it("falls back to Untitled for a blank title", () => {
    expect(duplicateDocumentTitle("   ", [])).toBe("Untitled (copy)");
  });
});

describe("collectDocumentDescendantIds", () => {
  const docs = [
    { id: 1, parentId: null },
    { id: 2, parentId: 1 },
    { id: 3, parentId: 2 },
    { id: 4, parentId: null },
  ];

  it("includes the root and everything nested under it", () => {
    expect(collectDocumentDescendantIds(docs, 1)).toEqual([1, 2, 3]);
    expect(collectDocumentDescendantIds(docs, 4)).toEqual([4]);
  });
});

describe("fetch wrappers", () => {
  it("listDocuments GETs the collection", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => [DOC] })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);
    expect(await listDocuments()).toEqual([DOC]);
    expect((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("/api/doc/documents");
  });

  it("fetchDocument returns null on 404/403", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
    expect(await fetchDocument(1)).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) })));
    expect(await fetchDocument(1)).toBeNull();
  });

  it("createDocument and updateDocument send JSON bodies", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 201, json: async () => DOC })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);
    await createDocument({ title: "New", isFolder: true });
    await updateDocument(1, { title: "Renamed" });
    const calls = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit][];
    expect(calls[0][0]).toBe("/api/doc/documents");
    expect(calls[0][1].method).toBe("POST");
    expect(JSON.parse(String(calls[0][1].body))).toEqual({ title: "New", isFolder: true });
    expect(calls[1][0]).toBe("/api/doc/documents/1");
    expect(calls[1][1].method).toBe("PUT");
  });

  it("deleteDocumentTree DELETEs every descendant", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true }) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);
    const ids = await deleteDocumentTree(
      [
        { id: 1, parentId: null },
        { id: 2, parentId: 1 },
      ],
      1,
    );
    expect(ids).toEqual([1, 2]);
    const urls = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0]);
    expect(urls.sort()).toEqual(["/api/doc/documents/1", "/api/doc/documents/2"]);
  });

  it("duplicateDocument fetches the source then creates a (copy) in the same folder", async () => {
    const source = { ...DOC, parentId: 7 };
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => ({
      ok: true,
      status: init?.method === "POST" ? 201 : 200,
      json: async () => (init?.method === "POST" ? { ...source, id: 2, title: "1AC (copy)" } : source),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);
    const copy = await duplicateDocument(1, [DOC]);
    expect(copy.id).toBe(2);
    const calls = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit | undefined][];
    expect(calls[0][0]).toBe("/api/doc/documents/1");
    expect(JSON.parse(String(calls[1][1]?.body))).toEqual({ title: "1AC (copy)", content: "<p>plan</p>", parentId: 7, isFolder: false });
  });

  it("duplicateDocument throws when the source is gone", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
    await expect(duplicateDocument(1, [])).rejects.toThrow("That document no longer exists.");
  });

  it("surfaces the server error on failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: "db down" }) })));
    await expect(listDocuments()).rejects.toThrow("db down");
  });
});
