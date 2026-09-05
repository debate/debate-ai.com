import { afterEach, describe, expect, it, vi } from "vitest";
import {
  copySharedFileToDocuments,
  createSharedFile,
  deleteSharedFile,
  fetchSharedFile,
  listMySharedFiles,
  listSharedFiles,
  shareDocument,
  updateSharedFile,
  uploadSharedFiles,
} from "../src/round/shared-files-client";
import type { SharedFileItem } from "../src/state/sharedFiles";

const ITEM: SharedFileItem = {
  id: 4,
  title: "Brief",
  content: "<p>x</p>",
  parentId: null,
  isFolder: false,
  tags: '["brief"]',
  published: true,
  ownerId: "alice",
  sourceDocumentId: null,
  updatedAt: "2026-09-01T00:00:00.000Z",
};

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => body })) as unknown as typeof fetch;
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock as unknown as ReturnType<typeof vi.fn>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listSharedFiles", () => {
  it("GETs the public library and unwraps items", async () => {
    const fetchMock = stubFetch(200, { items: [ITEM] });
    expect(await listSharedFiles()).toEqual([ITEM]);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/shared-files");
  });

  it("returns [] when the payload has no items", async () => {
    stubFetch(200, {});
    expect(await listSharedFiles()).toEqual([]);
  });

  it("throws the server's error message", async () => {
    stubFetch(500, { error: "boom" });
    await expect(listSharedFiles()).rejects.toThrow("boom");
  });
});

describe("listMySharedFiles", () => {
  it("asks for scope=mine and returns the items", async () => {
    const fetchMock = stubFetch(200, { items: [ITEM] });
    expect(await listMySharedFiles()).toEqual([ITEM]);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/shared-files?scope=mine");
  });

  it("resolves null when signed out", async () => {
    stubFetch(401, { error: "Sign in" });
    expect(await listMySharedFiles()).toBeNull();
  });
});

describe("fetchSharedFile", () => {
  it("returns the item", async () => {
    const fetchMock = stubFetch(200, ITEM);
    expect(await fetchSharedFile(4)).toEqual(ITEM);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/shared-files/4");
  });

  it("returns null on 404 and 403", async () => {
    stubFetch(404, { error: "nope" });
    expect(await fetchSharedFile(4)).toBeNull();
    stubFetch(403, { error: "nope" });
    expect(await fetchSharedFile(4)).toBeNull();
  });
});

describe("writes", () => {
  it("createSharedFile POSTs the payload as JSON", async () => {
    const fetchMock = stubFetch(201, ITEM);
    expect(await createSharedFile({ title: "Brief", content: "<p>x</p>", tags: ["brief"] })).toEqual(ITEM);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/shared-files");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ title: "Brief", content: "<p>x</p>", tags: ["brief"] });
  });

  it("shareDocument POSTs the documentId with options", async () => {
    const fetchMock = stubFetch(201, ITEM);
    await shareDocument(12, { published: false, tags: ["x"] });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ documentId: 12, published: false, tags: ["x"] });
  });

  it("updateSharedFile PUTs to the item's URL", async () => {
    const fetchMock = stubFetch(200, { ...ITEM, published: false });
    const updated = await updateSharedFile(4, { published: false });
    expect(updated.published).toBe(false);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/shared-files/4");
    expect(init.method).toBe("PUT");
  });

  it("deleteSharedFile DELETEs and returns the count", async () => {
    const fetchMock = stubFetch(200, { deleted: 3 });
    expect(await deleteSharedFile(4)).toEqual({ deleted: 3 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/shared-files/4");
    expect(init.method).toBe("DELETE");
  });

  it("copySharedFileToDocuments POSTs to /copy", async () => {
    const fetchMock = stubFetch(201, { id: 99, title: "Brief" });
    expect(await copySharedFileToDocuments(4)).toEqual({ id: 99, title: "Brief" });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/shared-files/4/copy");
  });

  it("uploadSharedFiles sends multipart form data to /upload", async () => {
    const fetchMock = stubFetch(201, { root: ITEM, imported: 2 });
    const file = new File(["x"], "pack.zip");
    expect(await uploadSharedFiles(file, { title: "Pack", published: false })).toEqual({ root: ITEM, imported: 2 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/shared-files/upload");
    const form = init.body as FormData;
    expect(form.get("title")).toBe("Pack");
    expect(form.get("published")).toBe("false");
    expect(form.get("file")).toBeInstanceOf(File);
  });

  it("surfaces the server error on a failed write", async () => {
    stubFetch(403, { error: "Only the owner can edit this file." });
    await expect(updateSharedFile(4, { title: "x" })).rejects.toThrow("Only the owner can edit this file.");
  });
});
