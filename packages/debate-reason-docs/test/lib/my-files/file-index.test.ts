import { describe, expect, it } from "vitest";

import {
  MY_FILES_INDEX_STORAGE_KEY,
  buildMyFilesIndex,
  clearStoredMyFilesIndex,
  indexEntryToDocument,
  isIndexOnlyDocument,
  mergeMyFilesIndex,
  parseMyFilesIndex,
  readStoredMyFilesIndex,
  stripIndexOnly,
  writeStoredMyFilesIndex,
} from "../../../src/lib/my-files/file-index";
import type { ReasonDocument } from "../../../src/docs/types";

function doc(overrides: Partial<ReasonDocument>): ReasonDocument {
  return { id: 1, title: "Doc", content: "<p>x</p>", format: "html", parentId: null, isFolder: false, updatedAt: 5, ...overrides };
}

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

describe("my files index", () => {
  it("builds an index without content, keeping format only on files", () => {
    const index = buildMyFilesIndex([doc({ id: 1 }), doc({ id: 2, isFolder: true, format: "html" })], new Date(0));
    expect(index).toEqual({
      version: 1,
      generatedAt: "1970-01-01T00:00:00.000Z",
      count: 2,
      items: [
        { id: 1, title: "Doc", parentId: null, isFolder: false, format: "html", updatedAt: 5 },
        { id: 2, title: "Doc", parentId: null, isFolder: true, updatedAt: 5 },
      ],
    });
  });

  it("rejects other versions and drops malformed rows", () => {
    expect(parseMyFilesIndex(null)).toBeNull();
    expect(parseMyFilesIndex({ version: 99, items: [] })).toBeNull();
    const parsed = parseMyFilesIndex({ version: 1, items: [{ id: 1, title: "A", parentId: null, isFolder: false }, { id: "x" }] });
    expect(parsed?.items).toEqual([{ id: 1, title: "A", parentId: null, isFolder: false, updatedAt: 0 }]);
    expect(parsed?.generatedAt).toBe("");
  });

  it("round-trips through storage and never throws", () => {
    const storage = memoryStorage();
    expect(readStoredMyFilesIndex(storage)).toBeNull();
    const index = buildMyFilesIndex([doc({ id: 3 })]);
    writeStoredMyFilesIndex(index, storage);
    expect(storage.map.has(MY_FILES_INDEX_STORAGE_KEY)).toBe(true);
    expect(readStoredMyFilesIndex(storage)).toEqual(index);
    storage.map.set(MY_FILES_INDEX_STORAGE_KEY, "{not json");
    expect(readStoredMyFilesIndex(storage)).toBeNull();
    clearStoredMyFilesIndex(storage);
    expect(storage.map.size).toBe(0);
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readStoredMyFilesIndex(broken)).toBeNull();
    expect(() => writeStoredMyFilesIndex(index, broken)).not.toThrow();
    expect(() => clearStoredMyFilesIndex(broken)).not.toThrow();
    expect(readStoredMyFilesIndex(null)).toBeNull();
  });

  it("merges loaded rows with index-only rows, loaded rows winning", () => {
    const index = buildMyFilesIndex([doc({ id: 1, title: "Old" }), doc({ id: 2, title: "Only indexed" })]);
    const merged = mergeMyFilesIndex([doc({ id: 1, title: "Fresh" })], index);
    expect(merged.map((d) => [d.id, d.title, isIndexOnlyDocument(d)])).toEqual([
      [1, "Fresh", false],
      [2, "Only indexed", true],
    ]);
    expect(mergeMyFilesIndex([indexEntryToDocument(index.items[0]!)], null)).toEqual([]);
    expect(stripIndexOnly(merged[1]!)).not.toHaveProperty("indexOnly");
  });
});
