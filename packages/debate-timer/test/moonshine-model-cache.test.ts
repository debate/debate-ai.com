import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  MOONSHINE_MODEL_FILES,
  downloadMoonshineModel,
  moonshineModelStatus,
  removeMoonshineModel,
  withMoonshineCache,
} from "../src/recorder/moonshine-model-cache"

/** An in-memory Cache Storage, enough for match / put / delete / keys. */
function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>()
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map())
    const store = stores.get(name)!
    return {
      match: async (url: string) => store.get(url)?.clone(),
      put: async (url: string, res: Response) => {
        store.set(url, new Response(await res.arrayBuffer(), { headers: res.headers }))
      },
      delete: async (url: string) => store.delete(url),
      keys: async () => [...store.keys()].map((url) => new Request(url)),
    }
  }
  return { stores, api: { has: async (name: string) => stores.has(name), open } }
}

function fileResponse(text: string): Response {
  return new Response(text, { headers: { "content-length": String(text.length) } })
}

let caches: ReturnType<typeof fakeCaches>

beforeEach(() => {
  caches = fakeCaches()
  vi.stubGlobal("caches", caches.api)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("moonshine model cache", () => {
  it("reports nothing before a download", async () => {
    expect(await moonshineModelStatus()).toEqual({ downloaded: false, bytes: 0 })
  })

  it("downloads both files with progress, then reports them, then removes them", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => fileResponse(`model:${String(url)}`))
    const progress: number[] = []
    await downloadMoonshineModel((f) => progress.push(f), fetchImpl as typeof fetch)
    expect(fetchImpl).toHaveBeenCalledTimes(MOONSHINE_MODEL_FILES.length)
    expect(progress.at(-1)).toBe(1)
    const status = await moonshineModelStatus()
    expect(status.downloaded).toBe(true)
    expect(status.bytes).toBe(MOONSHINE_MODEL_FILES.reduce((n, url) => n + `model:${url}`.length, 0))

    // A second download fetches nothing.
    await downloadMoonshineModel(undefined, fetchImpl as typeof fetch)
    expect(fetchImpl).toHaveBeenCalledTimes(MOONSHINE_MODEL_FILES.length)

    await removeMoonshineModel()
    expect((await moonshineModelStatus()).downloaded).toBe(false)
  })

  it("rejects a failed download", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 503 }))
    await expect(downloadMoonshineModel(undefined, fetchImpl as typeof fetch)).rejects.toThrow("503")
  })

  it("serves the model files from the cache while loading, caching misses, and restores fetch", async () => {
    const network = vi.fn(async (input: RequestInfo | URL) => fileResponse(`net:${String(input)}`))
    vi.stubGlobal("fetch", network)
    const [encoder, decoder] = MOONSHINE_MODEL_FILES
    await (await caches.api.open("debate-ai-models")).put(encoder, fileResponse("cached-encoder"))

    const texts = await withMoonshineCache(async () => [
      await (await fetch(encoder)).text(),
      await (await fetch(decoder)).text(),
      await (await fetch("https://example.com/other")).text(),
    ])
    expect(texts).toEqual(["cached-encoder", `net:${decoder}`, "net:https://example.com/other"])
    expect(network).toHaveBeenCalledTimes(2)
    expect(globalThis.fetch).toBe(network)
    await vi.waitFor(async () => expect((await moonshineModelStatus()).downloaded).toBe(true))
  })
})
