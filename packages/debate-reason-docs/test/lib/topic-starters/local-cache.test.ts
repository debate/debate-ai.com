// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearCachedItems,
  configureTopicStarterCache,
  downloadFullTopicStarterLibrary,
  getCachedItem,
  getCachedItems,
  getCachedVersion,
  isExtensionInstalled,
  replaceCachedItems,
  resetTopicStarterCacheForTests,
  resolveCachedTopic,
  setCachedVersion,
  upsertCachedItem,
  type CachedTopicStarter,
} from "../../../src/lib/topic-starters/local-cache"

/** A fetch-like that answers with a JSON body, typed as a Response. */
function fakeResponse(body: unknown, ok = true, status = ok ? 200 : 500): Response {
  return { ok, status, json: async () => body } as unknown as Response
}

function row(id: number, overrides: Partial<CachedTopicStarter> = {}): CachedTopicStarter {
  return {
    id,
    title: `Item ${id}`,
    content: `content-${id}`,
    format: "html",
    parentId: null,
    isFolder: false,
    tags: "[]",
    cachedAt: 0,
    ...overrides,
  } as CachedTopicStarter
}

/** A key/value backend mirroring what IndexedDB stores, in a plain map. */
function memoryBackend() {
  const store = new Map<string, string>()
  const backend = {
    async getAll() {
      return Object.fromEntries(store)
    },
    async getMany(keys: readonly string[]) {
      const out: Record<string, string | null> = {}
      for (const key of keys) out[key] = store.get(key) ?? null
      return out
    },
    async set(key: string, value: string) {
      store.set(key, value)
    },
    async remove(key: string) {
      store.delete(key)
    },
    async clear() {
      store.clear()
    },
  }
  return { backend, store }
}

beforeEach(() => {
  resetTopicStarterCacheForTests()
})
afterEach(() => {
  resetTopicStarterCacheForTests()
  vi.restoreAllMocks()
})

describe("without a backend (jsdom has no IndexedDB)", () => {
  it("reads null and writes without throwing", async () => {
    expect(await getCachedItems()).toBeNull()
    expect(await getCachedItem(1)).toBeNull()
    await expect(upsertCachedItem(row(1))).resolves.toBeUndefined()
    await expect(clearCachedItems()).resolves.toBeUndefined()
    await expect(
      downloadFullTopicStarterLibrary({ fetchImpl: async (): Promise<Response> => fakeResponse({}, false, 404) }),
    ).rejects.toThrow()
    expect(await isExtensionInstalled()).toBe(false)
  })
})

describe("with an in-memory backend", () => {
  it("round-trips a single row", async () => {
    const { backend } = memoryBackend()
    configureTopicStarterCache({ primary: backend })
    expect(await getCachedItems()).toBeNull()

    await upsertCachedItem(row(1))
    const got = await getCachedItem(1)
    expect(got?.id).toBe(1)
    expect(got?.title).toBe("Item 1")
    expect(typeof got?.cachedAt).toBe("number")

    const all = await getCachedItems()
    expect(all).toHaveLength(1)
    expect(all![0]!.id).toBe(1)
  })

  it("replaces the whole library", async () => {
    const { backend } = memoryBackend()
    configureTopicStarterCache({ primary: backend })
    await replaceCachedItems([row(1), row(2)])
    expect((await getCachedItems()!)?.map((r) => r.id)).toEqual([1, 2])

    await replaceCachedItems([row(9)])
    expect((await getCachedItems()!)?.map((r) => r.id)).toEqual([9])
  })

  it("tracks the full-download version separately from items", async () => {
    const { backend } = memoryBackend()
    configureTopicStarterCache({ primary: backend })
    await setCachedVersion("v1")
    expect(await getCachedVersion()).toBe("v1")

    await replaceCachedItems([row(1)])
    // Clearing items on replace must not clobber the version until a new download stamps it.
    expect(await getCachedVersion()).toBe("v1")

    await setCachedVersion("v2")
    expect(await getCachedVersion()).toBe("v2")
  })

  it("clears everything", async () => {
    const { backend } = memoryBackend()
    configureTopicStarterCache({ primary: backend })
    await replaceCachedItems([row(1), row(2)])
    await setCachedVersion("v1")
    await clearCachedItems()
    expect(await getCachedItems()).toBeNull()
    expect(await getCachedVersion()).toBeNull()
  })

  it("downloadFullTopicStarterLibrary stores every item and stamps the version", async () => {
    const { backend } = memoryBackend()
    configureTopicStarterCache({ primary: backend })
    const items = [row(1), row(2), { ...row(3), isFolder: true, content: "" }]
    const fetchImpl = vi.fn(async (): Promise<Response> => fakeResponse({ items }))
    await downloadFullTopicStarterLibrary({ fetchImpl, version: "bulk-1" })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect((await getCachedItems()!)?.map((r) => r.id)).toEqual([1, 2, 3])
    expect(await getCachedVersion()).toBe("bulk-1")
    expect((await getCachedItem(3))?.isFolder).toBe(true)
  })

  it("downloadFullTopicStarterLibrary throws on a bad response", async () => {
    const { backend } = memoryBackend()
    configureTopicStarterCache({ primary: backend })
    const fetchImpl = vi.fn(async (): Promise<Response> => fakeResponse({}, false, 500))
    await expect(downloadFullTopicStarterLibrary({ fetchImpl })).rejects.toThrow(/bulk export failed/)
  })

  it("resolveCachedTopic finds a row by numeric id and by name", async () => {
    const { backend } = memoryBackend()
    configureTopicStarterCache({ primary: backend })
    const items = [
      row(1, { title: "Energy", content: "aff", format: "cmir" }),
      row(2, { title: "Solar Aff", parentId: 1, content: "da", format: "cmir" }),
      row(3, { title: "Neg", content: "cp", format: "cmir" }),
    ]
    await replaceCachedItems(items)

    expect((await resolveCachedTopic("1"))?.id).toBe(1)
    expect((await resolveCachedTopic("Energy"))?.id).toBe(1)
    expect((await resolveCachedTopic("energy/solar-aff"))?.id).toBe(2)
    expect(await resolveCachedTopic("does-not-exist")).toBeNull()
    expect(await resolveCachedTopic("")).toBeNull()
  })
})
