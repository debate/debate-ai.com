import { afterEach, describe, expect, it } from "vitest";

import {
  clearCachedDocuments,
  configureMyFilesCache,
  getCachedDocument,
  getCachedDocuments,
  putCachedDocuments,
  removeCachedDocuments,
  type CachedDocument,
  type MyFilesBackend,
} from "../../../src/lib/my-files/local-cache";
import type { ReasonDocument } from "../../../src/docs/types";

function doc(id: number): ReasonDocument {
  return { id, title: `Doc ${id}`, content: `<p>${id}</p>`, format: "html", parentId: null, isFolder: false, updatedAt: 0 };
}

function memoryBackend(): MyFilesBackend & { rows: Map<number, CachedDocument> } {
  const rows = new Map<number, CachedDocument>();
  return {
    rows,
    async getAll() {
      return [...rows.values()];
    },
    async get(id) {
      return rows.get(id) ?? null;
    },
    async put(list) {
      for (const row of list) rows.set(row.id, row);
    },
    async remove(ids) {
      for (const id of ids) rows.delete(id);
    },
    async clear() {
      rows.clear();
    },
  };
}

afterEach(() => configureMyFilesCache(null));

describe("my files local cache", () => {
  it("stores, reads, removes and clears documents without the cachedAt stamp", async () => {
    const backend = memoryBackend();
    configureMyFilesCache(backend);
    await putCachedDocuments([doc(1), doc(2)]);
    expect(backend.rows.get(1)?.cachedAt).toBeTypeOf("number");
    expect(await getCachedDocument(1)).toEqual(doc(1));
    expect(await getCachedDocument(9)).toBeNull();
    await removeCachedDocuments([1]);
    expect((await getCachedDocuments()).map((d) => d.id)).toEqual([2]);
    await clearCachedDocuments();
    expect(await getCachedDocuments()).toEqual([]);
  });

  it("is a no-op without IndexedDB and swallows backend failures", async () => {
    await putCachedDocuments([doc(1)]);
    expect(await getCachedDocuments()).toEqual([]);
    expect(await getCachedDocument(1)).toBeNull();
    const fail = () => Promise.reject(new Error("gone"));
    configureMyFilesCache({ getAll: fail, get: fail, put: fail, remove: fail, clear: fail });
    expect(await getCachedDocuments()).toEqual([]);
    expect(await getCachedDocument(1)).toBeNull();
    await expect(putCachedDocuments([doc(1)])).resolves.toBeUndefined();
    await expect(removeCachedDocuments([1])).resolves.toBeUndefined();
    await expect(clearCachedDocuments()).resolves.toBeUndefined();
    await expect(putCachedDocuments([])).resolves.toBeUndefined();
  });
});
