import { describe, expect, it } from "vitest";

import {
  MY_FILES_INDEX_STORAGE_KEY,
  buildMyFilesIndex,
  clearStoredMyFilesIndex,
  indexEntryToDocument,
  isIndexOnlyDocument,
  MY_FILES_INDEX_URL,
  isSameVersion,
  mergeMyFilesIndex,
  reconcileMyFilesIndex,
  refreshMyFilesIndex,
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

describe("checking the server index", () => {
  const T1 = "2026-11-01T10:00:00.000Z";
  const T2 = "2026-11-08T10:00:00.000Z";

  function memoryStorage() {
    const data = new Map<string, string>();
    return {
      data,
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    };
  }

  it("refreshMyFilesIndex fetches, validates and stores the index", async () => {
    const storage = memoryStorage();
    const index = buildMyFilesIndex([doc({ id: 1, updatedAt: T1 })]);
    const urls: string[] = [];
    const fetchImpl = (async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify(index));
    }) as unknown as typeof fetch;
    const got = await refreshMyFilesIndex({ fetchImpl, storage });
    expect(urls).toEqual([MY_FILES_INDEX_URL]);
    expect(got?.items).toEqual(index.items);
    expect(readStoredMyFilesIndex(storage)?.items).toEqual(index.items);
  });

  it("refreshMyFilesIndex resolves to null and keeps the stored copy on failure", async () => {
    const storage = memoryStorage();
    const old = buildMyFilesIndex([doc({ id: 7 })]);
    writeStoredMyFilesIndex(old, storage);
    const failing = (async () => new Response("{}", { status: 500 })) as unknown as typeof fetch;
    const throwing = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const notAnIndex = (async () => new Response("[]")) as unknown as typeof fetch;
    for (const fetchImpl of [failing, throwing, notAnIndex]) {
      expect(await refreshMyFilesIndex({ fetchImpl, storage })).toBeNull();
    }
    expect(readStoredMyFilesIndex(storage)?.items.map((row) => row.id)).toEqual([7]);
  });

  it("isSameVersion compares times, not spellings", () => {
    expect(isSameVersion({ updatedAt: T1 }, { updatedAt: T1 })).toBe(true);
    expect(isSameVersion({ updatedAt: new Date(T1).getTime() }, { updatedAt: T1 })).toBe(true);
    expect(isSameVersion({ updatedAt: T1 }, { updatedAt: T2 })).toBe(false);
    expect(isSameVersion({ updatedAt: "" }, { updatedAt: "" })).toBe(false);
  });

  it("reconcileMyFilesIndex keeps current files, marks changed ones stale and lists deletions", () => {
    const index = buildMyFilesIndex([
      doc({ id: 1, title: "Renamed", updatedAt: T1 }),
      doc({ id: 2, updatedAt: T2 }),
      doc({ id: 3, updatedAt: T1 }),
      doc({ id: 4, title: "Folder", isFolder: true, updatedAt: T1 }),
    ]);
    const cached = [
      doc({ id: 1, title: "Old name", content: "<p>one</p>", updatedAt: T1 }),
      doc({ id: 2, content: "<p>old two</p>", updatedAt: T1 }),
      doc({ id: 9, content: "<p>deleted</p>", updatedAt: T1 }),
    ];
    const { rows, stale, removed } = reconcileMyFilesIndex(index, cached);
    expect(rows.map((row) => row.id)).toEqual([1, 2, 3, 4]);
    expect(rows[0]).toMatchObject({ title: "Renamed", content: "<p>one</p>" });
    expect(isIndexOnlyDocument(rows[0])).toBe(false);
    expect(isIndexOnlyDocument(rows[1])).toBe(true);
    expect(isIndexOnlyDocument(rows[2])).toBe(true);
    expect(rows[3]).toMatchObject({ isFolder: true, content: "" });
    expect(isIndexOnlyDocument(rows[3])).toBe(false);
    expect(stale).toEqual([2, 3]);
    expect(removed).toEqual([9]);
  });
});
