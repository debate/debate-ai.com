import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const grabMock = vi.fn()
const setupDevToolsMock = vi.fn()

/** Stands in for the grab module's own `grab`, log and all, as a browser sees it. */
const grabModuleDefault = Object.assign(
  (...args: unknown[]) => grabMock(...args),
  { log: [] as unknown[] },
)

vi.mock("grab-url/slim", () => ({
  default: grabModuleDefault,
  setupDevTools: () => setupDevToolsMock(),
}))

const { attachDevTools, createClient, DEFAULT_BASE_URL, DEFAULT_GRAB_OPTIONS } =
  await import("../src/client")

describe("createClient", () => {
  beforeEach(() => {
    grabMock.mockReset()
  })

  it("defaults to the Debate AI API origin", () => {
    const client = createClient()
    expect(client.getConfig().baseUrl).toBe(DEFAULT_BASE_URL)
  })

  it("substitutes path params and appends a query string for GET", async () => {
    grabMock.mockResolvedValue({ data: { ok: true } })
    const client = createClient()

    await client.request({
      url: "/coach-materials/{materialId}",
      path: { materialId: "abc 123" },
      query: { include: "notes", tags: ["a", "b"] },
    })

    const [url, options] = grabMock.mock.calls[0]
    expect(url).toBe("/coach-materials/abc%20123?include=notes&tags=a&tags=b")
    expect(options.method).toBe("GET")
    expect(options.baseURL).toBe(DEFAULT_BASE_URL)
  })

  it("JSON-serializes the body for POST/PUT/PATCH and ignores query", async () => {
    grabMock.mockResolvedValue({ data: { created: true } })
    const client = createClient()

    await client.request({
      url: "/coach-materials",
      method: "POST",
      body: { title: "New material" },
    })

    const [url, options] = grabMock.mock.calls[0]
    expect(url).toBe("/coach-materials")
    expect(options.method).toBe("POST")
    expect(options.body).toBe(JSON.stringify({ title: "New material" }))
  })

  it("maps a grab error onto RequestResult.error instead of throwing", async () => {
    grabMock.mockResolvedValue({ error: "HTTP error: 404 Not Found" })
    const client = createClient()

    const result = await client.request({ url: "/missing" })

    expect(result.error).toBe("HTTP error: 404 Not Found")
    expect(result.data).toBeUndefined()
  })

  it("merges setConfig headers instead of replacing them", () => {
    const client = createClient({ headers: { "X-A": "1" } })
    const next = client.setConfig({ headers: { "X-B": "2" } })
    expect(next.headers).toEqual({ "X-A": "1", "X-B": "2" })
  })

  it("sends the default grab options on a read", async () => {
    grabMock.mockResolvedValue({ data: {} })
    await createClient().request({ url: "/user-settings" })

    expect(grabMock.mock.calls[0][1]).toMatchObject(DEFAULT_GRAB_OPTIONS)
  })

  it("drops the cache and retry defaults on a write", async () => {
    grabMock.mockResolvedValue({ data: {} })
    await createClient().request({ url: "/analyze", method: "POST", body: {} })

    const options = grabMock.mock.calls[0][1]
    expect(options.cache).toBeUndefined()
    expect(options.cacheForTime).toBeUndefined()
    expect(options.retryAttempts).toBeUndefined()
    // A timeout is safe on any method, so it stays.
    expect(options.timeout).toBe(DEFAULT_GRAB_OPTIONS.timeout)
  })

  it("keeps a client-wide cache and retry setting off writes", async () => {
    grabMock.mockResolvedValue({ data: {} })
    const client = createClient({ grab: { cache: true, retryAttempts: 5 } })
    await client.request({ url: "/analyze", method: "POST", body: {} })

    const options = grabMock.mock.calls[0][1]
    expect(options.cache).toBeUndefined()
    expect(options.retryAttempts).toBeUndefined()
  })

  it("applies a client-wide cache and retry setting to reads", async () => {
    grabMock.mockResolvedValue({ data: {} })
    const client = createClient({ grab: { cache: true, retryAttempts: 5 } })
    await client.request({ url: "/user-settings" })

    expect(grabMock.mock.calls[0][1]).toMatchObject({ cache: true, retryAttempts: 5 })
  })

  it("lets a single write opt into caching and retries", async () => {
    grabMock.mockResolvedValue({ data: {} })
    const client = createClient()
    await client.request({
      url: "/analyze",
      method: "POST",
      body: {},
      grab: { cache: true, retryAttempts: 5 },
    })

    expect(grabMock.mock.calls[0][1]).toMatchObject({ cache: true, retryAttempts: 5 })
  })

  it("lets a per-call grab option override the defaults", async () => {
    grabMock.mockResolvedValue({ data: {} })
    const client = createClient({ grab: { cacheForTime: 120 } })
    await client.request({ url: "/user-settings", grab: { cache: false } })

    expect(grabMock.mock.calls[0][1]).toMatchObject({ cache: false, cacheForTime: 120 })
  })
})

describe("attachDevTools", () => {
  beforeEach(() => {
    setupDevToolsMock.mockReset()
    delete (globalThis as Record<string, any>).grab
    delete (globalThis as Record<string, any>).__grabDevToolsAttached
  })

  it("reports no inspector when there is no DOM to attach it to", () => {
    expect(attachDevTools()).toBe(false)
    expect(setupDevToolsMock).not.toHaveBeenCalled()
  })

  describe("with a DOM", () => {
    beforeEach(() => {
      vi.stubGlobal("document", {})
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it("publishes grab globally so the inspector has a log to read", () => {
      expect(attachDevTools()).toBe(true)
      expect((globalThis as Record<string, any>).grab).toBe(grabModuleDefault)
      expect(setupDevToolsMock).toHaveBeenCalledTimes(1)
    })

    it("installs the shortcut once, however many clients are created", () => {
      createClient()
      createClient()
      attachDevTools()

      expect(setupDevToolsMock).toHaveBeenCalledTimes(1)
    })

    it("leaves the shortcut to grab when its own import already published it", () => {
      ;(globalThis as Record<string, any>).grab = grabModuleDefault

      expect(attachDevTools()).toBe(true)
      expect(setupDevToolsMock).not.toHaveBeenCalled()
    })

    it("keeps an app's own global grab, and its log, in place", () => {
      const appGrab = Object.assign(() => {}, { log: ["earlier request"] })
      ;(globalThis as Record<string, any>).grab = appGrab

      attachDevTools()

      expect((globalThis as Record<string, any>).grab).toBe(appGrab)
    })

    it("stays out of the way when a client opts out", () => {
      createClient({ devtools: false })
      expect(setupDevToolsMock).not.toHaveBeenCalled()
    })
  })
})
