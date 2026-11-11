import { describe, expect, it } from "vitest";

import {
  MY_FILES_ANONYMOUS_OWNER,
  MY_FILES_INDEX_STORAGE_KEY,
  buildMyFilesIndex,
  canPaintMyFilesIndex,
  myFilesOwnerOf,
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
      version: 2,
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
    // A copy stored before the hover details (version 1) is refetched.
    expect(parseMyFilesIndex({ version: 1, items: [] })).toBeNull();
    const parsed = parseMyFilesIndex({ version: 2, items: [{ id: 1, title: "A", parentId: null, isFolder: false }, { id: "x" }] });
    expect(parsed?.items).toEqual([{ id: 1, title: "A", parentId: null, isFolder: false, updatedAt: 0 }]);
    expect(parsed?.generatedAt).toBe("");
  });

  it("carries author, created date and size stats on file rows only", () => {
    const index = buildMyFilesIndex([
      doc({ id: 1, author: "Alexa", createdAt: "2025-01-02T00:00:00.000Z", quoteCount: 4, blockCount: 2, pageCount: 1, charCount: 900 }),
      doc({ id: 2, isFolder: true, author: "Alexa", quoteCount: 0 }),
      doc({ id: 3, quoteCount: null, charCount: null }),
    ]);
    expect(index.items[0]).toMatchObject({ author: "Alexa", createdAt: "2025-01-02T00:00:00.000Z", quoteCount: 4, blockCount: 2, pageCount: 1, charCount: 900 });
    expect(index.items[1]).not.toHaveProperty("author");
    expect(index.items[1]).not.toHaveProperty("quoteCount");
    expect(index.items[2]).not.toHaveProperty("charCount");
    expect(parseMyFilesIndex(JSON.parse(JSON.stringify(index)))).toEqual(index);
  });

  it("fills hover details a cached row lacks from the index", () => {
    const index = buildMyFilesIndex([doc({ id: 1, author: "Alexa", quoteCount: 4, charCount: 900 })]);
    const [row] = mergeMyFilesIndex([doc({ id: 1, content: "<p>x</p>" })], index);
    expect(row).toMatchObject({ author: "Alexa", quoteCount: 4, charCount: 900, content: "<p>x</p>" });
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

describe("scoping the index to one account", () => {
  it("myFilesOwnerOf reads the user id once the session is known", () => {
    expect(myFilesOwnerOf({ isAuthenticated: true, user: { id: "u1" } })).toBeNull();
    expect(myFilesOwnerOf({ isLoading: true, isAuthenticated: false, user: null })).toBeNull();
    expect(myFilesOwnerOf({ isLoading: false, isAuthenticated: true, user: { id: "u1" } })).toBe("u1");
    expect(myFilesOwnerOf({ isLoading: false, isAuthenticated: false, user: null })).toBe(MY_FILES_ANONYMOUS_OWNER);
    expect(myFilesOwnerOf({ isLoading: false, isAuthenticated: true, user: {} })).toBeNull();
  });

  it("records the owner and keeps it through storage", () => {
    const storage = new Map<string, string>();
    const backend = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
      removeItem: (key: string) => void storage.delete(key),
    };
    const index = buildMyFilesIndex([doc({ id: 1 })], new Date(0), "u1");
    expect(index.owner).toBe("u1");
    expect(buildMyFilesIndex([doc({ id: 1 })])).not.toHaveProperty("owner");
    writeStoredMyFilesIndex(index, backend);
    expect(readStoredMyFilesIndex(backend)?.owner).toBe("u1");
    expect(parseMyFilesIndex({ ...index, owner: 5 })).not.toHaveProperty("owner");
  });

  it("refreshMyFilesIndex stamps the owner on what it stores", async () => {
    const storage = new Map<string, string>();
    const backend = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
      removeItem: (key: string) => void storage.delete(key),
    };
    const fetchImpl = (async () => new Response(JSON.stringify(buildMyFilesIndex([doc({ id: 2 })])))) as unknown as typeof fetch;
    expect((await refreshMyFilesIndex({ fetchImpl, storage: backend, owner: "u2" }))?.owner).toBe("u2");
    expect(readStoredMyFilesIndex(backend)?.owner).toBe("u2");
  });

  it("paints a stored copy only for its own account once the session is known", () => {
    expect(canPaintMyFilesIndex({ owner: "u1" }, null)).toBe(true);
    expect(canPaintMyFilesIndex({}, null)).toBe(true);
    expect(canPaintMyFilesIndex({ owner: "u1" }, "u1")).toBe(true);
    expect(canPaintMyFilesIndex({ owner: "u1" }, "u2")).toBe(false);
    expect(canPaintMyFilesIndex({}, "u1")).toBe(false);
  });
});
