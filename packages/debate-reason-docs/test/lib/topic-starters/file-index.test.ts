import { describe, expect, it } from "vitest"
import {
  TOPIC_STARTER_INDEX_STORAGE_KEY,
  TOPIC_STARTER_INDEX_URL,
  buildTopicStarterFileIndex,
  isIndexOnly,
  mergeTopicStarterIndex,
  parseTopicStarterFileIndex,
  readStoredTopicStarterIndex,
  refreshTopicStarterIndex,
  writeStoredTopicStarterIndex,
} from "../../../src/lib/topic-starters/file-index"
import type { TopicStarterItem } from "../../../src/docs/topic-starters/TopicStarterTree"

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  }
}

const rows = [
  { id: 3, title: "Warming 1AC", parentId: 1, isFolder: false, tags: '["cmir"]', year: 2026, format: "cmir" },
  { id: 1, title: "Aff", parentId: null, isFolder: true, tags: "[]", year: null, format: "html", topicCode: "lda27" },
  { id: 2, title: "Neg", parentId: null, isFolder: true, tags: null, year: null, format: null },
]

describe("buildTopicStarterFileIndex", () => {
  it("lists folders first, then by title, without content", () => {
    const index = buildTopicStarterFileIndex(rows, new Date("2026-11-03T06:00:00Z"))
    expect(index.generatedAt).toBe("2026-11-03T06:00:00.000Z")
    expect(index.count).toBe(3)
    expect(index.items.map((item) => item.id)).toEqual([1, 2, 3])
    expect(index.items[1]).toEqual({ id: 2, title: "Neg", parentId: null, isFolder: true, tags: "[]", year: null, topicCode: null })
    expect(index.items[0]).toMatchObject({ topicCode: "lda27" })
    expect(index.items[2]).toMatchObject({ format: "cmir", year: 2026 })
    expect(JSON.stringify(index)).not.toContain("content")
  })
})

describe("parseTopicStarterFileIndex", () => {
  it("rejects other versions and drops malformed rows", () => {
    expect(parseTopicStarterFileIndex({ version: 0, items: [] })).toBeNull()
    // A copy stored before topic codes would put every row in the default tree.
    expect(parseTopicStarterFileIndex({ version: 1, items: [] })).toBeNull()
    expect(parseTopicStarterFileIndex("nope")).toBeNull()
    // A copy stored before the hover details (version 2) is refetched.
    expect(parseTopicStarterFileIndex({ version: 2, items: [] })).toBeNull()
    const parsed = parseTopicStarterFileIndex({
      version: 3,
      generatedAt: "x",
      items: [{ id: 1, title: "A", parentId: null, isFolder: false }, { id: "bad" }],
    })
    expect(parsed?.items).toEqual([{ id: 1, title: "A", parentId: null, isFolder: false, tags: "[]", year: null, topicCode: null }])
    expect(parsed?.count).toBe(1)
  })

  it("keeps last modified, author and size stats on file rows", () => {
    const index = buildTopicStarterFileIndex([
      { id: 1, title: "File", parentId: null, isFolder: false, updatedAt: new Date("2026-11-08T00:00:00Z"), author: "Jane", quoteCount: 9, blockCount: 3, pageCount: 2, charCount: 4500 },
      { id: 2, title: "Folder", parentId: null, isFolder: true, updatedAt: new Date("2026-11-08T00:00:00Z"), author: "Jane" },
    ])
    const file = index.items.find((item) => item.id === 1)
    expect(file).toMatchObject({ updatedAt: "2026-11-08T00:00:00.000Z", author: "Jane", quoteCount: 9, blockCount: 3, pageCount: 2, charCount: 4500 })
    expect(index.items.find((item) => item.id === 2)).not.toHaveProperty("author")
    expect(parseTopicStarterFileIndex(JSON.parse(JSON.stringify(index)))).toEqual(index)
  })
})

describe("localStorage copy", () => {
  it("round-trips and ignores unreadable values", () => {
    const storage = memoryStorage()
    expect(readStoredTopicStarterIndex(storage)).toBeNull()
    const index = buildTopicStarterFileIndex(rows)
    writeStoredTopicStarterIndex(index, storage)
    expect(readStoredTopicStarterIndex(storage)).toEqual(index)
    storage.data.set(TOPIC_STARTER_INDEX_STORAGE_KEY, "{not json")
    expect(readStoredTopicStarterIndex(storage)).toBeNull()
  })

  it("never throws when storage does", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked")
      },
      setItem: () => {
        throw new Error("quota")
      },
    }
    expect(readStoredTopicStarterIndex(broken)).toBeNull()
    expect(() => writeStoredTopicStarterIndex(buildTopicStarterFileIndex(rows), broken)).not.toThrow()
    expect(readStoredTopicStarterIndex(null)).toBeNull()
  })
})

describe("refreshTopicStarterIndex", () => {
  it("fetches the index and stores it", async () => {
    const storage = memoryStorage()
    const index = buildTopicStarterFileIndex(rows)
    const urls: string[] = []
    const fetchImpl = (async (url: string) => {
      urls.push(url)
      return { ok: true, json: async () => index }
    }) as unknown as typeof fetch
    expect(await refreshTopicStarterIndex({ fetchImpl, storage })).toEqual(index)
    expect(urls).toEqual([TOPIC_STARTER_INDEX_URL])
    expect(readStoredTopicStarterIndex(storage)).toEqual(index)
  })

  it("resolves to null and keeps the old copy when the request fails", async () => {
    const index = buildTopicStarterFileIndex(rows)
    const storage = memoryStorage({ [TOPIC_STARTER_INDEX_STORAGE_KEY]: JSON.stringify(index) })
    const failing = (async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch
    const throwing = (async () => {
      throw new Error("offline")
    }) as unknown as typeof fetch
    expect(await refreshTopicStarterIndex({ fetchImpl: failing, storage })).toBeNull()
    expect(await refreshTopicStarterIndex({ fetchImpl: throwing, storage })).toBeNull()
    expect(readStoredTopicStarterIndex(storage)).toEqual(index)
  })
})

describe("mergeTopicStarterIndex", () => {
  const index = buildTopicStarterFileIndex(rows)
  const loaded: TopicStarterItem = {
    id: 3,
    title: "Warming 1AC (live)",
    content: "abc",
    format: "cmir",
    parentId: 1,
    isFolder: false,
    tags: "[]",
  }

  it("adds index rows without content, keeping rows that have it", () => {
    const merged = mergeTopicStarterIndex([loaded], index)
    expect(merged.map((item) => item.id)).toEqual([3, 1, 2])
    expect(merged[0]).toBe(loaded)
    expect(isIndexOnly(merged[0]!)).toBe(false)
    expect(merged[1]).toMatchObject({ id: 1, content: "", indexOnly: true })
  })

  it("replaces stale index rows with the new index", () => {
    const first = mergeTopicStarterIndex([], index)
    const next = buildTopicStarterFileIndex(rows.filter((row) => row.id !== 2))
    expect(mergeTopicStarterIndex(first, next).map((item) => item.id)).toEqual([1, 3])
  })

  it("returns just the loaded rows without an index", () => {
    expect(mergeTopicStarterIndex([loaded], null)).toEqual([loaded])
  })
})
