// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  bulkStorage,
  configureBulkStorage,
  connectExtensionBackend,
  getBulkItem,
  getBulkStorageStatus,
  hydrateBulkStorage,
  removeBulkItem,
  resetBulkStorageForTests,
  setBulkItem,
  type BulkStorageBackend,
} from "../src/state/bulk-storage"

/** An in-memory backend, optionally refusing every call. */
function memoryBackend(initial: Record<string, string> = {}, fail = false) {
  const data = new Map(Object.entries(initial))
  const backend: BulkStorageBackend = {
    async getMany(keys) {
      if (fail) throw new Error("down")
      return Object.fromEntries(keys.map((k) => [k, data.get(k) ?? null]))
    },
    async set(key, value) {
      if (fail) throw new Error("down")
      data.set(key, value)
    },
    async remove(key) {
      if (fail) throw new Error("down")
      data.delete(key)
    },
  }
  return { backend, data }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  resetBulkStorageForTests()
  localStorage.clear()
})
afterEach(() => resetBulkStorageForTests())

describe("bulk storage without a durable backend", () => {
  it("reads and writes straight through localStorage", async () => {
    await hydrateBulkStorage()
    setBulkItem("flows", "[1]")
    expect(localStorage.getItem("flows")).toBe("[1]")
    localStorage.setItem("flows", "[2]")
    expect(getBulkItem("flows")).toBe("[2]")
    removeBulkItem("flows")
    expect(getBulkItem("flows")).toBeNull()
  })

  it("keeps a value localStorage refuses in memory, without throwing", () => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError")
    }
    try {
      expect(() => setBulkItem("flows", "[big]")).not.toThrow()
      expect(getBulkItem("flows")).toBe("[big]")
    } finally {
      Storage.prototype.setItem = original
    }
  })
})

describe("bulk storage over IndexedDB", () => {
  it("migrates a legacy localStorage value into the backend and frees it", async () => {
    const { backend, data } = memoryBackend()
    configureBulkStorage({ primary: backend })
    localStorage.setItem("flows", "[legacy]")
    localStorage.setItem("theme", "dark")

    await hydrateBulkStorage()

    expect(data.get("flows")).toBe("[legacy]")
    expect(localStorage.getItem("flows")).toBeNull()
    expect(localStorage.getItem("theme")).toBe("dark")
    expect(getBulkItem("flows")).toBe("[legacy]")
  })

  it("prefers the backend's value and drops a stale legacy copy", async () => {
    const { backend } = memoryBackend({ rounds: "[new]" })
    configureBulkStorage({ primary: backend })
    localStorage.setItem("rounds", "[old]")
    await hydrateBulkStorage()
    expect(getBulkItem("rounds")).toBe("[new]")
    expect(localStorage.getItem("rounds")).toBeNull()
  })

  it("writes through without touching localStorage", async () => {
    const { backend, data } = memoryBackend()
    configureBulkStorage({ primary: backend })
    await hydrateBulkStorage()
    bulkStorage.setItem("flow-history", "[h]")
    expect(getBulkItem("flow-history")).toBe("[h]")
    await flush()
    expect(data.get("flow-history")).toBe("[h]")
    expect(localStorage.getItem("flow-history")).toBeNull()

    bulkStorage.removeItem("flow-history")
    await flush()
    expect(getBulkItem("flow-history")).toBeNull()
    expect(data.has("flow-history")).toBe(false)
  })

  it("does not let a write made during hydration be overwritten", async () => {
    const { backend } = memoryBackend({ flows: "[stored]" })
    configureBulkStorage({ primary: backend })
    const loading = hydrateBulkStorage()
    setBulkItem("flows", "[edited]")
    await loading
    expect(getBulkItem("flows")).toBe("[edited]")
  })

  it("restores a key the primary lost from the extension mirror", async () => {
    const primary = memoryBackend()
    const mirror = memoryBackend({ flows: "[from-extension]" })
    configureBulkStorage({ primary: primary.backend, mirror: mirror.backend })
    await hydrateBulkStorage()
    expect(getBulkItem("flows")).toBe("[from-extension]")
    expect(primary.data.get("flows")).toBe("[from-extension]")
  })

  it("mirrors writes into the extension", async () => {
    const primary = memoryBackend()
    const mirror = memoryBackend()
    configureBulkStorage({ primary: primary.backend, mirror: mirror.backend })
    await hydrateBulkStorage()
    setBulkItem("rounds", "[r]")
    await flush()
    expect(mirror.data.get("rounds")).toBe("[r]")
  })

  it("falls back to localStorage when the backend refuses a write", async () => {
    const { backend } = memoryBackend({}, true)
    configureBulkStorage({ primary: backend })
    await hydrateBulkStorage()
    setBulkItem("flows", "[x]")
    await flush()
    expect(getBulkItem("flows")).toBe("[x]")
    expect(localStorage.getItem("flows")).toBe("[x]")
  })

  it("reports where data lives", async () => {
    configureBulkStorage({ primary: memoryBackend().backend, mirror: memoryBackend().backend })
    await hydrateBulkStorage()
    const status = await getBulkStorageStatus()
    expect(status.backend).toBe("indexeddb")
    expect(status.extensionConnected).toBe(true)
  })
})

describe("connectExtensionBackend", () => {
  function fakeRuntime(handler: (message: any) => unknown) {
    return {
      lastError: undefined as unknown,
      sendMessage(_id: string, message: unknown, callback: (response: unknown) => void) {
        queueMicrotask(() => callback(handler(message)))
      },
    }
  }

  it("resolves null when there is no extension runtime", async () => {
    expect(await connectExtensionBackend("id", null)).toBeNull()
  })

  it("resolves null when the extension does not answer the ping", async () => {
    expect(await connectExtensionBackend("id", fakeRuntime(() => undefined))).toBeNull()
  })

  it("speaks the bridge protocol", async () => {
    const store = new Map<string, string>()
    const runtime = fakeRuntime((message) => {
      expect(message.type).toBe("debate-ai:bulk-storage")
      if (message.op === "ping") return { ok: true }
      if (message.op === "set") store.set(message.key, message.value)
      if (message.op === "remove") store.delete(message.key)
      if (message.op === "get") {
        return { ok: true, values: Object.fromEntries(message.keys.map((k: string) => [k, store.get(k) ?? null])) }
      }
      return { ok: true }
    })
    const backend = await connectExtensionBackend("id", runtime)
    expect(backend).not.toBeNull()
    await backend!.set("flows", "[1]")
    expect(await backend!.getMany(["flows", "rounds"])).toEqual({ flows: "[1]", rounds: null })
    await backend!.remove("flows")
    expect(store.has("flows")).toBe(false)
  })
})
